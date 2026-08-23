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

import { nextWeekdayRushHour } from "@/lib/pipeline/oslo-time";

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
  destinationDisplay?: { frontText?: string | null } | null;
  serviceJourney?: { line?: { publicCode?: string | null } | null } | null;
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

function message(e: unknown): string {
  return e instanceof Error ? e.message : "ukjent feil";
}
