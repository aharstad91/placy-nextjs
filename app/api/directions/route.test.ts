import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET } from "./route";

/**
 * Kontrakt-vakter for r11.5 (PRD 11 Unit 5): /api/directions-proxyen ble portet
 * nær-verbatim — koden fantes alt og matchet alle AC 1:1, ingen omskriving.
 *
 * Maskinfester: profil-mapping, origin/dest + waypoints-form, routes-form
 * (min→duration), 400/404/500, og token-i-URL-aldri-logginggarantien.
 */

const TOKEN = "pk.test-mapbox-token";

function stubFetchOk(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
    })) as unknown as typeof fetch,
  );
}

function capturedUrl() {
  const mockFetch = vi.mocked(global.fetch);
  const [url] = mockFetch.mock.calls[0] as [string, ...unknown[]];
  return url;
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", TOKEN);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC1 — profil-mapping
// ---------------------------------------------------------------------------

describe("directions GET — profil-mapping (AC1)", () => {
  const profiles: Array<[string, string]> = [
    ["walk", "walking"],
    ["bike", "cycling"],
    ["car", "driving"],
    ["walking", "walking"],
    ["cycling", "cycling"],
    ["driving", "driving"],
  ];

  for (const [input, expected] of profiles) {
    it(`mapper "${input}" → "${expected}" i Mapbox-URL`, async () => {
      stubFetchOk({ routes: [{ duration: 120, distance: 500, geometry: { type: "LineString", coordinates: [[10, 63], [10.01, 63.01]] } }] });
      const req = new NextRequest(
        `http://localhost/api/directions?origin=10,63&destination=10.01,63.01&profile=${input}`,
      );
      const res = await GET(req);
      expect(res.status).toBe(200);
      const url = capturedUrl();
      expect(url).toContain(`/mapbox/${expected}/`);
    });
  }

  it("ukjent profil faller tilbake til walking", async () => {
    stubFetchOk({ routes: [{ duration: 60, distance: 200, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }] });
    const req = new NextRequest(
      "http://localhost/api/directions?origin=0,0&destination=1,1&profile=teleport",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(capturedUrl()).toContain("/mapbox/walking/");
  });
});

// ---------------------------------------------------------------------------
// AC1 — origin/destination + waypoints-form
// ---------------------------------------------------------------------------

describe("directions GET — koordinat-former (AC1)", () => {
  beforeEach(() => {
    stubFetchOk({
      routes: [
        { duration: 180, distance: 800, geometry: { type: "LineString", coordinates: [[10, 63], [10.01, 63.01]] } },
      ],
    });
  });

  it("origin/destination → semikolon-separert i URL", async () => {
    const req = new NextRequest(
      "http://localhost/api/directions?origin=10.4,63.4&destination=10.41,63.41",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const url = capturedUrl();
    expect(url).toContain("10.4,63.4;10.41,63.41");
  });

  it("waypoints-form sendes direkte til Mapbox", async () => {
    const req = new NextRequest(
      "http://localhost/api/directions?waypoints=10.4,63.4;10.41,63.41;10.42,63.42",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const url = capturedUrl();
    expect(url).toContain("10.4,63.4;10.41,63.41;10.42,63.42");
  });
});

// ---------------------------------------------------------------------------
// AC1 — routes-form (min→duration-konvertering)
// ---------------------------------------------------------------------------

describe("directions GET — routes-form duration (AC1)", () => {
  it("konverterer duration fra sekunder til minutter (ceil) og bevarer routes[]", async () => {
    stubFetchOk({
      routes: [
        { duration: 605, distance: 1200, geometry: { type: "LineString", coordinates: [[10, 63], [10.01, 63.01]] } },
        { duration: 730, distance: 1500, geometry: { type: "LineString", coordinates: [[10, 63], [10.02, 63.02]] } },
      ],
    });
    const req = new NextRequest(
      "http://localhost/api/directions?origin=10,63&destination=10.01,63.01",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();

    // Top-level felt (første rute)
    expect(json.duration).toBe(11); // ceil(605/60) = 11
    expect(json.distance).toBe(1200);

    // routes[] inkluderer alle ruter med konvertert duration
    expect(json.routes).toHaveLength(2);
    expect(json.routes[0].duration).toBe(11); // ceil(605/60)
    expect(json.routes[1].duration).toBe(13); // ceil(730/60)
  });
});

// ---------------------------------------------------------------------------
// AC1 — 400/404/500 error-håndtering
// ---------------------------------------------------------------------------

describe("directions GET — error-håndtering (AC1)", () => {
  it("400 når verken waypoints eller origin/destination er oppgitt", async () => {
    const fn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    vi.stubGlobal("fetch", fn as unknown as typeof fetch);
    const res = await GET(new NextRequest("http://localhost/api/directions"));
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });

  it("404 når Mapbox returnerer tom routes[]", async () => {
    stubFetchOk({ routes: [] });
    const res = await GET(
      new NextRequest("http://localhost/api/directions?origin=0,0&destination=1,1"),
    );
    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/no route/i);
  });

  it("500 ved ekstern fetch-feil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })) as unknown as typeof fetch,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET(
      new NextRequest("http://localhost/api/directions?origin=0,0&destination=1,1"),
    );
    expect(res.status).toBe(500);
  });

  it("500 ved manglende Mapbox-token", async () => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    const res = await GET(
      new NextRequest("http://localhost/api/directions?origin=0,0&destination=1,1"),
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Mapbox token-i-URL: offentlig token + aldri logg URL
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Rate-limit (bead 3uc) — 429 over grensen, andre IP-er upåvirket
// ---------------------------------------------------------------------------

describe("directions GET — per-IP rate-limit (3uc)", () => {
  // NB: limiteren er modul-nivå og deler tilstand over hele testfila.
  // Testene her bruker dedikerte IP-er så de ikke berører "unknown"-bøtta
  // som resten av fila bruker (godt under 60 kall totalt).
  const okBody = {
    routes: [{ duration: 60, distance: 200, geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }],
  };

  function reqFrom(ip: string) {
    return new NextRequest(
      "http://localhost/api/directions?origin=0,0&destination=1,1",
      { headers: { "x-forwarded-for": ip } },
    );
  }

  it("returnerer 429 uten oppstrøms-kall når per-IP-grensen (60/min) er brukt opp", async () => {
    stubFetchOk(okBody);
    for (let i = 0; i < 60; i++) {
      expect((await GET(reqFrom("198.51.100.10"))).status).toBe(200);
    }
    const res = await GET(reqFrom("198.51.100.10"));
    expect(res.status).toBe(429);
    // Oppstrøms Mapbox skal IKKE belastes for avviste kall.
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(60);
  });

  it("struper ikke andre IP-er når én IP er over grensen", async () => {
    stubFetchOk(okBody);
    // 198.51.100.10 er allerede strupet fra forrige test (samme modul-instans).
    expect((await GET(reqFrom("198.51.100.10"))).status).toBe(429);
    expect((await GET(reqFrom("198.51.100.20"))).status).toBe(200);
  });
});

describe("directions source-vakt — token-i-URL + aldri-logg-garanti (AC2)", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "api", "directions", "route.ts"),
    "utf8",
  );

  it("access_token er i URL-querystring (Mapbox-kontrakt, offentlig token)", () => {
    expect(src).toContain("access_token=${mapboxToken}");
  });

  it("bruker NEXT_PUBLIC_MAPBOX_TOKEN (bevisst klient-eksponert)", () => {
    expect(src).toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
  });

  it("console.error logger IKKE url-variabelen (token aldri i logg)", () => {
    // Error-handleren logger kun `error`-objektet, ikke `url`.
    const errorBlock = src.slice(src.indexOf("catch (error)"));
    expect(errorBlock).not.toMatch(/console\.\w+\(.*url/);
  });

  it("har dokumentert token-i-URL-rationale i kommentar", () => {
    expect(src).toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
    expect(src).toContain("Logg aldri");
  });
});
