import type { BoardData, BoardPOI } from "@/components/variants/report/board/board-data";
import type { EnturDeparturesResult, EnturTripResult } from "@/lib/entur/client";
import type { RealtimeTool } from "@/lib/realtime/types";

const schema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});

export const liveTransportTools: RealtimeTool[] = [
  {
    type: "function",
    name: "get_live_departures",
    description: "Hent levende avganger fra en holdeplass som allerede finnes på boardet. Bruk bare poi_id fra find_places eller kapittelet.",
    parameters: schema({
      poi_id: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 8 },
    }, ["poi_id"]),
  },
  {
    type: "function",
    name: "plan_live_transit_trip",
    description: "Planlegg kollektiv fra prosjektet til et konkret sted som finnes på boardet. Ved uklare mål som «byen» må du spørre hvilket sted brukeren mener før du kaller verktøyet.",
    parameters: schema({ destination_poi_id: { type: "string" } }, ["destination_poi_id"]),
  },
];

const LIVE_TOOL_NAMES = new Set(liveTransportTools.map((tool) => tool.name));
export type LiveTransportToolName = "get_live_departures" | "plan_live_transit_trip";
export const isLiveTransportTool = (name: string) => LIVE_TOOL_NAMES.has(name);

export interface LiveTransportClient {
  departures(stopPlaceId: string, limit: number): Promise<EnturDeparturesResult>;
  trip(from: { lat: number; lng: number }, to: { lat: number; lng: number }, limit: number): Promise<EnturTripResult>;
}

export type LiveTransportExecutor = (name: string, args: Record<string, unknown>) => Promise<unknown>;

const allPlaces = (board: BoardData): BoardPOI[] =>
  board.categories.flatMap((category) => category.pois);

const failure = (error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "unavailable";
  return {
    live: false,
    error: code,
    note: "Jeg fikk ikke hentet levende kollektivdata nå. Jeg bruker ikke eldre research som om den var sanntid.",
  };
};

export function createLiveTransportExecutor(board: BoardData, client: LiveTransportClient): LiveTransportExecutor {
  const byId = new Map(allPlaces(board).map((poi) => [String(poi.id), poi]));
  return async (name, args) => {
    try {
      if (name === "get_live_departures") {
        const poi = byId.get(typeof args.poi_id === "string" ? args.poi_id : "");
        if (!poi) return { error: "Ukjent poi_id. Bruk en holdeplass fra boardets verktøyresultater." };
        if (!poi.raw.enturStopplaceId) return { error: "Stedet har ingen validert Entur-kobling." };
        const limit = typeof args.limit === "number" ? Math.max(1, Math.min(Math.trunc(args.limit), 8)) : 5;
        const result = await client.departures(poi.raw.enturStopplaceId, limit);
        const departures = result.quays
          .flatMap((quay) => quay.departures)
          .sort((a, b) => Date.parse(a.departureTime) - Date.parse(b.departureTime))
          .slice(0, limit)
          .map((departure) => ({
            line: departure.lineCode,
            direction: departure.destination,
            expected_departure_time: departure.expectedDepartureTime,
            actual_departure_time: departure.actualDepartureTime,
            departure_time: departure.departureTime,
            realtime: departure.isRealtime,
            mode: departure.transportMode,
          }));
        return {
          live: true,
          fetched_at: result.fetchedAt,
          stop: { poi_id: String(poi.id), name: result.stopPlace.name },
          departures,
          note: departures.length ? "Levende data fra Entur." : "Entur returnerte ingen kommende avganger for holdeplassen.",
        };
      }
      if (name === "plan_live_transit_trip") {
        const destination = byId.get(typeof args.destination_poi_id === "string" ? args.destination_poi_id : "");
        if (!destination) return { error: "Ukjent mål. Finn et konkret sted på boardet først; avklar uklare mål som «byen»." };
        const result = await client.trip(board.home.coordinates, destination.coordinates, 3);
        return {
          live: true,
          fetched_at: result.fetchedAt,
          from: board.home.name,
          destination: { poi_id: String(destination.id), name: destination.name },
          trips: result.trips.slice(0, 3),
          note: result.trips.length ? "Levende reisealternativer fra Entur." : "Entur fant ingen reisealternativer nå.",
        };
      }
      return { error: "Ukjent kollektivverktøy." };
    } catch (error) {
      return failure(error);
    }
  };
}
