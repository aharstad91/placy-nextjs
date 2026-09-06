/**
 * Setter sammen boardets deterministiske fakta: skolekrets fra registeret,
 * holdeplasser og linjer fra Entur, og bussetider til sentrum og til byens
 * videregående skoler.
 *
 * DELINGEN: `school-facts.ts` kan Udir, `transit-facts.ts` kan Entur, og ingen
 * av dem vet om den andre. Her møtes de — hvem det er verdt å reise til er et
 * redaksjonelt valg (sentrum, og de nærmeste videregående), og det hører hjemme
 * ett sted, ikke inne i to leverandørmoduler.
 *
 * Fail-soft hele veien: hver kilde som svikter tar bare med seg sitt eget svar.
 * Et board uten transittfakta er et board der transport-FAQ-en utelates, ikke
 * et board som feiler.
 */

import {
  fetchSchoolFacts,
  MAX_VIDEREGAENDE,
  type KretsSchoolFact,
  type VideregaendeFact,
} from "@/lib/pipeline/school-facts";
import { WEEKDAYS, WEEKEND_NIGHTS } from "@/lib/pipeline/oslo-time";
import {
  countDeparturesInWindow,
  fetchDepartureWindow,
  fetchLastDepartureHome,
  fetchTransitFacts,
  FREQUENCY_WINDOWS,
  resolveCityCentreStop,
  velgSentrumsretning,
  type TransitDestination,
  type TransitTrip,
} from "@/lib/pipeline/transit-facts";
import type { BoardKretsSchool, BoardVideregaende, ReportBoardFacts } from "@/lib/types";

const CITY_CENTRE_KEY = "sentrum";
const vgsKey = (orgnr: string) => `vgs:${orgnr}`;
const kretsKey = (kind: "barneskole" | "ungdomsskole") => `krets:${kind}`;
const workplaceKey = (navn: string) => `arbeid:${navn}`;

/**
 * Byens store arbeidsplasser, som reisemål.
 *
 * REDAKSJONELT VALG, IKKE ET REGISTEROPPSLAG. Spørsmålet er «hvor lang tid tar
 * det på jobb», og det finnes ikke noe register over hvor folk jobber. Lista er
 * de arbeidsplassene som sysselsetter nok folk til at en tilfeldig kjøper
 * kjenner seg igjen: sykehuset, universitetet, det store næringsområdet.
 *
 * Nøkkelen er kommunenavnet i småbokstaver. En by uten oppføring får ingen
 * arbeidsplass-rad, og det er riktig — å gjette tre store arbeidsplasser i en
 * kommune vi ikke kjenner ville vært å dikte.
 */
const WORKPLACES_BY_CITY: Record<
  string,
  ReadonlyArray<{ navn: string; lat: number; lng: number }>
> = {
  trondheim: [
    { navn: "St. Olavs hospital", lat: 63.4203, lng: 10.3776 },
    { navn: "NTNU Gløshaugen", lat: 63.4189, lng: 10.4034 },
    { navn: "Sluppen", lat: 63.4022, lng: 10.3833 },
  ],
};

/** Så mange arbeidsplasser vi henter reise til. Malen navngir færre. */
const MAX_WORKPLACES = 3;

export interface BoardFactsResult {
  /** Undefined når ingen kilde ga noe — da skrives ingenting til config. */
  facts?: ReportBoardFacts;
  warnings: string[];
}

export async function computeBoardFacts(options: {
  lat: number;
  lng: number;
  /**
   * Kommunen adressen ligger i, fra Kartverket. FØRSTEVALG for å slå opp
   * sentrumsstoppet: geokoderens `city` er STEDSNAVNET, og for en forstad er
   * det forstaden. Strindfjordvegen 10 geokoder til «Ranheim», og «hvordan
   * kommer jeg meg til byen?» ville da blitt besvart med reisen til Ranheim
   * stasjon — teknisk et svar, og feil spørsmål.
   */
  kommunenavn?: string;
  /** Fallback når kommuneoppslaget feilet. Uten begge utelates reisen til byen. */
  city?: string;
  /** Uten kommunenummer utelates skolefaktaene (kretspolygonene er per kommune). */
  kommunenummer?: string;
  /** Injiserbar for tester. */
  now?: Date;
}): Promise<BoardFactsResult> {
  const { lat, lng, kommunenummer, now } = options;
  const city = options.kommunenavn ?? options.city;
  const warnings: string[] = [];

  // 1. Skolene først: de videregående blir reisemål i transitt-oppslaget.
  const schools = kommunenummer
    ? await fetchSchoolFacts({ lat, lng, kommunenummer })
    : { facts: { videregaaende: [] as VideregaendeFact[] }, warnings: [] };
  warnings.push(...schools.warnings);

  // 2. Sentrumsstoppet. Slås opp på bynavn slik at logikken ikke er
  //    Trondheim-spesifikk; feiler oppslaget, utelates spørsmålet.
  let cityCentre: { id: string; label: string } | null = null;
  if (city) {
    try {
      cityCentre = await resolveCityCentreStop(city);
      if (!cityCentre) {
        warnings.push(`ℹ️  Fant ikke et sentrumsstoppested for «${city}» — reisen til byen utelates`);
      }
    } catch (e) {
      warnings.push(
        `⚠️  Oppslag av sentrumsstoppested for «${city}» feilet (${message(e)})`,
      );
    }
  }

  const destinations: TransitDestination[] = [];
  if (cityCentre) {
    destinations.push({ key: CITY_CENTRE_KEY, label: cityCentre.label, place: cityCentre.id });
  }
  for (const vgs of schools.facts.videregaaende.slice(0, MAX_VIDEREGAENDE)) {
    destinations.push({
      key: vgsKey(vgs.orgnr),
      label: vgs.navn,
      lat: vgs.koordinat.lat,
      lng: vgs.koordinat.lng,
    });
  }
  // Kretsskolene som reisemål. Ikke for reisetiden — den precomputes som gange
  // på POI-en — men for GANGRUTENS LENGDE. Skoleskyss-retten måles i meter
  // langs vegen, og Enturs gå-mønster er det eneste stedet vi har det tallet.
  for (const kind of ["barneskole", "ungdomsskole"] as const) {
    const skole = schools.facts[kind];
    if (skole?.koordinat) {
      destinations.push({
        key: kretsKey(kind),
        label: skole.navn,
        lat: skole.koordinat.lat,
        lng: skole.koordinat.lng,
      });
    }
  }
  const workplaces = city
    ? (WORKPLACES_BY_CITY[city.toLocaleLowerCase("nb-NO")] ?? []).slice(0, MAX_WORKPLACES)
    : [];
  for (const wp of workplaces) {
    destinations.push({ key: workplaceKey(wp.navn), label: wp.navn, lat: wp.lat, lng: wp.lng });
  }

  // 3. Transitt.
  const transit = await fetchTransitFacts({ lat, lng, destinations, now });
  warnings.push(...transit.warnings);

  const tripByKey = new Map<string, TransitTrip>(transit.facts.trips.map((t) => [t.key, t]));

  // Videregående sorteres på REISETID, ikke på luftlinje. Spørsmålet er «hvor
  // lang tid tar bussen», og på Ranheim er den nærmeste i luftlinje (1,9 km)
  // 25 minutter unna mens en skole 2,2 km unna tar 12 — luftlinja ville gitt
  // et svar som er sant og samtidig villedende. Skoler uten funnet reise havner
  // sist, sortert på avstand seg imellom.
  const videregaaende: BoardVideregaende[] = schools.facts.videregaaende
    .map((vgs) => ({
      navn: vgs.navn,
      orgnr: vgs.orgnr,
      offentlig: vgs.offentlig,
      distanceM: vgs.distanceM,
      patterns: tripByKey.get(vgsKey(vgs.orgnr))?.patterns ?? [],
    }))
    .sort((a, b) => {
      const am = a.patterns[0]?.minutes ?? Number.POSITIVE_INFINITY;
      const bm = b.patterns[0]?.minutes ?? Number.POSITIVE_INFINITY;
      if (am !== bm) return am - bm;
      return a.distanceM - b.distanceM;
    });

  const centreTrip = tripByKey.get(CITY_CENTRE_KEY);

  // 4. Gangruta til kretsskolen. BARE et mønster som er helt til fots teller:
  //    et mønster med buss måler gangen til holdeplassen, og skoleskyss-retten
  //    måles langs hele skoleveien.
  const gangMeterTil = (kind: "barneskole" | "ungdomsskole"): number | undefined => {
    const tilFots = tripByKey
      .get(kretsKey(kind))
      ?.patterns.find((p) => p.lines.length === 0 && p.walkMeters > 0);
    return tilFots ? Math.round(tilFots.walkMeters) : undefined;
  };

  const arbeidsplasser = workplaces
    .map((wp) => ({ navn: wp.navn, patterns: tripByKey.get(workplaceKey(wp.navn))?.patterns ?? [] }))
    .filter((wp) => wp.patterns.length > 0);

  // 5. Frekvens og siste avgang hjem. Begge er egne Entur-oppslag på andre
  //    tidspunkter enn rushtimen, og begge er fail-soft hver for seg.
  const sentrumsLinjer = centreTrip?.patterns[0]?.lines ?? [];
  const naermesteStopp = transit.facts.stops[0];
  let frequency: ReportBoardFacts["frequency"];
  if (naermesteStopp) {
    try {
      const [morgen, kveld] = await Promise.all([
        fetchDepartureWindow({
          stopPlaceId: naermesteStopp.stopPlaceId,
          ...FREQUENCY_WINDOWS.morgen,
          weekdays: WEEKDAYS,
          now,
        }),
        fetchDepartureWindow({
          stopPlaceId: naermesteStopp.stopPlaceId,
          ...FREQUENCY_WINDOWS.kveld,
          weekdays: WEEKDAYS,
          now,
        }),
      ]);
      const retning = velgSentrumsretning(naermesteStopp, sentrumsLinjer, morgen.calls);
      // Uten et skilt å navngi er tallet hjemløst — «det går 14 avganger» sier
      // ikke hvorhen, og retningen ER halve svaret.
      if (retning?.destinations[0]) {
        frequency = {
          stopPlaceId: naermesteStopp.stopPlaceId,
          stopName: naermesteStopp.name,
          retning: retning.destinations[0],
          morgen: {
            ...FREQUENCY_WINDOWS.morgen,
            avganger: countDeparturesInWindow(
              morgen.calls,
              retning.quayId,
              FREQUENCY_WINDOWS.morgen.fraTime,
              FREQUENCY_WINDOWS.morgen.tilTime,
            ),
          },
          kveld: {
            ...FREQUENCY_WINDOWS.kveld,
            avganger: countDeparturesInWindow(
              kveld.calls,
              retning.quayId,
              FREQUENCY_WINDOWS.kveld.fraTime,
              FREQUENCY_WINDOWS.kveld.tilTime,
            ),
          },
        };
      }
    } catch (e) {
      warnings.push(`⚠️  Entur avgangstelling feilet (${message(e)}) — frekvenssvaret utelates`);
    }
  }

  let lastDeparture: ReportBoardFacts["lastDeparture"];
  if (cityCentre && naermesteStopp) {
    try {
      const [hverdag, helg] = await Promise.all([
        fetchLastDepartureHome({
          centreStopPlaceId: cityCentre.id,
          homeLat: lat,
          homeLng: lng,
          weekdays: WEEKDAYS,
          now,
        }),
        fetchLastDepartureHome({
          centreStopPlaceId: cityCentre.id,
          homeLat: lat,
          homeLng: lng,
          weekdays: WEEKEND_NIGHTS,
          now,
        }),
      ]);
      if (hverdag || helg) {
        // Holdeplassen hver reise faktisk ender på. Den kan være en annen enn
        // boligens nærmeste — den siste turen hjem er ofte en annen linje til
        // et annet stopp, og resten går man.
        lastDeparture = {
          fraNavn: cityCentre.label,
          ...(hverdag ? { hverdag } : {}),
          ...(helg ? { helg } : {}),
        };
      }
    } catch (e) {
      warnings.push(`⚠️  Entur siste avgang feilet (${message(e)}) — svaret utelates`);
    }
  }

  const hasSchools =
    Boolean(schools.facts.barneskole) ||
    Boolean(schools.facts.ungdomsskole) ||
    videregaaende.length > 0;
  const hasTransit = transit.facts.stops.length > 0 || Boolean(centreTrip);

  if (!hasSchools && !hasTransit) {
    warnings.push("ℹ️  Ingen board-fakta å skrive — verken skole- eller transittkilder ga svar");
    return { warnings };
  }

  const facts: ReportBoardFacts = {
    factsVersion: 1,
    fetchedAt: (now ?? new Date()).toISOString(),
    departureAt: transit.facts.departureAt,
    stops: transit.facts.stops,
    ...(centreTrip && cityCentre
      ? { cityCentre: { name: cityCentre.label, patterns: centreTrip.patterns } }
      : {}),
    ...(hasSchools
      ? {
          schools: {
            ...(schools.facts.barneskole
              ? { barneskole: medGangMeter(schools.facts.barneskole, gangMeterTil("barneskole")) }
              : {}),
            ...(schools.facts.ungdomsskole
              ? {
                  ungdomsskole: medGangMeter(
                    schools.facts.ungdomsskole,
                    gangMeterTil("ungdomsskole"),
                  ),
                }
              : {}),
            videregaaende,
          },
        }
      : {}),
    ...(arbeidsplasser.length > 0 ? { workplaces: arbeidsplasser } : {}),
    ...(frequency ? { frequency } : {}),
    ...(lastDeparture ? { lastDeparture } : {}),
  };

  return { facts, warnings };
}

/** Kretsskolen med gangruta påsatt. `koordinat` hører til pipelinen, ikke boardet. */
function medGangMeter(
  skole: KretsSchoolFact,
  gangMeter: number | undefined,
): BoardKretsSchool {
  const { koordinat: _koordinat, ...rest } = skole;
  return { ...rest, ...(gangMeter ? { gangMeter } : {}) };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}
