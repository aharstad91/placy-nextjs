import { describe, it, expect } from "vitest";
import { byTierThenScore } from "./report-data";
import type { POI } from "@/lib/types";

/** Minimal POI factory for testing sort behavior */
function makePOI(overrides: Partial<POI> & { id: string }): POI {
  return {
    name: overrides.id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: "restaurant", name: "Restaurant", icon: "Utensils", color: "#ef4444" },
    ...overrides,
  };
}

describe("byTierThenScore", () => {
  it("sorts tier 1 before tier 2 before tier 3", () => {
    const pois = [
      makePOI({ id: "t3", poiTier: 3, googleRating: 4.9, googleReviewCount: 500 }),
      makePOI({ id: "t1", poiTier: 1, googleRating: 4.0, googleReviewCount: 50 }),
      makePOI({ id: "t2", poiTier: 2, googleRating: 4.5, googleReviewCount: 200 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("treats null tier as 2.5 (between tier 2 and tier 3)", () => {
    const pois = [
      makePOI({ id: "t3", poiTier: 3, googleRating: 4.9, googleReviewCount: 500 }),
      makePOI({ id: "null", googleRating: 4.5, googleReviewCount: 300 }),
      makePOI({ id: "t2", poiTier: 2, googleRating: 4.0, googleReviewCount: 50 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["t2", "null", "t3"]);
  });

  it("sorts by formula score within same tier", () => {
    const pois = [
      makePOI({ id: "low", poiTier: 2, googleRating: 4.0, googleReviewCount: 50 }),
      makePOI({ id: "high", poiTier: 2, googleRating: 4.7, googleReviewCount: 2000 }),
      makePOI({ id: "mid", poiTier: 2, googleRating: 4.5, googleReviewCount: 200 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });

  it("with all null tiers, falls back to pure formula score sort (backward compat)", () => {
    const pois = [
      makePOI({ id: "low", googleRating: 4.0, googleReviewCount: 50 }),
      makePOI({ id: "high", googleRating: 4.7, googleReviewCount: 2000 }),
      makePOI({ id: "mid", googleRating: 4.5, googleReviewCount: 200 }),
    ];
    const sorted = [...pois].sort(byTierThenScore);
    expect(sorted.map((p) => p.id)).toEqual(["high", "mid", "low"]);
  });
});
