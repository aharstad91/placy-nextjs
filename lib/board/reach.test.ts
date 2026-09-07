import { describe, expect, it } from "vitest";
import type { ContourRing } from "./contour-geometry";
import {
  partitionByReach,
  pointInPolygon,
  reachMinutesFor,
  ringContains,
  REACH_INACTIVE,
} from "./reach";

/** Kvadrat rundt (0,0) med halv side `h`, lukket. */
function square(h: number): [number, number][] {
  return [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
    [-h, -h],
  ];
}

function ring(minutes: "5" | "10" | "15", h: number, holes: [number, number][][] = []): ContourRing {
  return { minutes, outer: square(h), holes };
}

/** Nøstede konturer, innerst først — slik `contourRings` leverer dem. */
const NESTED: ContourRing[] = [ring("5", 1), ring("10", 2), ring("15", 3)];

describe("pointInPolygon", () => {
  it("skiller innenfor fra utenfor", () => {
    expect(pointInPolygon(square(1), 0, 0)).toBe(true);
    expect(pointInPolygon(square(1), 2, 0)).toBe(false);
    expect(pointInPolygon(square(1), 0, 2)).toBe(false);
  });

  it("håndterer konkave former (punktet i utsnittet er utenfor)", () => {
    // L-form: kvadratet 0..4 med det øvre høyre kvadrantet skåret bort.
    const l: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 2],
      [2, 2],
      [2, 4],
      [0, 4],
      [0, 0],
    ];
    expect(pointInPolygon(l, 1, 1)).toBe(true);
    expect(pointInPolygon(l, 3, 1)).toBe(true);
    expect(pointInPolygon(l, 3, 3)).toBe(false);
  });
});

describe("ringContains", () => {
  it("et punkt i et hull er UTENFOR", () => {
    // Hullet er lommen du ikke kommer til innenfor tidsbudsjettet.
    const withHole = ring("10", 4, [square(1)]);
    expect(ringContains(withHole, 2, 2)).toBe(true);
    expect(ringContains(withHole, 0, 0)).toBe(false);
  });
});

describe("reachMinutesFor", () => {
  it("gir den MINSTE konturen som inneholder punktet", () => {
    // Uten «minste» ville alt inne i 5 også rapportert 10 og 15.
    expect(reachMinutesFor(NESTED, { lat: 0, lng: 0 })).toBe("5");
    expect(reachMinutesFor(NESTED, { lat: 0, lng: 1.5 })).toBe("10");
    expect(reachMinutesFor(NESTED, { lat: 0, lng: 2.5 })).toBe("15");
  });

  it("gir null utenfor den ytterste", () => {
    expect(reachMinutesFor(NESTED, { lat: 0, lng: 4 })).toBeNull();
  });

  it("gir null uten ringer", () => {
    expect(reachMinutesFor([], { lat: 0, lng: 0 })).toBeNull();
  });
});

describe("partitionByReach", () => {
  const pois = [
    { id: "inne", coordinates: { lat: 0, lng: 0 } },
    { id: "midt", coordinates: { lat: 0, lng: 2.5 } },
    { id: "ute", coordinates: { lat: 0, lng: 9 } },
  ];

  it("deler i innenfor og utenfor, og teller begge", () => {
    const result = partitionByReach(NESTED, pois);
    expect(result.active).toBe(true);
    expect([...result.outsideIds]).toEqual(["ute"]);
    expect(result.inside).toBe(2);
  });

  it("rapporterer konturene som finnes, innerst først", () => {
    expect(partitionByReach(NESTED, pois).minutes).toEqual(["5", "10", "15"]);
  });

  it("slår sammen flere flater med samme minuttverdi til én oppføring", () => {
    // Isochrone gir MultiPolygon når et nåbart område henger på en bru uten
    // kobling i veinettet — det er fortsatt ÉN kontur.
    const split: ContourRing[] = [
      { minutes: "10", outer: square(1), holes: [] },
      { minutes: "10", outer: [[8, 8], [9, 8], [9, 9], [8, 9], [8, 8]], holes: [] },
    ];
    const result = partitionByReach(split, [
      { id: "a", coordinates: { lat: 0, lng: 0 } },
      { id: "b", coordinates: { lat: 8.5, lng: 8.5 } },
    ]);
    expect(result.minutes).toEqual(["10"]);
    expect(result.inside).toBe(2);
  });

  it("er INAKTIV uten ringer — ikke «alle utenfor»", () => {
    // Mangler profilen konturer, har vi ikke målt noe. Da skal ingenting dempes.
    expect(partitionByReach([], pois)).toEqual(REACH_INACTIVE);
  });
});
