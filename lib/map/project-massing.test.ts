import { describe, expect, it } from "vitest";
import {
  getProjectMassing,
  projectMassingFeatureCollection,
  rectangleFootprint,
  type LngLat,
} from "./project-massing";

function distanceMeters(a: LngLat, b: LngLat): number {
  const lat = ((a[1] + b[1]) / 2) * (Math.PI / 180);
  const east = (b[0] - a[0]) * 111_320 * Math.cos(lat);
  const north = (b[1] - a[1]) * 111_320;
  return Math.hypot(east, north);
}

describe("project-massing", () => {
  it("gater volumstudien til Wesselsløkka", () => {
    expect(getProjectMassing()).toBeUndefined();
    expect(getProjectMassing("stasjonskvartalet")).toBeUndefined();
    expect(getProjectMassing("wesselslokka")?.projectSlug).toBe("wesselslokka");
  });

  it("har alle tre volumene fra situasjonsplanen", () => {
    const massing = getProjectMassing("wesselslokka")!;
    expect(massing.buildings.map((building) => building.id)).toEqual([
      "a1",
      "a2",
      "b",
    ]);
    expect(massing.buildings.every((building) => building.heightMeters === 14)).toBe(
      true,
    );
  });

  it("lager et rotert rektangel med oppgitte fysiske mål", () => {
    const building = rectangleFootprint(
      { lat: 63.422074, lng: 10.450617 },
      {
        id: "test",
        name: "Test",
        eastMeters: 0,
        northMeters: 0,
        lengthMeters: 40,
        widthMeters: 12,
        headingDegrees: 33,
        heightMeters: 10,
      },
    );

    expect(building.footprint).toHaveLength(4);
    expect(distanceMeters(building.footprint[0], building.footprint[1])).toBeCloseTo(
      40,
      1,
    );
    expect(distanceMeters(building.footprint[1], building.footprint[2])).toBeCloseTo(
      12,
      1,
    );
  });

  it("lukker GeoJSON-ringene og bærer høyden som egenskap", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const collection = projectMassingFeatureCollection(massing);

    expect(collection.features).toHaveLength(3);
    for (const feature of collection.features) {
      const ring = feature.geometry.coordinates[0];
      expect(ring).toHaveLength(5);
      expect(ring.at(-1)).toEqual(ring[0]);
      expect(feature.properties?.heightMeters).toBe(14);
    }
  });

  it("holder volumene sørøst for adressepunktet og innenfor prototypefeltet", () => {
    const origin = { lat: 63.422074, lng: 10.450617 };
    const massing = getProjectMassing("wesselslokka")!;
    const allCorners = massing.buildings.flatMap((building) => building.footprint);

    expect(Math.max(...allCorners.map(([lng]) => lng))).toBeGreaterThan(origin.lng);
    expect(Math.min(...allCorners.map(([, lat]) => lat))).toBeLessThan(origin.lat);
    expect(
      allCorners.every((corner) =>
        distanceMeters([origin.lng, origin.lat], corner) < 90,
      ),
    ).toBe(true);
  });
});
