import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import walkingFixture from "./__fixtures__/isochrone-walking.json";
import {
  computeProjectIsochrones,
  fetchIsochronesForMode,
  mergeIsochrones,
} from "./isochrones";
import type { IsochroneContours, IsochroneSet } from "@/lib/types";

const CENTER = { lat: 63.4305, lng: 10.3951 };
const PRODUCT_ID = "11111111-1111-1111-1111-111111111111";

/** Isochrone-svaret fra fixturen, med minuttverdiene svaret faktisk bærer. */
function okResponse(body: unknown = walkingFixture) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => ({}),
    text: async () => "",
  } as unknown as Response;
}

function contoursFrom(fixture: typeof walkingFixture): IsochroneContours {
  const byMinute = Object.fromEntries(
    fixture.features.map((f) => [String(f.properties.contour), f.geometry])
  );
  return byMinute as unknown as IsochroneContours;
}

/** products-raden GET-en returnerer. */
function productRow(config: unknown) {
  return okResponse([{ id: PRODUCT_ID, config, updated_at: "2026-09-01T00:00:00Z" }]);
}

/** Svaret PATCH-en returnerer ved suksess (én rad). */
function patchOk() {
  return okResponse([{ id: PRODUCT_ID }]);
}

describe("fetchIsochronesForMode", () => {
  it("plukker ut alle tre konturene fra svaret", async () => {
    const fetchMock = vi.fn(async () => okResponse());
    vi.stubGlobal("fetch", fetchMock);
    const warnings: string[] = [];

    const contours = await fetchIsochronesForMode({
      mode: "walk",
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      token: "tok",
      warnings,
    });

    expect(contours).toBeDefined();
    expect(Object.keys(contours!).sort()).toEqual(["10", "15", "5"]);
    expect(warnings).toEqual([]);
  });

  it("kaller riktig profil-endepunkt med [lng,lat] og de tre minuttverdiene", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: unknown) => {
      calls.push(String(url));
      return okResponse();
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchIsochronesForMode({
      mode: "bike",
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      token: "tok",
      warnings: [],
    });

    const url = new URL(calls[0]);
    expect(url.pathname).toContain("/isochrone/v1/mapbox/cycling/");
    expect(url.pathname).toContain(`${CENTER.lng},${CENTER.lat}`);
    expect(url.searchParams.get("contours_minutes")).toBe("5,10,15");
    expect(url.searchParams.get("polygons")).toBe("true");
  });

  it("dropper profilen når svaret mangler en minuttverdi", async () => {
    const partial = { ...walkingFixture, features: walkingFixture.features.slice(0, 2) };
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(partial)));
    const warnings: string[] = [];

    const contours = await fetchIsochronesForMode({
      mode: "walk",
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      token: "tok",
      warnings,
    });

    expect(contours).toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("15");
  });

  it("dropper profilen når geometrien ikke validerer", async () => {
    const broken = {
      ...walkingFixture,
      features: walkingFixture.features.map((f) => ({
        ...f,
        geometry: { type: "Polygon", coordinates: [[[10.4], [10.4], [10.4], [10.4]]] },
      })),
    };
    vi.stubGlobal("fetch", vi.fn(async () => okResponse(broken)));
    const warnings: string[] = [];

    const contours = await fetchIsochronesForMode({
      mode: "walk",
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      token: "tok",
      warnings,
    });

    expect(contours).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it("advarselen bærer profil og status, aldri URL-en med tokenet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => errorResponse(422)));
    const warnings: string[] = [];

    await fetchIsochronesForMode({
      mode: "car",
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      token: "hemmelig-token",
      warnings,
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("car");
    expect(warnings[0]).toContain("422");
    expect(warnings[0]).not.toContain("hemmelig-token");
    expect(warnings[0]).not.toContain("access_token");
  });
});

describe("mergeIsochrones", () => {
  const contours = contoursFrom(walkingFixture);

  it("fersk profil vinner over eksisterende", () => {
    const existing: IsochroneSet = {
      isochronesVersion: 1,
      fetchedAt: "2026-01-01T00:00:00.000Z",
      byMode: { walk: contours },
    };
    const merged = mergeIsochrones(existing, { walk: contours }, "2026-09-03T00:00:00.000Z");
    expect(merged?.fetchedAt).toBe("2026-09-03T00:00:00.000Z");
  });

  it("beholder en profil som mangler i denne kjøringen", () => {
    const existing: IsochroneSet = {
      isochronesVersion: 1,
      fetchedAt: "2026-01-01T00:00:00.000Z",
      byMode: { bike: contours },
    };
    const merged = mergeIsochrones(existing, { walk: contours }, "2026-09-03T00:00:00.000Z");
    expect(merged?.byMode.walk).toBeDefined();
    expect(merged?.byMode.bike).toBeDefined();
  });

  it("gir undefined når resultatet ville vært tomt", () => {
    expect(mergeIsochrones(undefined, {}, "2026-09-03T00:00:00.000Z")).toBeUndefined();
  });
});

describe("computeProjectIsochrones", () => {
  // Bare nøklene testen faktisk rører restaureres. Å bytte ut HELE
  // `process.env` river bort nøkler andre testfiler i samme worker satte, og
  // ga flakete feil i urelaterte filer (målt 2026-09-03).
  const TOUCHED = [
    "MAPBOX_TOKEN",
    "NEXT_PUBLIC_MAPBOX_TOKEN",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ] as const;
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of TOUCHED) saved.set(key, process.env[key]);
    process.env.MAPBOX_TOKEN = "tok";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  });

  afterEach(() => {
    for (const key of TOUCHED) {
      const value = saved.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    vi.unstubAllGlobals();
  });

  it("tre 200-svar gir tre profiler med tre konturer hver og et fetchedAt (AE1)", async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      const href = String(url);
      if (href.includes("/isochrone/")) return okResponse();
      if (href.includes("/rest/v1/products")) return productRow({ reportConfig: {} });
      throw new Error(`uventet kall: ${href}`);
    });
    // PATCH-en treffer samme products-URL; skill på metode.
    const fetchWithMethod = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (init?.method === "PATCH") return patchOk();
      return fetchMock(url);
    });
    vi.stubGlobal("fetch", fetchWithMethod);

    const result = await computeProjectIsochrones({
      productId: PRODUCT_ID,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      now: new Date("2026-09-03T10:00:00.000Z"),
    });

    expect(result.skipped).toBeUndefined();
    expect(result.fetched).toEqual(["walk", "bike", "car"]);
    expect(result.isochrones?.fetchedAt).toBe("2026-09-03T10:00:00.000Z");
    for (const mode of ["walk", "bike", "car"] as const) {
      expect(Object.keys(result.isochrones!.byMode[mode]!).sort()).toEqual(["10", "15", "5"]);
    }
  });

  it("429 på sykkel og 200 på de to andre lagrer to profiler med én advarsel (AE2)", async () => {
    let bikeCalls = 0;
    const fetchWithMethod = vi.fn(async (url: unknown, init?: RequestInit) => {
      const href = String(url);
      if (init?.method === "PATCH") return patchOk();
      if (href.includes("/isochrone/v1/mapbox/cycling/")) {
        bikeCalls++;
        return errorResponse(429);
      }
      if (href.includes("/isochrone/")) return okResponse();
      if (href.includes("/rest/v1/products")) return productRow({ reportConfig: {} });
      throw new Error(`uventet kall: ${href}`);
    });
    vi.stubGlobal("fetch", fetchWithMethod);

    const result = await computeProjectIsochrones({
      productId: PRODUCT_ID,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
      now: new Date("2026-09-03T10:00:00.000Z"),
      sleepImpl: async () => undefined,
    });

    expect(result.fetched).toEqual(["walk", "car"]);
    expect(result.isochrones?.byMode.bike).toBeUndefined();
    expect(result.warnings.filter((w) => w.includes("429"))).toHaveLength(1);
    expect(bikeCalls).toBeGreaterThan(1); // retry-budsjettet ble brukt
  });

  it("beholder eksisterende sykkel-kontur når sykkel feiler i denne kjøringen", async () => {
    const existing = {
      reportConfig: {
        isochrones: {
          isochronesVersion: 1,
          fetchedAt: "2026-01-01T00:00:00.000Z",
          byMode: { bike: contoursFrom(walkingFixture) },
        },
      },
    };
    const fetchWithMethod = vi.fn(async (url: unknown, init?: RequestInit) => {
      const href = String(url);
      if (init?.method === "PATCH") return patchOk();
      if (href.includes("/isochrone/v1/mapbox/cycling/")) return errorResponse(500);
      if (href.includes("/isochrone/")) return okResponse();
      if (href.includes("/rest/v1/products")) return productRow(existing);
      throw new Error(`uventet kall: ${href}`);
    });
    vi.stubGlobal("fetch", fetchWithMethod);

    const result = await computeProjectIsochrones({
      productId: PRODUCT_ID,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
    });

    expect(result.isochrones?.byMode.bike).toBeDefined();
    expect(result.isochrones?.byMode.walk).toBeDefined();
  });

  it("alle tre feiler: ingen skriving, advarsel, ingen kast (AE3)", async () => {
    const fetchWithMethod = vi.fn(async (url: unknown, init?: RequestInit) => {
      const href = String(url);
      if (init?.method === "PATCH") throw new Error("PATCH skulle ikke skjedd");
      if (href.includes("/isochrone/")) return errorResponse(500);
      return productRow({ reportConfig: {} });
    });
    vi.stubGlobal("fetch", fetchWithMethod);

    const result = await computeProjectIsochrones({
      productId: PRODUCT_ID,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
    });

    expect(result.skipped).toBe(true);
    expect(result.fetched).toEqual([]);
    expect(result.isochrones).toBeUndefined();
    expect(fetchWithMethod.mock.calls.some(([, init]) => (init as RequestInit)?.method === "PATCH")).toBe(false);
  });

  it("config lest som JSON-streng skrives tilbake som JSON-streng", async () => {
    let patchedBody: string | undefined;
    const fetchWithMethod = vi.fn(async (url: unknown, init?: RequestInit) => {
      const href = String(url);
      if (init?.method === "PATCH") {
        patchedBody = init.body as string;
        return patchOk();
      }
      if (href.includes("/isochrone/")) return okResponse();
      return productRow(JSON.stringify({ reportConfig: { label: "beholdes" } }));
    });
    vi.stubGlobal("fetch", fetchWithMethod);

    await computeProjectIsochrones({
      productId: PRODUCT_ID,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
    });

    const parsed = JSON.parse(patchedBody!) as { config: unknown };
    expect(typeof parsed.config).toBe("string");
    const config = JSON.parse(parsed.config as string) as {
      reportConfig: { label: string; isochrones: unknown };
    };
    expect(config.reportConfig.label).toBe("beholdes");
    expect(config.reportConfig.isochrones).toBeDefined();
  });

  it("manglende Mapbox-token gir advarsel og ingen kall", async () => {
    delete process.env.MAPBOX_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await computeProjectIsochrones({
      productId: PRODUCT_ID,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
    });

    expect(result.skipped).toBe(true);
    expect(result.warnings[0]).toContain("MAPBOX_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("optimistisk lås som ryker gir advarsel, ikke kast", async () => {
    const fetchWithMethod = vi.fn(async (url: unknown, init?: RequestInit) => {
      const href = String(url);
      if (init?.method === "PATCH") return okResponse([]); // 0 rader
      if (href.includes("/isochrone/")) return okResponse();
      return productRow({ reportConfig: {} });
    });
    vi.stubGlobal("fetch", fetchWithMethod);

    const result = await computeProjectIsochrones({
      productId: PRODUCT_ID,
      centerLat: CENTER.lat,
      centerLng: CENTER.lng,
    });

    expect(result.skipped).toBe(true);
    expect(result.warnings.some((w) => w.includes("Optimistisk lås"))).toBe(true);
  });
});
