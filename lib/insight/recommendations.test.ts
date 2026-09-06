import { describe, expect, it } from "vitest";
import { deriveRecommendations, themeStatus, underperformingFaq } from "./recommendations";
import type { CategoryInsight, FaqInsight, InsightReport } from "./types";

function cat(p: Partial<CategoryInsight> & { id: string }): CategoryInsight {
  return {
    label: p.id, opens: 0, prevOpens: 0, share: 0, baselineShare: null, deltaPp: null, presentedPosition: null,
    ...p,
  };
}

function faq(id: string, opens: number, categoryId = "barn"): FaqInsight {
  return { id, question: `Spørsmål ${id}?`, categoryId, categoryLabel: "Barn & Oppvekst", opens, prevOpens: 0 };
}

function report(p: Partial<InsightReport>): InsightReport {
  return {
    window: { since: "2026-08-07", until: "2026-09-05", days: 30 },
    views: 100, interactions: 200,
    threshold: { minViews: 50, reached: true },
    previous: { views: 60, interactions: 100, daily: [] },
    daily: [], hourly: new Array(24).fill(0),
    categories: [], pois: [], faq: [],
    sources: [{ source: "finn", views: 100, share: 1, prevViews: 0 }],
    travelModes: { walk: 10, bike: 1, car: 1 },
    threeDShare: null,
    ...p,
  };
}

describe("themeStatus", () => {
  it("trekker når andelen ligger 5 pp over andre boards", () => {
    expect(themeStatus(cat({ id: "barn", deltaPp: 5, opens: 20, prevOpens: 20 }), true)).toBe("trekker");
  });
  it("trekker på vekst mot forrige periode når grunnlaget er stort nok", () => {
    expect(themeStatus(cat({ id: "barn", deltaPp: 0, opens: 14, prevOpens: 10 }), true)).toBe("trekker");
    expect(themeStatus(cat({ id: "barn", deltaPp: 0, opens: 4, prevOpens: 2 }), true)).toBe("som-ventet");
  });
  it("lite brukt under −5 pp, for tidlig under terskel", () => {
    expect(themeStatus(cat({ id: "mat", deltaPp: -6 }), true)).toBe("lite-brukt");
    expect(themeStatus(cat({ id: "mat", deltaPp: 9 }), false)).toBe("for-tidlig");
  });
});

describe("underperformingFaq", () => {
  it("finner spørsmål under 20 % av temaets snitt, men bare med nok volum", () => {
    const list = [faq("a", 12), faq("b", 9), faq("c", 1), faq("d", 0)];
    expect(underperformingFaq(list).map((f) => f.id)).toEqual(["d", "c"]);
    expect(underperformingFaq([faq("a", 3), faq("b", 2), faq("c", 0)])).toEqual([]);
  });
});

describe("deriveRecommendations", () => {
  it("under terskel: bare «for tidlig» (+ kilder når alt er umerket)", () => {
    const r = report({ views: 40, threshold: { minViews: 50, reached: false }, sources: [{ source: "direkte", views: 40, share: 1, prevViews: 0 }] });
    expect(deriveRecommendations(r).map((x) => x.kind)).toEqual(["for-tidlig", "kilder"]);
  });

  it("tema som trekker kommer først, med stedet flest sjekker som neste steg", () => {
    const r = report({
      categories: [
        cat({ id: "barn", label: "Barn & Oppvekst", opens: 30, prevOpens: 20, share: 0.3, baselineShare: 0.2, deltaPp: 10 }),
        cat({ id: "mat", label: "Mat & Drikke", opens: 5, prevOpens: 5, share: 0.05, baselineShare: 0.15, deltaPp: -10 }),
      ],
      pois: [{ id: "p1", name: "Eberg skole", categoryId: "barn", categoryLabel: "Barn & Oppvekst", clicks: 7, explores: 0, outbound: 0, prevTotal: 0 }],
    });
    const recs = deriveRecommendations(r);
    expect(recs[0]).toMatchObject({ kind: "tema-trekker", themeId: "barn", title: "Løft barn & oppvekst i annonsen og på visning" });
    expect(recs[0].why).toContain("30 %");
    expect(recs[0].why).toContain("20 %");
    expect(recs[0].next).toContain("Eberg skole");
    expect(recs.find((x) => x.kind === "tema-lite-brukt")).toMatchObject({ themeId: "mat" });
  });

  it("spørsmål: revider de som ikke leses, legg til flere der de leses", () => {
    const r = report({
      categories: [cat({ id: "barn", label: "Barn & Oppvekst", opens: 30, prevOpens: 30, share: 0.3, baselineShare: 0.3, deltaPp: 0 })],
      faq: [faq("krets", 14), faq("sfo", 9), faq("trinn", 6), faq("nynorsk", 0), faq("privat", 1)],
    });
    const recs = deriveRecommendations(r);
    const revider = recs.find((x) => x.kind === "faq-revider");
    expect(revider?.title).toBe("Skriv om 2 spørsmål under barn & oppvekst");
    expect(revider?.why).toContain("«Spørsmål nynorsk?»");
    expect(revider?.why).toContain("«Spørsmål krets?» er åpnet 14 ganger");
    expect(recs.find((x) => x.kind === "faq-flere")?.why).toContain("4 av 5 spørsmål er lest");
  });

  it("sted som trekker klart mer enn resten i temaet, når temaet ikke alt er løftet", () => {
    const r = report({
      categories: [cat({ id: "hverdag", label: "Hverdagsliv", opens: 30, prevOpens: 30, share: 0.4, baselineShare: 0.4, deltaPp: 0 })],
      pois: [
        { id: "v", name: "Valentinlyst Senter", categoryId: "hverdag", categoryLabel: "Hverdagsliv", clicks: 11, explores: 2, outbound: 0, prevTotal: 0 },
        { id: "b", name: "Bunnpris", categoryId: "hverdag", categoryLabel: "Hverdagsliv", clicks: 2, explores: 1, outbound: 0, prevTotal: 0 },
      ],
    });
    expect(deriveRecommendations(r).find((x) => x.kind === "sted-trekker")).toMatchObject({ title: "Nevn Valentinlyst Senter i annonsen" });
  });

  it("bil-regelen krever både volum og andel", () => {
    expect(deriveRecommendations(report({ travelModes: { walk: 10, bike: 0, car: 10 } })).some((x) => x.kind === "bil")).toBe(true);
    expect(deriveRecommendations(report({ travelModes: { walk: 5, bike: 0, car: 5 } })).some((x) => x.kind === "bil")).toBe(false);
  });
});
