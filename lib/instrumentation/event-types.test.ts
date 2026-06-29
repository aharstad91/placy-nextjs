import { describe, it, expect } from "vitest";
import {
  EVENT_TYPES,
  isEventType,
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
  it("har riktige payload-former per event-type", () => {
    // Disse assignmentene kompilerer KUN hvis EventPayloads/PayloadFor er korrekt.
    const categoryOpened: PayloadFor<"category_opened"> = { category_id: "cafe" };
    const voiceoverPlayed: PayloadFor<"voiceover_played"> = {
      voiceover_segment: "intro",
    };
    const boardViewed: PayloadFor<"board_viewed"> = undefined;
    const poiClicked: PayloadFor<"poi_clicked"> = undefined;

    expect(categoryOpened.category_id).toBe("cafe");
    expect(voiceoverPlayed.voiceover_segment).toBe("intro");
    expect(boardViewed).toBeUndefined();
    expect(poiClicked).toBeUndefined();
  });
});
