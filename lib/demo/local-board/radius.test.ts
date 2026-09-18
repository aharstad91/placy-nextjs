import { describe, expect, it } from "vitest";
import { curatedInitialIds, discoveryGeometry, radiusPlaces } from "@/lib/demo/local-board/radius";
import type { BoardData } from "@/components/variants/report/board/board-data";

/**
 * Boardet (`board.ts`) og guiden (`presentation.ts`) beregner hvilke steder som
 * vises FØR brukeren ber om flere, fra samme funksjon. Testen låser at et
 * datasett uten manus gir samme svar begge steder: før 2026-09-18 fikk boardet
 * `undefined` (alt innen 2 km) og guiden `[]` (bare de tre nærmeste), så guiden
 * kunne «avdekke» steder kartet alt viste.
 */
describe("curatedInitialIds", () => {
  it("er undefined uten manus, og manusets steder med manus", () => {
    expect(curatedInitialIds(undefined)).toBeUndefined();
    expect(curatedInitialIds([])).toBeUndefined();
    expect(curatedInitialIds([{ placeIds: ["a", "b"] }, { placeIds: ["c"] }])).toEqual(["a", "b", "c"]);
  });

  it("gir boardet og guiden samme startutvalg når datasettet mangler manus", () => {
    const center = { lat: 63.44, lng: 10.47 };
    // Fem treningssteder innen 2 km: uten manus skal alle være synlige fra start.
    const places = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`, categoryId: "trening", coordinates: { lat: center.lat + 0.001 * (i + 1), lng: center.lng },
    }));
    const board = radiusPlaces(places, center, ["trening"], curatedInitialIds(undefined));
    const guide = radiusPlaces(places, center, ["trening"], curatedInitialIds([]));
    expect(guide).toEqual(board);
    expect(board.every(p => p.initiallyVisible)).toBe(true);
  });
});

/**
 * Ringen rundt hjemmet navngis etter datasettets eget hjem. Testen fantes bare
 * med Nyhavna, så et hardkodet «Nyhavna» ville ha bestått den; her er hjemmet
 * Leangenbukta, og navnet må følge med.
 */
describe("discoveryGeometry", () => {
  it("navngir ringen etter datasettets eget hjem", () => {
    const center = { lat: 63.43, lng: 10.45 };
    const data = {
      home: { name: "Leangenbukta", coordinates: center },
      poisById: new Map([["trening-1", {}]]),
      demoRadiusPlaces: radiusPlaces(
        [{ id: "trening-1", categoryId: "trening", coordinates: { lat: center.lat + 0.005, lng: center.lng } }],
        center, ["trening"], undefined,
      ),
    } as unknown as BoardData;
    const [ring] = discoveryGeometry(data, "trening");
    expect(ring.name).toContain("Leangenbukta");
    expect(ring.name).not.toContain("Nyhavna");
    expect(ring.themeId).toBe("trening");
    expect(discoveryGeometry(data, "ukjent-kategori")).toEqual([]);
  });
});
