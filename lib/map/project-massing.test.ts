import { describe, expect, it } from "vitest";
import {
  getProjectMassing,
  projectMassingFeatureCollection,
  type LngLat,
} from "@/lib/map/project-massing";
import { sitePlanCoordinate, WESSELSLOKKA_CONTROL_POINTS } from "@/lib/map/wesselslokka-site-plan";

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

  it("registrerer alle tre holdepunktene uten aksebytte", () => {
    for (const { pixel, coordinate } of WESSELSLOKKA_CONTROL_POINTS) {
      expect(distanceMeters(sitePlanCoordinate(pixel), coordinate)).toBeLessThan(0.01);
    }
    // Independent visual check: Brøsetvegen's middle bend, not a fit anchor.
    expect(distanceMeters(sitePlanCoordinate([600, 407]), [10.4541, 63.4232])).toBeLessThan(15);
  });

  it("lukker GeoJSON-ringene og bærer høyden som egenskap", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const collection = projectMassingFeatureCollection(massing);

    expect(collection.features).toHaveLength(4);
    for (const feature of collection.features) {
      const ring = feature.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(5);
      expect(ring.at(-1)).toEqual(ring[0]);
      if (feature.properties?.kind === "building") {
        expect(feature.properties.heightMeters).toBe(14);
      }
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
        distanceMeters([origin.lng, origin.lat], corner) < 170,
      ),
    ).toBe(true);
  });

  it("holder veien sør for A1/A2 og kobler den til Brøsetvegen", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const street = massing.streets![0];
    expect(distanceMeters(street.footprint[0], [10.4496, 63.42176])).toBeLessThan(5);
    const streetAtBuildings = street.footprint.filter(([lng]) => lng > 10.4517 && lng < 10.4531);
    const southernBuildingEdge = Math.min(...massing.buildings.slice(0, 2).flatMap(b => b.footprint.map(p => p[1])));
    expect(streetAtBuildings.every(([, lat]) => lat < southernBuildingEdge)).toBe(true);
  });
});
