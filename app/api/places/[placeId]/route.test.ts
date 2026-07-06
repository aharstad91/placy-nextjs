import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Kontrakts-vakter for /api/places/[placeId]:
 * - rate-limiting (429 over grensen)
 * - gyldig Google-kall gir 200
 * - cache-treff gjenbruker ikke fetch mot Google
 */

// Rate-limiteren er module-level singleton — mock den bort slik at testene
// ikke akkumulerer tilstand på tvers av kjøringer.
const rateLimitCheckMock = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/utils/rate-limit", () => ({
  createRateLimiter: () => ({ check: rateLimitCheckMock }),
  getClientIp: () => "test-ip",
}));

// fetchPlaceDetails wrapper Google-kallet — mock selve modulen så ingen ekte
// nettverkskall skjer og vi kontrollerer responsen eksplisitt.
const fetchPlaceDetailsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/google-places/fetch-place-details", () => ({
  fetchPlaceDetails: fetchPlaceDetailsMock,
}));

import { GET } from "./route";

// -----------------------------------------------------------------------
// Hjelpere
// -----------------------------------------------------------------------

/** Bygg en NextRequest med valgfri x-forwarded-for-header. */
function makeRequest(placeId: string): NextRequest {
  return new NextRequest(`http://localhost/api/places/${placeId}`, {
    headers: { "x-forwarded-for": "127.0.0.1" },
  });
}

/** Bygg params-Promise slik GET-handleren forventer. */
function makeParams(placeId: string): { params: Promise<{ placeId: string }> } {
  return { params: Promise.resolve({ placeId }) };
}

// Bruk unike place-IDer per test-gruppe for å unngå at den in-memory-cachen
// i route.ts «forurenser» tester som forventer et ferskt Google-kall.
// Cachen er modul-level og lever for hele test-suiten.
const PLACE_ID_RATE     = "ChIJrate_limitTestPlacyA1";
const PLACE_ID_VALID    = "ChIJvalidation_TestPlacyB2";
const PLACE_ID_NO_KEY   = "ChIJnokey_TestPlacyC3";
const PLACE_ID_NOTFOUND = "ChIJnotfound_TestPlacyD4";
const PLACE_ID_CACHE    = "ChIJcache_TestPlacyE5";

const MOCK_PLACE_DETAILS = {
  rating: 4.5,
  reviewCount: 1234,
  photos: [{ reference: "photos/Af84i9X9abc" }],
  website: "https://example.com",
  phone: "+47 12 34 56 78",
  openingHours: ["Mandag: 09:00–17:00"],
  isOpen: true,
  businessStatus: "OPERATIONAL",
  priceLevel: 2,
};

// -----------------------------------------------------------------------
// Oppsett
// -----------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-api-key");
  rateLimitCheckMock.mockReturnValue(true);
  fetchPlaceDetailsMock.mockResolvedValue(MOCK_PLACE_DETAILS);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// -----------------------------------------------------------------------
// Tester
// -----------------------------------------------------------------------

describe("GET /api/places/[placeId] — rate limiting", () => {
  it("innenfor grensen → 200 med place-detaljer", async () => {
    const req = makeRequest(PLACE_ID_RATE);
    const res = await GET(req, makeParams(PLACE_ID_RATE));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rating).toBe(4.5);
    expect(body.reviewCount).toBe(1234);
    expect(body.businessStatus).toBe("OPERATIONAL");
  });

  it("over grensen → 429 med { error: 'Too many requests' }", async () => {
    rateLimitCheckMock.mockReturnValue(false);

    const req = makeRequest(PLACE_ID_RATE);
    const res = await GET(req, makeParams(PLACE_ID_RATE));

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toBe("Too many requests");
  });
});

describe("GET /api/places/[placeId] — validering", () => {
  it("ugyldig placeId (inneholder /) → 400", async () => {
    const badId = "bad/place/id";
    const req = makeRequest(badId);
    const res = await GET(req, makeParams(badId));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("placeId");
  });

  it("manglende API-nøkkel → 500 (unikt place ID, ikke cachet)", async () => {
    vi.unstubAllEnvs(); // fjern GOOGLE_PLACES_API_KEY

    const req = makeRequest(PLACE_ID_NO_KEY);
    const res = await GET(req, makeParams(PLACE_ID_NO_KEY));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("API key");
  });

  it("Google returnerer null (sted ikke funnet) → 404 (unikt place ID)", async () => {
    fetchPlaceDetailsMock.mockResolvedValue(null);

    const req = makeRequest(PLACE_ID_NOTFOUND);
    const res = await GET(req, makeParams(PLACE_ID_NOTFOUND));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not found");
  });
});

describe("GET /api/places/[placeId] — cache", () => {
  it("cache-treff på samme placeId → kun ett Google-kall totalt", async () => {
    // Første kall: cache MISS — skal treffe Google
    const res1 = await GET(makeRequest(PLACE_ID_CACHE), makeParams(PLACE_ID_CACHE));
    expect(res1.status).toBe(200);
    expect(res1.headers.get("X-Cache")).toBe("MISS");

    // Andre kall: cache HIT — skal IKKE treffe Google igjen
    const res2 = await GET(makeRequest(PLACE_ID_CACHE), makeParams(PLACE_ID_CACHE));
    expect(res2.status).toBe(200);
    expect(res2.headers.get("X-Cache")).toBe("HIT");

    // fetchPlaceDetails skal kun ha blitt kalt én gang totalt i denne testen
    expect(fetchPlaceDetailsMock).toHaveBeenCalledTimes(1);
  });

  it("cache-treff returnerer samme data som det opprinnelige Google-kallet", async () => {
    // Første kall fyll cache (MISS allerede sjekket ovenfor; PLACE_ID_CACHE er nå cachet)
    const res2 = await GET(makeRequest(PLACE_ID_CACHE), makeParams(PLACE_ID_CACHE));
    const body = await res2.json();

    expect(body.rating).toBe(MOCK_PLACE_DETAILS.rating);
    expect(body.reviewCount).toBe(MOCK_PLACE_DETAILS.reviewCount);
  });
});
