import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

/**
 * Kontrakt-vakter for r11.6 (PRD 11 Unit 6): /api/travel-times-proxyen ble portet
 * verbatim — koden fantes alt og matchet alle AC 1:1, kun kommentar-delta.
 *
 * Maskinfester: profil-mapping, <=24-destinations-grense, POST/GET dup-logikk,
 * durationMinutes-ceil, 400/500-error-håndtering, og token-i-URL-aldri-logginggarantien.
 */

const TOKEN = "pk.test-matrix-token";

/** Minimal Mapbox Matrix v1-respons med én destinasjon. */
function matrixOkBody(durationSeconds: number | null = 120) {
  return { code: "Ok", durations: [[durationSeconds]] };
}

function stubFetchOk(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
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
// AC1 POST — profil-mapping
// ---------------------------------------------------------------------------

describe("travel-times POST — profil-mapping (AC1)", () => {
  const profiles: Array<[string, string]> = [
    ["walk", "walking"],
    ["bike", "cycling"],
    ["car", "driving"],
    ["walking", "walking"],
    ["cycling", "cycling"],
    ["driving", "driving"],
  ];

  for (const [input, expected] of profiles) {
    it(`mapper "${input}" → "${expected}" i Mapbox Matrix URL`, async () => {
      stubFetchOk(matrixOkBody());
      const res = await POST(
        new NextRequest("http://localhost/api/travel-times", {
          method: "POST",
          body: JSON.stringify({
            origin: { lat: 63.43, lng: 10.4 },
            destinations: [{ lat: 63.44, lng: 10.41 }],
            profile: input,
          }),
        }),
      );
      expect(res.status).toBe(200);
      expect(capturedUrl()).toContain(`/mapbox/${expected}/`);
    });
  }

  it("ukjent profil faller tilbake til walking", async () => {
    stubFetchOk(matrixOkBody());
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({
          origin: { lat: 63.43, lng: 10.4 },
          destinations: [{ lat: 63.44, lng: 10.41 }],
          profile: "hoverskate",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(capturedUrl()).toContain("/mapbox/walking/");
  });
});

// ---------------------------------------------------------------------------
// AC1 POST — 24-destinations-grense
// ---------------------------------------------------------------------------

describe("travel-times POST — 24-destinations-grense (AC1)", () => {
  const dest = { lat: 63.44, lng: 10.41 };
  const origin = { lat: 63.43, lng: 10.4 };

  it("24 destinations er innenfor grensen (200)", async () => {
    stubFetchOk({ code: "Ok", durations: [Array(24).fill(60)] });
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({ origin, destinations: Array(24).fill(dest) }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(24);
  });

  it("25 destinations → 400 (over grense)", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn as unknown as typeof fetch);
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({ origin, destinations: Array(25).fill(dest) }),
      }),
    );
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });

  it("tom destinations-array → 200 med tomme resultater (ingen fetch)", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn as unknown as typeof fetch);
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({ origin, destinations: [] }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).results).toHaveLength(0);
    expect(fn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC1 POST — durationMinutes-ceil-konvertering
// ---------------------------------------------------------------------------

describe("travel-times POST — durationMinutes ceil(sek/60) (AC1)", () => {
  const origin = { lat: 63.43, lng: 10.4 };

  it("konverterer sekunder til minutter via ceil", async () => {
    stubFetchOk({ code: "Ok", durations: [[61, 120, 121]] });
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({
          origin,
          destinations: [
            { lat: 63.44, lng: 10.41 },
            { lat: 63.45, lng: 10.42 },
            { lat: 63.46, lng: 10.43 },
          ],
        }),
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results[0].durationMinutes).toBe(2); // ceil(61/60)
    expect(json.results[1].durationMinutes).toBe(2); // ceil(120/60)
    expect(json.results[2].durationMinutes).toBe(3); // ceil(121/60)
  });

  it("null duration → durationMinutes null", async () => {
    stubFetchOk({ code: "Ok", durations: [[null]] });
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({
          origin,
          destinations: [{ lat: 63.44, lng: 10.41 }],
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).results[0].durationMinutes).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC1 POST — error-håndtering
// ---------------------------------------------------------------------------

describe("travel-times POST — error-håndtering (AC1)", () => {
  const origin = { lat: 63.43, lng: 10.4 };
  const destinations = [{ lat: 63.44, lng: 10.41 }];

  it("400 når origin mangler", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn as unknown as typeof fetch);
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({ destinations }),
      }),
    );
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });

  it("400 når destinations er ikke-array", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn as unknown as typeof fetch);
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({ origin, destinations: "invalid" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });

  it("500 ved Mapbox-feil (ok=false)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => "service unavailable",
      })) as unknown as typeof fetch,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({ origin, destinations }),
      }),
    );
    expect(res.status).toBe(500);
  });

  it("500 ved manglende token", async () => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    const res = await POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        body: JSON.stringify({ origin, destinations }),
      }),
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// AC1 GET — dup-logikk (speil av POST via query-params)
// ---------------------------------------------------------------------------

describe("travel-times GET — dup-logikk (AC1)", () => {
  it("parser origin og destinations fra query-params og returnerer resultater", async () => {
    stubFetchOk({ code: "Ok", durations: [[90, 180]] });
    const res = await GET(
      new NextRequest(
        "http://localhost/api/travel-times?origin=63.43,10.4&destinations=63.44,10.41;63.45,10.42",
      ),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(2);
    expect(json.results[0].durationMinutes).toBe(2); // ceil(90/60)
    expect(json.results[1].durationMinutes).toBe(3); // ceil(180/60)
  });

  it("400 når origin eller destinations mangler", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn as unknown as typeof fetch);
    const res = await GET(
      new NextRequest("http://localhost/api/travel-times?origin=63.43,10.4"),
    );
    expect(res.status).toBe(400);
    expect(fn).not.toHaveBeenCalled();
  });

  it("500 ved manglende token (GET)", async () => {
    vi.unstubAllGlobals();
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_TOKEN", "");
    const res = await GET(
      new NextRequest(
        "http://localhost/api/travel-times?origin=63.43,10.4&destinations=63.44,10.41",
      ),
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// AC1 — Mapbox token-i-URL: offentlig token + aldri logg URL
// ---------------------------------------------------------------------------

describe("travel-times source-vakt — token-i-URL + aldri-logg-garanti (AC1)", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "api", "travel-times", "route.ts"),
    "utf8",
  );

  it("access_token er i URL-querystring (Mapbox Matrix-kontrakt, offentlig token)", () => {
    expect(src).toContain("access_token=${mapboxToken}");
  });

  it("bruker NEXT_PUBLIC_MAPBOX_TOKEN (bevisst klient-eksponert)", () => {
    expect(src).toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
  });

  it("console.error logger IKKE url-variabelen i POST catch-blokk (token aldri i logg)", () => {
    const firstCatch = src.slice(src.indexOf("} catch (error)"));
    expect(firstCatch).not.toMatch(/console\.\w+\([^)]*url/);
  });

  it("har dokumentert Mapbox token-rationale + Logg aldri-garanti", () => {
    expect(src).toContain("NEXT_PUBLIC_MAPBOX_TOKEN");
    expect(src).toContain("Logg aldri");
  });

  it("har no-live-board-consumer-note (reference-only-klassifisering)", () => {
    expect(src).toContain("INGEN live board-konsument");
  });
});

// ---------------------------------------------------------------------------
// Rate-limit (bead 3uc) — 429 over grensen, delt kvote POST+GET, andre IP-er OK
// ---------------------------------------------------------------------------

describe("travel-times — per-IP rate-limit (3uc)", () => {
  // NB: limiteren er modul-nivå og deler tilstand over hele testfila.
  // Testene her bruker dedikerte IP-er så de ikke berører "unknown"-bøtta
  // som resten av fila bruker (godt under 60 kall totalt).
  function postFrom(ip: string) {
    return POST(
      new NextRequest("http://localhost/api/travel-times", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({
          origin: { lat: 63.43, lng: 10.4 },
          destinations: [{ lat: 63.44, lng: 10.41 }],
        }),
      }),
    );
  }

  it("POST returnerer 429 uten oppstrøms-kall når per-IP-grensen (60/min) er brukt opp", async () => {
    stubFetchOk(matrixOkBody());
    for (let i = 0; i < 60; i++) {
      expect((await postFrom("198.51.100.30")).status).toBe(200);
    }
    const res = await postFrom("198.51.100.30");
    expect(res.status).toBe(429);
    // Oppstrøms Mapbox skal IKKE belastes for avviste kall.
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(60);
  });

  it("GET deler kvote med POST (samme rute, samme limiter-instans)", async () => {
    stubFetchOk(matrixOkBody());
    // 198.51.100.30 er strupet via POST i forrige test (samme modul-instans).
    const res = await GET(
      new NextRequest(
        "http://localhost/api/travel-times?origin=63.43,10.4&destinations=63.44,10.41",
        { headers: { "x-forwarded-for": "198.51.100.30" } },
      ),
    );
    expect(res.status).toBe(429);
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  it("struper ikke andre IP-er når én IP er over grensen", async () => {
    stubFetchOk(matrixOkBody());
    expect((await postFrom("198.51.100.40")).status).toBe(200);
  });
});
