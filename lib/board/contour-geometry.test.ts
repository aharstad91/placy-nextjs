import { describe, it, expect } from "vitest";
import {
  contourFeatureCollection,
  contourLabelCandidates,
  contourRings,
  contourRingsForMode,
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

describe("contourLabelCandidates", () => {
  it("gir kandidater per kontur, nordligst først", () => {
    const cands = contourLabelCandidates(contourRings(polygonContours));
    expect(cands.map((c) => c.minutes)).toEqual(["5", "10", "15"]);
    for (const c of cands) {
      const lats = c.points.map((p) => p[1]);
      expect([...lats].sort((a, b) => b - a)).toEqual(lats);
    }
  });

  it("slår flere flater med samme minuttverdi sammen til ÉN kandidatliste", () => {
    // Isochrone gir MultiPolygon når et nåbart område henger på en bru uten
    // kobling i veinettet — det er fortsatt én kontur, med én etikett.
    const multi = {
      ...polygonContours,
      "15": { type: "MultiPolygon", coordinates: [[square(0.012)], [square(0.02)]] },
    } as unknown as IsochroneContours;
    const cands = contourLabelCandidates(contourRings(multi));
    expect(cands.filter((c) => c.minutes === "15")).toHaveLength(1);
    // Den nordligste flatens toppunkt ligger først.
    expect(cands[2].points[0][1]).toBeCloseTo(63.42, 6);
  });

  it("subsampler FØR sorteringen, så kandidatene er spredt rundt ringen", () => {
    /* Sorterte vi først og kappet, ville alle kandidatene ligget i samme
       nordlige hjørne — og et kamera som ikke ser hjørnet hadde stått uten
       etikett likevel. */
    const ring = {
      minutes: "10" as const,
      outer: Array.from({ length: 400 }, (_, i) => {
        const a = (i / 400) * Math.PI * 2;
        return [10.4 + 0.01 * Math.cos(a), 63.41 + 0.01 * Math.sin(a)] as [
          number,
          number,
        ];
      }),
      holes: [],
    };
    ring.outer.push(ring.outer[0]);
    const [cand] = contourLabelCandidates([ring], 40);
    expect(cand.points.length).toBeLessThanOrEqual(40);
    const lats = cand.points.map((p) => p[1]);
    // Spennet dekker hele ringen, ikke bare toppen.
    expect(Math.max(...lats) - Math.min(...lats)).toBeGreaterThan(0.015);
  });

  it("hopper over konturer uten ringer", () => {
    expect(contourLabelCandidates([])).toEqual([]);
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
