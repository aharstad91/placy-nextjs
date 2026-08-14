import { describe, it, expect, vi, afterEach } from "vitest";
import {
  hasProfile,
  summariseCoverage,
  fetchTravelTimeRows,
  type TravelTimeRow,
} from "./travel-coverage";
import { createServerClient } from "@/lib/supabase/client";

/**
 * Dekningsregnskapet er tallet backfillen styrer etter. To ting må holde:
 *   - korrupte jsonb-verdier teller ikke som dekning
 *   - sidingen henter ALT (PostgREST avkorter usidet select ved 1 000 stille)
 */

vi.mock("@/lib/supabase/client", () => ({ createServerClient: vi.fn() }));

afterEach(() => vi.clearAllMocks());

function row(projectId: string, poiId: string, travelTimes: Record<string, unknown> | null): TravelTimeRow {
  return { project_id: projectId, poi_id: poiId, travel_times: travelTimes };
}

describe("hasProfile — siling av ubrukelige verdier", () => {
  it("godtar endelige tall", () => {
    expect(hasProfile({ walk: 12 }, "walk")).toBe(true);
    expect(hasProfile({ walk: 0 }, "walk")).toBe(true);
  });

  it("siler bort null, undefined, strenger, NaN og Infinity", () => {
    expect(hasProfile(null, "walk")).toBe(false);
    expect(hasProfile({}, "walk")).toBe(false);
    expect(hasProfile({ walk: null }, "walk")).toBe(false);
    expect(hasProfile({ walk: "12" }, "walk")).toBe(false);
    expect(hasProfile({ walk: NaN }, "walk")).toBe(false);
    expect(hasProfile({ walk: Infinity }, "walk")).toBe(false);
  });
});

describe("summariseCoverage", () => {
  it("teller dekning per profil og grupperer per board", () => {
    const result = summariseCoverage([
      row("a", "p1", { walk: 10, bike: 4, car: 2 }),
      row("a", "p2", { walk: 20 }),
      row("b", "p3", { bike: 7 }),
    ]);

    expect(result).toEqual([
      {
        projectId: "a",
        total: 2,
        covered: { walk: 2, bike: 1, car: 1 },
        missingAll: [],
      },
      {
        projectId: "b",
        total: 1,
        covered: { walk: 0, bike: 1, car: 0 },
        missingAll: [],
      },
    ]);
  });

  it("lister POI-er uten en eneste reisetid (kandidatene Matrix ikke kan rute til)", () => {
    const result = summariseCoverage([
      row("a", "p1", { walk: 10 }),
      row("a", "p2", null),
      row("a", "p3", {}),
      row("a", "p4", { walk: "tolv" }),
    ]);

    expect(result[0].total).toBe(4);
    expect(result[0].covered).toEqual({ walk: 1, bike: 0, car: 0 });
    expect(result[0].missingAll).toEqual(["p2", "p3", "p4"]);
  });

  it("tom input → tomt regnskap", () => {
    expect(summariseCoverage([])).toEqual([]);
  });
});

describe("fetchTravelTimeRows — siding", () => {
  function stubPages(pages: TravelTimeRow[][]) {
    const ranges: Array<[number, number]> = [];
    let page = 0;
    const builder = {
      select: vi.fn(() => builder),
      order: vi.fn(() => builder),
      in: vi.fn(() => builder),
      range: vi.fn((from: number, to: number) => {
        ranges.push([from, to]);
        return Promise.resolve({ data: pages[page++] ?? [], error: null });
      }),
    };
    vi.mocked(createServerClient).mockReturnValue({
      schema: vi.fn(() => ({ from: vi.fn(() => builder) })),
    } as unknown as ReturnType<typeof createServerClient>);
    return { ranges, builder };
  }

  function fullPage(offset: number): TravelTimeRow[] {
    return Array.from({ length: 1000 }, (_, i) => row("a", `poi-${offset + i}`, { walk: 5 }));
  }

  it("henter alle rader når porteføljen er større enn én side (1 519 > 1 000)", async () => {
    const { ranges } = stubPages([fullPage(0), Array.from({ length: 519 }, (_, i) => row("a", `poi-${1000 + i}`, { walk: 5 }))]);

    const rows = await fetchTravelTimeRows();

    expect(rows).toHaveLength(1519);
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("full siste side → én ekstra runde som svarer tomt (ingen rad går tapt på en eksakt grense)", async () => {
    const { ranges } = stubPages([fullPage(0), []]);

    const rows = await fetchTravelTimeRows();

    expect(rows).toHaveLength(1000);
    expect(ranges).toHaveLength(2);
  });

  it("projectIds avgrenser oppslaget", async () => {
    const { builder } = stubPages([[row("a", "p1", { walk: 5 })]]);

    await fetchTravelTimeRows(["a", "b"]);

    expect(builder.in).toHaveBeenCalledWith("project_id", ["a", "b"]);
  });

  it("uten projectIds settes ingen in-filter", async () => {
    const { builder } = stubPages([[]]);
    await fetchTravelTimeRows();
    expect(builder.in).not.toHaveBeenCalled();
  });

  it("DB-feil kaster (et avkortet dekningstall er verre enn en feilmelding)", async () => {
    vi.mocked(createServerClient).mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => {
          const b = {
            select: vi.fn(() => b),
            order: vi.fn(() => b),
            in: vi.fn(() => b),
            range: vi.fn(async () => ({ data: null, error: { message: "boom" } })),
          };
          return b;
        }),
      })),
    } as unknown as ReturnType<typeof createServerClient>);

    await expect(fetchTravelTimeRows()).rejects.toThrow("boom");
  });
});
