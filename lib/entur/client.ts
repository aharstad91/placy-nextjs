const ENTUR_API_URL = "https://api.entur.io/journey-planner/v3/graphql";
const ENTUR_CLIENT_NAME = "placy-neighborhood-stories";
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CACHE_TTL_MS = 30_000;
const MAX_NUM_TRIPS = 10;

const DEPARTURES_QUERY = `
  query GetDepartures($stopPlaceId: String!, $numberOfDepartures: Int!) {
    stopPlace(id: $stopPlaceId) {
      id name
      quays {
        id
        estimatedCalls(numberOfDepartures: $numberOfDepartures) {
          expectedDepartureTime actualDepartureTime realtime
          destinationDisplay { frontText }
          serviceJourney { line { id publicCode transportMode presentation { colour textColour } } }
        }
      }
    }
  }
`;

const TRIP_QUERY = `
  query GetTrip($from: Location!, $to: Location!, $numTripPatterns: Int!) {
    trip(from: $from, to: $to, numTripPatterns: $numTripPatterns) {
      tripPatterns {
        duration walkDistance
        legs {
          mode distance duration
          fromPlace { name }
          toPlace { name }
          line { publicCode name transportMode }
        }
      }
    }
  }
`;

export type EnturErrorCode = "not_found" | "timeout" | "upstream" | "partial" | "invalid_response";

export class EnturClientError extends Error {
  constructor(public readonly code: EnturErrorCode, message: string) {
    super(message);
    this.name = "EnturClientError";
  }
}

export interface EnturDeparture {
  departureTime: string;
  expectedDepartureTime: string;
  actualDepartureTime: string | null;
  isRealtime: boolean;
  destination: string;
  lineCode: string;
  transportMode: string;
  lineColor?: string;
}

export interface EnturDeparturesResult {
  stopPlace: { id: string; name: string };
  quays: Array<{ quayId: string; departures: EnturDeparture[] }>;
  departures: EnturDeparture[];
  fetchedAt: string;
}

export interface EnturTripResult {
  trips: Array<{
    duration: number;
    walkDistance: number;
    legs: Array<{
      mode: string;
      distance: number;
      duration: number;
      from?: string;
      to?: string;
      lineCode?: string;
      lineName?: string;
    }>;
  }>;
  fetchedAt: string;
}

interface ClientOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
  cacheTtlMs?: number;
  now?: () => Date;
}

const cache = new Map<string, { expiresAt: number; value: unknown }>();
export const clearEnturCache = () => cache.clear();

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal && typeof AbortSignal.any === "function" ? AbortSignal.any([signal, timeout]) : timeout;
}

interface GraphqlResult<T> { data: T; fetchedAt: string }

async function graphql<T>(query: string, variables: Record<string, unknown>, options: ClientOptions, cacheKey?: string): Promise<GraphqlResult<T>> {
  const now = options.now ?? (() => new Date());
  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  if (cacheKey && ttl > 0) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expiresAt > now().getTime()) return hit.value as GraphqlResult<T>;
  }
  try {
    const response = await (options.fetcher ?? fetch)(ENTUR_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "ET-Client-Name": ENTUR_CLIENT_NAME },
      signal: requestSignal(options.signal, options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 30 },
    } as RequestInit & { next: { revalidate: number } });
    if (!response.ok) throw new EnturClientError("upstream", `Entur svarte ${response.status}.`);
    const body = await response.json() as { data?: T; errors?: Array<{ message?: string }> };
    if (body.errors?.length) {
      throw new EnturClientError(body.data ? "partial" : "upstream", body.errors[0]?.message || "Entur returnerte en GraphQL-feil.");
    }
    if (!body.data) throw new EnturClientError("invalid_response", "Entur-responsen mangler data.");
    const fetchedAt = now();
    const result = { data: body.data, fetchedAt: fetchedAt.toISOString() };
    if (cacheKey && ttl > 0) cache.set(cacheKey, { expiresAt: fetchedAt.getTime() + ttl, value: result });
    return result;
  } catch (error) {
    if (error instanceof EnturClientError) throw error;
    if (error instanceof DOMException && error.name === "TimeoutError") throw new EnturClientError("timeout", "Entur svarte ikke innen tidsfristen.");
    throw new EnturClientError("upstream", error instanceof Error ? error.message : "Ukjent Entur-feil.");
  }
}

type RawCall = {
  expectedDepartureTime: string;
  actualDepartureTime: string | null;
  realtime: boolean;
  destinationDisplay?: { frontText?: string };
  serviceJourney?: { line?: { publicCode?: string; transportMode?: string; presentation?: { colour?: string } } };
};

const formatCall = (call: RawCall): EnturDeparture => ({
  departureTime: call.actualDepartureTime || call.expectedDepartureTime,
  expectedDepartureTime: call.expectedDepartureTime,
  actualDepartureTime: call.actualDepartureTime,
  isRealtime: call.realtime,
  destination: call.destinationDisplay?.frontText ?? "Ukjent retning",
  lineCode: call.serviceJourney?.line?.publicCode ?? "Ukjent linje",
  transportMode: call.serviceJourney?.line?.transportMode ?? "unknown",
  lineColor: call.serviceJourney?.line?.presentation?.colour,
});

export async function fetchEnturDepartures(stopPlaceId: string, numberOfDepartures = 5, options: ClientOptions = {}): Promise<EnturDeparturesResult> {
  const limit = Math.max(1, Math.min(Math.trunc(numberOfDepartures) || 5, 20));
  const { data, fetchedAt } = await graphql<{ stopPlace: { id: string; name: string; quays?: Array<{ id: string; estimatedCalls?: RawCall[] }> } | null }>(
    DEPARTURES_QUERY,
    { stopPlaceId, numberOfDepartures: limit },
    options,
    `departures:${stopPlaceId}:${limit}`,
  );
  if (!data.stopPlace) throw new EnturClientError("not_found", "Stop place not found");
  const quays = (data.stopPlace.quays ?? [])
    .filter((quay) => quay.estimatedCalls?.length)
    .map((quay) => ({ quayId: quay.id, departures: (quay.estimatedCalls ?? []).map(formatCall) }));
  return {
    stopPlace: { id: data.stopPlace.id, name: data.stopPlace.name },
    quays,
    departures: quays.map((quay) => quay.departures[0]).filter((call): call is EnturDeparture => Boolean(call)),
    fetchedAt,
  };
}

export async function planEnturTrip(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  numTrips = 3,
  options: ClientOptions = {},
): Promise<EnturTripResult> {
  const count = Math.max(1, Math.min(Math.trunc(numTrips) || 3, MAX_NUM_TRIPS));
  const { data, fetchedAt } = await graphql<{ trip?: { tripPatterns?: Array<{ duration: number; walkDistance: number; legs: Array<{ mode: string; distance: number; duration: number; fromPlace?: { name?: string }; toPlace?: { name?: string }; line?: { publicCode?: string; name?: string } | null }> }> } }>(
    TRIP_QUERY,
    {
      from: { coordinates: { latitude: from.lat, longitude: from.lng } },
      to: { coordinates: { latitude: to.lat, longitude: to.lng } },
      numTripPatterns: count,
    },
    options,
  );
  const trips = (data.trip?.tripPatterns ?? []).map((pattern) => ({
    duration: Math.ceil(pattern.duration / 60),
    walkDistance: Math.round(pattern.walkDistance),
    legs: pattern.legs.map((leg) => ({
      mode: leg.mode,
      distance: Math.round(leg.distance),
      duration: Math.ceil(leg.duration / 60),
      from: leg.fromPlace?.name,
      to: leg.toPlace?.name,
      lineCode: leg.line?.publicCode,
      lineName: leg.line?.name,
    })),
  }));
  return { trips, fetchedAt };
}

export { ENTUR_API_URL, ENTUR_CLIENT_NAME, MAX_NUM_TRIPS };
