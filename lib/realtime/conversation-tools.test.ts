import { describe, expect, it } from "vitest";
import type { BoardData } from "@/components/variants/report/board/board-data";
import { executeConversationTool, initialConversationView, placeEvidence } from "@/lib/realtime/conversation-tools";

const data = {
  home: { name: "Nyhavna", address: "Nyhavna utgangspunkt", coordinates: { lat: 63.44, lng: 10.42 } },
  categories: [{ id: "park", label: "Park og promenade", body: "En planlagt park.", pois: [{ id: "park-1", name: "Planlagt park", address: "Testgata 7", body: "Park ved Testgata 7.", categoryId: "park", coordinates: { lat: 63.44, lng: 10.42 }, raw: { address: "Testgata 7", description: "Park ved Testgata 7.", category: { name: "Park" }, developmentStatus: "planned", locationPrecision: "approximate", locationNote: "Foreløpig plassering", editorialSources: ["https://nyhavna.no/leve/park-og-promenade/"], travelTime: { walk: 7 } } }] }],
} as unknown as BoardData;

describe("conversation tools: grounded map mutations", () => {
  it("rejects a partly invented map selection atomically", () => {
    const view = initialConversationView(data);
    let writes = 0;
    const result = executeConversationTool("show_places", { place_ids: ["park-1", "invented-id"], title: "Parker" }, data, view, () => { writes++; });
    expect(result).toHaveProperty("error");
    expect(writes).toBe(0);
  });

  it("retains planned status, coordinate uncertainty and source evidence", () => {
    const evidence = placeEvidence(data.categories[0].pois[0], data);
    expect(evidence).toMatchObject({ development_status: "planned", location_precision: "approximate", location_note: "Foreløpig plassering", sources: ["https://nyhavna.no/leve/park-og-promenade/"], travel_minutes_from_board_origin: { walk: 7 } });
  });

  it("does not invent missing bicycle time or convert minutes to seconds", () => {
    const view = initialConversationView(data);
    expect(executeConversationTool("set_travel_mode", { mode: "walk" }, data, view, () => {})).toMatchObject({ origin: "Nyhavna", places: [{ minutes: 7 }] });
    expect(executeConversationTool("set_travel_mode", { mode: "bike" }, data, view, () => {})).toMatchObject({ places: [{ minutes: null }] });
  });

  it("returns no matches with a data coverage qualification", () => {
    const view = initialConversationView(data);
    expect(executeConversationTool("search_places", { query: "svømmehall" }, data, view, () => {})).toMatchObject({ total: 0, places: [], note: "Utvalg fra boardet. Ingen treff betyr ikke at tilbudet ikke finnes." });
  });

  it("opens only an existing place and keeps it in the visible set", () => {
    let view = { ...initialConversationView(data), placeIds: [] as string[] };
    executeConversationTool("open_place", { place_id: "park-1" }, data, view, (next) => { view = next; });
    expect(view.selectedId).toBe("park-1");
    expect(view.placeIds).toEqual(["park-1"]);
    expect(view.revision).toBe(1);
  });

  it("holder adressen utenfor normal modelldata og åpner den bare eksplisitt", () => {
    const view = initialConversationView(data);
    const search = executeConversationTool("search_places", { query: "park" }, data, view, () => {});
    const opened = executeConversationTool("open_place", { place_id: "park-1" }, data, view, () => {});
    expect(JSON.stringify({ search, opened })).not.toContain("Testgata 7");
    expect(executeConversationTool("get_place_address", { place_id: "park-1", purpose: "address" }, data, view, () => {}))
      .toEqual({ id: "park-1", name: "Planlagt park", address: "Testgata 7", purpose: "address" });
    expect(executeConversationTool("get_place_address", { place_id: "park-1", purpose: "curiosity" }, data, view, () => {}))
      .toHaveProperty("error");
  });
});
