import { describe, it, expect } from "vitest";
import { IsochroneSetSchema } from "@/lib/types";

/** En lukket firkant rundt et punkt — minste gyldige ring (4 punkter). */
function ring(offset: number): number[][] {
  return [
    [10.4 - offset, 63.4 - offset],
    [10.4 + offset, 63.4 - offset],
    [10.4 + offset, 63.4 + offset],
    [10.4 - offset, 63.4 + offset],
    [10.4 - offset, 63.4 - offset],
  ];
}

function polygon(offset: number) {
  return { type: "Polygon" as const, coordinates: [ring(offset)] };
}

function contours() {
  return {
    "5": polygon(0.004),
    "10": polygon(0.008),
    "15": polygon(0.012),
  };
}

function validSet() {
  return {
    isochronesVersion: 1,
    fetchedAt: "2026-09-03T08:00:00.000Z",
    byMode: { walk: contours(), bike: contours(), car: contours() },
  };
}

describe("IsochroneSetSchema", () => {
  it("parser et fullt sett og beholder alle tre konturer per profil", () => {
    const result = IsochroneSetSchema.safeParse(validSet());
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const mode of ["walk", "bike", "car"] as const) {
      const byMode = result.data.byMode[mode];
      expect(byMode).toBeDefined();
      expect(Object.keys(byMode!).sort()).toEqual(["10", "15", "5"]);
      expect(byMode!["10"].coordinates[0]).toHaveLength(5);
    }
  });

  it("godtar et delvis sett med bare gange (AE4)", () => {
    const result = IsochroneSetSchema.safeParse({
      ...validSet(),
      byMode: { walk: contours() },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.byMode.walk).toBeDefined();
    expect(result.data.byMode.bike).toBeUndefined();
    expect(result.data.byMode.car).toBeUndefined();
  });

  it("godtar MultiPolygon — Isochrone kan returnere flere flater per kontur", () => {
    const multi = {
      type: "MultiPolygon" as const,
      coordinates: [[ring(0.004)], [ring(0.002)]],
    };
    const result = IsochroneSetSchema.safeParse({
      ...validSet(),
      byMode: { walk: { ...contours(), "15": multi } },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.byMode.walk!["15"].type).toBe("MultiPolygon");
  });

  it("avviser en ukjent versjon", () => {
    const result = IsochroneSetSchema.safeParse({ ...validSet(), isochronesVersion: 2 });
    expect(result.success).toBe(false);
  });

  it("avviser et tomt sett — ingen profiler skal ikke lagres", () => {
    const result = IsochroneSetSchema.safeParse({ ...validSet(), byMode: {} });
    expect(result.success).toBe(false);
  });

  it("avviser koordinatpar med feil aritet", () => {
    const broken = { type: "Polygon" as const, coordinates: [[[10.4], [10.4], [10.4], [10.4]]] };
    const result = IsochroneSetSchema.safeParse({
      ...validSet(),
      byMode: { walk: { ...contours(), "5": broken } },
    });
    expect(result.success).toBe(false);
  });

  // MERK: et byttet [lat, lng]-par i Norge gir lng 63 og lat 10 — begge
  // gyldige verdier. Rekkefølge-feil kan derfor bare fanges når breddegraden
  // sprenger [-90, 90], altså for koordinater lenger øst enn 90 grader.
  it("avviser en breddegrad utenfor [-90, 90]", () => {
    const outOfRange = {
      type: "Polygon" as const,
      coordinates: [
        [
          [10.4, 163.4],
          [10.5, 163.4],
          [10.5, 163.5],
          [10.4, 163.4],
        ],
      ],
    };
    const result = IsochroneSetSchema.safeParse({
      ...validSet(),
      byMode: { walk: { ...contours(), "5": outOfRange } },
    });
    expect(result.success).toBe(false);
  });

  it("avviser en ring som ikke er lukket", () => {
    const open = {
      type: "Polygon" as const,
      coordinates: [
        [
          [10.4, 63.4],
          [10.5, 63.4],
          [10.5, 63.5],
          [10.45, 63.45],
        ],
      ],
    };
    const result = IsochroneSetSchema.safeParse({
      ...validSet(),
      byMode: { walk: { ...contours(), "5": open } },
    });
    expect(result.success).toBe(false);
  });

  it("krever alle tre minuttverdier — en profil med bare 5 min avvises", () => {
    const result = IsochroneSetSchema.safeParse({
      ...validSet(),
      byMode: { walk: { "5": polygon(0.004) } },
    });
    expect(result.success).toBe(false);
  });
});
