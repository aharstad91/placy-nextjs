import { describe, it, expect, vi, beforeEach } from "vitest";

const { createServerClientMock, selectSpy, builderState } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
  selectSpy: vi.fn(),
  builderState: { result: { data: [] as unknown[] | null, error: null as unknown } },
}));

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: createServerClientMock,
}));

import { getEngagementStats } from "./engagement-stats";

// Thenable query-builder-mock: alle kjede-metoder returnerer seg selv; await → result.
function makeBuilder() {
  const b: Record<string, unknown> = {};
  b.select = (...args: unknown[]) => {
    selectSpy(...args);
    return b;
  };
  b.eq = () => b;
  b.gte = () => b;
  b.lte = () => b;
  b.then = (resolve: (v: unknown) => unknown) => resolve(builderState.result);
  return b;
}

beforeEach(() => {
  selectSpy.mockReset();
  builderState.result = { data: [], error: null };
  createServerClientMock.mockReturnValue({ schema: () => ({ from: () => makeBuilder() }) });
});

describe("getEngagementStats", () => {
  it("aggregerer per type/kategori/poi", async () => {
    builderState.result = {
      data: [
        { event_type: "board_viewed", payload: null, poi_id: null },
        { event_type: "board_viewed", payload: null, poi_id: null },
        { event_type: "voiceover_played", payload: { voiceover_segment: "intro" }, poi_id: null },
        { event_type: "category_opened", payload: { category_id: "cafe" }, poi_id: null },
        { event_type: "category_opened", payload: { category_id: "cafe" }, poi_id: null },
        { event_type: "category_opened", payload: { category_id: "park" }, poi_id: null },
        { event_type: "poi_clicked", payload: null, poi_id: "p1" },
        { event_type: "poi_clicked", payload: null, poi_id: "p1" },
      ],
      error: null,
    };
    const s = await getEngagementStats("proj");
    expect(s.boardViews).toBe(2);
    expect(s.voiceoverPlays).toBe(1);
    expect(s.categoryOpensByCategory).toEqual({ cafe: 2, park: 1 });
    expect(s.poiClicksByPoi).toEqual({ p1: 2 });
  });

  it("PERSONVERN: velger ALDRI session_id", async () => {
    await getEngagementStats("proj");
    const selectArg = String(selectSpy.mock.calls[0]?.[0] ?? "");
    expect(selectArg).not.toContain("session_id");
  });

  it("tom event-tabell → null-aggregat", async () => {
    const s = await getEngagementStats("proj");
    expect(s).toEqual({ boardViews: 0, categoryOpensByCategory: {}, voiceoverPlays: 0, poiClicksByPoi: {} });
  });

  it("spørrings-feil → tomt aggregat (fail-soft, logget)", async () => {
    builderState.result = { data: null, error: { message: "boom" } };
    const s = await getEngagementStats("proj");
    expect(s.boardViews).toBe(0);
  });

  it("category_opened uten category_id telles ikke", async () => {
    builderState.result = { data: [{ event_type: "category_opened", payload: {}, poi_id: null }], error: null };
    const s = await getEngagementStats("proj");
    expect(s.categoryOpensByCategory).toEqual({});
  });
});
