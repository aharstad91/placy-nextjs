import { describe, it, expect } from "vitest";
import { computeSpreadCoordinates } from "./spread-co-located";

// AKSET-caset: ungdomsskole + vgs på identisk koordinat (Straumen 2026-08-12)
const AKSET = { lat: 63.87729, lng: 11.28629 };

function meters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng =
    (b.lng - a.lng) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

describe("computeSpreadCoordinates", () => {
  it("returnerer tomt map når ingen punkter er samlokalisert", () => {
    const result = computeSpreadCoordinates([
      { id: "a", coordinates: { lat: 63.87, lng: 11.29 } },
      { id: "b", coordinates: { lat: 63.88, lng: 11.3 } },
    ]);
    expect(result.size).toBe(0);
  });

  it("sprer et identisk-koordinat-par til ~2× radius avstand", () => {
    const result = computeSpreadCoordinates(
      [
        { id: "vgs", coordinates: AKSET },
        { id: "ungdomsskole", coordinates: AKSET },
      ],
      { radiusMeters: 12 },
    );
    expect(result.size).toBe(2);
    const d = meters(result.get("vgs")!, result.get("ungdomsskole")!);
    expect(d).toBeGreaterThan(20);
    expect(d).toBeLessThan(28);
  });

  it("er deterministisk og rekkefølge-uavhengig", () => {
    const pts = [
      { id: "b", coordinates: AKSET },
      { id: "a", coordinates: AKSET },
    ];
    const r1 = computeSpreadCoordinates(pts);
    const r2 = computeSpreadCoordinates([...pts].reverse());
    expect(r1.get("a")).toEqual(r2.get("a"));
    expect(r1.get("b")).toEqual(r2.get("b"));
  });

  it("grupperer transitivt: kjede av nære punkter blir én gruppe", () => {
    // a–b 8 m, b–c 8 m, a–c 16 m (over threshold 12) — likevel én gruppe
    const result = computeSpreadCoordinates([
      { id: "a", coordinates: { lat: 63.87729, lng: 11.28629 } },
      { id: "b", coordinates: { lat: 63.877362, lng: 11.28629 } },
      { id: "c", coordinates: { lat: 63.877434, lng: 11.28629 } },
    ]);
    expect(result.size).toBe(3);
  });

  it("alle medlemmer i en 3-gruppe får innbyrdes synlig avstand", () => {
    const result = computeSpreadCoordinates(
      [
        { id: "a", coordinates: AKSET },
        { id: "b", coordinates: AKSET },
        { id: "c", coordinates: AKSET },
      ],
      { radiusMeters: 12 },
    );
    const coords = [result.get("a")!, result.get("b")!, result.get("c")!];
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        expect(meters(coords[i], coords[j])).toBeGreaterThan(15);
      }
    }
  });

  it("rører ikke punkter utenfor grupper (fravær i map = vis ekte koordinat)", () => {
    const result = computeSpreadCoordinates([
      { id: "par1", coordinates: AKSET },
      { id: "par2", coordinates: AKSET },
      { id: "alene", coordinates: { lat: 63.86, lng: 11.31 } },
    ]);
    expect(result.has("alene")).toBe(false);
    expect(result.size).toBe(2);
  });
});
