import { describe, it, expect } from "vitest";
import type { POI } from "@/lib/types";
import { rankScore, getTopRankedPOIs } from "./top-ranked-pois";

function poi(id: string, googleRating?: number, poiTier?: 1 | 2 | 3): POI {
  return {
    id,
    name: id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: "cat", name: "Cat", icon: "Coffee", color: "#000" },
    googleRating,
    poiTier,
  } as POI;
}

describe("rankScore", () => {
  it("multiplies googleRating by (4 - poiTier)", () => {
    expect(rankScore({ googleRating: 4.5, poiTier: 1 })).toBe(4.5 * 3);
    expect(rankScore({ googleRating: 4.5, poiTier: 2 })).toBe(4.5 * 2);
    expect(rankScore({ googleRating: 4.5, poiTier: 3 })).toBe(4.5 * 1);
  });

  it("treats missing googleRating as 0 (sinks to bottom)", () => {
    expect(rankScore({ googleRating: undefined, poiTier: 1 })).toBe(0);
  });

  it("treats missing poiTier as 3 (tier-vekt 1)", () => {
    expect(rankScore({ googleRating: 4.0, poiTier: undefined })).toBe(4.0);
  });
});

describe("getTopRankedPOIs", () => {
  it("returns [] when limit < 1", () => {
    expect(getTopRankedPOIs([poi("a", 4)], 0)).toEqual([]);
    expect(getTopRankedPOIs([poi("a", 4)], -5)).toEqual([]);
  });

  it("returns [] for empty input", () => {
    expect(getTopRankedPOIs([], 10)).toEqual([]);
  });

  it("sorts by rankScore descending (higher rating × tier-vekt first)", () => {
    const tier1High = poi("t1h", 4.5, 1); // 13.5
    const tier2High = poi("t2h", 4.8, 2); // 9.6
    const tier1Low = poi("t1l", 3.0, 1);  // 9.0
    const tier3High = poi("t3h", 5.0, 3); // 5.0
    const sorted = getTopRankedPOIs([tier3High, tier1Low, tier2High, tier1High], 10);
    expect(sorted.map((p) => p.id)).toEqual(["t1h", "t2h", "t1l", "t3h"]);
  });

  it("caps at limit", () => {
    const pois = Array.from({ length: 15 }, (_, i) => poi(`p${i}`, 4.0, 1));
    expect(getTopRankedPOIs(pois, 6)).toHaveLength(6);
    expect(getTopRankedPOIs(pois, 10)).toHaveLength(10);
  });

  it("invariant: first 6 of top-10 === top-6 (identisk sort, kun limit varierer)", () => {
    const pois = [
      poi("a", 4.5, 1),
      poi("b", 4.0, 1),
      poi("c", 4.8, 2),
      poi("d", 3.5, 2),
      poi("e", 5.0, 3),
      poi("f", 4.2, 1),
      poi("g", 3.0, 1),
      poi("h", 4.9, 3),
      poi("i", 2.5, 2),
      poi("j", 4.1, 2),
    ];
    const top10 = getTopRankedPOIs(pois, 10);
    const top6 = getTopRankedPOIs(pois, 6);
    expect(top6.map((p) => p.id)).toEqual(top10.slice(0, 6).map((p) => p.id));
  });

  it("does not mutate input array", () => {
    const pois = [poi("a", 3.0, 2), poi("b", 5.0, 1), poi("c", 4.0, 3)];
    const before = pois.map((p) => p.id);
    getTopRankedPOIs(pois, 10);
    expect(pois.map((p) => p.id)).toEqual(before);
  });

  it("handles POIs with missing rating/tier (sinks to bottom, no crash)", () => {
    const missing = poi("miss", undefined, undefined);
    const rated = poi("rated", 4.0, 1);
    const sorted = getTopRankedPOIs([missing, rated], 10);
    expect(sorted.map((p) => p.id)).toEqual(["rated", "miss"]);
  });
});
