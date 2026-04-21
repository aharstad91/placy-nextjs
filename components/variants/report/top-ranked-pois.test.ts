import { describe, it, expect } from "vitest";
import type { POI } from "@/lib/types";
import { rankScore, getTopRankedPOIs, getCuratedPOIs } from "./top-ranked-pois";

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

function catPoi(
  id: string,
  categoryId: string,
  walk?: number,
  googleRating?: number,
  poiTier?: 1 | 2 | 3,
): POI {
  return {
    id,
    name: id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: categoryId, name: categoryId, icon: "Coffee", color: "#000" },
    googleRating,
    poiTier,
    travelTime: walk != null ? { walk } : undefined,
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

describe("getCuratedPOIs", () => {
  it("TC-A1: barn-oppvekst — barnehage slot 1, skole slot 2, lekeplass slot 3", () => {
    const pois = [
      catPoi("skole-1", "skole", 300, 4.5, 1),
      catPoi("bhg-1", "barnehage", 200, 4.0, 1),
      catPoi("lek-1", "lekeplass", 400, 3.5, 2),
      catPoi("rest-1", "restaurant", 150, 4.8, 1),
    ];
    const result = getCuratedPOIs(pois, "barn-oppvekst", 6);
    expect(result.slice(0, 3).map((p) => p.id)).toEqual([
      "bhg-1",
      "skole-1",
      "lek-1",
    ]);
  });

  it("TC-A2: manglende anchor → ranking-fill, slider forblir full", () => {
    const pois = [
      catPoi("bhg-1", "barnehage", 200, 4.0, 1),
      catPoi("skole-1", "skole", 300, 4.5, 1),
      // ingen lekeplass
      catPoi("rest-1", "restaurant", 150, 4.8, 1),
      catPoi("rest-2", "restaurant", 250, 4.7, 1),
      catPoi("cafe-1", "cafe", 180, 4.6, 1),
    ];
    const result = getCuratedPOIs(pois, "barn-oppvekst", 6);
    expect(result).toHaveLength(5);
    expect(result[0].id).toBe("bhg-1");
    expect(result[1].id).toBe("skole-1");
    // Slot 3..5 = ranking-fill (rest-1 > rest-2 > cafe-1 alle har tier 1)
    // rankScore: rest-1=4.8*3=14.4, cafe-1=4.6*3=13.8, rest-2=4.7*3=14.1
    expect(result[2].id).toBe("rest-1");
    expect(result[3].id).toBe("rest-2");
    expect(result[4].id).toBe("cafe-1");
  });

  it("TC-A3: trening — 3 gyms nærmest-first, alle distinkte", () => {
    const pois = [
      catPoi("gym-far", "gym", 900, 4.5, 1),
      catPoi("gym-mid", "gym", 500, 4.0, 1),
      catPoi("gym-near", "gym", 200, 3.0, 2),
      catPoi("spa-1", "spa", 300, 4.8, 1),
    ];
    const result = getCuratedPOIs(pois, "trening-aktivitet", 6);
    expect(result.slice(0, 3).map((p) => p.id)).toEqual([
      "gym-near",
      "gym-mid",
      "gym-far",
    ]);
    // Distinkte IDs (ingen duplikat)
    expect(new Set(result.map((p) => p.id)).size).toBe(result.length);
  });

  it("TC-A4: mat-drikke (ingen anchors) === getTopRankedPOIs", () => {
    const pois = [
      catPoi("rest-1", "restaurant", 100, 4.5, 1), // 13.5
      catPoi("cafe-1", "cafe", 200, 4.0, 2), // 8.0
      catPoi("bar-1", "bar", 300, 4.8, 1), // 14.4
      catPoi("bak-1", "bakery", 150, 3.5, 1), // 10.5
    ];
    const curated = getCuratedPOIs(pois, "mat-drikke", 6);
    const ranked = getTopRankedPOIs(pois, 6);
    expect(curated.map((p) => p.id)).toEqual(ranked.map((p) => p.id));
  });

  it("TC-A5: tom POI-liste → []", () => {
    expect(getCuratedPOIs([], "barn-oppvekst", 6)).toEqual([]);
  });

  it("TC-A6: færre POI-er enn limit → returnerer alle tilgjengelige (ingen padding)", () => {
    const pois = [
      catPoi("bhg-1", "barnehage", 200, 4.0, 1),
      catPoi("rest-1", "restaurant", 150, 4.8, 1),
    ];
    const result = getCuratedPOIs(pois, "barn-oppvekst", 6);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual(["bhg-1", "rest-1"]);
  });

  it("TC-A7: dedup — anchor-POI vises ikke i ranking-fill", () => {
    const pois = [
      catPoi("bhg-1", "barnehage", 200, 5.0, 1), // høyeste rankScore (15)
      catPoi("skole-1", "skole", 300, 4.5, 1),
      catPoi("lek-1", "lekeplass", 400, 3.5, 2),
      catPoi("rest-1", "restaurant", 150, 4.0, 1), // 12
    ];
    const result = getCuratedPOIs(pois, "barn-oppvekst", 6);
    const ids = result.map((p) => p.id);
    const bhgCount = ids.filter((id) => id === "bhg-1").length;
    expect(bhgCount).toBe(1);
    expect(ids).toEqual(["bhg-1", "skole-1", "lek-1", "rest-1"]);
  });

  it("handles unknown theme-id → ingen anchors, ren ranking", () => {
    const pois = [
      catPoi("a", "foo", 100, 4.0, 1),
      catPoi("b", "bar", 200, 5.0, 1),
    ];
    const result = getCuratedPOIs(pois, "unknown-theme", 6);
    expect(result.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("limit < 1 → []", () => {
    expect(getCuratedPOIs([catPoi("a", "skole", 100)], "barn-oppvekst", 0)).toEqual([]);
  });

  it("does not mutate input array", () => {
    const pois = [
      catPoi("bhg-1", "barnehage", 200, 4.0, 1),
      catPoi("skole-1", "skole", 300, 4.5, 1),
    ];
    const before = pois.map((p) => p.id);
    getCuratedPOIs(pois, "barn-oppvekst", 6);
    expect(pois.map((p) => p.id)).toEqual(before);
  });
});
