import { describe, expect, it, vi } from "vitest";
import type { BoardData, BoardCategoryId, BoardPOIId } from "@/components/variants/report/board/board-data";
import { boardReducer, initialBoardState } from "@/components/variants/report/board/board-state";
import { boardToolTargets, executeBoardTool, type BoardToolEnvironment } from "@/lib/realtime/board-tools";

function fixture(): BoardToolEnvironment {
  const culture = "culture" as BoardCategoryId;
  const food = "food" as BoardCategoryId;
  const make = (id: string, categoryId: BoardCategoryId, name: string, lat: number) => {
    const raw = { id, name, category: { id: "park", name: "Park", color: "#111", icon: "TreePine" }, coordinates: { lat, lng: 10.4 }, developmentStatus: "planned" as const, locationPrecision: "approximate" as const, locationNote: "Omtrentlig plassering", travelTime: { walk: 12 }, editorialSources: ["https://example.org/plan"] };
    return { id: id as BoardPOIId, categoryId, name, coordinates: raw.coordinates, color: "#111", icon: "TreePine", raw };
  };
  const park = make("planned-park", culture, "Havneparken", 63.4);
  const bunker = make("bunker", culture, "Bunkeren", 63.41);
  const cafe = make("cafe", food, "Kafeen", 63.42);
  const data: BoardData = {
    home: { name: "Nyhavna", address: "Nyhavna, Trondheim", coordinates: park.coordinates },
    categories: [
      { id: culture, label: "Kulturliv", lead: "", body: "", icon: "Palette", color: "#111", pois: [park, bunker], topRankedPois: [park, bunker] },
      { id: food, label: "Servering", lead: "", body: "", icon: "Coffee", color: "#222", pois: [cafe], topRankedPois: [cafe] },
    ],
    poisById: new Map([[park.id, park.raw], [bunker.id, bunker.raw], [cafe.id, cafe.raw]]),
    audioTourEnabled: false,
  };
  return { data, state: initialBoardState, dispatch: vi.fn(), mapCamera: { snapshot: vi.fn(), restore: vi.fn(), fitVisible: vi.fn(), fitCoordinates: vi.fn(), flyToPoint: vi.fn() } };
}

describe("Kartkommandoene i nettleseren", () => {
  it("avviser oppdiktede ID-er uten å flytte kartet, og svarer bare med kartstatus", () => {
    const env = fixture();
    expect(executeBoardTool("show_place", { poi_id: "invented" }, env)).toHaveProperty("error");
    expect(env.dispatch).not.toHaveBeenCalled();
    expect(env.mapCamera?.flyToPoint).not.toHaveBeenCalled();
    const shown = executeBoardTool("show_place", { poi_id: "planned-park" }, env);
    expect(shown).toEqual({ ok: true, shown: "Havneparken", poi_id: "planned-park" });
    expect(env.dispatch).toHaveBeenLastCalledWith({ type: "OPEN_POI", id: "planned-park", source: "voice" });
    expect(env.mapCamera?.flyToPoint).toHaveBeenCalledOnce();
    // Ingen RESET: fremhevingen og temaet står når ett sted åpnes.
    expect(env.dispatch).not.toHaveBeenCalledWith({ type: "RESET_TO_DEFAULT" });
  });

  it("fremhever flere steder samtidig i uttalt rekkefølge, på tvers av temaer, uten å åpne noen", () => {
    const env = fixture();
    const result = executeBoardTool("highlight_places", { poi_ids: ["cafe", "planned-park", "cafe", "finnes-ikke"] }, env);
    expect(result).toEqual({
      ok: true, shown: "Kafeen, Havneparken",
      highlighted: [{ ord: 1, id: "cafe", name: "Kafeen" }, { ord: 2, id: "planned-park", name: "Havneparken" }],
      rejected: ["finnes-ikke"],
    });
    expect(env.dispatch).toHaveBeenCalledTimes(1);
    expect(env.dispatch).toHaveBeenCalledWith({ type: "HIGHLIGHT_POIS", ids: ["cafe", "planned-park"] });
    expect(env.dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: "OPEN_POI" }));
    // Ny gruppe rammes inn én gang.
    expect(env.mapCamera?.fitCoordinates).toHaveBeenCalledOnce();
    expect(env.mapCamera?.fitCoordinates).toHaveBeenCalledWith([{ lat: 63.42, lng: 10.4 }, { lat: 63.4, lng: 10.4 }], expect.objectContaining({ maxZoom: 16.5 }));
  });

  it("gjentatt fremheving av samme gruppe lar brukerens utsnitt stå", () => {
    const env = fixture();
    env.state = { ...env.state, highlightedPoiIds: ["cafe", "planned-park"] as BoardPOIId[] };
    executeBoardTool("highlight_places", { poi_ids: ["cafe", "planned-park"] }, env);
    expect(env.dispatch).toHaveBeenCalledWith({ type: "HIGHLIGHT_POIS", ids: ["cafe", "planned-park"] });
    expect(env.mapCamera?.fitCoordinates).not.toHaveBeenCalled();
    // Annen rekkefølge er en ny gruppe.
    executeBoardTool("highlight_places", { poi_ids: ["planned-park", "cafe"] }, env);
    expect(env.mapCamera?.fitCoordinates).toHaveBeenCalledOnce();
  });

  it("bare ukjente ID-er gir feil og ingen dispatch; tom liste gir feil", () => {
    const env = fixture();
    expect(executeBoardTool("highlight_places", { poi_ids: ["a", "b"] }, env)).toEqual({ error: expect.stringContaining("Ukjente kart-ID-er: a, b") });
    expect(executeBoardTool("highlight_places", { poi_ids: [] }, env)).toHaveProperty("error");
    expect(executeBoardTool("highlight_places", {}, env)).toHaveProperty("error");
    expect(env.dispatch).not.toHaveBeenCalled();
  });

  it("rydder fremhevingen eksplisitt og ved retur til oversikten", () => {
    const env = fixture();
    expect(executeBoardTool("clear_highlights", {}, env)).toEqual({ ok: true, shown: "Fremhevingen er fjernet" });
    expect(env.dispatch).toHaveBeenCalledWith({ type: "CLEAR_HIGHLIGHTS" });
    const onReset = vi.fn();
    expect(executeBoardTool("reset_board", {}, { ...env, onReset })).toEqual({ ok: true, shown: "Hele nabolaget" });
    expect(onReset).toHaveBeenCalledOnce();
    expect(env.dispatch).toHaveBeenCalledWith({ type: "RESET_TO_DEFAULT" });
    expect(env.dispatch).toHaveBeenLastCalledWith({ type: "CLEAR_HIGHLIGHTS" });
  });

  it("temaet går via omvisningen når den finnes, ellers via reduceren", () => {
    const env = fixture();
    const onCategory = vi.fn();
    expect(executeBoardTool("show_category", { category_id: "food" }, { ...env, onCategory })).toEqual({ ok: true, shown: "Servering", category_id: "food" });
    expect(onCategory).toHaveBeenCalledWith(1);
    expect(executeBoardTool("show_category", { category_id: "food" }, env)).toEqual({ ok: true, shown: "Servering", category_id: "food" });
    expect(env.dispatch).toHaveBeenCalledWith({ type: "SELECT_CATEGORY", id: "food", source: "voice" });
    expect(executeBoardTool("show_category", { category_id: "fake" }, env)).toHaveProperty("error");
  });

  it("nekter reisemåter uten lagrede tider og ukjente kommandoer", () => {
    const env = fixture();
    expect(executeBoardTool("set_travel_mode", { mode: "bike" }, env)).toHaveProperty("error");
    expect(executeBoardTool("set_travel_mode", { mode: "walk" }, env)).toEqual({ ok: true, shown: "Reisemåte: walk" });
    expect(executeBoardTool("find_places", { query: "kaffe" }, env)).toEqual({ error: "Ukjent kartkommando." });
  });

  it("oppgir hvilke temaer og steder assistenten selv navigerte til", () => {
    const env = fixture();
    const highlighted = executeBoardTool("highlight_places", { poi_ids: ["cafe", "planned-park"] }, env);
    expect(boardToolTargets("highlight_places", highlighted, env.data)).toEqual({ categoryIds: ["food", "culture"], poiIds: [] });
    const shown = executeBoardTool("show_place", { poi_id: "cafe" }, env);
    expect(boardToolTargets("show_place", shown, env.data)).toEqual({ categoryIds: ["food"], poiIds: ["cafe"] });
    expect(boardToolTargets("show_place", { error: "x" }, env.data)).toEqual({ categoryIds: [], poiIds: [] });
  });

  it("stemme-navigasjon lar samtalen stå synlig på mobil", () => {
    const state = boardReducer(initialBoardState, { type: "OPEN_POI", id: "planned-park" as BoardPOIId, source: "voice" });
    expect(state.exploreSuppressed).toBe(true);
    expect(boardReducer(initialBoardState, { type: "SELECT_CATEGORY", id: "culture" as BoardCategoryId, source: "voice" }).phase).toBe("default");
  });
});
