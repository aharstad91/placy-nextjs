import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CHAT_VOICE_DATASET, parseVoiceCommand, VOICE_EVENTS, voiceWidgetState } from "@/lib/demo/leangenbukta-chat/voice-channel";
import { LB_VOICE_DATASET } from "@/lib/live/leangenbukta-voice-access";

describe("talekanalen mellom widget og bro", () => {
  it("widgeten bruker de samme hendelsesnavnene, og broen samme datasett som servergaten", () => {
    const widget = readFileSync(join(process.cwd(), "public/embed/placy-chat.js"), "utf8");
    for (const name of Object.values(VOICE_EVENTS)) expect(widget).toContain(`"${name}"`);
    expect(CHAT_VOICE_DATASET).toBe(LB_VOICE_DATASET);
  });

  it("godtar bare kjente kommandoer og kapper tekst til 600 tegn", () => {
    expect(parseVoiceCommand({ type: "start" })).toEqual({ type: "start" });
    expect(parseVoiceCommand({ type: "stop", extra: 1 })).toEqual({ type: "stop" });
    expect(parseVoiceCommand({ type: "text", text: "  Hei  " })).toEqual({ type: "text", text: "Hei" });
    expect(parseVoiceCommand({ type: "text", text: "x".repeat(900) })).toEqual({ type: "text", text: "x".repeat(600) });
    expect(parseVoiceCommand({ type: "text", text: "   " })).toBeNull();
    expect(parseVoiceCommand({ type: "text" })).toBeNull();
    expect(parseVoiceCommand({ type: "map" })).toBeNull();
    expect(parseVoiceCommand("start")).toBeNull();
  });

  it("gir stabile ID-er, dropper tomme innslag og viser feil bare i feiltilstand", () => {
    const messages = [
      { id: "user-1", role: "user" as const, text: " Hvordan er det å bo her?" },
      { id: "assistant-2", role: "assistant" as const, text: "  " },
    ];
    const state = voiceWidgetState({ status: "listening", error: "gammel feil", notice: null, messages });
    expect(state).toEqual({
      available: true, status: "listening", error: null, notice: null,
      messages: [{ id: "voice-user-1", role: "user", text: "Hvordan er det å bo her?" }],
    });
    expect(voiceWidgetState({ status: "error", error: "Mikrofonen er ikke tilgjengelig.", notice: null, messages: [] }).error).toBe("Mikrofonen er ikke tilgjengelig.");
  });
});
