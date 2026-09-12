import { describe, expect, it, vi } from "vitest";
import type { BoardData, BoardCategoryId, BoardPOIId } from "@/components/variants/report/board/board-data";
import { boardReducer, initialBoardState } from "@/components/variants/report/board/board-state";
import { boardRealtimeContext, executeBoardTool, type BoardToolEnvironment } from "@/lib/realtime/board-tools";

function fixture(): BoardToolEnvironment {
  const categoryId = "culture" as BoardCategoryId;
  const poiId = "planned-park" as BoardPOIId;
  const raw = { id: poiId, name: "Havneparken", category: { id: "park", name: "Park", color: "#111", icon: "TreePine" }, coordinates: { lat: 63.4, lng: 10.4 }, developmentStatus: "planned" as const, locationPrecision: "approximate" as const, locationNote: "Omtrentlig plassering langs havnefronten", travelTime: { walk: 12 }, editorialSources: ["https://example.org/plan"] };
  const poi = { id: poiId, categoryId, name: raw.name, coordinates: raw.coordinates, color: "#111", icon: "TreePine", raw };
  const data: BoardData = { home: { name: "Nyhavna", address: "Nyhavna, Trondheim", coordinates: raw.coordinates }, categories: [{ id: categoryId, label: "Kulturliv", lead: "Kultur ved havna", body: "", icon: "Palette", color: "#111", pois: [poi], topRankedPois: [poi] }], poisById: new Map([[poiId, raw]]), audioTourEnabled: false };
  return { data, state: initialBoardState, dispatch: vi.fn(), mapCamera: { snapshot: vi.fn(), restore: vi.fn(), fitVisible: vi.fn(), fitCoordinates: vi.fn(), flyToPoint: vi.fn() } };
}

describe("Realtime board tools", () => {
  it("rejects invented place IDs without moving the board", () => {
    const env = fixture();
    expect(executeBoardTool("show_place", { poi_id: "invented" }, env)).toHaveProperty("error");
    expect(env.dispatch).not.toHaveBeenCalled();
    expect(env.mapCamera?.flyToPoint).not.toHaveBeenCalled();
  });
  it("preserves planned status, location caveat, source and minute units", () => {
    const env = fixture();
    const result = executeBoardTool("show_place", { poi_id: "planned-park" }, env);
    expect(result).toMatchObject({ development_status: "planned", location_precision: "approximate", location_note: "Omtrentlig plassering langs havnefronten", travel_minutes_from_board_origin: { walk: 12 }, sources: ["https://example.org/plan"] });
    expect(env.dispatch).toHaveBeenLastCalledWith({ type: "OPEN_POI", id: "planned-park", source: "voice" });
    expect(env.mapCamera?.flyToPoint).toHaveBeenCalledOnce();
  });
  it("uses the actual selected point in follow-up context", () => {
    const env = fixture();
    env.state = { ...env.state, activePOIId: "planned-park" as BoardPOIId };
    expect(boardRealtimeContext(env.data, env.state)).toHaveProperty("selected_place.name", "Havneparken");
  });
  it("refuses unsupported travel modes instead of inventing times", () => {
    const env = fixture();
    expect(executeBoardTool("set_travel_mode", { mode: "bike" }, env)).toHaveProperty("error");
    expect(env.dispatch).not.toHaveBeenCalled();
  });
  it("rejects an unknown category before applying navigation", () => {
    const env = fixture();
    expect(executeBoardTool("show_category", { category_id: "fake" }, env)).toHaveProperty("error");
    expect(env.dispatch).not.toHaveBeenCalled();
  });
  it("finds and opens a unique requested place in one round, retaining caveats", () => {
    const env = fixture();
    expect(executeBoardTool("find_places", { query: "Havneparken", show_if_unique: true }, env)).toMatchObject({ shown: true, development_status: "planned", sources: ["https://example.org/plan"] });
    expect(env.mapCamera?.flyToPoint).toHaveBeenCalledOnce();
  });
  it("paginates compact results and does not choose between ambiguous matches", () => {
    const env = fixture();
    const base = env.data.categories[0].pois[0];
    env.data.categories[0].pois = Array.from({ length: 8 }, (_, i) => ({ ...base, id: `park-${i}` as BoardPOIId, body: "Long description" }));
    const first = executeBoardTool("find_places", { query: "park", show_if_unique: true }, env) as { places: unknown[]; next_offset: number };
    expect(first.places).toHaveLength(6);
    expect(first.next_offset).toBe(6);
    expect(JSON.stringify(first)).not.toContain("Long description");
    expect(first.places[0]).toMatchObject({ development_status: "planned", sources: ["https://example.org/plan"] });
    expect(executeBoardTool("find_places", { query: "park", offset: first.next_offset }, env)).toMatchObject({ next_offset: null, places: [{ id: "park-6" }, { id: "park-7" }] });
    expect(env.dispatch).not.toHaveBeenCalled();
  });
  it("voice navigation leaves the conversation visible on mobile", () => {
    const state = boardReducer(initialBoardState, { type: "OPEN_POI", id: "planned-park" as BoardPOIId, source: "voice" });
    expect(state.exploreSuppressed).toBe(true);
    expect(boardReducer(initialBoardState, { type: "SELECT_CATEGORY", id: "culture" as BoardCategoryId, source: "voice" }).phase).toBe("default");
  });
});
