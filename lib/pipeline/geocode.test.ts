import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  geocodeAddress,
  getKommunenummer,
  meetsGeocodeConfidence,
  GEOCODE_CONFIDENCE_THRESHOLD,
  type GeocodeResult,
} from "./geocode";

/** Bygg en Mapbox Geocoding v6-feature. */
function v6Feature(opts: {
  confidence?: string;
  full_address?: string;
  coordinates?: [number, number];
  propsCoordinates?: { longitude: number; latitude: number };
  place?: string;
  locality?: string;
  region?: string;
}) {
  return {
    geometry: opts.coordinates ? { coordinates: opts.coordinates } : undefined,
    properties: {
      full_address: opts.full_address,
      coordinates: opts.propsCoordinates,
      match_code: opts.confidence ? { confidence: opts.confidence } : undefined,
      context: {
        place: opts.place ? { name: opts.place } : undefined,
        locality: opts.locality ? { name: opts.locality } : undefined,
        region: opts.region ? { name: opts.region } : undefined,
      },
    },
  };
}

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

beforeEach(() => {
  process.env.MAPBOX_TOKEN = "pk.test-token";
});
afterEach(() => vi.unstubAllGlobals());

describe("geocodeAddress (Mapbox v6)", () => {
  it("AC1: returnerer typet GeocodeResult[] fra v6-respons (ingen any)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, {
        features: [
          v6Feature({
            confidence: "exact",
            full_address: "Ferjemannsveien 10, 7042 Trondheim",
            coordinates: [10.4, 63.43],
            place: "Trondheim",
            region: "Trøndelag",
          }),
        ],
      }),
    );

    const results = await geocodeAddress("Ferjemannsveien 10");
    expect(results).toHaveLength(1);
    const r: GeocodeResult = results[0];
    expect(r.placeName).toBe("Ferjemannsveien 10, 7042 Trondheim");
    expect(r.lng).toBe(10.4);
    expect(r.lat).toBe(63.43);
    expect(r.confidence).toBe(1);
    expect(r.city).toBe("Trondheim");
    expect(r.region).toBe("Trøndelag");
  });

  it("AC2: bruker v6-endepunktet (search/geocode/v6/forward), ikke v5", async () => {
    const spy = mockFetch(200, { features: [] });
    vi.stubGlobal("fetch", spy);
    await geocodeAddress("Storgata 1");
    const url = (spy as unknown as { mock: { calls: [string][] } }).mock.calls[0][0];
    expect(url).toContain("/search/geocode/v6/forward");
    expect(url).not.toContain("/geocoding/v5/");
    expect(url).toContain("q=Storgata%201");
  });

  it("AC2: confidence-mapping exact→1, high→0.75, medium→0.4, low→0.2, ukjent→0", async () => {
    const cases: [string | undefined, number][] = [
      ["exact", 1],
      ["high", 0.75],
      ["medium", 0.4],
      ["low", 0.2],
      [undefined, 0],
      ["garbage", 0],
    ];
    for (const [conf, expected] of cases) {
      vi.stubGlobal(
        "fetch",
        mockFetch(200, { features: [v6Feature({ confidence: conf, coordinates: [10, 63] })] }),
      );
      const [r] = await geocodeAddress("x");
      expect(r.confidence, `confidence=${conf}`).toBe(expected);
    }
  });

  it("AC1: faller tilbake til properties.coordinates når geometry mangler", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, {
        features: [v6Feature({ confidence: "high", propsCoordinates: { longitude: 5.3, latitude: 60.4 } })],
      }),
    );
    const [r] = await geocodeAddress("Bergen");
    expect(r.lng).toBe(5.3);
    expect(r.lat).toBe(60.4);
  });

  it("kaster ved ikke-ok respons", async () => {
    vi.stubGlobal("fetch", mockFetch(429, {}));
    await expect(geocodeAddress("x")).rejects.toThrow(/Mapbox geocode feila: 429/);
  });

  it("AC4: kaster når MAPBOX_TOKEN mangler (server-side token)", async () => {
    delete process.env.MAPBOX_TOKEN;
    delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    vi.stubGlobal("fetch", mockFetch(200, { features: [] }));
    await expect(geocodeAddress("x")).rejects.toThrow(/MAPBOX_TOKEN/);
  });
});

describe("meetsGeocodeConfidence — load-bearing avbryt-gate (AC5)", () => {
  const make = (confidence: number): GeocodeResult => ({
    placeName: "x",
    lat: 0,
    lng: 0,
    confidence,
  });

  it("terskelen er 0.5", () => {
    expect(GEOCODE_CONFIDENCE_THRESHOLD).toBe(0.5);
  });

  it("PASSERER på høy confidence (exact=1, high=0.75) — gaten avbryter IKKE", () => {
    expect(meetsGeocodeConfidence(make(1))).toBe(true);
    expect(meetsGeocodeConfidence(make(0.75))).toBe(true);
  });

  it("AVBRYTER på lav confidence (medium=0.4, low=0.2, ukjent=0)", () => {
    expect(meetsGeocodeConfidence(make(0.4))).toBe(false);
    expect(meetsGeocodeConfidence(make(0.2))).toBe(false);
    expect(meetsGeocodeConfidence(make(0))).toBe(false);
  });
});

describe("getKommunenummer (Kartverket, fail-soft)", () => {
  it("AC3: returnerer KommuneInfo med padStart(4) ved treff", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, { kommunenummer: 301, kommunenavn: "Oslo" }),
    );
    const k = await getKommunenummer(59.9, 10.7);
    expect(k).toEqual({ kommunenummer: "0301", kommunenavn: "Oslo" });
  });

  it("AC3: fail-soft → null ved ikke-ok (kaster ikke)", async () => {
    vi.stubGlobal("fetch", mockFetch(503, {}));
    await expect(getKommunenummer(59.9, 10.7)).resolves.toBeNull();
  });

  it("AC3: fail-soft → null når fetch kaster (kaster ikke videre)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }) as unknown as typeof fetch,
    );
    await expect(getKommunenummer(59.9, 10.7)).resolves.toBeNull();
  });
});
