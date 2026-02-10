import { describe, it, expect } from "vitest";
import { calculateReportScore } from "./poi-score";

describe("calculateReportScore", () => {
  it("scores highly-reviewed places higher than low-reviewed", () => {
    const britannia = { googleRating: 4.7, googleReviewCount: 2051 };
    const awake = { googleRating: 4.9, googleReviewCount: 209 };
    expect(calculateReportScore(britannia)).toBeGreaterThan(
      calculateReportScore(awake)
    );
  });

  it("matches expected scores from Scandic Lerkendal data", () => {
    expect(
      calculateReportScore({ googleRating: 4.7, googleReviewCount: 2051 })
    ).toBeCloseTo(51.7, 0);
    expect(
      calculateReportScore({ googleRating: 4.4, googleReviewCount: 427 })
    ).toBeCloseTo(38.5, 0);
    expect(
      calculateReportScore({ googleRating: 4.9, googleReviewCount: 209 })
    ).toBeCloseTo(37.8, 0);
  });

  it("returns 0 for POIs without rating", () => {
    expect(
      calculateReportScore({ googleRating: null, googleReviewCount: 100 })
    ).toBe(0);
    expect(
      calculateReportScore({ googleRating: undefined, googleReviewCount: 50 })
    ).toBe(0);
  });

  it("returns 0 for POIs with rating 0", () => {
    expect(
      calculateReportScore({ googleRating: 0, googleReviewCount: 500 })
    ).toBe(0);
  });

  it("handles POIs with 0 reviews (score = rating × log2(1) = 0)", () => {
    expect(
      calculateReportScore({ googleRating: 4.5, googleReviewCount: 0 })
    ).toBe(0);
  });

  it("handles null/undefined review count", () => {
    expect(
      calculateReportScore({ googleRating: 4.5, googleReviewCount: null })
    ).toBe(0);
    expect(
      calculateReportScore({ googleRating: 4.5, googleReviewCount: undefined })
    ).toBe(0);
  });
});
