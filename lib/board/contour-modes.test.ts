import { describe, it, expect } from "vitest";
import { contourTravelModes, hasAnyContours } from "./contour-modes";
import type { IsochroneContours, IsochroneSet } from "@/lib/types";

const contours = {} as unknown as IsochroneContours;

function set(byMode: IsochroneSet["byMode"]): IsochroneSet {
  return { isochronesVersion: 1, fetchedAt: "2026-09-03T00:00:00.000Z", byMode };
}

describe("contourTravelModes", () => {
  it("gir tom liste når konturene mangler helt (AE3)", () => {
    expect(contourTravelModes(undefined)).toEqual([]);
    expect(hasAnyContours(undefined)).toBe(false);
  });

  it("gir bare profilene som finnes ved delvis sett (AE4)", () => {
    const partial = set({ walk: contours, car: contours });
    expect(contourTravelModes(partial)).toEqual(["walk", "car"]);
    expect(hasAnyContours(partial)).toBe(true);
  });

  it("beholder kanonisk rekkefølge gå → sykkel → bil", () => {
    expect(contourTravelModes(set({ car: contours, walk: contours, bike: contours }))).toEqual([
      "walk",
      "bike",
      "car",
    ]);
  });
});
