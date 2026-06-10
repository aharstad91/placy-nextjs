import { describe, it, expect } from "vitest";
import { pointInPolygon, pointInGeometry, type GeoJsonPolygonGeometry } from "./geo";

describe("pointInPolygon", () => {
  // Unit square as a closed ring (GeoJSON convention: first point repeated last)
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];

  it("returns true for a point inside the polygon", () => {
    expect(pointInPolygon(5, 5, square)).toBe(true);
  });

  it("returns false for a point outside the polygon", () => {
    expect(pointInPolygon(15, 5, square)).toBe(false);
    expect(pointInPolygon(5, -1, square)).toBe(false);
  });

  it("returns true for points just inside the boundary", () => {
    expect(pointInPolygon(0.001, 5, square)).toBe(true);
    expect(pointInPolygon(5, 9.999, square)).toBe(true);
  });

  it("returns false for points just outside the boundary", () => {
    expect(pointInPolygon(-0.001, 5, square)).toBe(false);
    expect(pointInPolygon(5, 10.001, square)).toBe(false);
  });

  // Boundary semantics are half-open (classic ray-cast): points exactly on
  // the lower/left edges count as inside, upper/right edges as outside.
  // Acceptable for neighborhood matching — boundary hits are not guaranteed.
  it("treats points exactly on the boundary with half-open semantics", () => {
    expect(pointInPolygon(0, 5, square)).toBe(true); // left edge → inside
    expect(pointInPolygon(5, 0, square)).toBe(true); // bottom edge → inside
    expect(pointInPolygon(10, 5, square)).toBe(false); // right edge → outside
    expect(pointInPolygon(5, 10, square)).toBe(false); // top edge → outside
  });
});

describe("pointInGeometry", () => {
  // WGS84 GeoJSON polygon roughly around Ranheim — coordinate pairs in
  // [lng, lat] order, passed directly without any projection.
  const ranheimish: GeoJsonPolygonGeometry = {
    type: "Polygon",
    coordinates: [
      [
        [10.5, 63.42],
        [10.55, 63.42],
        [10.55, 63.45],
        [10.5, 63.45],
        [10.5, 63.42],
      ],
    ],
  };

  it("returns true for a WGS84 point inside a Polygon (x = lng, y = lat)", () => {
    expect(pointInGeometry(10.52, 63.435, ranheimish)).toBe(true);
  });

  it("returns false for a WGS84 point outside the Polygon", () => {
    expect(pointInGeometry(10.4, 63.43, ranheimish)).toBe(false); // Trondheim sentrum
    expect(pointInGeometry(10.75, 59.91, ranheimish)).toBe(false); // Oslo
  });

  it("returns false when lng/lat are passed in swapped order", () => {
    // GeoJSON order is [lng, lat] — calling with (lat, lng) misses the polygon
    expect(pointInGeometry(63.435, 10.52, ranheimish)).toBe(false);
  });

  it("checks each polygon in a MultiPolygon", () => {
    const multi: GeoJsonPolygonGeometry = {
      type: "MultiPolygon",
      coordinates: [
        [
          // Polygon 1: exterior ring + hole
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [4, 4],
            [6, 4],
            [6, 6],
            [4, 6],
            [4, 4],
          ],
        ],
        [
          // Polygon 2: exterior ring only
          [
            [20, 20],
            [30, 20],
            [30, 30],
            [20, 30],
            [20, 20],
          ],
        ],
      ],
    };

    expect(pointInGeometry(2, 2, multi)).toBe(true); // in polygon 1
    expect(pointInGeometry(25, 25, multi)).toBe(true); // in polygon 2
    expect(pointInGeometry(15, 15, multi)).toBe(false); // between the polygons
    // Holes are ignored (only exterior rings are tested) — a point inside the
    // hole still counts as inside. Pinned from the original school-zones behavior.
    expect(pointInGeometry(5, 5, multi)).toBe(true);
  });
});
