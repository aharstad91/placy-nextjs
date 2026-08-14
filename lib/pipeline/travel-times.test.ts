import { describe, it, expect, vi, afterEach } from "vitest";
import {
  batchDestinations,
  calculateTravelTimes,
  computeProjectTravelTimes,
} from "./travel-times";
import { createServerClient } from "@/lib/supabase/client";

/**
 * Eksekverings-tester for reisetid-precompute (bead 2nj):
 *   - Matrix-motoren: batching over 24 destinasjoner, sekunder→MINUTTER (ceil),
 *     fail-soft per batch (HTTP-feil stopper ikke resten).
 *   - Bolke-invarianten: ingen bolk med én destinasjon (Matrix svarer 422).
 *   - Provision-steget: leser project_pois→pois (split-queries), skriver
 *     travel_times per rad for alle tre profiler, kaster ALDRI.
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

/** Matrix-stub som svarer med like durasjoner for uansett hvor mange destinasjoner bolken har. */
function matrixEcho(seconds = 120) {
  return vi.fn(async (url: string) => {
    const n = destinationCountOf(url);
    return matrixOk(Array.from({ length: n }, () => seconds));
  });
}

/** Antall destinasjoner i en Matrix-URL — bolke-størrelsen slik Mapbox faktisk ser den. */
function destinationCountOf(url: string): number {
  const raw = url.match(/destinations=([\d;]+)/)?.[1];
  return raw ? raw.split(";").length : 0;
}

function batchSizesFrom(fetchMock: { mock: { calls: unknown[][] } }): number[] {
  return fetchMock.mock.calls.map((call) => destinationCountOf(call[0] as string));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("batchDestinations — bolke-invarianten", () => {
  // Mapbox Matrix avviser en forespørsel med ett enkelt matrise-element
  // ("minimum number of matrix elements is 2", HTTP 422). En siste bolk med én
  // destinasjon mistet derfor stille sin reisetid — på hvert POI-antall ≡ 1 (mod 24).
  it("gir aldri en bolk med under 2 eller over 24 destinasjoner, og mister ingen destinasjon", () => {
    for (let n = 2; n <= 200; n++) {
      const batches = batchDestinations(destinations(n));
      const sizes = batches.map((b) => b.length);

      expect(sizes.every((s) => s >= 2 && s <= 24), `n=${n} ga bolker ${sizes.join("+")}`).toBe(
        true
      );
      // Ingen destinasjon forsvinner og ingen dubleres i omfordelingen
      expect(batches.flat().map((d) => d.id)).toEqual(destinations(n).map((d) => d.id));
    }
  });

  it("omfordeler 24+1 til 23+2 i stedet for å slå sammen til 25 (over Matrix' koordinatgrense)", () => {
    expect(batchDestinations(destinations(25)).map((b) => b.length)).toEqual([23, 2]);
    expect(batchDestinations(destinations(49)).map((b) => b.length)).toEqual([24, 23, 2]);
  });

  it("2 destinasjoner → én bolk, ingen omfordeling", () => {
    expect(batchDestinations(destinations(2)).map((b) => b.length)).toEqual([2]);
  });

  it("1 destinasjon → ingen bolker (Matrix kan ikke svare; kalleren samler warning)", () => {
    expect(batchDestinations(destinations(1))).toEqual([]);
    expect(batchDestinations([])).toEqual([]);
  });
});

describe("calculateTravelTimes — bolking mot Matrix", () => {
  it("25 destinasjoner → ingen 1-bolk, og alle 25 får reisetid (regresjon: HTTP 422)", async () => {
    const fetchMock = matrixEcho(300);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const warnings: string[] = [];
    const result = await calculateTravelTimes(ORIGIN, destinations(25), TOKEN, ["walk"], warnings);

    expect(batchSizesFrom(fetchMock)).toEqual([23, 2]);
    expect(result.filter((r) => r.walk === 5)).toHaveLength(25);
    expect(warnings).toEqual([]);
  });

  it("97 destinasjoner (faktisk board-størrelse) → 97 av 97 får reisetid", async () => {
    const fetchMock = matrixEcho(600);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await calculateTravelTimes(ORIGIN, destinations(97), TOKEN, ["walk"]);

    expect(batchSizesFrom(fetchMock).every((s) => s >= 2)).toBe(true);
    expect(result.filter((r) => r.walk === 10)).toHaveLength(97);
  });

  it("1 destinasjon totalt → warning, ingen Matrix-kall, ingen kast", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const warnings: string[] = [];
    const result = await calculateTravelTimes(ORIGIN, destinations(1), TOKEN, ["walk"], warnings);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual([{ poiId: "poi-0", walk: undefined, bike: undefined, car: undefined }]);
    expect(warnings.some((w) => w.includes("minimum"))).toBe(true);
  });
});

describe("calculateTravelTimes — tre profiler", () => {
  it("48 destinasjoner × 3 profiler → alle får walk, bike og car", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const n = destinationCountOf(url);
      // walking treigest, driving raskest — så en profil-forveksling er synlig
      const seconds = url.includes("/walking/") ? 1800 : url.includes("/cycling/") ? 600 : 300;
      return matrixOk(Array.from({ length: n }, () => seconds));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await calculateTravelTimes(ORIGIN, destinations(48), TOKEN, [
      "walk",
      "bike",
      "car",
    ]);

    expect(result).toHaveLength(48);
    expect(result.every((r) => r.walk === 30 && r.bike === 10 && r.car === 5)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(6); // 2 bolker × 3 profiler
  });

  it("422 på sykkel men 200 på gå → walk beholdes, bike er undefined, ingen kast", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/cycling/")) {
        return { ok: false, status: 422, json: async () => ({}) };
      }
      return matrixOk(Array.from({ length: destinationCountOf(url) }, () => 900));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const warnings: string[] = [];
    const result = await calculateTravelTimes(
      ORIGIN,
      destinations(10),
      TOKEN,
      ["walk", "bike", "car"],
      warnings
    );

    expect(result.every((r) => r.walk === 15 && r.car === 15)).toBe(true);
    expect(result.every((r) => r.bike === undefined)).toBe(true);
    expect(warnings.some((w) => w.includes("bike") && w.includes("HTTP 422"))).toBe(true);
  });
});

describe("calculateTravelTimes — rate-limit (HTTP 429)", () => {
  // Matrix' grense er 60 requests/minutt. En backfill over hele porteføljen fyrer
  // flere hundre, og uten retry ble hver 429 en stille tapt bolk.
  function matrix429(headers?: Record<string, string>) {
    return {
      ok: false,
      status: 429,
      headers: { get: (k: string) => headers?.[k.toLowerCase()] ?? null },
      json: async () => ({}),
    };
  }

  it("429 → venter og prøver igjen, og lykkes på andre forsøk", async () => {
    vi.useFakeTimers();
    let call = 0;
    const fetchMock = vi.fn(async (url: string) => {
      call++;
      if (call === 1) return matrix429();
      return matrixOk(Array.from({ length: destinationCountOf(url) }, () => 300));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const warnings: string[] = [];
    const pending = calculateTravelTimes(ORIGIN, destinations(3), TOKEN, ["walk"], warnings);
    await vi.advanceTimersByTimeAsync(5_000);
    const result = await pending;
    vi.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.every((r) => r.walk === 5)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it("respekterer Retry-After framfor egen backoff", async () => {
    vi.useFakeTimers();
    let call = 0;
    const fetchMock = vi.fn(async (url: string) => {
      call++;
      if (call === 1) return matrix429({ "retry-after": "3" });
      return matrixOk(Array.from({ length: destinationCountOf(url) }, () => 300));
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const pending = calculateTravelTimes(ORIGIN, destinations(3), TOKEN, ["walk"]);
    // Etter 2,5 s skal retryen ennå ikke ha skjedd (Retry-After sa 3 s)
    await vi.advanceTimersByTimeAsync(2_500);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    const result = await pending;
    vi.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.every((r) => r.walk === 5)).toBe(true);
  });

  it("vedvarende 429 → warning etter oppbrukte forsøk, ingen kast", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => matrix429());
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const warnings: string[] = [];
    const pending = calculateTravelTimes(ORIGIN, destinations(3), TOKEN, ["walk"], warnings);
    await vi.advanceTimersByTimeAsync(120_000);
    const result = await pending;
    vi.useRealTimers();

    expect(fetchMock).toHaveBeenCalledTimes(5); // 1 forsøk + 4 retries
    expect(result.every((r) => r.walk === undefined)).toBe(true);
    expect(warnings.some((w) => w.includes("rate-limit") && w.includes("429"))).toBe(true);
  });
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

  it("koordinat-rekkefølgen i Matrix-URL-en er lng,lat (Mapbox-konvensjonen) — bytta akser gir plausible men gale tider", async () => {
    // En lat/lng-swap her ville gitt reisetider fra et punkt i Indiahavet —
    // tallene ser fortsatt ut som minutter, så feilen er 100 % stille på boardet.
    const fetchMock = vi.fn<(url: string) => Promise<ReturnType<typeof matrixOk>>>(
      async () => matrixOk([120, 180])
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    // To destinasjoner, ikke én: Matrix' minimum er 2 matrise-elementer.
    await calculateTravelTimes(
      { lat: 63.43, lng: 10.4 },
      [
        { id: "poi-x", coordinates: { lat: 63.44, lng: 10.41 } },
        { id: "poi-y", coordinates: { lat: 63.45, lng: 10.42 } },
      ],
      TOKEN,
      ["walk"]
    );

    const url = fetchMock.mock.calls[0][0];
    // origo først (lng,lat), deretter destinasjonene (lng,lat)
    expect(url).toContain("/10.4,63.43;10.41,63.44;10.42,63.45?");
    expect(url).toContain("/mapbox/walking/");
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
    projectPois?: { poi_id: string; travel_times?: Record<string, unknown> | null }[] | null;
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
            // Lesestien går via fetchTravelTimeRows: select→order→order→in→range
            select: vi.fn(() => {
              const builder = {
                order: vi.fn(() => builder),
                in: vi.fn(() => builder),
                range: vi.fn(async (from: number) =>
                  from === 0
                    ? { data: opts.projectPois ?? [], error: opts.ppError ?? null }
                    : { data: [], error: null }
                ),
              };
              return builder;
            }),
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

  it("skriver alle tre profiler per project_pois-rad (minutter, hver i sin nøkkel)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    const { updates } = stubClient({
      projectPois: [{ poi_id: "a" }, { poi_id: "b" }],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: 63.432, lng: 10.4 },
      ],
    });
    // Ulik durasjon per profil — en profil skrevet til feil nøkkel er da synlig.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/walking/")
          ? matrixOk([300, 660])
          : url.includes("/cycling/")
            ? matrixOk([120, 240])
            : matrixOk([60, 120])
      ) as unknown as typeof fetch
    );

    const result = await computeProjectTravelTimes({
      projectId: "proj-1",
      centerLat: ORIGIN.lat,
      centerLng: ORIGIN.lng,
    });

    expect(result.computed).toBe(2);
    expect(result.total).toBe(2);
    expect(result.coverage).toEqual({ walk: 2, bike: 2, car: 2 });
    expect(updates).toEqual([
      { travel_times: { walk: 5, bike: 2, car: 1 }, project_id: "proj-1", poi_id: "a" },
      { travel_times: { walk: 11, bike: 4, car: 2 }, project_id: "proj-1", poi_id: "b" },
    ]);
  });

  it("delvis profil-feil → POI-et beholder profilene som lyktes, dekningen viser hullet", async () => {
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
      vi.fn(async (url: string) =>
        url.includes("/cycling/")
          ? { ok: false, status: 500, json: async () => ({}) }
          : matrixOk([300, 660])
      ) as unknown as typeof fetch
    );

    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });

    expect(result.computed).toBe(2);
    expect(result.coverage).toEqual({ walk: 2, bike: 0, car: 2 });
    expect(updates.map((u) => u.travel_times)).toEqual([
      { walk: 5, car: 5 },
      { walk: 11, car: 11 },
    ]);
  });

  it("POI uten koordinater filtreres bort før bolking (påvirker ikke invarianten)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    const { updates } = stubClient({
      projectPois: [{ poi_id: "a" }, { poi_id: "b" }, { poi_id: "c" }],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: null as unknown as number, lng: 10.4 },
        { id: "c", lat: 63.433, lng: 10.4 },
      ],
    });
    const fetchMock = matrixEcho(300);
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });

    // 2 gyldige destinasjoner → én bolk på 2, ikke 3 med et hull
    expect(batchSizesFrom(fetchMock)).toEqual([2, 2, 2]); // én bolk per profil
    expect(updates.map((u) => u.poi_id)).toEqual(["a", "c"]);
    expect(result.total).toBe(3); // totalen er pool-størrelsen, ikke antall rutbare
  });

  // ── Datatap-regresjonen (2026-08-14) ────────────────────────────────────
  // update({ travel_times }) erstatter HELE jsonb-objektet. En backfill der
  // sykkel ble rate-limitet mens bil lyktes, tømte gangtiden på 31 POI-er.
  it("profil som feiler sletter IKKE en verdi som alt sto i basen", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    const { updates } = stubClient({
      projectPois: [
        { poi_id: "a", travel_times: { walk: 12 } },
        { poi_id: "b", travel_times: { walk: 30 } },
      ],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: 63.432, lng: 10.4 },
      ],
    });
    // Gå OG sykkel feiler; bare bil lykkes. Gangtiden må overleve.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/driving/")
          ? matrixOk([120, 180])
          : { ok: false, status: 500, json: async () => ({}) }
      ) as unknown as typeof fetch
    );

    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });

    expect(updates.map((u) => u.travel_times)).toEqual([
      { walk: 12, car: 2 },
      { walk: 30, car: 3 },
    ]);
    expect(result.coverage).toEqual({ walk: 2, bike: 0, car: 2 });
  });

  it("frisk verdi vinner over gammel for samme profil", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    const { updates } = stubClient({
      projectPois: [
        { poi_id: "a", travel_times: { walk: 99, bike: 99, car: 99 } },
        { poi_id: "b", travel_times: { walk: 99, bike: 99, car: 99 } },
      ],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: 63.432, lng: 10.4 },
      ],
    });
    vi.stubGlobal("fetch", matrixEcho(300) as unknown as typeof fetch);

    await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });

    expect(updates.map((u) => u.travel_times)).toEqual([
      { walk: 5, bike: 5, car: 5 },
      { walk: 5, bike: 5, car: 5 },
    ]);
  });

  it("korrupt eksisterende verdi bæres ikke videre", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    const { updates } = stubClient({
      projectPois: [
        { poi_id: "a", travel_times: { walk: "tolv", bike: null } },
        { poi_id: "b", travel_times: { walk: 8 } },
      ],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: 63.432, lng: 10.4 },
      ],
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("/driving/")
          ? matrixOk([120, 120])
          : { ok: false, status: 500, json: async () => ({}) }
      ) as unknown as typeof fetch
    );

    await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });

    expect(updates.map((u) => u.travel_times)).toEqual([{ car: 2 }, { walk: 8, car: 2 }]);
  });

  it("identisk rad skrives ikke om (idempotens: computed 0, unchanged 2)", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    const { updates } = stubClient({
      projectPois: [
        { poi_id: "a", travel_times: { walk: 5, bike: 5, car: 5 } },
        { poi_id: "b", travel_times: { walk: 5, bike: 5, car: 5 } },
      ],
      pois: [
        { id: "a", lat: 63.431, lng: 10.4 },
        { id: "b", lat: 63.432, lng: 10.4 },
      ],
    });
    vi.stubGlobal("fetch", matrixEcho(300) as unknown as typeof fetch);

    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });

    expect(updates).toEqual([]);
    expect(result.computed).toBe(0);
    expect(result.unchanged).toBe(2);
    // Dekningen er full selv om ingenting ble skrevet — den speiler basen.
    expect(result.coverage).toEqual({ walk: 2, bike: 2, car: 2 });
  });

  it("tomt POI-pool → {computed:0, total:0} uten Mapbox-kall", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
    stubClient({ projectPois: [] });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const result = await computeProjectTravelTimes({ projectId: "p", centerLat: 1, centerLng: 2 });
    expect(result).toEqual({
      computed: 0,
      unchanged: 0,
      total: 0,
      coverage: { walk: 0, bike: 0, car: 0 },
      warnings: [],
    });
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
