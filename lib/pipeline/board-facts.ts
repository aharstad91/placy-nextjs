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
  type VideregaendeFact,
} from "@/lib/pipeline/school-facts";
import {
  fetchTransitFacts,
  resolveCityCentreStop,
  type TransitDestination,
  type TransitTrip,
} from "@/lib/pipeline/transit-facts";
import type { BoardVideregaende, ReportBoardFacts } from "@/lib/types";

const CITY_CENTRE_KEY = "sentrum";
const vgsKey = (orgnr: string) => `vgs:${orgnr}`;

export interface BoardFactsResult {
  /** Undefined når ingen kilde ga noe — da skrives ingenting til config. */
  facts?: ReportBoardFacts;
  warnings: string[];
}

export async function computeBoardFacts(options: {
  lat: number;
  lng: number;
  /** Brukes til å slå opp sentrumsstoppet. Uten by utelates reisen til byen. */
  city?: string;
  /** Uten kommunenummer utelates skolefaktaene (kretspolygonene er per kommune). */
  kommunenummer?: string;
  /** Injiserbar for tester. */
  now?: Date;
}): Promise<BoardFactsResult> {
  const { lat, lng, city, kommunenummer, now } = options;
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
            ...(schools.facts.barneskole ? { barneskole: schools.facts.barneskole } : {}),
            ...(schools.facts.ungdomsskole ? { ungdomsskole: schools.facts.ungdomsskole } : {}),
            videregaaende,
          },
        }
      : {}),
  };

  return { facts, warnings };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}
