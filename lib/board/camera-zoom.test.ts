import { describe, it, expect } from "vitest";
import {
  equivalentZoomForCamera,
  metersPerPixelForCamera,
} from "./camera-zoom";
import { computeZoomTier } from "@/components/variants/report/board/use-board-zoom-tier";

/** Trondheim — der boardene faktisk står. cos(63.44°) ≈ 0.4474. */
const TRD_LAT = 63.44;
/** Googles default-fov, og den boardet kjører på. */
const FOV = 35;
/** Typisk kart-høyde på desktop. */
const H = 900;

describe("metersPerPixelForCamera", () => {
  it("regner bakke-oppløsning fra range + fov + høyde", () => {
    // halv dybde = 900 · tan(17.5°) ≈ 283.8 m → 567.6 m over 900 px.
    const mpp = metersPerPixelForCamera({
      rangeM: 900,
      fovDeg: FOV,
      lat: TRD_LAT,
      heightPx: H,
    })!;
    expect(mpp).toBeCloseTo(0.6307, 3);
  });

  it("er lineær i range — dobbel avstand gir dobbelt så grov oppløsning", () => {
    const near = metersPerPixelForCamera({
      rangeM: 600,
      fovDeg: FOV,
      lat: TRD_LAT,
      heightPx: H,
    })!;
    const far = metersPerPixelForCamera({
      rangeM: 1200,
      fovDeg: FOV,
      lat: TRD_LAT,
      heightPx: H,
    })!;
    expect(far / near).toBeCloseTo(2, 6);
  });

  it("null for degenerert input (kamera ikke lesbart, kart uten høyde)", () => {
    const base = { rangeM: 900, fovDeg: FOV, lat: TRD_LAT, heightPx: H };
    expect(metersPerPixelForCamera({ ...base, rangeM: 0 })).toBeNull();
    expect(metersPerPixelForCamera({ ...base, rangeM: NaN })).toBeNull();
    expect(metersPerPixelForCamera({ ...base, fovDeg: 0 })).toBeNull();
    expect(metersPerPixelForCamera({ ...base, fovDeg: 180 })).toBeNull();
    expect(metersPerPixelForCamera({ ...base, heightPx: 0 })).toBeNull();
  });
});

describe("equivalentZoomForCamera", () => {
  it("er monotont AVTAGENDE i range — å trekke kameraet ut er å zoome ut", () => {
    const zoomAt = (rangeM: number) =>
      equivalentZoomForCamera({ rangeM, fovDeg: FOV, lat: TRD_LAT, heightPx: H })!;
    const zooms = [400, 900, 2000, 5000, 12000].map(zoomAt);
    for (let i = 1; i < zooms.length; i++) {
      expect(zooms[i]).toBeLessThan(zooms[i - 1]);
    }
  });

  it("halvert range = ett zoom-hakk inn (2× oppløsning)", () => {
    const a = equivalentZoomForCamera({
      rangeM: 1800,
      fovDeg: FOV,
      lat: TRD_LAT,
      heightPx: H,
    })!;
    const b = equivalentZoomForCamera({
      rangeM: 900,
      fovDeg: FOV,
      lat: TRD_LAT,
      heightPx: H,
    })!;
    expect(b - a).toBeCloseTo(1, 6);
  });

  it("null når kameraet ikke er lesbart — konsumenten skal beholde forrige tier", () => {
    expect(
      equivalentZoomForCamera({
        rangeM: 0,
        fovDeg: FOV,
        lat: TRD_LAT,
        heightPx: H,
      }),
    ).toBeNull();
    expect(
      equivalentZoomForCamera({
        rangeM: 900,
        fovDeg: FOV,
        lat: NaN,
        heightPx: H,
      }),
    ).toBeNull();
  });
});

/**
 * Selve poenget med modulen: 3D arver 2D-tersklene i stedet for å ha egne.
 * Tallene her er de range-ene boardet faktisk bruker — DEFAULT_CAMERA_LOCK.range
 * er 900 og orbiten ligger på 650.
 */
describe("kobling til computeZoomTier — 3D arver 2D-tersklene", () => {
  const tierAt = (rangeM: number) =>
    computeZoomTier(
      equivalentZoomForCamera({ rangeM, fovDeg: FOV, lat: TRD_LAT, heightPx: H })!,
    );

  it("board-orbit (650 m) og default-range (900 m) er label-nivå", () => {
    expect(tierAt(650)).toBe("icon+label");
    expect(tierAt(900)).toBe("icon+label");
  });

  it("trukket ut til strøks-oversikt (3 km) → ikon uten navn", () => {
    expect(tierAt(3000)).toBe("icon");
  });

  it("helt uttrukket (15 km) → prikker", () => {
    expect(tierAt(15000)).toBe("dot");
  });
});
