import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isMarker3DTarget,
  MARKER_3D_ATTR,
  MARKER_3D_SELECTOR,
} from "./marker-3d-selectors";

/** Bygger et markør-element med et barn, og returnerer barnet (det klikket treffer). */
function markerWithChild(tag: string, withAttr = true) {
  const marker = document.createElement(tag);
  if (withAttr) marker.setAttribute(MARKER_3D_ATTR, "");
  const inner = document.createElement("span");
  inner.textContent = "Grillstadfjæra";
  marker.appendChild(inner);
  const map = document.createElement("gmp-map-3d");
  map.appendChild(marker);
  return { marker, inner, map };
}

describe("isMarker3DTarget — begge markør-generasjoner", () => {
  it("gjenkjenner den rasteriserte markøren (dagens oppførsel)", () => {
    const { marker } = markerWithChild("gmp-marker-3d-interactive");
    expect(isMarker3DTarget(marker)).toBe(true);
  });

  it("gjenkjenner HTML-markøren", () => {
    const { marker } = markerWithChild("gmp-marker-interactive");
    expect(isMarker3DTarget(marker)).toBe(true);
  });

  it("gjenkjenner de non-interaktive variantene av begge", () => {
    expect(isMarker3DTarget(markerWithChild("gmp-marker-3d").marker)).toBe(true);
    expect(isMarker3DTarget(markerWithChild("gmp-marker").marker)).toBe(true);
  });

  it("treffer et NØSTET barn — klikket lander på labelen, ikke på verten", () => {
    const { inner } = markerWithChild("gmp-marker-interactive");
    expect(isMarker3DTarget(inner)).toBe(true);
  });

  it("kart-bakgrunnen er IKKE en markør — ellers slutter popupen å lukke seg", () => {
    const { map } = markerWithChild("gmp-marker-interactive");
    expect(isMarker3DTarget(map)).toBe(false);
  });

  it("tåler null og ikke-Element-mål uten å kaste", () => {
    expect(isMarker3DTarget(null)).toBe(false);
    expect(isMarker3DTarget(document.createTextNode("x"))).toBe(false);
    expect(isMarker3DTarget(window)).toBe(false);
  });

  it("fanger markøren på tagnavn alene, uten attributtet", () => {
    // Fallback-stien: en markør vi ikke selv monterte, eller som mistet
    // attributtet i en refaktorering, skal fortsatt fanges.
    const { marker } = markerWithChild("gmp-marker-interactive", false);
    expect(isMarker3DTarget(marker)).toBe(true);
  });

  it("fanger markøren på attributtet alene, uansett tagnavn", () => {
    const el = document.createElement("div");
    el.setAttribute(MARKER_3D_ATTR, "");
    expect(isMarker3DTarget(el)).toBe(true);
  });

  it("selektoren nevner hvert tagnavn eksplisitt — gmp-marker dekker ikke gmp-marker-interactive", () => {
    // Fellen denne modulen finnes for: de to er ULIKE tagnavn, ikke et prefiks.
    for (const tag of [
      "gmp-marker-3d",
      "gmp-marker-3d-interactive",
      "gmp-marker",
      "gmp-marker-interactive",
    ]) {
      expect(MARKER_3D_SELECTOR).toContain(tag);
    }
    // Bevis påstanden i jsdom, så den ikke bare er en kommentar.
    const el = document.createElement("gmp-marker-interactive");
    expect(el.closest("gmp-marker")).toBeNull();
  });
});

describe("kallstedene bruker den delte gaten", () => {
  // Vakt mot at noen skriver closest("gmp-marker-3d-interactive") på nytt. Gaten
  // er usynlig når den svikter — POI-trykk blir lest som kamera-grep — og ingen
  // av de tre kallstedene har en render-test som ville fanget det.
  const CALL_SITES = [
    "components/variants/report/board/BoardMap3D.tsx",
    "components/variants/report/board/use-3d-viewport-publish.ts",
  ];

  for (const file of CALL_SITES) {
    it(`${file} importerer isMarker3DTarget i stedet for en literal`, () => {
      const src = readFileSync(join(process.cwd(), file), "utf8");
      expect(src).toContain("isMarker3DTarget");
      expect(src).not.toMatch(/closest\(\s*["']gmp-marker/);
    });
  }
});
