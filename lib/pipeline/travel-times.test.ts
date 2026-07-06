import { describe, it, expect, vi, afterEach } from "vitest";
import {
  calculateTravelTimes,
  computeProjectTravelTimes,
} from "./travel-times";
import { createServerClient } from "@/lib/supabase/client";

/**
 * Eksekverings-tester for reisetid-precompute (bead 2nj):
 *   - Matrix-motoren: batching over 24 destinasjoner, sekunder→MINUTTER (ceil),
 *     fail-soft per batch (HTTP-feil stopper ikke resten).
 *   - Provision-steget: leser project_pois→pois (split-queries), skriver
 *     travel_times per rad, kaster ALDRI (haversine-fallback på board).
 */

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

const ORIGIN = { lat: 63.43, lng: 10.4 };
const TOKEN = "pk.test";

function destinations(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `poi-${i}`,
    coordinates: { lat: 63.4 + i * 0.001, lng: 10.4 },
  }));
}

function matrixOk(durations: (number | null)[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ code: "Ok", durations: [durations] }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("calculateTravelTimes — Matrix-motoren", () => {
  it("konverterer sekunder → MINUTTER med ceil (enhets-kontrakten)", async () => {
    const fetchMock = vi.fn(async () => matrixOk([605, 59, 60]));
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await calculateTravelTimes(ORIGIN, destinations(3), TOKEN, ["walk"]);

    expect(result).toEqual([
      { poiId: "poi-0", walk: 11, bike: undefined, car: undefined }, // ceil(605/60)
      { poiId: "poi-1", walk: 1, bike: undefined, car: undefined }, // ceil(59/60)
      { poiId: "poi-2", walk: 1, bike: undefined, car: undefined }, // ceil(60/60)
    ]);
  });

  it("batcher over 24 destinasjoner (Matrix-grensen: 1 origo + 24)", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const destCount = (url.match(/destinations=([\d;]+)/)?.[1] ?? "").split(";").length;
      return matrixOk(Array.from({ length: destCount }, () => 120));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await calculateTravelTimes(ORIGIN, destinations(30), TOKEN, ["walk"]);

    expect(fetchMock).toHaveBeenCalledTimes(2); // 24 + 6
    expect(result).toHaveLength(30);
    expect(result.every((r) => r.walk === 2)).toBe(true);

    // Batch 1 har origo + 24 koordinater, destinasjonsindekser 1..24
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    expect(firstUrl).toContain("destinations=" + Array.from({ length: 24 }, (_, i) => i + 1).join("%3B").replace(/%3B/g, ";"));
  });

  it("HTTP-feil på én batch → warning, resten beregnes (fail-soft)", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call === 1) return { ok: false, status: 503, json: async () => ({}) };
      return matrixOk(Array.from({ length: 6 }, () => 300));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const warnings: string[] = [];
    const result = await calculateTravelTimes(ORIGIN, destinations(30), TOKEN, ["walk"], warnings);

    expect(warnings.some((w) => w.includes("HTTP 503"))).toBe(true);
    // Batch 1 (24 første) mangler, batch 2 (6 siste) har verdier
    expect(result.slice(0, 24).every((r) => r.walk === undefined)).toBe(true);
    expect(result.slice(24).every((r) => r.walk === 5)).toBe(true);
  });

  it("null-durasjon (uoppnåelig destinasjon) → walk utelates for den POI-en", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => matrixOk([120, null, 180])) as unknown as typeof fetch
    );
    const result = await calculateTravelTimes(ORIGIN, destinations(3), TOKEN, ["walk"]);
    expect(result[0].walk).toBe(2);
    expect(result[1].walk).toBeUndefined();
    expect(result[2].walk).toBe(3);
  });
});

describe("computeProjectTravelTimes — provision-steget", () => {
  // Scriptbar chainable v2-klient: project_pois-select, pois-select, updates.
  function stubClient(opts: {
    projectPois?: { poi_id: string }[] | null;
    pois?: { id: string; lat: number; lng: number }[] | null;
    ppError?: { message: string };
    poisError?: { message: string };
    updateError?: { message: string };
  }) {
    const updates: Array<{ travel_times: unknown; project_id: string; poi_id: string }> = [];
    const db = {
      from: vi.fn((table: string) => {
        if (table === "project_pois") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: opts.projectPois ?? [], error: opts.ppError ?? null })),
            })),
            update: vi.fn((row: { travel_times: unknown }) => ({
              eq: vi.fn((_c: string, project_id: string) => ({
                eq: vi.fn(async (_c2: string, poi_id: string) => {
                  updates.push({ ...row, project_id, poi_id });
                  return { error: opts.updateError ?? null };
                }),
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: opts.pois ?? [], error: opts.poisError ?? null })),
          })),
        };
      }),
    };
    vi.mocked(createServerClient).mockReturnValue({
      schema: vi.fn(() => db),
    } as unknown as ReturnType<typeof createServerClient>);
    return { updates };
  }

  it("skriver travel_times per project_pois-rad (walk, minutter)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    const { updates } = stubClient({
      projectPois: [{ poi_id: "a" }, { poi_id: "b" }],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: 63.432, lng: 10.4 },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => matrixOk([300, 660])) as unknown as typeof fetch
    );

    const result = await computeProjectTravelTimes({
      projectId: "proj-1",
      centerLat: ORIGIN.lat,
      centerLng: ORIGIN.lng,
    });

    expect(result.computed).toBe(2);
    expect(result.total).toBe(2);
    expect(updates).toEqual([
      { travel_times: { walk: 5 }, project_id: "proj-1", poi_id: "a" },
      { travel_times: { walk: 11 }, project_id: "proj-1", poi_id: "b" },
    ]);
  });

  it("tomt POI-pool → {computed:0, total:0} uten Mapbox-kall", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    stubClient({ projectPois: [] });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });
    expect(result).toEqual({ computed: 0, total: 0, warnings: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("manglende token → warning + hopp over, ALDRI kast", async () => {
    vi.stubEnv("MAPBOX_TOKEN", "");
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });
    expect(result.computed).toBe(0);
    expect(result.warnings.some((w) => w.includes("MAPBOX_TOKEN mangler"))).toBe(true);
  });

  it("DB-lesefeil → warning + fail-soft (ingen kast)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    stubClient({ ppError: { message: "boom" } });
    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });
    expect(result.computed).toBe(0);
    expect(result.warnings.some((w) => w.includes("boom"))).toBe(true);
  });

  it("skrivefeil på én rad → warning, resten skrives (computed teller riktig)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    // updateError gjelder ALLE rader i denne stubben — verifiserer at computed=0
    // og at hver rad får sin warning (ingen abort midt i).
    stubClient({
      projectPois: [{ poi_id: "a" }, { poi_id: "b" }],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: 63.432, lng: 10.4 },
      ],
      updateError: { message: "write-fail" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => matrixOk([300, 660])) as unknown as typeof fetch
    );
    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });
    expect(result.computed).toBe(0);
    expect(result.warnings.filter((w) => w.includes("write-fail"))).toHaveLength(2);
  });
});
