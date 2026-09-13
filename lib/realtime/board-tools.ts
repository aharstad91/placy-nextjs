import type { Dispatch } from "react";
import type { BoardCategoryId, BoardData, BoardPOI, BoardPOIId } from "@/components/variants/report/board/board-data";
import { findBoardPOI } from "@/components/variants/report/board/board-data";
import type { BoardAction, BoardState } from "@/components/variants/report/board/board-state";
import type { MapCameraApi } from "@/lib/board/board-types";

/**
 * Kartkommandoene slik NETTLESEREN utfører dem (2026-09-13).
 *
 * Serveren eier alle fakta; her flyttes bare kartet og flaten, og svaret
 * tilbake er ren kartstatus: hva som ble vist, med ID og navn. Ukjente ID-er
 * avvises uten at kartet rører seg – modellen får aldri en markør på et sted
 * som ikke finnes, og aldri en bekreftelse på noe som ikke skjedde.
 *
 * Fremhevingen (`highlight_places`) er en egen tilstand ved siden av det åpne
 * stedet: flere steder samtidig, i uttalt rekkefølge, uten detaljkort. Kameraet
 * rammer inn gruppen ÉN gang når den er ny; en gjentatt fremheving av samme
 * gruppe (oppfølgingsspørsmål) lar utsnittet stå der brukeren har satt det.
 */
export interface BoardToolEnvironment {
  data: BoardData;
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
  mapCamera?: MapCameraApi | null;
  /** Omvisningen: gå til stoppet for kategorien (indeks i `data.categories`). */
  onCategory?: (index: number) => void;
  /** Omvisningen: tilbake til området. */
  onReset?: () => void;
}

export interface HighlightedPlaceStatus {
  ord: number;
  id: string;
  name: string;
}

export type BoardToolResult =
  | { ok: true; shown: string; poi_id?: string; category_id?: string; highlighted?: HighlightedPlaceStatus[]; rejected?: string[] }
  | { error: string };

const sameOrder = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

export function executeBoardTool(name: string, args: Record<string, unknown>, env: BoardToolEnvironment): BoardToolResult {
  const { data, state, dispatch, mapCamera } = env;
  switch (name) {
    case "highlight_places": {
      const requested = Array.isArray(args.poi_ids) ? args.poi_ids.filter((id): id is string => typeof id === "string") : [];
      if (!requested.length) return { error: "poi_ids mangler. Bruk kart-ID-er fra kapittelet, katalogen eller map_poi_id." };
      const found: BoardPOI[] = [];
      const rejected: string[] = [];
      for (const id of requested.slice(0, 6)) {
        const poi = findBoardPOI(data.categories, id);
        if (!poi) rejected.push(id);
        else if (!found.some((p) => p.id === poi.id)) found.push(poi);
      }
      if (!found.length) return { error: `Ukjente kart-ID-er: ${rejected.join(", ")}. Ingen steder ble fremhevet. Bruk bare ID-er fra kapittel, katalog («vis:») eller map_poi_id.` };
      const ids = found.map((p) => p.id);
      const unchanged = sameOrder(ids, state.highlightedPoiIds);
      dispatch({ type: "HIGHLIGHT_POIS", ids });
      // Ny gruppe → ramm den inn én gang. Samme gruppe → brukerens utsnitt står.
      if (!unchanged) mapCamera?.fitCoordinates(found.map((p) => p.coordinates), { maxZoom: 16.5, durationMs: 1000 });
      return {
        ok: true,
        shown: found.map((p) => p.name).join(", "),
        highlighted: found.map((p, i) => ({ ord: i + 1, id: String(p.id), name: p.name })),
        ...(rejected.length ? { rejected } : {}),
      };
    }
    case "clear_highlights":
      dispatch({ type: "CLEAR_HIGHLIGHTS" });
      return { ok: true, shown: "Fremhevingen er fjernet" };
    case "show_place": {
      const poi = typeof args.poi_id === "string" ? findBoardPOI(data.categories, args.poi_id) : null;
      if (!poi) return { error: "Ukjent sted. Bruk en kart-ID fra kapittelet, katalogen eller map_poi_id." };
      // Stoppet følger stedets tema så flaten og kartet forteller det samme;
      // fremhevingen står (ingen navigasjons-action rører den).
      if (env.onCategory) env.onCategory(data.categories.findIndex((c) => c.id === poi.categoryId));
      dispatch({ type: "OPEN_POI", id: poi.id, source: "voice" });
      mapCamera?.flyToPoint(poi.coordinates, { minZoom: 16, durationMs: 1100 });
      return { ok: true, shown: poi.name, poi_id: String(poi.id) };
    }
    case "show_category": {
      const category = typeof args.category_id === "string" ? data.categories.find((c) => String(c.id) === args.category_id) : undefined;
      if (!category) return { error: "Ukjent tema-ID. Bruk en tema-ID fra boardets temaer." };
      if (env.onCategory) env.onCategory(data.categories.indexOf(category));
      else dispatch({ type: "SELECT_CATEGORY", id: category.id, source: "voice" });
      mapCamera?.fitCoordinates((category.topRankedPois.length ? category.topRankedPois.slice(0, 5) : category.pois.slice(0, 8)).map((p) => p.coordinates), { maxZoom: 16, durationMs: 1000 });
      return { ok: true, shown: category.label, category_id: String(category.id) };
    }
    case "set_travel_mode": {
      const mode = args.mode;
      if (mode !== "walk" && mode !== "bike" && mode !== "car") return { error: "Ukjent reisemåte." };
      const available = data.categories.some((c) => c.pois.some((p) => p.raw.travelTime?.[mode] !== undefined));
      if (!available) return { error: "Boardet har ingen lagrede reisetider for denne reisemåten." };
      dispatch({ type: "SET_TRAVEL_MODE", mode });
      return { ok: true, shown: `Reisemåte: ${mode}` };
    }
    case "reset_board":
      env.onReset?.();
      dispatch({ type: "RESET_TO_DEFAULT" });
      dispatch({ type: "CLEAR_HIGHLIGHTS" });
      mapCamera?.fitCoordinates([data.home.coordinates, ...data.categories.flatMap((c) => c.topRankedPois.slice(0, 2).map((p) => p.coordinates))], { maxZoom: 14.5, durationMs: 1000 });
      return { ok: true, shown: "Hele nabolaget" };
    default:
      return { error: "Ukjent kartkommando." };
  }
}

/** Kart-ID-ene et verktøykall førte til – brukt av flaten til å skille assistentens navigasjon fra brukerens egne trykk. */
export function boardToolTargets(name: string, result: BoardToolResult, data: BoardData): { categoryIds: string[]; poiIds: string[] } {
  if ("error" in result) return { categoryIds: [], poiIds: [] };
  const poiIds = [...(result.poi_id ? [result.poi_id] : []), ...(result.highlighted?.map((h) => h.id) ?? [])];
  const categoryIds = [
    ...(result.category_id ? [result.category_id] : []),
    ...poiIds.map((id) => findBoardPOI(data.categories, id as BoardPOIId)?.categoryId).filter((id): id is BoardCategoryId => Boolean(id)).map(String),
  ];
  return { categoryIds, poiIds: name === "highlight_places" ? [] : poiIds };
}
