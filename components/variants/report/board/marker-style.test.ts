import { describe, it, expect } from "vitest";
import { poiVisualIdentity } from "./marker-style";

/**
 * Den delte derivasjonen av en POI-s visuelle identitet (2026-08-13).
 *
 * Bakgrunn: kartmarkøren avledet ikon/farge fra POI-ens sub-kategori, mens
 * sidebar-radene hardkodet et nål-ikon i temafargen. Samme sted så ulikt ut på
 * de to flatene. Derivasjonen bor nå på ett sted, og disse testene er kontrakten
 * som holder den der.
 */

const TEMA = { icon: "Utensils", color: "#ef4444" };

describe("poiVisualIdentity", () => {
  it("sub-kategoriens ikon og dempede farge vinner over temaets", () => {
    expect(
      poiVisualIdentity({ category: { icon: "Coffee", color: "#f97316" } }, TEMA),
    ).toEqual({ icon: "Coffee", color: "#fa8229" });
  });

  it("faller tilbake til temaets farge når sub-kategorien mangler farge", () => {
    expect(
      poiVisualIdentity({ category: { icon: "Coffee" } }, TEMA),
    ).toEqual({ icon: "Coffee", color: "#ef4444" });
  });

  it("faller tilbake til temaets ikon når sub-kategorien mangler ikon", () => {
    expect(
      poiVisualIdentity({ category: { color: "#f97316" } }, TEMA),
    ).toEqual({ icon: "Utensils", color: "#fa8229" });
  });

  it("faller tilbake på begge når sub-kategorien er tom", () => {
    expect(poiVisualIdentity({ category: {} }, TEMA)).toEqual(TEMA);
  });

  it("behandler tom streng som manglende verdi (ikke som gyldig ikon)", () => {
    expect(
      poiVisualIdentity({ category: { icon: "", color: "" } }, TEMA),
    ).toEqual(TEMA);
  });

  it("slipper ukjent hex gjennom uendret — aldri undefined inn i backgroundColor", () => {
    const out = poiVisualIdentity(
      { category: { icon: "Star", color: "#123456" } },
      TEMA,
    );
    expect(out.color).toBe("#123456");
    expect(out.color).toBeTypeOf("string");
  });

  it("returnerer primitiver, ikke nøstede objekter (React.memo-stabilitet)", () => {
    const out = poiVisualIdentity(
      { category: { icon: "Coffee", color: "#f97316" } },
      TEMA,
    );
    expect(typeof out.icon).toBe("string");
    expect(typeof out.color).toBe("string");
    expect(Object.keys(out).sort()).toEqual(["color", "icon"]);
  });

  it("er ren: samme input gir samme output", () => {
    const poi = { category: { icon: "Coffee", color: "#f97316" } };
    expect(poiVisualIdentity(poi, TEMA)).toEqual(poiVisualIdentity(poi, TEMA));
  });
});
