import { describe, it, expect } from "vitest";
import { fitPortfolioCamera, boundsOf } from "@/lib/portfolio/fit-camera";
import { HEM_PORTFOLIO } from "@/data/portfolios/hem";

const TRONDHEIM = { lat: 63.422074, lng: 10.450617 }; // Wesselsløkka
const MELHUS = { lat: 63.284281, lng: 10.285656 }; // Ole Brumms Hage
const INDEROY = { lat: 63.865218, lng: 11.303152 }; // Sundsøya

describe("boundsOf", () => {
  it("gir null for tom liste", () => {
    expect(boundsOf([])).toBeNull();
  });

  it("omslutter alle punktene", () => {
    const b = boundsOf([TRONDHEIM, MELHUS, INDEROY])!;
    expect(b.south).toBe(MELHUS.lat);
    expect(b.north).toBe(INDEROY.lat);
    expect(b.west).toBe(MELHUS.lng);
    expect(b.east).toBe(INDEROY.lng);
  });
});

describe("fitPortfolioCamera", () => {
  it("gir null for tom liste", () => {
    expect(fitPortfolioCamera([])).toBeNull();
  });

  it("gir fast nær-range for ett punkt", () => {
    const cam = fitPortfolioCamera([TRONDHEIM])!;
    expect(cam.center).toEqual(TRONDHEIM);
    expect(cam.range).toBe(1500);
  });

  it("gir nær-range når to punkter ligger oppå hverandre", () => {
    const cam = fitPortfolioCamera([TRONDHEIM, { ...TRONDHEIM }])!;
    expect(cam.range).toBe(1500);
  });

  it("legger senteret inne i boksen og dekker diagonalen (AE3)", () => {
    const cam = fitPortfolioCamera([TRONDHEIM, MELHUS, INDEROY])!;

    expect(cam.center.lat).toBeGreaterThan(cam.bounds.south);
    expect(cam.center.lat).toBeLessThan(cam.bounds.north);
    expect(cam.center.lng).toBeGreaterThan(cam.bounds.west);
    expect(cam.center.lng).toBeLessThan(cam.bounds.east);

    // Utstrekningen er ~65 km nord-sør. Range må ligge i samme størrelsesorden
    // eller over — en range på nabolagsnivå ville betydd at innrammingen ikke
    // så de ytre punktene i det hele tatt.
    const heightM = (cam.bounds.north - cam.bounds.south) * 110_574;
    expect(cam.range).toBeGreaterThan(heightM / 2);
  });

  it("gir større range jo mer spredt prosjektene ligger", () => {
    const tett = fitPortfolioCamera([TRONDHEIM, MELHUS])!;
    const spredt = fitPortfolioCamera([TRONDHEIM, MELHUS, INDEROY])!;
    expect(spredt.range).toBeGreaterThan(tett.range);
  });

  it("rammer hele HEM-porteføljen inn i ruta på både desktop og mobil", () => {
    // Selve akseptansen bak AE3: hvert eneste prosjekt må projisere innenfor
    // ruta ved åpning. Vi regner ground-footprint fra range og sjekker at
    // bounding-boksen får plass i den, på begge skjermformene.
    const cam = fitPortfolioCamera(HEM_PORTFOLIO.projects)!;
    for (const viewport of [
      { width: 900, height: 900 }, // desktop-kartrute
      { width: 390, height: 480 }, // mobil-kartrute
    ]) {
      const { widthM, heightM } = groundFootprint(cam.range, viewport, cam.center.lat);
      const cosLat = Math.cos((cam.center.lat * Math.PI) / 180);
      const spanW = (cam.bounds.east - cam.bounds.west) * 111_320 * cosLat;
      const spanH = (cam.bounds.north - cam.bounds.south) * 110_574;
      expect(widthM, `bredde på ${viewport.width}x${viewport.height}`).toBeGreaterThan(spanW);
      expect(heightM, `høyde på ${viewport.width}x${viewport.height}`).toBeGreaterThan(spanH);
    }
  });

  it("gir en zoom som stemmer med range for Mapbox-reserven", () => {
    const cam = fitPortfolioCamera(HEM_PORTFOLIO.projects)!;
    // Hele Trøndelag i bildet er lav zoom; en tosifret zoom ville betydd at de
    // to konverteringene har drevet fra hverandre.
    expect(cam.zoom).toBeGreaterThan(1);
    expect(cam.zoom).toBeLessThan(10);
  });
});

/** Ground-footprint ved gitt range — invers av `zoomToRange`s geometri. */
function groundFootprint(
  range: number,
  viewport: { width: number; height: number },
  _latDeg: number,
) {
  const fovVRad = (35 * Math.PI) / 180;
  const aspect = viewport.width / viewport.height;
  const fovHRad = 2 * Math.atan(aspect * Math.tan(fovVRad / 2));
  const widthM = 2 * range * Math.tan(fovHRad / 2);
  const heightM = 2 * range * Math.tan(fovVRad / 2);
  return { widthM, heightM };
}
