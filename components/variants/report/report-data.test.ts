import { describe, it, expect } from "vitest";
import { byTierThenScore, applyCategoryFilter } from "./report-data";
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
