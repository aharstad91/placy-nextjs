import { describe, it, expect } from "vitest";
import { zoomToRange, rangeToZoom } from "./camera-map";

describe("zoomToRange / rangeToZoom", () => {
  // Shared test constants
  const LAT_TRONDHEIM = 63.4;
  const TILT_45 = 45;
  const W = 672;
  const H = 504;

  // TC-04: Camera mapping precision
  it("TC-04: zoomToRange(15, 63.4, 45, 672, 504) returns ~604m (±5%)", () => {
    const range = zoomToRange(15, LAT_TRONDHEIM, TILT_45, W, H);
    // Expected ~604m from calibration table, ±5% = [574, 634]
    expect(range).toBeGreaterThanOrEqual(574);
    expect(range).toBeLessThanOrEqual(634);
  });

  // TC-05: Roundtrip stability
  it.each([12, 14, 15, 16, 17])(
    "TC-05: roundtrip zoomToRange → rangeToZoom at zoom %d is stable (±0.01)",
    (z) => {
      const range = zoomToRange(z, LAT_TRONDHEIM, TILT_45, W, H);
      const recovered = rangeToZoom(range, LAT_TRONDHEIM, TILT_45, W, H);
      expect(recovered).toBeCloseTo(z, 2); // ±0.005, stricter than ±0.01
    },
  );

  // TC-06: Latitude correction — equator vs 63.4deg
  it("TC-06: latitude correction factor matches cos(63.4°) ±1%", () => {
    const rangeEquator = zoomToRange(15, 0, 0, W, H);
    const rangeTrondheim = zoomToRange(15, LAT_TRONDHEIM, 0, W, H);

    const ratio = rangeTrondheim / rangeEquator;
    const expectedCos = Math.cos((LAT_TRONDHEIM * Math.PI) / 180); // ~0.4476

    // Ratio should equal cos(63.4°) within ±1%
    expect(ratio).toBeCloseTo(expectedCos, 2);
    expect(Math.abs(ratio - expectedCos) / expectedCos).toBeLessThan(0.01);
  });

  // Tilt=0 vs tilt=45 ratio
  it("tilt=45 range is ~70.7% of tilt=0 range (cos(45°))", () => {
    const rangeTilt0 = zoomToRange(15, LAT_TRONDHEIM, 0, W, H);
    const rangeTilt45 = zoomToRange(15, LAT_TRONDHEIM, TILT_45, W, H);

    const ratio = rangeTilt45 / rangeTilt0;
    const expectedCos45 = Math.cos((45 * Math.PI) / 180); // ~0.7071

    // Should match cos(45°) exactly (formula has cos(tilt) as direct factor)
    expect(ratio).toBeCloseTo(expectedCos45, 4);
  });
});
