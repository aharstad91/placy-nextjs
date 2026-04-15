import { describe, it, expect } from "vitest";
import { byTierThenScore, byTierThenDistance, diversifiedSelection, applyCategoryFilter } from "./report-data";
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

function makeBusPOI(id: string): POI {
  return makePOI({
    id,
    name: `Holdeplass ${id}`,
    category: { id: "bus", name: "Buss", icon: "Bus", color: "#3b82f6" },
  });
}

function makeSkolePOI(id: string, name: string): POI {
  return makePOI({
    id,
    name,
    category: { id: "skole", name: "Skole", icon: "School", color: "#22c55e" },
  });
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

describe("applyCategoryFilter", () => {
  // Brøset center coordinates
  const brosetCenter = { lat: 63.418, lng: 10.395 };

  it("caps bus POIs to maxCount of 5", () => {
    const pois = Array.from({ length: 10 }, (_, i) => makeBusPOI(`bus-${i}`));
    const filtered = applyCategoryFilter("bus", pois, brosetCenter);
    expect(filtered.length).toBe(5);
    // Keeps first 5 (nearest, since already sorted by distance)
    expect(filtered[0].id).toBe("bus-0");
    expect(filtered[4].id).toBe("bus-4");
  });

  it("caps idrett POIs to maxCount of 3", () => {
    const pois = Array.from({ length: 8 }, (_, i) =>
      makePOI({
        id: `idrett-${i}`,
        name: `Idrettsplass ${i}`,
        category: { id: "idrett", name: "Idrett", icon: "Activity", color: "#22c55e" },
      })
    );
    const filtered = applyCategoryFilter("idrett", pois, brosetCenter);
    expect(filtered.length).toBe(3);
  });

  it("does not cap categories without rules (e.g. restaurant)", () => {
    const pois = Array.from({ length: 20 }, (_, i) => makePOI({ id: `r-${i}` }));
    const filtered = applyCategoryFilter("restaurant", pois, brosetCenter);
    expect(filtered.length).toBe(20);
  });

  it("does not cap haircare (frisør)", () => {
    const pois = Array.from({ length: 15 }, (_, i) =>
      makePOI({
        id: `hair-${i}`,
        name: `Frisør ${i}`,
        category: { id: "haircare", name: "Frisør", icon: "Scissors", color: "#22c55e" },
      })
    );
    const filtered = applyCategoryFilter("haircare", pois, brosetCenter);
    expect(filtered.length).toBe(15);
  });

  it("filters skole by school zone — keeps Singsaker barneskole for Brøset", () => {
    const pois = [
      makeSkolePOI("s1", "Singsaker skole"),
      makeSkolePOI("s2", "Ila skole"),
      makeSkolePOI("s3", "Lade skole"),
      makeSkolePOI("s4", "Rosenborg ungdomsskole"),
    ];
    const filtered = applyCategoryFilter("skole", pois, brosetCenter);
    const names = filtered.map((p) => p.name);
    expect(names).toContain("Singsaker skole");
    expect(names).toContain("Rosenborg ungdomsskole");
    expect(names).not.toContain("Ila skole");
    expect(names).not.toContain("Lade skole");
  });

  it("keeps higher education regardless of school zone", () => {
    const pois = [
      makeSkolePOI("s1", "Singsaker skole"),
      makeSkolePOI("s2", "Ila skole"),
      makeSkolePOI("ntnu", "NTNU Gløshaugen"),
      makeSkolePOI("vgs", "Trondheim Katedralskole VGS"),
    ];
    const filtered = applyCategoryFilter("skole", pois, brosetCenter);
    const names = filtered.map((p) => p.name);
    expect(names).toContain("Singsaker skole");
    expect(names).toContain("NTNU Gløshaugen");
    expect(names).toContain("Trondheim Katedralskole VGS");
    expect(names).not.toContain("Ila skole");
  });

  it("returns empty for skole when no schools match zone (e.g. Oslo coords)", () => {
    const osloCenter = { lat: 59.91, lng: 10.75 };
    const pois = [
      makeSkolePOI("s1", "Singsaker skole"),
      makeSkolePOI("s2", "Ila skole"),
    ];
    const filtered = applyCategoryFilter("skole", pois, osloCenter);
    // No school zone match for Oslo → none pass
    expect(filtered.length).toBe(0);
  });
});

// --- Test helpers for diversified selection ---

const testCenter = { lat: 63.43, lng: 10.40 };

/** Create POI at specific distance from testCenter (approximate via lat offset) */
function makePOIAtDistance(
  overrides: Partial<POI> & { id: string },
  distanceMeters: number,
): POI {
  // ~111,000 meters per degree of latitude
  const latOffset = distanceMeters / 111_000;
  return makePOI({
    coordinates: { lat: testCenter.lat + latOffset, lng: testCenter.lng },
    ...overrides,
  });
}

function makeCategoryPOI(
  id: string,
  categoryId: string,
  opts: { tier?: 1 | 2 | 3; distanceMeters?: number; walkMinutes?: number } = {},
): POI {
  const { tier, distanceMeters = 500, walkMinutes } = opts;
  const poi = makePOIAtDistance(
    {
      id,
      name: id,
      category: { id: categoryId, name: categoryId, icon: "MapPin", color: "#888" },
      poiTier: tier,
      travelTime: walkMinutes != null ? { walk: walkMinutes } : undefined,
    },
    distanceMeters,
  );
  return poi;
}

describe("byTierThenDistance", () => {
  const comparator = byTierThenDistance(testCenter);

  it("sorts tier 1 before tier 2 before tier 3", () => {
    const pois = [
      makeCategoryPOI("t3", "bus", { tier: 3, distanceMeters: 100 }),
      makeCategoryPOI("t1", "bus", { tier: 1, distanceMeters: 1000 }),
      makeCategoryPOI("t2", "bus", { tier: 2, distanceMeters: 500 }),
    ];
    const sorted = [...pois].sort(comparator);
    expect(sorted.map((p) => p.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("sorts by distance within same tier (closer first)", () => {
    const pois = [
      makeCategoryPOI("far", "bus", { tier: 2, distanceMeters: 800 }),
      makeCategoryPOI("near", "bus", { tier: 2, distanceMeters: 200 }),
      makeCategoryPOI("mid", "bus", { tier: 2, distanceMeters: 500 }),
    ];
    const sorted = [...pois].sort(comparator);
    expect(sorted.map((p) => p.id)).toEqual(["near", "mid", "far"]);
  });

  it("prefers walk time over haversine when available", () => {
    const pois = [
      makeCategoryPOI("slow-walk", "bus", { tier: 2, distanceMeters: 100, walkMinutes: 10 }),
      makeCategoryPOI("fast-walk", "bus", { tier: 2, distanceMeters: 900, walkMinutes: 3 }),
    ];
    const sorted = [...pois].sort(comparator);
    // fast-walk is closer by walk time despite being farther by haversine
    expect(sorted.map((p) => p.id)).toEqual(["fast-walk", "slow-walk"]);
  });

  it("treats null tier as 2.5 (between tier 2 and 3)", () => {
    const pois = [
      makeCategoryPOI("t3", "bus", { tier: 3, distanceMeters: 100 }),
      makeCategoryPOI("null", "bus", { distanceMeters: 100 }),
      makeCategoryPOI("t2", "bus", { tier: 2, distanceMeters: 100 }),
    ];
    const sorted = [...pois].sort(comparator);
    expect(sorted.map((p) => p.id)).toEqual(["t2", "null", "t3"]);
  });
});

describe("diversifiedSelection", () => {
  it("round-robins across categories", () => {
    const pois = [
      makeCategoryPOI("bus-1", "bus", { distanceMeters: 100 }),
      makeCategoryPOI("bus-2", "bus", { distanceMeters: 200 }),
      makeCategoryPOI("bus-3", "bus", { distanceMeters: 300 }),
      makeCategoryPOI("bike-1", "bike", { distanceMeters: 150 }),
      makeCategoryPOI("bike-2", "bike", { distanceMeters: 250 }),
      makeCategoryPOI("bike-3", "bike", { distanceMeters: 350 }),
      makeCategoryPOI("rest-1", "restaurant", { distanceMeters: 120 }),
      makeCategoryPOI("rest-2", "restaurant", { distanceMeters: 220 }),
      makeCategoryPOI("rest-3", "restaurant", { distanceMeters: 320 }),
    ];
    const { visiblePOIs } = diversifiedSelection(pois, testCenter, 6);
    const ids = visiblePOIs.map((p) => p.id);
    // Round-robin: bus, bike, restaurant, bus, bike, restaurant
    expect(ids).toEqual(["bus-1", "bike-1", "rest-1", "bus-2", "bike-2", "rest-2"]);
  });

  it("picks tier-1 before tier-3 within same category", () => {
    const pois = [
      makeCategoryPOI("t3-near", "bus", { tier: 3, distanceMeters: 100 }),
      makeCategoryPOI("t1-far", "bus", { tier: 1, distanceMeters: 1000 }),
      makeCategoryPOI("bike-1", "bike", { distanceMeters: 150 }),
    ];
    const { visiblePOIs } = diversifiedSelection(pois, testCenter, 3);
    // t1-far should be picked before t3-near for bus category
    expect(visiblePOIs[0].id).toBe("t1-far");
    expect(visiblePOIs[1].id).toBe("bike-1");
    expect(visiblePOIs[2].id).toBe("t3-near");
  });

  it("handles single category (sequential picking)", () => {
    const pois = [
      makeCategoryPOI("bus-1", "bus", { tier: 2, distanceMeters: 100 }),
      makeCategoryPOI("bus-2", "bus", { tier: 2, distanceMeters: 200 }),
      makeCategoryPOI("bus-3", "bus", { tier: 2, distanceMeters: 300 }),
    ];
    const { visiblePOIs } = diversifiedSelection(pois, testCenter, 3);
    expect(visiblePOIs.map((p) => p.id)).toEqual(["bus-1", "bus-2", "bus-3"]);
  });

  it("handles two categories (alternating)", () => {
    const pois = [
      makeCategoryPOI("bus-1", "bus", { distanceMeters: 100 }),
      makeCategoryPOI("bus-2", "bus", { distanceMeters: 200 }),
      makeCategoryPOI("bus-3", "bus", { distanceMeters: 300 }),
      makeCategoryPOI("bike-1", "bike", { distanceMeters: 150 }),
      makeCategoryPOI("bike-2", "bike", { distanceMeters: 250 }),
      makeCategoryPOI("bike-3", "bike", { distanceMeters: 350 }),
    ];
    const { visiblePOIs } = diversifiedSelection(pois, testCenter, 6);
    expect(visiblePOIs.map((p) => p.id)).toEqual([
      "bus-1", "bike-1", "bus-2", "bike-2", "bus-3", "bike-3",
    ]);
  });

  it("sorts by distance as secondary within same tier", () => {
    const pois = [
      makeCategoryPOI("bus-far", "bus", { tier: 2, distanceMeters: 800 }),
      makeCategoryPOI("bus-near", "bus", { tier: 2, distanceMeters: 200 }),
    ];
    const { visiblePOIs } = diversifiedSelection(pois, testCenter, 2);
    expect(visiblePOIs.map((p) => p.id)).toEqual(["bus-near", "bus-far"]);
  });

  it("guarantees minority categories in first batch (uneven categories)", () => {
    const pois = [
      // 10 buses
      ...Array.from({ length: 10 }, (_, i) =>
        makeCategoryPOI(`bus-${i}`, "bus", { distanceMeters: 100 + i * 50 }),
      ),
      // 1 bike
      makeCategoryPOI("bike-1", "bike", { distanceMeters: 500 }),
      // 1 restaurant
      makeCategoryPOI("rest-1", "restaurant", { distanceMeters: 600 }),
    ];
    const { visiblePOIs } = diversifiedSelection(pois, testCenter, 6);
    const categories = visiblePOIs.map((p) => p.category.id);
    expect(categories).toContain("bike");
    expect(categories).toContain("restaurant");
    // Should have at least 3 unique categories
    expect(new Set(categories).size).toBe(3);
  });

  it("returns empty for empty input", () => {
    const { visiblePOIs, hiddenPOIs } = diversifiedSelection([], testCenter, 6);
    expect(visiblePOIs).toEqual([]);
    expect(hiddenPOIs).toEqual([]);
  });

  it("returns all as visible when fewer than count", () => {
    const pois = [
      makeCategoryPOI("bus-1", "bus", { distanceMeters: 100 }),
      makeCategoryPOI("bike-1", "bike", { distanceMeters: 200 }),
      makeCategoryPOI("rest-1", "restaurant", { distanceMeters: 300 }),
      makeCategoryPOI("cafe-1", "cafe", { distanceMeters: 400 }),
    ];
    const { visiblePOIs, hiddenPOIs } = diversifiedSelection(pois, testCenter, 6);
    expect(visiblePOIs.length).toBe(4);
    expect(hiddenPOIs.length).toBe(0);
  });

  it("sorts hidden POIs by tier then distance", () => {
    const pois = [
      makeCategoryPOI("bus-1", "bus", { tier: 2, distanceMeters: 100 }),
      makeCategoryPOI("bus-2", "bus", { tier: 1, distanceMeters: 200 }),
      makeCategoryPOI("bus-3", "bus", { tier: 2, distanceMeters: 300 }),
      makeCategoryPOI("bike-1", "bike", { tier: 2, distanceMeters: 150 }),
      makeCategoryPOI("bike-2", "bike", { tier: 3, distanceMeters: 250 }),
      makeCategoryPOI("rest-1", "restaurant", { tier: 2, distanceMeters: 120 }),
      makeCategoryPOI("rest-2", "restaurant", { tier: 1, distanceMeters: 220 }),
      makeCategoryPOI("rest-3", "restaurant", { tier: 2, distanceMeters: 400 }),
      makeCategoryPOI("rest-4", "restaurant", { tier: 3, distanceMeters: 500 }),
    ];
    const { hiddenPOIs } = diversifiedSelection(pois, testCenter, 6);
    // Hidden POIs should be sorted by tier then distance
    for (let i = 1; i < hiddenPOIs.length; i++) {
      const prevTier = hiddenPOIs[i - 1].poiTier ?? 2.5;
      const currTier = hiddenPOIs[i].poiTier ?? 2.5;
      expect(prevTier).toBeLessThanOrEqual(currTier);
    }
  });
});
