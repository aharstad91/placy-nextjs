import { describe, it, expect } from "vitest";
import {
  poiPinScaleForZoom,
  POI_PIN_GROW_START_ZOOM,
  POI_PIN_GROW_END_ZOOM,
  POI_PIN_MIN_SCALE,
  POI_PIN_MAX_SCALE,
  POI_PIN_SCALE_STEP,
} from "./poi-pin-scale";

describe("poiPinScaleForZoom — rampen", () => {
  it("hele oversikts- og strøks-zoomen står på basis", () => {
    // Tersklene for prikk/label er 13/16 — rampen starter over BEGGE, så et
    // board som ligger på oversikt har nøyaktig samme markør som 2D-kartet.
    for (const z of [11, 13, 15, 16, 16.9, POI_PIN_GROW_START_ZOOM]) {
      expect(poiPinScaleForZoom(z)).toBe(POI_PIN_MIN_SCALE);
    }
  });

  it("flater ut på full vekst — vokser ikke i det uendelige", () => {
    for (const z of [POI_PIN_GROW_END_ZOOM, 20, 24]) {
      expect(poiPinScaleForZoom(z)).toBe(POI_PIN_MAX_SCALE);
    }
  });

  it("midt i rampen ligger den midt mellom endepunktene", () => {
    const mid = (POI_PIN_GROW_START_ZOOM + POI_PIN_GROW_END_ZOOM) / 2;
    const linear = (POI_PIN_MIN_SCALE + POI_PIN_MAX_SCALE) / 2;
    // Innenfor ett trinn: kvantiseringen får lov til å runde, rampen får ikke
    // lov til å være noe annet enn lineær.
    expect(Math.abs(poiPinScaleForZoom(mid) - linear)).toBeLessThanOrEqual(
      POI_PIN_SCALE_STEP,
    );
  });

  it("gatezoom (~18) gir omtrent de 40 px pinnen hadde før", () => {
    // 32 px × 1,25. Dette er tallet Andreas leste som «for lite» ved 32 px.
    expect(poiPinScaleForZoom(18)).toBe(1.25);
    expect(Math.round(32 * poiPinScaleForZoom(18))).toBe(40);
  });

  it("kvantisert til trinn — ingen 1,3000000000000003 inn i CSS", () => {
    for (let z = 16; z <= 20; z += 0.037) {
      const s = poiPinScaleForZoom(z);
      const steps = s / POI_PIN_SCALE_STEP;
      expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-9);
      // To desimaler: px-tallene og `sameResult`-dedupen skal være eksakte.
      expect(s).toBe(Math.round(s * 100) / 100);
    }
  });

  it("monoton: zoomer man inn blir markøren aldri mindre", () => {
    let prev = 0;
    for (let z = 12; z <= 21; z += 0.1) {
      const s = poiPinScaleForZoom(z);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it("aldri utenfor [min, max] — heller ikke for tull-input", () => {
    for (const z of [-40, 0, 100, 1e9]) {
      const s = poiPinScaleForZoom(z);
      expect(s).toBeGreaterThanOrEqual(POI_PIN_MIN_SCALE);
      expect(s).toBeLessThanOrEqual(POI_PIN_MAX_SCALE);
    }
  });

  it("ulesbart kamera → basis, ikke en gjettet oppskalering", () => {
    // Google deriverer kamera-feltene; de mangler til første scene er rendret.
    // Ville vi gjettet stort her, hadde alle markørene blinket ned ved mount.
    expect(poiPinScaleForZoom(null)).toBe(POI_PIN_MIN_SCALE);
    expect(poiPinScaleForZoom(undefined)).toBe(POI_PIN_MIN_SCALE);
    expect(poiPinScaleForZoom(NaN)).toBe(POI_PIN_MIN_SCALE);
    // Infinity er ikke «uendelig langt inn», det er en ulesbar avlesning.
    expect(poiPinScaleForZoom(Infinity)).toBe(POI_PIN_MIN_SCALE);
  });
});
