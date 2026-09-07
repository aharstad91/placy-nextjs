import { describe, expect, it } from "vitest";
import {
  getProjectMassing,
  projectMassingFeatureCollection,
  type LngLat,
} from "@/lib/map/project-massing";
import {
  sitePlanCoordinate,
  WESSELSLOKKA_CONTROL_POINTS,
  WESSELSLOKKA_REGISTRATION_CHECKS,
} from "@/lib/map/wesselslokka-site-plan";

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

  it("har salgsbyggene med bokstav, og resten av områdeplanen bak dem", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const sale = massing.buildings.filter((b) => b.role === "sale");
    const context = massing.buildings.filter((b) => b.role === "context");

    expect(sale.map((b) => b.id)).toEqual(["a1", "a2", "b"]);
    expect(sale.map((b) => b.label)).toEqual(["A1", "A2", "B"]);
    expect(sale.every((b) => b.heightMeters === 14)).toBe(true);
    // Kontekstvolumene er navnløse i planen; en bokstav ville vært oppdiktet.
    expect(context.every((b) => b.label === undefined)).toBe(true);
    expect(context.length).toBeGreaterThan(40);
    expect(new Set(massing.buildings.map((b) => b.id)).size).toBe(
      massing.buildings.length,
    );
  });

  // Uttrekket fra den store planen skal ikke tegne A1/A2/B en gang til oppå
  // de håndavtegnede. Dubletter er usynlige i 2D og doble vegger i 3D.
  it("dublerer ikke salgsbyggene fra den store planen", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const centre = (b: { footprint: readonly LngLat[] }): LngLat => [
      b.footprint.reduce((sum, [lng]) => sum + lng, 0) / b.footprint.length,
      b.footprint.reduce((sum, [, lat]) => sum + lat, 0) / b.footprint.length,
    ];
    const saleCentres = massing.buildings
      .filter((b) => b.role === "sale")
      .map(centre);

    for (const building of massing.buildings.filter((b) => b.role === "context")) {
      const nearest = Math.min(
        ...saleCentres.map((c) => distanceMeters(c, centre(building))),
      );
      expect(nearest).toBeGreaterThan(10);
    }
  });

  it("holder hele områdeplanen innenfor Brøset", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const corners = massing.buildings.flatMap((b) => b.footprint);
    // Brøset ligger mellom Brøsetvegen i vest og Tungasletta i øst.
    expect(Math.min(...corners.map(([lng]) => lng))).toBeGreaterThan(10.4485);
    expect(Math.max(...corners.map(([lng]) => lng))).toBeLessThan(10.4615);
    expect(Math.min(...corners.map(([, lat]) => lat))).toBeGreaterThan(63.4205);
    expect(Math.max(...corners.map(([, lat]) => lat))).toBeLessThan(63.4255);
    expect(
      massing.buildings.every((b) => b.footprint.length >= 3),
    ).toBe(true);
  });

  it("registrerer alle tre holdepunktene uten aksebytte", () => {
    for (const { pixel, coordinate } of WESSELSLOKKA_CONTROL_POINTS) {
      expect(distanceMeters(sitePlanCoordinate(pixel), coordinate)).toBeLessThan(0.01);
    }
  });

  // Kontrollene under inngår IKKE i tilpasningen. De er hentet fra OSM, altså
  // en helt annen kilde enn bildet, og faller hvis noen flytter et holdepunkt.
  it.each(WESSELSLOKKA_REGISTRATION_CHECKS)(
    "treffer $name uavhengig av tilpasningen",
    ({ pixel, coordinate, toleranceMeters }) => {
      expect(distanceMeters(sitePlanCoordinate(pixel), coordinate)).toBeLessThan(
        toleranceMeters,
      );
    },
  );

  it("lukker GeoJSON-ringene og bærer høyden som egenskap", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const collection = projectMassingFeatureCollection(massing);

    expect(collection.features).toHaveLength(massing.buildings.length);
    for (const feature of collection.features) {
      const ring = feature.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring.at(-1)).toEqual(ring[0]);
      expect(feature.properties?.heightMeters).toBeGreaterThan(0);
      expect(feature.properties?.role).toMatch(/^(sale|context)$/);
    }
  });

  it("holder salgsbyggene sørøst for adressepunktet og innenfor prototypefeltet", () => {
    const origin = { lat: 63.422074, lng: 10.450617 };
    const massing = getProjectMassing("wesselslokka")!;
    const allCorners = massing.buildings
      .filter((building) => building.role === "sale")
      .flatMap((building) => building.footprint);

    expect(Math.max(...allCorners.map(([lng]) => lng))).toBeGreaterThan(origin.lng);
    expect(Math.min(...allCorners.map(([, lat]) => lat))).toBeLessThan(origin.lat);
    expect(
      allCorners.every((corner) =>
        distanceMeters([origin.lng, origin.lat], corner) < 170,
      ),
    ).toBe(true);
  });
});
