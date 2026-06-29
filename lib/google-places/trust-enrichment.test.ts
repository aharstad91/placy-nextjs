import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./fetch-place-details", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./fetch-place-details")>();
  return { ...actual, fetchPlaceDetails: vi.fn() };
});

import { enrichTrustSignals, type TrustEnrichmentRow } from "./trust-enrichment";
import { fetchPlaceDetails } from "./fetch-place-details";

const mockFetchDetails = vi.mocked(fetchPlaceDetails);

/** Minimal supabase-dobbel som fanger update-payloads. */
function fakeSupabase(updates: Record<string, unknown>[], dbError: string | null = null) {
  return {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { eq: async () => ({ error: dbError ? { message: dbError } : null }) };
      },
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const candidate = (id: string): TrustEnrichmentRow => ({
  id,
  google_place_id: `ChIJ-${id}`,
  google_website: null,
});

describe("enrichTrustSignals", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AC1: ingen kandidater (har website / mangler place_id) → no-op", async () => {
    const updates: Record<string, unknown>[] = [];
    const result = await enrichTrustSignals({
      supabase: fakeSupabase(updates),
      pois: [
        { id: "a", google_place_id: "ChIJ-a", google_website: "https://x.no" },
        { id: "b", google_place_id: null, google_website: null },
      ],
      googleApiKey: "k",
      concurrency: 4,
    });
    expect(result).toEqual({ enriched: 0, failedPoiIds: [], errors: [] });
    expect(updates).toHaveLength(0);
    expect(mockFetchDetails).not.toHaveBeenCalled();
  });

  it("AC6: manglende rating/reviewCount nulles IKKE (utelates fra update)", async () => {
    mockFetchDetails.mockResolvedValue({
      website: "https://new.no",
      businessStatus: "OPERATIONAL",
      // rating/reviewCount bevisst undefined
    });
    const updates: Record<string, unknown>[] = [];
    const result = await enrichTrustSignals({
      supabase: fakeSupabase(updates),
      pois: [candidate("a")],
      googleApiKey: "k",
      concurrency: 4,
    });
    expect(result.enriched).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]).not.toHaveProperty("google_rating");
    expect(updates[0]).not.toHaveProperty("google_review_count");
    expect(updates[0].google_website).toBe("https://new.no");
  });

  it("AC6: rating/reviewCount skrives når Place Details returnerer dem (inkl. 0)", async () => {
    mockFetchDetails.mockResolvedValue({
      website: "https://new.no",
      businessStatus: "OPERATIONAL",
      rating: 4.5,
      reviewCount: 0,
    });
    const updates: Record<string, unknown>[] = [];
    await enrichTrustSignals({
      supabase: fakeSupabase(updates),
      pois: [candidate("a")],
      googleApiKey: "k",
      concurrency: 4,
    });
    expect(updates[0].google_rating).toBe(4.5);
    expect(updates[0].google_review_count).toBe(0);
  });

  it("AC2: place not found (null) → failedPoiIds + errors, ingen update, ingen abort", async () => {
    mockFetchDetails.mockResolvedValue(null);
    const updates: Record<string, unknown>[] = [];
    const result = await enrichTrustSignals({
      supabase: fakeSupabase(updates),
      pois: [candidate("a")],
      googleApiKey: "k",
      concurrency: 4,
    });
    expect(result.enriched).toBe(0);
    expect(result.failedPoiIds).toEqual(["a"]);
    expect(result.errors).toHaveLength(1);
    expect(updates).toHaveLength(0);
  });

  it("AC2: fail-soft — fetch-throw på én POI stopper ikke poolen", async () => {
    mockFetchDetails.mockImplementation(async (placeId: string) => {
      if (placeId === "ChIJ-b") throw new Error("boom");
      return { website: "https://ok.no", businessStatus: "OPERATIONAL" };
    });
    const updates: Record<string, unknown>[] = [];
    const result = await enrichTrustSignals({
      supabase: fakeSupabase(updates),
      pois: [candidate("a"), candidate("b"), candidate("c")],
      googleApiKey: "k",
      concurrency: 2,
    });
    expect(result.enriched).toBe(2);
    expect(result.failedPoiIds).toEqual(["b"]);
    expect(result.errors).toHaveLength(1);
  });
});
