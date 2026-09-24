import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseVoiceCommand, VOICE_EVENTS, VOICE_TRANSCRIPT_MAX, voiceWidgetState } from "@/lib/demo/site-chat/voice-channel";
import { MAX_TRANSCRIPT_TOKEN_LENGTH } from "@/lib/demo/site-chat/transcript";

describe("talekanalen mellom widget og bro", () => {
  it("widgeten bruker de samme hendelsesnavnene og samme tokentak som serveren", () => {
    const widget = readFileSync(join(process.cwd(), "public/embed/placy-chat.js"), "utf8");
    for (const name of Object.values(VOICE_EVENTS)) expect(widget).toContain(`"${name}"`);
    expect(VOICE_TRANSCRIPT_MAX).toBe(MAX_TRANSCRIPT_TOKEN_LENGTH);
  });

  it("godtar bare kjente kommandoer og kapper tekst til 600 tegn", () => {
    expect(parseVoiceCommand({ type: "start" })).toEqual({ type: "start" });
    expect(parseVoiceCommand({ type: "start", transcript: "body.sig" })).toEqual({ type: "start", transcript: "body.sig" });
    expect(parseVoiceCommand({ type: "start", transcript: "x".repeat(VOICE_TRANSCRIPT_MAX + 1) })).toEqual({ type: "start" });
    expect(parseVoiceCommand({ type: "start", transcript: 42 })).toEqual({ type: "start" });
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
      continuity: null, handoff: null,
    });
    expect(voiceWidgetState({ status: "error", error: "Mikrofonen er ikke tilgjengelig.", notice: null, messages: [] }).error).toBe("Mikrofonen er ikke tilgjengelig.");
  });
});
