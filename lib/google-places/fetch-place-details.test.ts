import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchPlaceDetails,
  OPENING_HOURS_FIELDS,
  TRUST_ENRICHMENT_FIELDS,
} from "./fetch-place-details";
import { PlacesApiError, isQuotaError } from "./errors";

function mockFetch(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("fetchPlaceDetails (Places API New)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("bruker Places-New header-auth (X-Goog-Api-Key + X-Goog-FieldMask), ALDRI key=querystring", async () => {
    const fetchSpy = mockFetch(200, { rating: 4.5, userRatingCount: 120 });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchPlaceDetails("ChIJxyz", "secret-key", TRUST_ENRICHMENT_FIELDS);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchSpy as unknown as { mock: { calls: [string, RequestInit & { headers: Record<string, string> }][] } }).mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJxyz");
    expect(url).not.toContain("key=");
    expect(init.headers["X-Goog-Api-Key"]).toBe("secret-key");
    expect(init.headers["X-Goog-FieldMask"]).toBe(TRUST_ENRICHMENT_FIELDS.join(","));
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("mapper Places-New camelCase-felt til PlaceDetails-shapen", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(200, {
        rating: 4.2,
        userRatingCount: 88,
        websiteUri: "https://example.no",
        nationalPhoneNumber: "+47 12 34 56 78",
        regularOpeningHours: { weekdayDescriptions: ["Man: 09–17"], openNow: true },
        businessStatus: "OPERATIONAL",
        priceLevel: "PRICE_LEVEL_MODERATE",
        photos: [{ name: "places/ChIJ/photos/AUc" }],
      }),
    );

    const d = await fetchPlaceDetails("ChIJ", "k");
    expect(d).toEqual({
      rating: 4.2,
      reviewCount: 88,
      website: "https://example.no",
      phone: "+47 12 34 56 78",
      openingHours: ["Man: 09–17"],
      isOpen: true,
      businessStatus: "OPERATIONAL",
      priceLevel: 2,
      photos: [{ reference: "places/ChIJ/photos/AUc" }],
    });
  });

  it("mapper priceLevel-enum: FREE→0, VERY_EXPENSIVE→4, UNSPECIFIED→undefined", async () => {
    const cases: [string, number | undefined][] = [
      ["PRICE_LEVEL_FREE", 0],
      ["PRICE_LEVEL_VERY_EXPENSIVE", 4],
      ["PRICE_LEVEL_UNSPECIFIED", undefined],
    ];
    for (const [enumVal, expected] of cases) {
      vi.stubGlobal("fetch", mockFetch(200, { priceLevel: enumVal }));
      const d = await fetchPlaceDetails("ChIJ", "k");
      expect(d?.priceLevel).toBe(expected);
    }
  });

  it("404 → null (stedet finnes ikke — legacy status!==OK-ekvivalent)", async () => {
    vi.stubGlobal("fetch", mockFetch(404, {}));
    expect(await fetchPlaceDetails("ChIJ", "k")).toBeNull();
  });

  it("andre ≠ok-status (403/429/500) → kaster (ikke feiltolk som tomt)", async () => {
    for (const status of [403, 429, 500]) {
      vi.stubGlobal("fetch", mockFetch(status, {}));
      await expect(fetchPlaceDetails("ChIJ", "k")).rejects.toThrow(
        /Google Places API error/,
      );
    }
  });

  it("kaster PlacesApiError med maskinlesbar status — 403/429 er kvote, 500 er transient", async () => {
    // Backfill-scriptene MÅ kunne skille de to: kvotefeil aborterer hele
    // kjøringen før noe skrives, transiente feil hoppes over per POI.
    for (const [status, quota] of [
      [403, true],
      [429, true],
      [500, false],
    ] as const) {
      vi.stubGlobal("fetch", mockFetch(status, {}));
      const err = await fetchPlaceDetails("ChIJ", "k").catch((e) => e);
      expect(err).toBeInstanceOf(PlacesApiError);
      expect((err as PlacesApiError).status).toBe(status);
      expect(isQuotaError(err)).toBe(quota);
    }
  });

  it("languageCode legges i querystringen — og nøkkelen gjør det ALDRI", async () => {
    const fetchSpy = mockFetch(200, { regularOpeningHours: { weekdayDescriptions: [] } });
    vi.stubGlobal("fetch", fetchSpy);

    await fetchPlaceDetails("ChIJxyz", "hemmelig-nøkkel", OPENING_HOURS_FIELDS, {
      languageCode: "en",
    });

    const [url, init] = (fetchSpy as unknown as { mock: { calls: [string, RequestInit & { headers: Record<string, string> }][] } }).mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJxyz?languageCode=en");
    // Regresjonsvern for CLAUDE.md-regelen: nøkkelen skal ikke finnes noe sted i URL-en.
    expect(url).not.toContain("hemmelig-nøkkel");
    expect(url).not.toContain("key=");
    expect(init.headers["X-Goog-Api-Key"]).toBe("hemmelig-nøkkel");
  });

  it("uten languageCode er URL-en uendret (ingen tom querystring)", async () => {
    const fetchSpy = mockFetch(200, {});
    vi.stubGlobal("fetch", fetchSpy);

    await fetchPlaceDetails("ChIJxyz", "k");

    const [url] = (fetchSpy as unknown as { mock: { calls: [string][] } }).mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJxyz");
  });

  it("OPENING_HOURS_FIELDS er snever — bilder holdes utenfor Enterprise-SKU-en", async () => {
    expect(OPENING_HOURS_FIELDS).toEqual(["regularOpeningHours", "nationalPhoneNumber"]);
    expect(OPENING_HOURS_FIELDS).not.toContain("photos");
  });
});
