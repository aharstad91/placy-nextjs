import { describe, it, expect } from "vitest";
import { eventToBoardData } from "./event-board-data";
import { buildReelsCards } from "@/components/variants/report/reels/reels-data";
import type { Category, POI, Project } from "@/lib/types";

// === Fixtures ===

const KN_CATEGORIES: Category[] = [
  { id: "kn-musikk", name: "Musikk", icon: "Music", color: "#a855f7" },
  { id: "kn-kunst", name: "Kunst & Utstilling", icon: "Palette", color: "#f59e0b" },
  { id: "kn-barn", name: "Barn & Familie", icon: "Baby", color: "#22c55e" },
];

function makeEventPOI(
  id: string,
  categoryId: string,
  overrides: Partial<POI> = {},
): POI {
  const cat = KN_CATEGORIES.find((c) => c.id === categoryId) ?? {
    id: categoryId,
    name: categoryId,
    icon: "MapPin",
    color: "#94a3b8",
  };
  return {
    id,
    name: `Event ${id}`,
    coordinates: { lat: 63.43 + Math.random() * 0.01, lng: 10.39 + Math.random() * 0.01 },
    category: cat,
    eventDates: ["2025-09-12"],
    eventTimeStart: "18:00",
    eventTimeEnd: "23:00",
    eventDescription: `Beskrivelse av ${id}`,
    ...overrides,
  };
}

function makeEventProject(pois: POI[], categories: Category[] = KN_CATEGORIES): Project {
  return {
    id: "kulturnatt-2025",
    name: "Kulturnatt Trondheim 2025",
    customer: "kulturnatt-trondheim",
    urlSlug: "kulturnatt-2025",
    productType: "explorer",
    centerCoordinates: { lat: 63.4305, lng: 10.3951 },
    story: {
      id: "kulturnatt-2025",
      title: "Kulturnatt Trondheim 2025",
      introText: "En kveld med kultur",
      sections: [],
      themeStories: [],
    },
    pois,
    categories,
    tags: ["Event"],
    venueType: null,
  };
}

describe("eventToBoardData", () => {
  it("mapper et Kulturnatt-lignende prosjekt → BoardData med korrekt kategori-antall", () => {
    const pois = [
      makeEventPOI("p1", "kn-musikk"),
      makeEventPOI("p2", "kn-musikk"),
      makeEventPOI("p3", "kn-kunst"),
      makeEventPOI("p4", "kn-barn"),
    ];
    const data = eventToBoardData(makeEventProject(pois));

    expect(data.categories).toHaveLength(3);
    const ids = data.categories.map((c) => c.id);
    expect(ids).toEqual(["kn-musikk", "kn-kunst", "kn-barn"]);

    const musikk = data.categories[0];
    expect(musikk.label).toBe("Musikk");
    expect(musikk.icon).toBe("Music");
    expect(musikk.color).toBe("#a855f7");
    expect(musikk.pois).toHaveLength(2);

    // Ingen-audio-kontrakt (D3).
    expect(data.audioTourEnabled).toBe(false);
    expect(data.welcome).toBeUndefined();
    expect(data.outro).toBeUndefined();
    expect(data.summary).toBeUndefined();
    expect(data.brokers).toBeUndefined();
    expect(musikk.audio).toBeUndefined();
    expect(musikk.editorial).toBeUndefined();

    // projectSlug + venueType + home.
    expect(data.projectSlug).toBe("kulturnatt-2025");
    expect(data.venueType).toBeNull();
    expect(data.home.name).toBe("Kulturnatt Trondheim 2025");
    expect(data.home.coordinates).toEqual({ lat: 63.4305, lng: 10.3951 });
  });

  it("BoardPOI.raw bærer event-feltene (D5 — filteret leser raw)", () => {
    const poi = makeEventPOI("p1", "kn-musikk", {
      eventDates: ["2025-09-12", "2025-09-13"],
      eventTimeStart: "19:30",
      eventTimeEnd: "22:00",
    });
    const data = eventToBoardData(makeEventProject([poi]));
    const boardPoi = data.categories[0].pois[0];

    expect(boardPoi.raw.eventDates).toEqual(["2025-09-12", "2025-09-13"]);
    expect(boardPoi.raw.eventTimeStart).toBe("19:30");
    expect(boardPoi.raw.eventTimeEnd).toBe("22:00");
    // Display-felter speilet.
    expect(boardPoi.eventDates).toEqual(["2025-09-12", "2025-09-13"]);
    expect(boardPoi.eventTimeStart).toBe("19:30");
    expect(boardPoi.eventTimeEnd).toBe("22:00");
  });

  it("poisById er bygget (lowercase) på tvers av alle POIer", () => {
    const pois = [
      makeEventPOI("Uuid-ABC", "kn-musikk"),
      makeEventPOI("xyz", "kn-kunst"),
    ];
    const data = eventToBoardData(makeEventProject(pois));
    expect(data.poisById.get("uuid-abc")?.name).toBe("Event Uuid-ABC");
    expect(data.poisById.get("xyz")?.name).toBe("Event xyz");
    expect(data.poisById.size).toBe(2);
  });

  it("event_dates: [] og undefined → begge gir ikke-dagfiltrerbar (display undefined)", () => {
    const emptyDates = makeEventPOI("p-empty", "kn-musikk", { eventDates: [] });
    const noDates = makeEventPOI("p-none", "kn-kunst", { eventDates: undefined });
    const data = eventToBoardData(makeEventProject([emptyDates, noDates]));

    const musikkPoi = data.categories[0].pois[0];
    const kunstPoi = data.categories[1].pois[0];
    expect(musikkPoi.eventDates).toBeUndefined();
    expect(kunstPoi.eventDates).toBeUndefined();
    // raw bevarer kilde-formen (tom array vs undefined) — filteret tåler begge.
    expect(musikkPoi.raw.eventDates).toEqual([]);
    expect(kunstPoi.raw.eventDates).toBeUndefined();
  });

  it("kategori uten POIer droppes", () => {
    // Tre kategorier definert, men POIer kun i to.
    const pois = [
      makeEventPOI("p1", "kn-musikk"),
      makeEventPOI("p2", "kn-barn"),
    ];
    const data = eventToBoardData(makeEventProject(pois));
    expect(data.categories.map((c) => c.id)).toEqual(["kn-musikk", "kn-barn"]);
    // kn-kunst (ingen POIer) er droppet.
    expect(data.categories.find((c) => c.id === "kn-kunst")).toBeUndefined();
  });

  it("POI med kategori-id uten match i project.categories droppes", () => {
    const orphan = makeEventPOI("p-orphan", "ukjent-kategori", {
      category: { id: "ukjent-kategori", name: "Ukjent", icon: "X", color: "#000" },
    });
    const valid = makeEventPOI("p1", "kn-musikk");
    const data = eventToBoardData(makeEventProject([orphan, valid]));
    // Kun kn-musikk får en kategori; orphan-POIen har ingen kategori å rendre i.
    expect(data.categories.map((c) => c.id)).toEqual(["kn-musikk"]);
    expect(data.categories[0].pois.map((p) => p.id)).toEqual(["p1"]);
    // Men poisById dekker fortsatt orphan (grounding-paritet).
    expect(data.poisById.get("p-orphan")).toBeDefined();
  });

  it("alle kategorier tomme → categories: [] uten krasj", () => {
    const data = eventToBoardData(makeEventProject([]));
    expect(data.categories).toEqual([]);
    expect(data.poisById.size).toBe(0);
    expect(data.audioTourEnabled).toBe(false);
    // Home rendres fortsatt fra prosjekt-meta.
    expect(data.home.name).toBe("Kulturnatt Trondheim 2025");
  });

  it("body faller tilbake til eventDescription når redaksjonelt innhold mangler", () => {
    const poi = makeEventPOI("p1", "kn-musikk", {
      editorialHook: undefined,
      localInsight: undefined,
      eventDescription: "Konsert i Domkirken kl 19",
    });
    const data = eventToBoardData(makeEventProject([poi]));
    expect(data.categories[0].pois[0].body).toBe("Konsert i Domkirken kl 19");
  });

  describe("integrasjon med buildReelsCards (ingen-audio/editorial/welcome/outro/summary)", () => {
    it("output kan kjøre gjennom buildReelsCards uten å kaste", () => {
      const pois = [
        makeEventPOI("p1", "kn-musikk"),
        makeEventPOI("p2", "kn-kunst"),
      ];
      const data = eventToBoardData(makeEventProject(pois));
      expect(() => buildReelsCards(data, "/reels/intro.mp4")).not.toThrow();
    });

    it("uten audio gir buildReelsCards kun intro-kortet (ingen audio/megler/summary-kort)", () => {
      const data = eventToBoardData(makeEventProject([makeEventPOI("p1", "kn-musikk")]));
      const cards = buildReelsCards(data, "/reels/intro.mp4");
      expect(cards).toHaveLength(1);
      expect(cards[0].kind).toBe("intro");
    });

    it("tomt prosjekt tåler buildReelsCards", () => {
      const data = eventToBoardData(makeEventProject([]));
      expect(() => buildReelsCards(data, "/reels/intro.mp4")).not.toThrow();
    });
  });
});
