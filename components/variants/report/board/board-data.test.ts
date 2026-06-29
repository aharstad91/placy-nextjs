import { describe, it, expect } from "vitest";
import { adaptBoardData } from "./board-data";
import type { BoardPOI } from "./board-data";
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
    district: "Midtbyen",
    city: "Trondheim",
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

  describe("event-display-felter (Unit 1 — additivt)", () => {
    it("boligrapport-POI har ikke event-display-felter satt (adaptBoardData rører dem ikke)", () => {
      const poi = makePOI("p1", {
        eventDates: ["2025-09-12"],
        eventTimeStart: "18:00",
        eventTimeEnd: "23:00",
      });
      const data = adaptBoardData(makeReportData([makeTheme("x", [poi])]));
      const boardPoi = data.categories[0].pois[0];
      // Display-feltene er event-native (Unit 2-adapteren setter dem). adaptBoardData
      // skal la dem være undefined selv om kilde-POIen tilfeldigvis har event-data.
      expect(boardPoi.eventDates).toBeUndefined();
      expect(boardPoi.eventTimeStart).toBeUndefined();
      expect(boardPoi.eventTimeEnd).toBeUndefined();
      // Kilde-data er fortsatt tilgjengelig via raw (D5 — filteret leser her).
      expect(boardPoi.raw.eventDates).toEqual(["2025-09-12"]);
      expect(boardPoi.raw.eventTimeStart).toBe("18:00");
    });

    it("BoardPOI godtar event-display-felter (additiv, optional kontrakt)", () => {
      const poi = makePOI("p1");
      const board = adaptBoardData(makeReportData([makeTheme("x", [poi])]));
      // Konstruer en BoardPOI med event-felter for å verifisere at typen er additiv
      // og branded-ID-kontrakten består.
      const withEvent: BoardPOI = {
        ...board.categories[0].pois[0],
        eventDates: ["2025-09-12", "2025-09-13"],
        eventTimeStart: "18:00",
        eventTimeEnd: "23:00",
      };
      expect(withEvent.eventDates).toEqual(["2025-09-12", "2025-09-13"]);
      expect(withEvent.eventTimeStart).toBe("18:00");
      expect(withEvent.eventTimeEnd).toBe("23:00");
      // Branded ID bevart.
      expect(withEvent.id).toBe(board.categories[0].pois[0].id);
    });
  });

  it("home er bygget fra projectName + centerCoordinates + address", () => {
    const data = adaptBoardData(makeReportData([makeTheme("x", [makePOI("p1")])]));
    expect(data.home).toEqual({
      name: "Test Prosjekt",
      coordinates: { lat: 63.4, lng: 10.4 },
      address: "Testveien 1, 0001 Test",
      district: "Midtbyen",
      city: "Trondheim",
    });
  });

  it("tråder assets-flagg fra reportData til boardData", () => {
    const assetsFixture = {
      brand: true,
      customIllustrations: true,
      pinThumbnail: false,
    };
    const data = adaptBoardData({
      ...makeReportData([makeTheme("x", [makePOI("p1")])]),
      assets: assetsFixture,
    });
    expect(data.assets).toEqual(assetsFixture);
  });

  it("assets er undefined når reportData mangler det", () => {
    const data = adaptBoardData(makeReportData([makeTheme("x", [makePOI("p1")])]));
    expect(data.assets).toBeUndefined();
  });

  describe("editorial (nivå-2) adapter", () => {
    it("resolver highlightPoiIds til {id, navn} mot kategoriens POIs", () => {
      const theme = makeTheme("x", [makePOI("p1"), makePOI("p2")], {
        editorial: {
          body: "Kuratert brødtekst om området.",
          highlightPoiIds: ["p2", "p1"],
        },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].editorial).toEqual({
        body: "Kuratert brødtekst om området.",
        image: undefined,
        highlights: [
          { id: "p2", name: "POI p2" },
          { id: "p1", name: "POI p1" },
        ],
      });
    });

    it("ignorerer highlightPoiIds som ikke finnes i kategorien", () => {
      const theme = makeTheme("x", [makePOI("p1")], {
        editorial: { body: "Tekst", highlightPoiIds: ["p1", "ukjent"] },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].editorial?.highlights).toEqual([
        { id: "p1", name: "POI p1" },
      ]);
    });

    it("beholder image-pathen når satt", () => {
      const theme = makeTheme("x", [makePOI("p1")], {
        editorial: { body: "Tekst", image: "/illustrations/x-custom.jpg" },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].editorial?.image).toBe("/illustrations/x-custom.jpg");
    });

    it("kategori uten editorial → editorial undefined (nivå 1)", () => {
      const data = adaptBoardData(makeReportData([makeTheme("x", [makePOI("p1")])]));
      expect(data.categories[0].editorial).toBeUndefined();
    });

    it("editorial med tom body og ingen resolvede highlights → undefined (gating)", () => {
      const theme = makeTheme("x", [makePOI("p1")], {
        editorial: { body: "   ", highlightPoiIds: ["finnes-ikke"] },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].editorial).toBeUndefined();
    });

    it("editorial med kun highlights (tom body) → beholdes", () => {
      const theme = makeTheme("x", [makePOI("p1")], {
        editorial: { body: "", highlightPoiIds: ["p1"] },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].editorial).toEqual({
        body: "",
        image: undefined,
        highlights: [{ id: "p1", name: "POI p1" }],
      });
    });
  });

  describe("audio adapter", () => {
    const timingsFixture = {
      characters: ["a", "b", "c"],
      characterStartTimesSeconds: [0.0, 0.1, 0.2],
      characterEndTimesSeconds: [0.1, 0.2, 0.3],
    };

    it("kategori med url+manus+timings → audio inkluderer alle tre", () => {
      const theme = makeTheme("x", [makePOI("p1")], {
        audio: {
          url: "/audio/x.mp3",
          manus: "manus-tekst",
          timings: timingsFixture,
        },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].audio).toEqual({
        url: "/audio/x.mp3",
        manus: "manus-tekst",
        timings: timingsFixture,
      });
    });

    it("kategori med url+manus uten timings → audio uten timings-felt", () => {
      const theme = makeTheme("x", [makePOI("p1")], {
        audio: { url: "/audio/x.mp3", manus: "manus-tekst" },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].audio).toEqual({
        url: "/audio/x.mp3",
        manus: "manus-tekst",
      });
      expect(data.categories[0].audio?.timings).toBeUndefined();
    });

    it("kategori med kun manus (mangler url) → audio er undefined", () => {
      const theme = makeTheme("x", [makePOI("p1")], {
        audio: { manus: "manus-tekst" },
      });
      const data = adaptBoardData(makeReportData([theme]));
      expect(data.categories[0].audio).toBeUndefined();
    });

    it("heroAudio gjennomføres til home.audio med timings", () => {
      const data = adaptBoardData({
        ...makeReportData([makeTheme("x", [makePOI("p1")])]),
        heroAudio: {
          url: "/audio/hjem.mp3",
          manus: "hjem-manus",
          timings: timingsFixture,
        },
      });
      expect(data.home.audio).toEqual({
        url: "/audio/hjem.mp3",
        manus: "hjem-manus",
        timings: timingsFixture,
      });
    });
  });
});

describe("adaptBoardData — poisById + topRankedPois (r05.1 AC)", () => {
  it("poisById bruker LOWERCASE-nøkler (case-insensitiv grounding-resolusjon)", () => {
    const data = adaptBoardData(
      makeReportData([makeTheme("hverdagsliv", [makePOI("ABC-123")])])
    );
    expect(data.poisById.has("abc-123")).toBe(true);
    expect(data.poisById.has("ABC-123")).toBe(false);
  });

  it("poisById dekker POIs på tvers av ALLE tema (cross-theme grounding-resolusjon)", () => {
    // Grounding i ett tema kan referere en POI som lever i et annet tema
    // (board-data.ts:166-167). poisById bygges fra report.themes (unfiltered),
    // ikke fra ett enkelt tema, så slik resolusjon virker.
    const themeA = makeTheme("hverdagsliv", [makePOI("a1")]);
    const themeB = makeTheme("transport", [makePOI("b1")]);
    const data = adaptBoardData(makeReportData([themeA, themeB]));
    expect(data.poisById.has("a1")).toBe(true);
    expect(data.poisById.has("b1")).toBe(true);
  });

  it("topRankedPois er score-rangert (theme.topRanked), separat fra distanse-sorterte pois", () => {
    const a = makePOI("a");
    const b = makePOI("b");
    const c = makePOI("c");
    // pois (distanse) i én rekkefølge, topRanked (score) i en annen
    const theme = makeTheme("hverdagsliv", [a, b, c], { topRanked: [c, a] });
    const data = adaptBoardData(makeReportData([theme]));
    expect(data.categories[0].pois.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(data.categories[0].topRankedPois.map((p) => p.id)).toEqual(["c", "a"]);
  });
});
