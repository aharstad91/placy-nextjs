import { describe, it, expect } from "vitest";
import { poiVisualIdentity } from "./marker-style";

/**
 * Den delte derivasjonen av en POI-s visuelle identitet.
 *
 * Opprinnelig kontrakt (2026-08-13): kartmarkøren og sidebar-raden for samme
 * sted skal se identiske ut, så derivasjonen bor på ett sted.
 *
 * Endret regel (2026-09-07): FARGEN kommer fra temaet, ikke fra
 * underkategorien. Underkategori-fargene ble delt ut per kategori uten et
 * felles budsjett, så en frisør fikk fuchsia inne i det grønne Hverdag-temaet
 * og et legesenter fikk Transport-temaets blå. Temaraden er den eneste
 * fargenøkkelen brukeren får se; markørene må lyde den. Ikonet bærer fortsatt
 * forskjellen inni temaet.
 */

const TEMA = { icon: "Utensils", color: "#ef4444" };

describe("poiVisualIdentity", () => {
  it("bruker temaets farge, ikke underkategoriens", () => {
    expect(
      poiVisualIdentity({ category: { icon: "Coffee" } }, TEMA),
    ).toEqual({ icon: "Coffee", color: "#f35a5a" });
  });

  it("beholder underkategoriens ikon", () => {
    expect(poiVisualIdentity({ category: { icon: "Coffee" } }, TEMA).icon).toBe(
      "Coffee",
    );
  });

  it("demper temafargen til 450-nivå når den er kjent", () => {
    // green-500 → 450. Uten dempingen roper markøren mot lys kartbakgrunn.
    expect(
      poiVisualIdentity({ category: { icon: "Star" } }, {
        icon: "ShoppingCart",
        color: "#22c55e",
      }).color,
    ).toBe("#36d16f");
  });

  it("faller tilbake til temaets ikon når underkategorien mangler ikon", () => {
    expect(poiVisualIdentity({ category: {} }, TEMA)).toEqual({
      icon: "Utensils",
      color: "#f35a5a",
    });
  });

  it("behandler tom streng som manglende ikon (ikke som gyldig ikon)", () => {
    expect(poiVisualIdentity({ category: { icon: "" } }, TEMA)).toEqual({
      icon: "Utensils",
      color: "#f35a5a",
    });
  });

  it("slipper ukjent temafarge gjennom uendret — aldri undefined inn i backgroundColor", () => {
    const out = poiVisualIdentity({ category: { icon: "Star" } }, {
      icon: "Utensils",
      color: "#123456",
    });
    expect(out.color).toBe("#123456");
    expect(out.color).toBeTypeOf("string");
  });

  it("to POI-er i samme tema får samme farge, uansett underkategori", () => {
    const frisor = poiVisualIdentity({ category: { icon: "Scissors" } }, TEMA);
    const butikk = poiVisualIdentity({ category: { icon: "Store" } }, TEMA);
    expect(frisor.color).toBe(butikk.color);
    expect(frisor.icon).not.toBe(butikk.icon);
  });

  it("returnerer primitiver, ikke nøstede objekter (React.memo-stabilitet)", () => {
    const out = poiVisualIdentity({ category: { icon: "Coffee" } }, TEMA);
    expect(typeof out.icon).toBe("string");
    expect(typeof out.color).toBe("string");
    expect(Object.keys(out).sort()).toEqual(["color", "icon"]);
  });

  it("er ren: samme input gir samme output", () => {
    const poi = { category: { icon: "Coffee" } };
    expect(poiVisualIdentity(poi, TEMA)).toEqual(poiVisualIdentity(poi, TEMA));
  });
});
