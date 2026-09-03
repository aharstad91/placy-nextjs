import { describe, it, expect } from "vitest";
import {
  contourFeatureCollection,
  contourLabels,
  contourRings,
  contourRingsForMode,
  northmostPoint,
} from "./contour-geometry";
import type { IsochroneContours, IsochroneSet } from "@/lib/types";

/** Lukket firkant sentrert i (10.4, 63.4) med gitt halvbredde i grader. */
function square(offset: number): [number, number][] {
  return [
    [10.4 - offset, 63.4 - offset],
    [10.4 + offset, 63.4 - offset],
    [10.4 + offset, 63.4 + offset],
    [10.4 - offset, 63.4 + offset],
    [10.4 - offset, 63.4 - offset],
  ];
}

const polygonContours = {
  "5": { type: "Polygon", coordinates: [square(0.004)] },
  "10": { type: "Polygon", coordinates: [square(0.008)] },
  "15": { type: "Polygon", coordinates: [square(0.012)] },
} as unknown as IsochroneContours;

describe("contourRings", () => {
  it("gir én ring per kontur, innerst først", () => {
    const rings = contourRings(polygonContours);
    expect(rings.map((r) => r.minutes)).toEqual(["5", "10", "15"]);
    expect(rings[0].outer).toHaveLength(5);
    expect(rings[0].holes).toEqual([]);
  });

  it("splitter en MultiPolygon-kontur i én ring per flate", () => {
    const multi = {
      ...polygonContours,
      "15": {
        type: "MultiPolygon",
        coordinates: [[square(0.012)], [square(0.02)]],
      },
    } as unknown as IsochroneContours;
    const rings = contourRings(multi);
    expect(rings.filter((r) => r.minutes === "15")).toHaveLength(2);
    expect(rings).toHaveLength(4);
  });

  it("bærer hull som egne ringer på flaten de hører til", () => {
    const withHole = {
      ...polygonContours,
      "10": { type: "Polygon", coordinates: [square(0.008), square(0.002)] },
    } as unknown as IsochroneContours;
    const ring = contourRings(withHole).find((r) => r.minutes === "10")!;
    expect(ring.holes).toHaveLength(1);
    expect(ring.holes[0]).toHaveLength(5);
  });

  it("hopper over en flate uten gyldig ytre ring", () => {
    const degenerate = {
      ...polygonContours,
      "5": { type: "Polygon", coordinates: [[[10.4, 63.4]]] },
    } as unknown as IsochroneContours;
    expect(contourRings(degenerate).map((r) => r.minutes)).toEqual(["10", "15"]);
  });

  it("gir tom liste når konturene mangler", () => {
    expect(contourRings(undefined)).toEqual([]);
  });
});

describe("contourRingsForMode", () => {
  const set = {
    isochronesVersion: 1,
    fetchedAt: "2026-09-03T00:00:00.000Z",
    byMode: { walk: polygonContours },
  } as unknown as IsochroneSet;

  it("gir konturene for den aktive reisemåten", () => {
    expect(contourRingsForMode(set, "walk")).toHaveLength(3);
  });

  it("AE4: gir tom liste for en reisemåte uten konturer", () => {
    expect(contourRingsForMode(set, "bike")).toEqual([]);
  });

  it("gir tom liste når settet mangler helt", () => {
    expect(contourRingsForMode(undefined, "walk")).toEqual([]);
  });
});

describe("northmostPoint", () => {
  it("velger punktet med høyest breddegrad", () => {
    const point = northmostPoint(contourRings(polygonContours));
    expect(point![1]).toBeCloseTo(63.412, 6);
  });

  it("gir null uten ringer", () => {
    expect(northmostPoint([])).toBeNull();
  });
});

describe("contourLabels", () => {
  it("gir én etikett per kontur med minutt-teksten", () => {
    const labels = contourLabels(contourRings(polygonContours));
    expect(labels.map((l) => l.text)).toEqual(["5 min", "10 min", "15 min"]);
  });

  it("plasserer hver etikett på sin egen konturs nordligste punkt", () => {
    const labels = contourLabels(contourRings(polygonContours));
    expect(labels[0].lat).toBeCloseTo(63.404, 6);
    expect(labels[1].lat).toBeCloseTo(63.408, 6);
    expect(labels[2].lat).toBeCloseTo(63.412, 6);
  });

  it("gir ÉN etikett for en kontur med flere flater", () => {
    const multi = {
      ...polygonContours,
      "15": { type: "MultiPolygon", coordinates: [[square(0.012)], [square(0.02)]] },
    } as unknown as IsochroneContours;
    const labels = contourLabels(contourRings(multi));
    expect(labels.filter((l) => l.minutes === "15")).toHaveLength(1);
    // Den nordligste av flatene vinner.
    expect(labels[2].lat).toBeCloseTo(63.42, 6);
  });

  it("skyver en etikett nordover når to konturer stopper på samme sted", () => {
    // En ås rett nord: 10 og 15 min når ikke lenger enn 5 min gjør.
    const blocked = {
      "5": { type: "Polygon", coordinates: [square(0.004)] },
      "10": { type: "Polygon", coordinates: [square(0.004)] },
      "15": { type: "Polygon", coordinates: [square(0.004)] },
    } as unknown as IsochroneContours;
    const labels = contourLabels(contourRings(blocked), 0.001);
    expect(labels[1].lat - labels[0].lat).toBeCloseTo(0.001, 6);
    expect(labels[2].lat - labels[1].lat).toBeCloseTo(0.001, 6);
  });
});

describe("contourFeatureCollection", () => {
  it("gir én LineString per ring med minuttverdien som tall", () => {
    const fc = contourFeatureCollection(contourRings(polygonContours));
    expect(fc.features).toHaveLength(3);
    expect(fc.features[0].geometry.type).toBe("LineString");
    expect(fc.features.map((f) => f.properties!.contour)).toEqual([5, 10, 15]);
  });

  it("gir en tom samling uten ringer", () => {
    expect(contourFeatureCollection([]).features).toEqual([]);
  });
});
