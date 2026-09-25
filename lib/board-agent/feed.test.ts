import { describe, expect, it } from "vitest";
import { feedReducer, voiceEntryId } from "@/lib/board-agent/feed";
import type { AgentEntry } from "@/lib/board-agent/types";

const place: AgentEntry = { id: "p1", kind: "place", poiId: "dora-1", name: "Dora 1 Bowling", categoryLabel: "Opplevelser", origin: "map" };
const pending: AgentEntry = { id: "w1", kind: "pending", forEntryId: "p1" };

describe("feedReducer", () => {
  it("legger ikke til samme innslag to ganger", () => {
    const once = feedReducer([], { type: "add", entry: place });
    expect(feedReducer(once, { type: "add", entry: place })).toBe(once);
  });

  it("bytter «svar på vei» med svaret på samme plass", () => {
    const later: AgentEntry = { id: "u2", kind: "user", text: "Og i nærheten?", via: "text" };
    const answer: AgentEntry = { id: "a1", kind: "assistant", text: "Bowling.", via: "text" };
    const entries = feedReducer([place, pending, later], { type: "replace", id: "w1", entries: [answer] });
    expect(entries.map((e) => e.id)).toEqual(["p1", "a1", "u2"]);
  });

  it("fjerner et forsinket innslag uten erstatning", () => {
    expect(feedReducer([place, pending], { type: "replace", id: "w1", entries: [] }).map((e) => e.id)).toEqual(["p1"]);
  });

  it("fletter taletranskriptet etter ID og oppdaterer en voksende melding", () => {
    let entries = feedReducer([place], { type: "voice", messages: [{ id: "m1", role: "assistant", text: "Dora 1" }] });
    entries = feedReducer(entries, { type: "voice", messages: [{ id: "m1", role: "assistant", text: "Dora 1 Bowling er et bowlingsenter." }, { id: "typed-9", role: "user", text: "  " }] });
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual({ id: voiceEntryId("m1"), kind: "assistant", text: "Dora 1 Bowling er et bowlingsenter.", via: "voice" });
  });

  it("skrevne meldinger under talen merkes som tekst, talte som tale", () => {
    // Samme ID-former som useLive: `typed-` fra sendText, `user-` fra transkriptet.
    const entries = feedReducer([], { type: "voice", messages: [{ id: "typed-1", role: "user", text: "Hva med kafeer?" }, { id: "user-2", role: "user", text: "Hei" }] });
    expect(entries.map((e) => (e.kind === "user" ? e.via : null))).toEqual(["text", "voice"]);
  });

  it("en ny talesesjon med tom liste sletter ingenting", () => {
    const entries = feedReducer([place], { type: "voice", messages: [{ id: "m1", role: "user", text: "Hei" }] });
    expect(feedReducer(entries, { type: "voice", messages: [] })).toBe(entries);
  });
});
