import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES,
  isEventType,
  SRC_VALUES,
  parseSrc,
  type EventType,
  type PayloadFor,
} from "./event-types";

describe("EVENT_TYPES", () => {
  it("er nøyaktig startsettet fra DB-CHECK-en (PRD 1 Unit 2 AC3)", () => {
    // Speiler events_event_type_check i 070_baseline.sql. Endres dette settet
    // MÅ DB-CHECK-en utvides i samme slengen (to-stegs-grensen).
    expect([...EVENT_TYPES]).toEqual([
      "board_viewed",
      "category_opened",
      "voiceover_played",
      "poi_clicked",
    ]);
  });

  it("har ingen duplikater", () => {
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
  });
});

describe("isEventType", () => {
  it("aksepterer hver gyldige event-type", () => {
    for (const t of EVENT_TYPES) {
      expect(isEventType(t)).toBe(true);
    }
  });

  it("avviser strenger utenfor settet", () => {
    expect(isEventType("bogus_type")).toBe(false);
    expect(isEventType("board_view")).toBe(false);
    expect(isEventType("")).toBe(false);
  });

  it("avviser ikke-strenger (utrygge grenser)", () => {
    expect(isEventType(undefined)).toBe(false);
    expect(isEventType(null)).toBe(false);
    expect(isEventType(42)).toBe(false);
    expect(isEventType({})).toBe(false);
    expect(isEventType(["board_viewed"])).toBe(false);
  });

  it("narrower til EventType ved true (type-bruk)", () => {
    const raw: unknown = "category_opened";
    if (isEventType(raw)) {
      const t: EventType = raw; // kompilerer kun hvis narrowing virker
      expect(t).toBe("category_opened");
    }
  });
});

describe("payload-typer (kompiler-tids-kontrakt)", () => {
  it("har riktige payload-former per event-type (inkl. kontekst-konvolutten)", () => {
    // Disse assignmentene kompilerer KUN hvis EventPayloads/PayloadFor er korrekt.
    const envelope = {
      mode: "report" as const,
      has_3d_addon: true,
      categories_presented: ["home", "natur"],
      locale: "no",
    };
    const categoryOpened: PayloadFor<"category_opened"> = {
      category_id: "cafe",
      context: envelope,
    };
    const voiceoverPlayed: PayloadFor<"voiceover_played"> = {
      voiceover_segment: "intro",
      context: envelope,
    };
    const boardViewed: PayloadFor<"board_viewed"> = { context: envelope };
    const poiClicked: PayloadFor<"poi_clicked"> = {
      category_id: "cafe",
      context: envelope,
    };

    expect(categoryOpened.category_id).toBe("cafe");
    expect(voiceoverPlayed.voiceover_segment).toBe("intro");
    expect(boardViewed.context?.mode).toBe("report");
    expect(poiClicked.context?.categories_presented).toEqual(["home", "natur"]);
  });
});

describe("parseSrc — kanal-markør-guard (R19, Unit 5)", () => {
  it("SRC_VALUES er nøyaktig finn|embed|qr", () => {
    expect([...SRC_VALUES]).toEqual(["finn", "embed", "qr"]);
  });

  it("aksepterer hver kjente kanal-markør", () => {
    for (const v of SRC_VALUES) {
      expect(parseSrc(v)).toBe(v);
    }
  });

  it("ukjent verdi → undefined (utelates, ingen 'unknown'-støy)", () => {
    expect(parseSrc("tulleball")).toBeUndefined();
    expect(parseSrc("FINN")).toBeUndefined(); // case-sensitiv
    expect(parseSrc("")).toBeUndefined();
  });

  it("manglende/ikke-streng → undefined (direkte-trafikk)", () => {
    expect(parseSrc(null)).toBeUndefined();
    expect(parseSrc(undefined)).toBeUndefined();
    expect(parseSrc(42)).toBeUndefined();
    expect(parseSrc(["qr"])).toBeUndefined();
  });
});
