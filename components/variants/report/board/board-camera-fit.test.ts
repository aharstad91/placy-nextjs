import { describe, it, expect } from "vitest";
import { computeFitBounds, shouldFitToProgram } from "./board-camera-fit";

const HOME = { lng: 10.39, lat: 63.43 }; // Trondheim sentrum (event-board home)

describe("computeFitBounds", () => {
  it("returnerer null uten POIer (behold posisjon)", () => {
    expect(computeFitBounds([], HOME)).toBeNull();
  });

  it("rammer inn POIer + home (home aldri utenfor bounds)", () => {
    const bounds = computeFitBounds(
      [
        { lng: 10.41, lat: 63.45 },
        { lng: 10.37, lat: 63.41 },
      ],
      HOME,
    );
    expect(bounds).not.toBeNull();
    // sw = [vest, sør], ne = [øst, nord]
    expect(bounds!.sw[0]).toBeCloseTo(10.37); // vestligste POI
    expect(bounds!.ne[0]).toBeCloseTo(10.41); // østligste POI
    expect(bounds!.sw[1]).toBeCloseTo(63.41); // sørligste POI
    expect(bounds!.ne[1]).toBeCloseTo(63.45); // nordligste POI
    // Home (10.39 / 63.43) ligger innenfor.
    expect(bounds!.sw[0]).toBeLessThanOrEqual(HOME.lng);
    expect(bounds!.ne[0]).toBeGreaterThanOrEqual(HOME.lng);
  });

  it("utvider bounds til home når alle POIene ligger på én side", () => {
    // Alle POIer nordøst for home → home setter sør/vest-kanten.
    const bounds = computeFitBounds(
      [
        { lng: 10.5, lat: 63.5 },
        { lng: 10.6, lat: 63.6 },
      ],
      HOME,
    );
    expect(bounds!.sw[0]).toBeCloseTo(HOME.lng); // home er vestligst
    expect(bounds!.sw[1]).toBeCloseTo(HOME.lat); // home er sørligst
    expect(bounds!.ne).toEqual([10.6, 63.6]);
  });
});

describe("shouldFitToProgram (B2/B3 ro-fit)", () => {
  const base = {
    eventMode: true,
    mapLoaded: true,
    tourActive: false,
    visibleIdsKey: null as string | null,
  };

  it("fitter til hele programmet i event-modus + ro-tilstand (B2: initial last)", () => {
    expect(shouldFitToProgram(base)).toBe(true);
  });

  it("fitter når et filter NULLSTILLES (B3: visibleIdsKey → null igjen)", () => {
    // Modellerer overgangen aktivt-filter → ro: nøkkelen er null på ny.
    expect(shouldFitToProgram({ ...base, visibleIdsKey: null })).toBe(true);
  });

  it("fitter IKKE mens et filter er aktivt (filter-fitten eier kameraet)", () => {
    expect(shouldFitToProgram({ ...base, visibleIdsKey: "a,b,c" })).toBe(false);
  });

  it("fitter IKKE i boligrapport-modus (eventMode=false) — behold default-senter", () => {
    expect(shouldFitToProgram({ ...base, eventMode: false })).toBe(false);
  });

  it("fitter IKKE før kartet er lastet", () => {
    expect(shouldFitToProgram({ ...base, mapLoaded: false })).toBe(false);
  });

  it("fitter IKKE mens en audio-tur eier kameraet", () => {
    expect(shouldFitToProgram({ ...base, tourActive: true })).toBe(false);
  });
});
