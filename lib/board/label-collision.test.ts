import { describe, it, expect } from "vitest";
import {
  computeLabelPlacements,
  estimateLabelBox,
  wrapLabelLines,
  LABEL_CHAR_W,
  LABEL_MAX_W,
  LABEL_OFFSET_X,
  type LabelCandidate,
} from "./label-collision";

function cand(
  id: string,
  x: number,
  y: number,
  priority = 0,
  name = "Testbutikken",
): LabelCandidate {
  return { id, x, y, name, priority };
}

describe("computeLabelPlacements", () => {
  it("plasserer alle til høyre når ingenting overlapper", () => {
    const result = computeLabelPlacements([
      cand("a", 0, 0),
      cand("b", 0, 200),
      cand("c", 400, 0),
    ]);
    expect(result.get("a")).toBe("right");
    expect(result.get("b")).toBe("right");
    expect(result.get("c")).toBe("right");
  });

  it("flipper lavest prioritet til venstre i stedet for å kulle", () => {
    // To samlokaliserte: høyre-boksene krysser, men venstre side er ledig.
    const result = computeLabelPlacements([
      cand("lav", 0, 0, 1),
      cand("hoy", 4, 3, 2),
    ]);
    expect(result.get("hoy")).toBe("right");
    expect(result.get("lav")).toBe("left");
  });

  it("kuller når begge sider er blokkert", () => {
    // Tre nesten samlokaliserte: høyest prioritet tar høyre, nestemann
    // flipper til venstre, tredjemann har ingen ledig side igjen og kulles.
    const result = computeLabelPlacements([
      cand("c3", 0, 0, 1),
      cand("c2", 2, 2, 2),
      cand("c1", 4, 4, 3),
    ]);
    expect(result.get("c1")).toBe("right");
    expect(result.get("c2")).toBe("left");
    expect(result.has("c3")).toBe(false);
  });

  it("er rekkefølge-uavhengig (deterministisk)", () => {
    const pts = [cand("b", 0, 0, 1), cand("a", 3, 2, 1), cand("c", 6, 4, 1)];
    const r1 = computeLabelPlacements(pts);
    const r2 = computeLabelPlacements([...pts].reverse());
    expect(r1).toEqual(r2);
    // lik prioritet → leksikografisk laveste id vinner høyre-plassen
    expect(r1.get("a")).toBe("right");
  });

  it("aktiv POI (Infinity-prioritet) plasseres alltid", () => {
    // Omringet: naboer med høy prioritet okkuperer begge sider først? Nei —
    // Infinity sorteres først og vinner. Test i stedet at den plasseres selv
    // når obstacles dekker begge sider.
    const result = computeLabelPlacements(
      [cand("aktiv", 100, 100, Number.POSITIVE_INFINITY)],
      [
        { x: 160, y: 100, halfSize: 40 },
        { x: 40, y: 100, halfSize: 40 },
      ],
    );
    expect(result.get("aktiv")).toBe("right");
  });

  it("kjede: midterste flipper, tredje kulles først når venstre også er tatt", () => {
    // Vertikal stabling 4 px fra hverandre: 1-linjes bokser (12 px høye,
    // 2 px slack) overlapper ved senteravstand < 10 px, så alle tre krysser
    // hverandre. a tar høyre, b flipper til venstre, c har ingen ledig side
    // (overlapper a til høyre og b til venstre) og kulles.
    const result = computeLabelPlacements([
      cand("a", 0, 0, 3),
      cand("b", 0, 4, 2),
      cand("c", 0, 8, 1),
    ]);
    expect(result.get("a")).toBe("right");
    expect(result.get("b")).toBe("left");
    expect(result.has("c")).toBe(false);
  });

  it("egen markør-sirkel blokkerer aldri egen label — på noen side", () => {
    const trang = { width: 200 };
    // Pin nær høyre kant → venstre side foretrekkes; egen sirkel (±16 px)
    // ligger inntil venstre-boksen men labelen starter 24 px fra senter.
    const result = computeLabelPlacements(
      [cand("a", 180, 100)],
      [{ x: 180, y: 100, halfSize: 16 }],
      trang,
    );
    expect(result.get("a")).toBe("left");
  });

  it("label som ville krysset en markør-sirkel til høyre flipper til venstre", () => {
    // Labelen til a starter på x+24 og er ~70 px bred — en markør 60 px til
    // høyre (sirkel 44..76 px fra a) står midt i teksten. Venstre er ledig.
    const result = computeLabelPlacements(
      [cand("a", 0, 0)],
      [{ x: 60, y: 0, halfSize: 16 }],
    );
    expect(result.get("a")).toBe("left");
  });

  it("pin nær høyre viewport-kant foretrekker venstre side", () => {
    const result = computeLabelPlacements([cand("a", 370, 100)], [], {
      width: 390,
    });
    expect(result.get("a")).toBe("left");
  });

  it("pin nær venstre viewport-kant beholder høyre side", () => {
    const result = computeLabelPlacements([cand("a", 20, 100)], [], {
      width: 390,
    });
    expect(result.get("a")).toBe("right");
  });

  it("kuller når begge sider stikker utenfor en smal viewport", () => {
    // Testbutikken ≈ 71 px bred + 24 px offset: trenger ~95 px klaring.
    const result = computeLabelPlacements([cand("a", 50, 100)], [], {
      width: 100,
    });
    expect(result.has("a")).toBe(false);
  });

  it("lange navn får 2-linjers bbox som kolliderer vertikalt", () => {
    const langt = "ALOHA MANA Hawaiisk Terapeutisk Massasje";
    const box = estimateLabelBox(cand("x", 0, 0, 0, langt), "right");
    expect(box.right - box.left).toBe(LABEL_MAX_W);
    expect(box.bottom - box.top).toBe(24);
    // 2-linjers naboer 18 px fra hverandre vertikalt overlapper på samme
    // side; nr. 2 flipper, nr. 3 kulles.
    const result = computeLabelPlacements([
      cand("over", 0, 0, 3, langt),
      cand("midt", 0, 18, 2, langt),
      cand("under", 0, 36, 1, langt),
    ]);
    expect(result.get("over")).toBe("right");
    expect(result.get("midt")).toBe("left");
    // "under" overlapper "over" vertikalt? Nei — 36 px unna, boks 24 høy →
    // fri til høyre (over-boksen slutter på y 12, under-boksen starter på 24).
    expect(result.get("under")).toBe("right");
  });

  it("venstre-boks speiler høyre-boksen rundt markørsenteret", () => {
    const c = cand("x", 100, 50);
    const r = estimateLabelBox(c, "right");
    const l = estimateLabelBox(c, "left");
    expect(l.right).toBe(100 - (r.left - 100));
    expect(l.right - l.left).toBe(r.right - r.left);
    expect(l.top).toBe(r.top);
  });
});

/**
 * 3D-halvdelen: samme regel, to parametre. Markøren er 40 px der (ikke 32), og
 * prosjekt-chipen er en bred, lav hindring — ikke en markør-sirkel.
 */
describe("motor-forskjellene (3D)", () => {
  it("offsetX skyver labelen ut fra en bredere markør", () => {
    const c = cand("x", 100, 50);
    const nær = estimateLabelBox(c, "right");
    const fjern = estimateLabelBox(c, "right", 28);
    expect(nær.left).toBe(100 + LABEL_OFFSET_X);
    expect(fjern.left).toBe(128);
    // Bare startpunktet flytter seg — bredden er den samme teksten.
    expect(fjern.right - fjern.left).toBe(nær.right - nær.left);
  });

  it("computeLabelPlacements respekterer offsetX-metrikken", () => {
    // Hindringen ligger like BAK der 2D-labelen slutter (høyre kant 194.8).
    // 3D-labelen starter 4 px lenger ute og rekker dermed borti den, så den må
    // flippe til venstre mens 2D blir stående.
    const obstacles = [{ x: 200, y: 50, halfSize: 6 }];
    const to2D = computeLabelPlacements([cand("x", 100, 50)], obstacles);
    const to3D = computeLabelPlacements([cand("x", 100, 50)], obstacles, undefined, {
      offsetX: 28,
    });
    expect(to2D.get("x")).toBe("right");
    expect(to3D.get("x")).toBe("left");
  });

  it("halfWidth/halfHeight gir en bred, lav hindring (prosjekt-chipen)", () => {
    // Chip 320 × 104 sentrert i (300, 50). En kvadratisk hindring med samme
    // halv-bredde ville også blokkert 160 px opp og ned — den 200 px under
    // skulle vært fri.
    const chip = { x: 300, y: 50, halfSize: 0, halfWidth: 160, halfHeight: 52 };
    const bak = computeLabelPlacements([cand("bak", 100, 50)], [chip]);
    const under = computeLabelPlacements([cand("under", 200, 250)], [chip]);
    expect(bak.get("bak")).toBe("left");
    expect(under.get("under")).toBe("right");
  });

  it("halfSize brukes fortsatt når aksene ikke er overstyrt (2D uendret)", () => {
    const kvadrat = { x: 140, y: 50, halfSize: 20 };
    const res = computeLabelPlacements([cand("x", 100, 50)], [kvadrat]);
    expect(res.get("x")).toBe("left");
  });
});

describe("wrapLabelLines", () => {
  const maxChars = Math.floor(LABEL_MAX_W / LABEL_CHAR_W); // 22

  it("kort navn blir én linje, uendret", () => {
    expect(wrapLabelLines("Extra Grilstad")).toEqual(["Extra Grilstad"]);
  });

  it("bryter på ordgrense, ikke midt i ordet", () => {
    const lines = wrapLabelLines("Pakkeautomat Ranheim Post i Butikk");
    expect(lines.length).toBe(2);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(maxChars);
    // Ingen ord er kuttet i to (alle ord finnes helt igjen i en linje).
    expect(lines[0]).toBe("Pakkeautomat Ranheim");
  });

  it("kutter med ellipsis når teksten ikke får plass på to linjer", () => {
    const lines = wrapLabelLines(
      "Grillstadfjæra barnehage avdeling Sjøparken vest",
    );
    expect(lines.length).toBe(2);
    expect(lines[1].endsWith("…")).toBe(true);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(maxChars);
  });

  it("ord som alene er lengre enn en linje deles hardt", () => {
    const lines = wrapLabelLines("A".repeat(60));
    expect(lines.length).toBe(2);
    expect(lines[0].length).toBe(maxChars);
    // Uten hard deling ville ett ord blitt én linje som stakk ut av boksen.
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(maxChars);
  });

  it("tomt/whitespace-navn gir ingen linjer (ingen tom label tegnes)", () => {
    expect(wrapLabelLines("")).toEqual([]);
    expect(wrapLabelLines("   ")).toEqual([]);
  });

  it("linjene er aldri bredere enn kollisjonsboksen estimerer", () => {
    for (const name of [
      "Vitusapotek Ranheim",
      "H2 Grilstad Marina",
      "Lavendel blomster & interiør",
      "Strindfjordvegen bussholdeplass",
    ]) {
      const lines = wrapLabelLines(name);
      const drawn = Math.max(...lines.map((l) => l.length)) * LABEL_CHAR_W;
      const estimated = estimateLabelBox(cand("x", 0, 0, 0, name), "right");
      expect(drawn).toBeLessThanOrEqual(estimated.right - estimated.left + 0.001);
    }
  });
});
