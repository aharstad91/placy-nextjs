/**
 * Build-time transittfakta fra Entur journey-planner.
 *
 * HVORFOR DETTE FINNES: reisetidene vi precomputer i pipelinen er GANGE og bare
 * gange — Mapbox Matrix har ingen kollektivprofil. Entur-importen lagrer
 * holdeplassen som et POI, men ikke hvilke linjer som går derfra. Og
 * `/api/entur` er en sanntidsrute for kart-popupene, ikke en build-time-kilde.
 * Resultatet var at boardet ikke kunne svare på de to spørsmålene en
 * boligkjøper stiller først: hvor er nærmeste holdeplass, og hvor lang tid tar
 * det til byen.
 *
 * Queryene er tilpasset fra `app/api/entur/route.ts`, ikke kopiert: de er
 * sanntids-orienterte og svarer «hva går nå». Her spør vi om et REPRESENTATIVT
 * tidspunkt — neste hverdag kl. 08:00 norsk tid (`oslo-time.ts`) — via
 * `startTime`/`timeRange` på avgangene og `dateTime` på reisene. Uten det ville
 * en provisjonering kjørt kl. 23 gitt nattbuss-svar.
 *
 * QUAY-GRUPPERING ER OBLIGATORISK
 * (`docs/solutions/integration-issues/entur-quay-direction-grouping-Report-20260410.md`):
 * `estimatedCalls` på et stoppested blander retninger, så «linje 20 mot
 * Grillstad» og «linje 20 mot Romolslia» ser ut som samme tilbud. En beboer som
 * skal til byen trenger å vite hvilken side av vegen hun skal stå på.
 *
 * FAIL-SOFT: modulen kaster aldri. Delvise fakta er gyldige — mister vi
 * reisen til sentrum, står holdeplassene fortsatt, og FAQ-en utelater bare det
 * spørsmålet den ikke har svar på.
 *
 * Entur er gratis og uten nøkkel; døgntaket for betalte API-kall berøres ikke.
 * `ET-Client-Name` er påkrevd av Entur og identifiserer oss.
 */

import { nextOsloDayAt, nextWeekdayRushHour } from "@/lib/pipeline/oslo-time";

const JOURNEY_PLANNER_URL = "https://api.entur.io/journey-planner/v3/graphql";
const GEOCODER_URL = "https://api.entur.io/geocoder/v1/autocomplete";
const CLIENT_NAME = "placy-board-facts";

/** Timeout per kall. Provisjoneringen skal ikke henge på en treg leverandør. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Hvor langt vi leter etter holdeplasser. 700 m er ~9 minutters gange — grensa
 * der en holdeplass slutter å være «din» holdeplass. På Grilstad gir det fire
 * stopp; i Midtbyen ville det gitt titalls, derfor taket under.
 */
export const NEARBY_RADIUS_M = 700;

/** Så mange holdeplasser FAQ-en kan nevne før svaret blir en liste. */
export const MAX_STOPS = 4;

/** Avgangsvindu vi sampler linjer fra: to timer fra rushtidspunktet. */
const DEPARTURE_WINDOW_S = 7_200;

/** Avganger per quay i vinduet. Nok til å fange alle linjer, ikke en ruteplan. */
const DEPARTURES_PER_QUAY = 30;

/** Reisealternativer per destinasjon. Malen velger blant dem ved render. */
const TRIP_PATTERNS = 3;

// ── Fakta-former ────────────────────────────────────────────────────────────

/** Én retning fra en holdeplass — én quay, altså én side av vegen. */
export interface TransitDirection {
  quayId: string;
  /** Destinasjonene skiltene faktisk viser, i frekvensrekkefølge. */
  destinations: string[];
  /** Linjekoder som betjener retningen, sortert. */
  lines: string[];
}

export interface TransitStopFact {
  /** Rå NSR-id med kolon (`NSR:StopPlace:60260`) — matcher `POI.enturStopplaceId`. */
  stopPlaceId: string;
  name: string;
  /** Luftlinje fra boligen, i meter. */
  distanceM: number;
  /** `bus`, `rail`, `tram` … slik Entur oppgir dem. */
  modes: string[];
  directions: TransitDirection[];
}

/** Ett reisealternativ. Minutter er avrundet opp, som i travel-times. */
export interface TransitPattern {
  minutes: number;
  /** Linjekoder i rekkefølge. Tom = hele reisen til fots. */
  lines: string[];
  transfers: number;
  walkMeters: number;
}

export interface TransitTrip {
  /** Kallerens nøkkel — brukes til å koble reisen til det den handler om. */
  key: string;
  label: string;
  /** Sortert på reisetid, raskeste først. Tom liste = ingen reise funnet. */
  patterns: TransitPattern[];
}

export interface TransitFacts {
  /** ISO-8601 med offset. Tidspunktet oppslagene gjelder for. */
  departureAt: string;
  stops: TransitStopFact[];
  trips: TransitTrip[];
}

export interface TransitDestination {
  key: string;
  label: string;
  /** Enten et NSR-stoppested eller en koordinat. */
  place?: string;
  lat?: number;
  lng?: number;
}

export interface TransitFactsResult {
  facts: TransitFacts;
  warnings: string[];
}

// ── Rene parsere ────────────────────────────────────────────────────────────
//
// Skilt fra fetch slik at de kan testes mot ekte lagrede responskropper uten
// nett — samme oppdeling som `udir-register.ts`.

interface RawNearestEdge {
  distance?: number;
  place?: {
    id?: string;
    name?: string;
    transportMode?: string[] | null;
  } | null;
}

export function parseNearestStops(raw: unknown, max = MAX_STOPS): TransitStopFact[] {
  const edges = extractArray(raw, ["nearest", "edges"]);
  const out: TransitStopFact[] = [];
  for (const edge of edges) {
    const node = (edge as { node?: RawNearestEdge })?.node;
    const place = node?.place;
    if (!place?.id || !place.name) continue;
    if (out.some((s) => s.stopPlaceId === place.id)) continue;
    out.push({
      stopPlaceId: place.id,
      name: place.name,
      distanceM: Math.round(node?.distance ?? 0),
      modes: Array.isArray(place.transportMode) ? place.transportMode : [],
      directions: [],
    });
    if (out.length >= max) break;
  }
  return out;
}

interface RawCall {
  aimedDepartureTime?: string | null;
  destinationDisplay?: { frontText?: string | null } | null;
  serviceJourney?: { line?: { publicCode?: string | null } | null } | null;
}

/** Én avgang, flatet ut av quay-strukturen. */
export interface DepartureCall {
  quayId: string;
  /** Lokal veggklokke i minutter etter midnatt, 0–1439. */
  minutt: number;
  /** Datodelen av avgangen, `YYYY-MM-DD`, slik Entur skrev den. */
  dato: string;
  line: string | null;
  destination: string | null;
}

/**
 * Klokkeslettet slik det står på skiltet, uten tidssone-regning.
 *
 * `aimedDepartureTime` er ISO med offset («2026-09-07T23:45:00+02:00»), og
 * offseten ER Europe/Oslo. Å parse den gjennom `Date` og lese timen tilbake
 * ville gitt maskinens tidssone, ikke holdeplassens — en byggeserver i UTC
 * hadde flyttet siste avgang to timer. Derfor leses veggklokka rett ut av
 * strengen.
 */
export function parseLocalClock(iso: string): { dato: string; minutt: number } | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return { dato: m[1], minutt: Number(m[2]) * 60 + Number(m[3]) };
}

/** Alle avgangene i svaret, flatet ut. Kaller som vil ha per quay, filtrerer selv. */
export function parseDepartureCalls(raw: unknown): DepartureCall[] {
  const out: DepartureCall[] = [];
  for (const q of extractArray(raw, ["stopPlace", "quays"])) {
    const quay = q as { id?: string; estimatedCalls?: RawCall[] | null };
    if (!quay.id) continue;
    for (const call of Array.isArray(quay.estimatedCalls) ? quay.estimatedCalls : []) {
      const t = call.aimedDepartureTime ? parseLocalClock(call.aimedDepartureTime) : null;
      if (!t) continue;
      out.push({
        quayId: quay.id,
        minutt: t.minutt,
        dato: t.dato,
        line: call.serviceJourney?.line?.publicCode?.trim() || null,
        destination: call.destinationDisplay?.frontText?.trim() || null,
      });
    }
  }
  return out;
}

/**
 * Tell avganger fra én quay innenfor et klokketimevindu.
 *
 * Vinduet er halvåpent: en avgang 09.00 tilhører ikke 07–09. Ellers ville en
 * avgang blitt talt i to nabovinduer, og summen ville ikke stemt med
 * avgangslista leseren kan slå opp.
 */
export function countDeparturesInWindow(
  calls: readonly DepartureCall[],
  quayId: string,
  fraTime: number,
  tilTime: number,
): number {
  return calls.filter(
    (c) => c.quayId === quayId && c.minutt >= fraTime * 60 && c.minutt < tilTime * 60,
  ).length;
}

/**
 * Siste avgang i settet, med linjene som kjører akkurat den.
 *
 * Minuttet er DØGNFORTSATT: en avgang 00.30 dagen etter start-datoen blir
 * 1470, ikke 30. Uten det ville nattbussen sortert som tidlig morgen og
 * «siste avgang» blitt 06.10.
 */
export function findLastDeparture(
  calls: readonly DepartureCall[],
  startDato: string,
): { minutt: number; lines: string[] } | undefined {
  const medDøgn = calls.map((c) => ({
    ...c,
    absolutt: c.dato === startDato ? c.minutt : c.minutt + 1440,
  }));
  const siste = medDøgn.reduce<(typeof medDøgn)[number] | undefined>(
    (best, c) => (!best || c.absolutt > best.absolutt ? c : best),
    undefined,
  );
  if (!siste) return undefined;
  const lines = [
    ...new Set(
      medDøgn
        .filter((c) => c.absolutt === siste.absolutt && c.line)
        .map((c) => c.line as string),
    ),
  ].sort((a, b) => a.localeCompare(b, "no"));
  return { minutt: siste.absolutt, lines };
}

/**
 * Grupper avgangene per quay. Rekkefølgen på destinasjoner og linjer er
 * frekvens først, deretter alfabetisk — deterministisk mellom kjøringer, og
 * den hyppigste retningen står først, som er den en beboer mener med «bussen».
 */
export function parseQuayDirections(raw: unknown): TransitDirection[] {
  const quays = extractArray(raw, ["stopPlace", "quays"]);
  const out: TransitDirection[] = [];

  for (const q of quays) {
    const quay = q as { id?: string; estimatedCalls?: RawCall[] | null };
    if (!quay.id) continue;
    const calls = Array.isArray(quay.estimatedCalls) ? quay.estimatedCalls : [];
    if (calls.length === 0) continue;

    const destinationCount = new Map<string, number>();
    const lineCount = new Map<string, number>();
    for (const call of calls) {
      const dest = call.destinationDisplay?.frontText?.trim();
      if (dest) destinationCount.set(dest, (destinationCount.get(dest) ?? 0) + 1);
      const line = call.serviceJourney?.line?.publicCode?.trim();
      if (line) lineCount.set(line, (lineCount.get(line) ?? 0) + 1);
    }
    if (lineCount.size === 0 && destinationCount.size === 0) continue;

    out.push({
      quayId: quay.id,
      destinations: byFrequency(destinationCount),
      lines: byFrequency(lineCount),
    });
  }

  return out;
}

function byFrequency(counts: Map<string, number>): string[] {
  return [...counts.entries()]
    .sort((a, b) => (b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0], "no")))
    .map(([value]) => value);
}

interface RawLeg {
  mode?: string;
  distance?: number;
  line?: { publicCode?: string | null } | null;
}

interface RawTripPattern {
  duration?: number;
  walkDistance?: number;
  legs?: RawLeg[] | null;
}

/**
 * Reisealternativer, sortert på tid. Gange-beina teller ikke som bytter — et
 * bytte er å gå av ett kollektivmiddel og på et annet, som er det en reisende
 * opplever som friksjon.
 */
export function parseTripPatterns(raw: unknown): TransitPattern[] {
  const patterns = extractArray(raw, ["trip", "tripPatterns"]) as RawTripPattern[];
  return patterns
    .map((p) => {
      const legs = Array.isArray(p.legs) ? p.legs : [];
      const transit = legs.filter((l) => l.mode && l.mode !== "foot");
      const lines = transit
        .map((l) => l.line?.publicCode?.trim())
        .filter((c): c is string => Boolean(c));
      return {
        // Math.ceil — samme avrundingskonvensjon som travel-times og
        // /api/entur, så to tall for samme reise aldri spriker med ett minutt.
        minutes: Math.ceil((p.duration ?? 0) / 60),
        lines,
        transfers: Math.max(0, transit.length - 1),
        walkMeters: Math.round(p.walkDistance ?? 0),
      };
    })
    .filter((p) => p.minutes > 0)
    .sort((a, b) => (a.minutes !== b.minutes ? a.minutes - b.minutes : a.transfers - b.transfers));
}

function extractArray(raw: unknown, path: string[]): unknown[] {
  let cursor: unknown = raw;
  for (const key of path) {
    if (typeof cursor !== "object" || cursor === null) return [];
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return Array.isArray(cursor) ? cursor : [];
}

// ── GraphQL ─────────────────────────────────────────────────────────────────

const NEAREST_QUERY = `
  query PlacyNearestStops($lat: Float!, $lon: Float!, $distance: Float!) {
    nearest(
      latitude: $lat
      longitude: $lon
      maximumDistance: $distance
      filterByPlaceTypes: [stopPlace]
      filterByInUse: true
      multiModalMode: parent
    ) {
      edges {
        node {
          distance
          place { ... on StopPlace { id name transportMode } }
        }
      }
    }
  }
`;

/**
 * Avganger per quay i et FRAMTIDIG vindu. `startTime`/`timeRange` er tilleggene
 * mot sanntidsvarianten i `app/api/entur/route.ts` — uten dem svarer Entur på
 * «nå», og et build-time-kall midt på natta hadde gitt nattbuss-linjene.
 */
const DEPARTURES_QUERY = `
  query PlacyDepartures($id: String!, $start: DateTime!, $range: Int!, $n: Int!) {
    stopPlace(id: $id) {
      id
      name
      quays {
        id
        estimatedCalls(startTime: $start, timeRange: $range, numberOfDepartures: $n) {
          aimedDepartureTime
          destinationDisplay { frontText }
          serviceJourney { line { publicCode } }
        }
      }
    }
  }
`;

/**
 * Reise fra boligen til en destinasjon. `modes` utelater fly og bil: uten
 * filteret svarte planleggeren med en flyreise via Værnes på et
 * nabolagsspørsmål.
 */
const TRIP_QUERY = `
  query PlacyTrip($from: Location!, $to: Location!, $dt: DateTime!, $n: Int!) {
    trip(
      from: $from
      to: $to
      dateTime: $dt
      numTripPatterns: $n
      modes: {
        accessMode: foot
        egressMode: foot
        directMode: foot
        transportModes: [
          { transportMode: bus }
          { transportMode: rail }
          { transportMode: tram }
          { transportMode: metro }
          { transportMode: water }
        ]
      }
    ) {
      tripPatterns {
        duration
        walkDistance
        legs { mode line { publicCode } }
      }
    }
  }
`;

async function graphql(
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(JOURNEY_PLANNER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "ET-Client-Name": CLIENT_NAME,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Entur HTTP ${res.status}`);
  const body = (await res.json()) as { data?: unknown; errors?: Array<{ message?: string }> };
  if (body.errors?.length) {
    throw new Error(body.errors[0]?.message ?? "Entur GraphQL-feil");
  }
  return body.data;
}

// ── Oppslag ─────────────────────────────────────────────────────────────────

/**
 * Stoppestedet som ER sentrum for en by, slått opp i Enturs geokoder.
 *
 * Generisk framfor hardkodet: en NSR-id i koden ville bundet oss til Trondheim
 * og forvitret stille den dagen stoppestedet får ny id. `layers=venue`
 * begrenser treffene til stoppesteder, så vi ikke får en adresse tilbake.
 */
export async function resolveCityCentreStop(
  city: string,
): Promise<{ id: string; label: string } | null> {
  for (const text of [`${city} sentralstasjon`, `${city} sentrum`, city]) {
    const url = new URL(GEOCODER_URL);
    url.searchParams.set("text", text);
    url.searchParams.set("size", "1");
    url.searchParams.set("lang", "no");
    url.searchParams.set("layers", "venue");
    const res = await fetch(url, {
      headers: { "ET-Client-Name": CLIENT_NAME },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) continue;
    const body = (await res.json()) as {
      features?: Array<{ properties?: { id?: string; name?: string; label?: string } }>;
    };
    const hit = body.features?.[0]?.properties;
    if (hit?.id?.startsWith("NSR:StopPlace:")) {
      return { id: hit.id, label: hit.name ?? hit.label ?? text };
    }
  }
  return null;
}

/**
 * Hent transittfaktaene for én adresse.
 *
 * `destinations` kommer utenfra (sentrum, videregående skoler) slik at denne
 * modulen bare kan Entur — hvem som er verdt å reise til er et redaksjonelt
 * valg som hører hjemme hos kalleren.
 */
export async function fetchTransitFacts(options: {
  lat: number;
  lng: number;
  destinations?: TransitDestination[];
  /** Injiserbar for tester. */
  now?: Date;
}): Promise<TransitFactsResult> {
  const { lat, lng, destinations = [], now } = options;
  const warnings: string[] = [];
  const departureAt = nextWeekdayRushHour(now);
  const facts: TransitFacts = { departureAt, stops: [], trips: [] };

  // 1. Nærmeste holdeplasser.
  try {
    const data = await graphql(NEAREST_QUERY, {
      lat,
      lon: lng,
      distance: NEARBY_RADIUS_M,
    });
    facts.stops = parseNearestStops(data);
    if (facts.stops.length === 0) {
      warnings.push(
        `ℹ️  Ingen kollektivholdeplass innenfor ${NEARBY_RADIUS_M} m — transport-FAQ utelates`,
      );
    }
  } catch (e) {
    warnings.push(`⚠️  Entur nearest feilet (${message(e)}) — ingen holdeplassfakta`);
  }

  // 2. Linjer per retning, per holdeplass. Én holdeplass som feiler tar ikke
  //    de andre med seg — delvise fakta er gyldige.
  for (const stop of facts.stops) {
    try {
      const data = await graphql(DEPARTURES_QUERY, {
        id: stop.stopPlaceId,
        start: departureAt,
        range: DEPARTURE_WINDOW_S,
        n: DEPARTURES_PER_QUAY,
      });
      stop.directions = parseQuayDirections(data);
    } catch (e) {
      warnings.push(
        `⚠️  Entur avganger for ${stop.name} feilet (${message(e)}) — holdeplassen står uten linjer`,
      );
    }
  }

  // 3. Reiser til destinasjonene.
  for (const dest of destinations) {
    const to = dest.place
      ? { place: dest.place }
      : dest.lat != null && dest.lng != null
        ? { coordinates: { latitude: dest.lat, longitude: dest.lng } }
        : null;
    if (!to) {
      warnings.push(`⚠️  Destinasjon «${dest.label}» mangler både stoppested og koordinat`);
      continue;
    }
    try {
      const data = await graphql(TRIP_QUERY, {
        from: { coordinates: { latitude: lat, longitude: lng } },
        to,
        dt: departureAt,
        n: TRIP_PATTERNS,
      });
      const patterns = parseTripPatterns(data);
      if (patterns.length > 0) {
        facts.trips.push({ key: dest.key, label: dest.label, patterns });
      }
    } catch (e) {
      warnings.push(`⚠️  Entur reise til «${dest.label}» feilet (${message(e)})`);
    }
  }

  return { facts, warnings };
}

/** Morgen- og kveldsvinduet `frekvens` teller i. Hele klokketimer. */
export const FREQUENCY_WINDOWS = {
  morgen: { fraTime: 7, tilTime: 9 },
  kveld: { fraTime: 19, tilTime: 21 },
} as const;

/**
 * Avganger per quay i ett to-timers vindu på neste hverdag.
 *
 * Taket er høyt med vilje: dette ER en telling, og et tak som bet ville gjort
 * svaret til et gulv uten å si fra. Midtbyen har stopp med over hundre
 * avganger i rushen.
 */
const FREQUENCY_DEPARTURES_CAP = 300;

export async function fetchDepartureWindow(options: {
  stopPlaceId: string;
  fraTime: number;
  tilTime: number;
  weekdays: readonly number[];
  now?: Date;
}): Promise<{ calls: DepartureCall[]; startDato: string }> {
  const start = nextOsloDayAt({
    weekdays: options.weekdays,
    hour: options.fraTime,
    now: options.now,
  });
  const data = await graphql(DEPARTURES_QUERY, {
    id: options.stopPlaceId,
    start,
    range: (options.tilTime - options.fraTime) * 3600,
    n: FREQUENCY_DEPARTURES_CAP,
  });
  return { calls: parseDepartureCalls(data), startDato: start.slice(0, 10) };
}

/**
 * Retningen `frekvens` teller: den som går mot byen.
 *
 * Sentrumsretningen finnes ved at quayens linjer overlapper med linjene i den
 * raskeste sentrumsreisen. Uten overlapp faller vi tilbake på quayen med flest
 * avganger, som er den en beboer mener når hun sier «bussen».
 */
export function velgSentrumsretning(
  stop: TransitStopFact,
  sentrumsLinjer: readonly string[],
  calls: readonly DepartureCall[],
): TransitDirection | undefined {
  const sett = new Set(sentrumsLinjer);
  const treff = stop.directions.filter((d) => d.lines.some((l) => sett.has(l)));
  if (treff.length === 1) return treff[0];
  const kandidater = treff.length > 1 ? treff : stop.directions;
  return kandidater.reduce<TransitDirection | undefined>((best, d) => {
    if (!best) return d;
    const antall = (x: TransitDirection) =>
      calls.filter((c) => c.quayId === x.quayId).length;
    return antall(d) > antall(best) ? d : best;
  }, undefined);
}

/** Kveldsvinduet `siste-buss` leter i: fra 21 og seks timer fram, over midnatt. */
const LAST_DEPARTURE_FROM_HOUR = 21;
const LAST_DEPARTURE_RANGE_S = 6 * 3600;

/**
 * Siste avgang fra sentrumsstoppet som faktisk går hjem.
 *
 * Filteret på linjer er det som gjør svaret sant: sentrumsstoppet betjener hele
 * byen, og den siste avgangen derfra kan gå stikk motsatt veg. Bare avganger på
 * linjene som inngår i sentrumsreisen teller som «hjem».
 */
export async function fetchLastDepartureHome(options: {
  centreStopPlaceId: string;
  homeLines: readonly string[];
  weekdays: readonly number[];
  now?: Date;
}): Promise<{ minutt: number; lines: string[] } | undefined> {
  if (options.homeLines.length === 0) return undefined;
  const start = nextOsloDayAt({
    weekdays: options.weekdays,
    hour: LAST_DEPARTURE_FROM_HOUR,
    now: options.now,
  });
  const data = await graphql(DEPARTURES_QUERY, {
    id: options.centreStopPlaceId,
    start,
    range: LAST_DEPARTURE_RANGE_S,
    n: FREQUENCY_DEPARTURES_CAP,
  });
  const sett = new Set(options.homeLines);
  const hjem = parseDepartureCalls(data).filter((c) => c.line && sett.has(c.line));
  return findLastDeparture(hjem, start.slice(0, 10));
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}
