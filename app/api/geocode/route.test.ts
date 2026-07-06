import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET } from "./route";
import { geocodeAddress } from "@/lib/pipeline/geocode";

/**
 * Kontrakt-vakter for bead aod: runtime-autocomplete portet fra Mapbox
 * Geocoding v5 til v6 via den DELTE pipeline-implementasjonen.
 *
 * Maskinfester: responskontrakten konsumentene (ReportAddressInput/
 * AddressAutocomplete) leser ({ features: [{ id, place_name, center }] }),
 * 400/500-håndtering, per-IP rate-limit, og at v5 aldri sniker seg tilbake.
 */

vi.mock("@/lib/pipeline/geocode", () => ({
  geocodeAddress: vi.fn(),
}));

const geocodeMock = vi.mocked(geocodeAddress);

function v6Result(overrides: Partial<ReturnType<typeof baseResult>> = {}) {
  return { ...baseResult(), ...overrides };
}

function baseResult() {
  return {
    placeName: "Storgata 1, 0155 Oslo, Norge",
    lat: 59.9139,
    lng: 10.7522,
    confidence: 1,
    city: "Oslo",
    region: "Oslo",
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("geocode GET — responskontrakt mot autocomplete-konsumentene", () => {
  it("mapper v6-treff til { features: [{ id, place_name, center: [lng, lat] }] }", async () => {
    geocodeMock.mockResolvedValueOnce([
      v6Result(),
      v6Result({ placeName: "Storgata 1, 7030 Trondheim, Norge", lat: 63.43, lng: 10.39 }),
    ]);
    const res = await GET(new NextRequest("http://localhost/api/geocode?q=Storgata+1"));
    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.features).toHaveLength(2);
    expect(json.features[0]).toEqual({
      id: "geocode-v6-0",
      place_name: "Storgata 1, 0155 Oslo, Norge",
      center: [10.7522, 59.9139], // [lng, lat] — rekkefølgen konsumentene destrukturerer
    });
    expect(json.features[1].center).toEqual([10.39, 63.43]);
    expect(geocodeMock).toHaveBeenCalledWith("Storgata 1");
  });

  it("tom treffliste → features: [] (ikke undefined)", async () => {
    geocodeMock.mockResolvedValueOnce([]);
    const res = await GET(new NextRequest("http://localhost/api/geocode?q=xyzzy"));
    expect(res.status).toBe(200);
    expect((await res.json()).features).toEqual([]);
  });
});

describe("geocode GET — error-håndtering", () => {
  it("400 uten q — geocodeAddress kalles ikke", async () => {
    const res = await GET(new NextRequest("http://localhost/api/geocode"));
    expect(res.status).toBe(400);
    expect(geocodeMock).not.toHaveBeenCalled();
  });

  it("500 når geocodeAddress kaster (manglende token / oppstrøms-feil)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    geocodeMock.mockRejectedValueOnce(new Error("Mapbox geocode feila: 503"));
    const res = await GET(new NextRequest("http://localhost/api/geocode?q=Storgata"));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Geocoding failed");
  });
});

describe("geocode GET — per-IP rate-limit (DECISIONS-QUEUE #2-mønsteret)", () => {
  // Limiteren er modul-nivå og deler tilstand over hele testfila — bruk
  // dedikerte IP-er så resten av fila («unknown»-bøtta) ikke berøres.
  function reqFrom(ip: string) {
    return new NextRequest("http://localhost/api/geocode?q=Storgata", {
      headers: { "x-forwarded-for": ip },
    });
  }

  it("429 uten oppstrøms-kall når grensen (60/min) er brukt opp", async () => {
    geocodeMock.mockResolvedValue([v6Result()]);
    for (let i = 0; i < 60; i++) {
      expect((await GET(reqFrom("198.51.100.30"))).status).toBe(200);
    }
    const res = await GET(reqFrom("198.51.100.30"));
    expect(res.status).toBe(429);
    expect(geocodeMock).toHaveBeenCalledTimes(60);
  });

  it("struper ikke andre IP-er når én IP er over grensen", async () => {
    geocodeMock.mockResolvedValue([v6Result()]);
    expect((await GET(reqFrom("198.51.100.30"))).status).toBe(429);
    expect((await GET(reqFrom("198.51.100.40"))).status).toBe(200);
  });
});

describe("geocode source-vakt — v6 via delt implementasjon, v5 aldri tilbake", () => {
  const src = readFileSync(
    join(process.cwd(), "app", "api", "geocode", "route.ts"),
    "utf8"
  );

  it("konsumerer den delte v6-implementasjonen fra pipelinen", () => {
    expect(src).toContain('from "@/lib/pipeline/geocode"');
  });

  it("ingen v5-endepunkt og ingen egen Mapbox-URL i ruten", () => {
    expect(src).not.toContain("geocoding/v5");
    expect(src).not.toContain("api.mapbox.com");
  });
});
