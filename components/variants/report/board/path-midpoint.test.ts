import { describe, it, expect } from "vitest";
import { pathMidpoint, type PathCoordinate } from "./path-midpoint";

function coord(lat: number, lng: number): PathCoordinate {
  return { lat, lng };
}

describe("pathMidpoint", () => {
  it("returns the middle element for a 5-coordinate path", () => {
    const coords = [
      coord(60.0, 5.0),
      coord(60.1, 5.1),
      coord(60.2, 5.2), // midt
      coord(60.3, 5.3),
      coord(60.4, 5.4),
    ];
    expect(pathMidpoint(coords)).toEqual(coord(60.2, 5.2));
  });

  it("returns the middle element for a 100-coordinate path", () => {
    const coords: PathCoordinate[] = Array.from({ length: 100 }, (_, i) =>
      coord(i, i),
    );
    expect(pathMidpoint(coords)).toEqual(coord(50, 50));
  });

  it("returns the middle element for an odd-length path of 3", () => {
    const coords = [coord(0, 0), coord(1, 1), coord(2, 2)];
    expect(pathMidpoint(coords)).toEqual(coord(1, 1));
  });

  it("returns floor(length/2) element for even-length path", () => {
    // 4 elementer → index 2 (`Math.floor(4/2)`)
    const coords = [coord(0, 0), coord(1, 1), coord(2, 2), coord(3, 3)];
    expect(pathMidpoint(coords)).toEqual(coord(2, 2));
  });

  it("returns null for an empty array", () => {
    expect(pathMidpoint([])).toBeNull();
  });

  it("returns null for a single coordinate", () => {
    expect(pathMidpoint([coord(0, 0)])).toBeNull();
  });

  it("returns null for two coordinates (not enough for meaningful midpoint)", () => {
    expect(pathMidpoint([coord(0, 0), coord(1, 1)])).toBeNull();
  });
});
