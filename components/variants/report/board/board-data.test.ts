import { describe, it, expect } from "vitest";
import { adaptBoardData } from "./board-data";
import type { ReportData, ReportTheme } from "../report-data";
import type { POI } from "@/lib/types";

function makePOI(id: string, overrides: Partial<POI> = {}): POI {
  return {
    id,
    name: `POI ${id}`,
    coordinates: { lat: 63.4 + Math.random() * 0.01, lng: 10.4 + Math.random() * 0.01 },
    category: { id: "restaurant", name: "Restaurant", icon: "Utensils", color: "#ef4444" },
    editorialHook: `Hook ${id}`,
    localInsight: `Insight ${id}`,
    ...overrides,
  };
}

function makeTheme(id: string, pois: POI[], overrides: Partial<ReportTheme> = {}): ReportTheme {
  return {
    id,
    name: id.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: "Sparkles",
    color: "#3b82f6",
    intro: `${id} intro-tekst`,
    upperNarrative: `${id} body som er lengre og forteller mer om hva som finnes i området.`,
    pois,
    allPOIs: pois,
    topRanked: pois.slice(0, 10),
    hiddenPOIs: [],
    richnessScore: 50,
    score: {
      total: 50,
      breakdown: { count: 50, rating: 50, proximity: 50, variety: 50 },
    },
    quote: "",
    stats: {
      totalPOIs: pois.length,
      ratedPOIs: 0,
      avgRating: null,
      totalReviews: 0,
      editorialCount: 0,
      uniqueCategories: 1,
    },
    ...overrides,
  };
}

function makeReportData(themes: ReportTheme[]): ReportData {
  return {
    projectName: "Test Prosjekt",
    address: "Testveien 1, 0001 Test",
    centerCoordinates: { lat: 63.4, lng: 10.4 },
    heroMetrics: {} as ReportData["heroMetrics"],
    themes,
    allProjectPOIs: themes.flatMap((t) => t.pois),
  };
}

describe("adaptBoardData", () => {
  it("maps themes to BoardCategory with normaliserte feltnavn", () => {
    const theme = makeTheme("hverdagsliv", [makePOI("p1")]);
    const data = adaptBoardData(makeReportData([theme]));

    expect(data.categories).toHaveLength(1);
    const cat = data.categories[0];
    expect(cat.id).toBe("hverdagsliv");
    expect(cat.label).toBe("Hverdagsliv");
    expect(cat.lead).toBe("hverdagsliv intro-tekst");
    expect(cat.body).toBe("hverdagsliv body som er lengre og forteller mer om hva som finnes i området.");
    expect(cat.icon).toBe("Sparkles");
    expect(cat.color).toBe("#3b82f6");
  });

  it("filtrerer bort tema uten POI-er", () => {
    const empty = makeTheme("empty", []);
    const filled = makeTheme("filled", [makePOI("p1")]);
    const data = adaptBoardData(makeReportData([empty, filled]));

    expect(data.categories).toHaveLength(1);
    expect(data.categories[0].id).toBe("filled");
  });

  it("faller tilbake til leadText hvis intro mangler", () => {
    const theme = makeTheme("x", [makePOI("p1")], {
      intro: undefined,
      leadText: "lead fallback",
    });
    const data = adaptBoardData(makeReportData([theme]));
    expect(data.categories[0].lead).toBe("lead fallback");
  });

  it("body inkluderer bridgeText når upperNarrative mangler og intro er lead (dedup)", () => {
    const theme = makeTheme("x", [makePOI("p1")], {
      intro: "intro-tekst",
      bridgeText: "bridge-tekst",
      upperNarrative: undefined,
    });
    const data = adaptBoardData(makeReportData([theme]));
    expect(data.categories[0].lead).toBe("intro-tekst");
    expect(data.categories[0].body).toBe("bridge-tekst");
  });

  it("body inkluderer intro+bridgeText når leadText finnes (intro er ikke lead)", () => {
    const theme = makeTheme("x", [makePOI("p1")], {
      intro: "intro-tekst",
      bridgeText: "bridge-tekst",
      upperNarrative: undefined,
      leadText: "kort tagline",
    });
    const data = adaptBoardData(makeReportData([theme]));
    expect(data.categories[0].lead).toBe("kort tagline");
    expect(data.categories[0].body).toBe("intro-tekst\n\nbridge-tekst");
  });

  it("POI body sammensatt av editorialHook + localInsight", () => {
    const poi = makePOI("p1", {
      editorialHook: "Hook-tekst",
      localInsight: "Insight-tekst",
    });
    const data = adaptBoardData(makeReportData([makeTheme("x", [poi])]));
    expect(data.categories[0].pois[0].body).toBe("Hook-tekst\n\nInsight-tekst");
  });

  it("POI uten hook eller insight → body undefined", () => {
    const poi = makePOI("p1", { editorialHook: undefined, localInsight: undefined });
    const data = adaptBoardData(makeReportData([makeTheme("x", [poi])]));
    expect(data.categories[0].pois[0].body).toBeUndefined();
  });

  it("POI carries categoryId for board-state lookup", () => {
    const poi = makePOI("p1");
    const data = adaptBoardData(makeReportData([makeTheme("themex", [poi])]));
    expect(data.categories[0].pois[0].categoryId).toBe("themex");
  });

  it("home er bygget fra projectName + centerCoordinates + address", () => {
    const data = adaptBoardData(makeReportData([makeTheme("x", [makePOI("p1")])]));
    expect(data.home).toEqual({
      name: "Test Prosjekt",
      coordinates: { lat: 63.4, lng: 10.4 },
      address: "Testveien 1, 0001 Test",
    });
  });
});
