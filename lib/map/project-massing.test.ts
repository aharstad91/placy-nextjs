import { describe, expect, it } from "vitest";
import {
  getProjectMassing,
  projectMassingFeatureCollection,
  projectSurfaceFeatureCollection,
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

/** Flateinnhold i kvadratmeter, i et lokalt plan lagt ved ringens første punkt.
 *  Over noen hundre meter er forvrengningen langt under det innpassingen selv
 *  slingrer med. */
function areaSquareMeters(ring: readonly LngLat[]): number {
  const scale = Math.cos(ring[0][1] * (Math.PI / 180)) * 111_320;
  const points = ring.map(([lng, lat]) => [lng * scale, lat * 111_320] as const);
  let twice = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    twice += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(twice) / 2;
}

/** Lengste avstand mellom to punkter i ringen. Skiller en gate fra en flekk. */
function spanMeters(ring: readonly LngLat[]): number {
  let longest = 0;
  for (const a of ring) {
    for (const b of ring) longest = Math.max(longest, distanceMeters(a, b));
  }
  return longest;
}

function isInside(ring: readonly LngLat[], [x, y]: LngLat): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
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
    // Fem, fem og sju etasjer slik prosjektet selges — hus B er det høye.
    expect(sale.map((b) => b.storeys)).toEqual([5, 5, 7]);
    expect(sale.map((b) => b.heightMeters)).toEqual([17.5, 17.5, 24.5]);
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

  // Kontekstvolumene arver etasjetall fra takplanen. Faller alle sammen til
  // samme tall igjen, er avlesningen død og silhuetten borte — uten at noe
  // annet i kartet ser galt ut.
  it("gir områdeplanen høyder som varierer, fra to til åtte etasjer", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const context = massing.buildings.filter((b) => b.role === "context");
    const storeys = context.map((b) => b.storeys);

    expect(Math.min(...storeys)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...storeys)).toBeLessThanOrEqual(8);
    expect(new Set(storeys).size).toBeGreaterThanOrEqual(5);
    expect(
      context.every((b) => b.heightMeters === b.storeys * 3.5),
    ).toBe(true);
  });

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

  // Gatene og stien er fargeavlest av tegningen. Drifter en terskel, faller de
  // ut i stillhet: kartet tegner fortsatt femti bygg, bare uten gatenett — og
  // ingenting ser galt ut før noen ser etter.
  it("henter gatetunene ut av planen som flater med lengde", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const streets = massing.siteStreets!;

    expect(streets.length).toBeGreaterThanOrEqual(6);
    expect(streets.every((ring) => ring.length >= 3)).toBe(true);
    const total = streets.reduce((sum, ring) => sum + areaSquareMeters(ring), 0);
    expect(total).toBeGreaterThan(5_000);
    expect(total).toBeLessThan(15_000);
    // De to lange gatetunene løper gjennom halve feltet. Blir alt kortere enn
    // dette, er nettet brutt opp i biter i stedet for å henge sammen.
    expect(streets.filter((ring) => spanMeters(ring) > 150)).toHaveLength(2);
  });

  it("beholder hovedstien byggfilteret forkaster", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const paths = massing.sitePaths!;

    expect(paths.length).toBeGreaterThanOrEqual(3);
    // Ryggraden går fra Brøsetvegen i nord, over bekkedraget og forbi torget.
    expect(Math.max(...paths.map(spanMeters))).toBeGreaterThan(200);
    const total = paths.reduce((sum, ring) => sum + areaSquareMeters(ring), 0);
    expect(total).toBeGreaterThan(800);
    expect(total).toBeLessThan(3_000);
  });

  // Utenfor grunnflaten står nabolaget slik det faktisk er. Der ville en gate
  // fra planen vært en unøyaktig kopi av noe kartet allerede tegner selv.
  it("holder gate og sti innenfor grunnflaten", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const ground = massing.siteGround!;
    const corners = [...massing.siteStreets!, ...massing.sitePaths!].flat();

    expect(corners.length).toBeGreaterThan(300);
    expect(corners.filter((corner) => !isInside(ground, corner))).toEqual([]);
  });

  it("merker flatene så gate og sti kan males hver for seg", () => {
    const massing = getProjectMassing("wesselslokka")!;
    const collection = projectSurfaceFeatureCollection(massing);

    expect(collection.features).toHaveLength(
      massing.siteStreets!.length + massing.sitePaths!.length,
    );
    const kinds = collection.features.map((feature) => feature.properties?.kind);
    expect(new Set(kinds)).toEqual(new Set(["street", "path"]));
    for (const feature of collection.features) {
      const ring = feature.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4);
      expect(ring.at(-1)).toEqual(ring[0]);
    }
  });

  it("tegner ingen flater for et prosjekt uten dem", () => {
    const bare = { ...getProjectMassing("wesselslokka")!, siteStreets: undefined, sitePaths: undefined };
    expect(projectSurfaceFeatureCollection(bare).features).toEqual([]);
  });
});
