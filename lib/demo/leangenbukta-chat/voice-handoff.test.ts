import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { LiveConversation } from "@/lib/live/types";

/**
 * Kontrakten tale → tekst (2026-09-24): sidebandets egne transkript-eventer
 * blir til et signert historikktoken, bundet til besøkende og sesjon. Ekte
 * sideband og ekte token; bare OpenAI-socketen og supervisoren er falske.
 */

const state = vi.hoisted(() => ({ socket: null as unknown, cleanup: undefined as undefined | ((reason: string) => void) }));
vi.mock("ws", async () => {
  const { EventEmitter } = await import("node:events");
  class Socket extends EventEmitter {
    static OPEN = 1;
    readyState = 1;
    constructor() { super(); state.socket = this; queueMicrotask(() => this.emit("open")); }
    send() {}
    close() { this.readyState = 3; }
  }
  return { default: Socket };
});
vi.mock("@/lib/live/supervisor", () => ({ getLiveSupervisor: () => ({
  setCleanup: (_token: string, fn: (reason: string) => void) => { state.cleanup = fn; },
  end: vi.fn(async () => true),
}) }));

import { connectLiveSideband } from "@/lib/live/sideband";
import { disposeMapBridge } from "@/lib/live/map-bridge";
import { issueVoiceHandoff, startVoiceHandoff } from "@/lib/demo/leangenbukta-chat/voice-handoff";
import { verifyTranscript } from "@/lib/demo/leangenbukta-chat/transcript";
import { POST as handoffPOST } from "@/app/api/prototype/live/handoff/route";

const emit = (event: unknown) => (state.socket as EventEmitter).emit("message", Buffer.from(JSON.stringify(event)));
const conversation = { execute: vi.fn(), observeBrowserResult: vi.fn(), noteIfChanged: () => null, mapContextIfChanged: () => null, onMapSelection: () => null, setBoardState: vi.fn() } as unknown as LiveConversation;
const BASE = [{ role: "user" as const, text: "Hvor er nærmeste skole?" }, { role: "assistant" as const, text: "Nærmeste barneskole er Lilleby skole, 8 minutter å gå." }];

beforeEach(() => {
  process.env.PLACY_LB_DEMO_COOKIE_SECRET = "s".repeat(40);
  state.cleanup = undefined;
});
afterEach(() => {
  state.cleanup?.("connection");
  delete process.env.PLACY_LB_DEMO_COOKIE_SECRET;
});

async function voiceSession(token: string, visitorId = "visitor-1") {
  const recorder = startVoiceHandoff(token, { visitorId, snapshotId: "snap-1", baseTurns: BASE, baseTrimmed: false });
  const handle = await connectLiveSideband("live_test", token, conversation, { transcript: recorder, onUsage: () => {}, onTiming: () => {} });
  return { handle, stop: () => { state.cleanup?.("manual"); disposeMapBridge(token); } };
}

describe("tale → tekst: sidebandets transkript blir signert historikk", () => {
  it("grupperer fragmentene til turer og gir tekstchatten turene før talen pluss det som faktisk ble sagt", async () => {
    const session = await voiceSession("tok-1");
    emit({ type: "session.output_transcript.delta", delta: "Hei igjen! ", start_ms: 0, end_ms: 800 });
    emit({ type: "session.output_transcript.delta", delta: "Hva mer lurer du på?", start_ms: 800, end_ms: 1800 });
    emit({ type: "session.input_transcript.delta", delta: "Hvor lang tid tar det ", start_ms: 2500, end_ms: 3500 });
    emit({ type: "session.input_transcript.delta", delta: "med sykkel?", start_ms: 3500, end_ms: 4200 });
    session.handle.onContext({ kind: "text", text: "Og til barnehagen?" });
    emit({ type: "session.output_transcript.delta", delta: "Tre minutter.", start_ms: 6000, end_ms: 7000 });
    session.stop();
    // Etter oppryddingen er opptaket lukket: sene fragmenter blir ikke med.
    emit({ type: "session.output_transcript.delta", delta: "etter stopp", start_ms: 9000, end_ms: 9500 });

    const result = issueVoiceHandoff("tok-1", "visitor-1");
    expect(result).toMatchObject({ ok: true, voiceTurns: 4, trimmed: false });
    const verified = verifyTranscript(result.ok ? result.transcript : "", "visitor-1");
    expect(verified?.snapshotId).toBe("snap-1");
    expect(verified?.turns).toEqual([
      ...BASE,
      { role: "assistant", text: "Hei igjen! Hva mer lurer du på?", via: "voice" },
      { role: "user", text: "Hvor lang tid tar det med sykkel?", via: "voice" },
      { role: "user", text: "Og til barnehagen?", via: "voice" },
      { role: "assistant", text: "Tre minutter.", via: "voice" },
    ]);
  });

  it("gir ingenting til en annen besøkende eller et ukjent sesjonstoken", async () => {
    const session = await voiceSession("tok-2");
    emit({ type: "session.output_transcript.delta", delta: "Hei.", start_ms: 0, end_ms: 500 });
    session.stop();
    expect(issueVoiceHandoff("tok-2", "visitor-2")).toEqual({ ok: false });
    expect(issueVoiceHandoff("ukjent", "visitor-1")).toEqual({ ok: false });
  });

  it("glemmer opptaket etter levetiden", async () => {
    const session = await voiceSession("tok-3");
    session.stop();
    expect(issueVoiceHandoff("tok-3", "visitor-1", Date.now() + 11 * 60 * 1000)).toEqual({ ok: false });
  });

  it("handoff-ruta binder tokenet til demotilgangen og svarer 404 uten detaljer ellers", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const session = await voiceSession("tok-4", "local");
    emit({ type: "session.output_transcript.delta", delta: "Hei.", start_ms: 0, end_ms: 500 });
    session.stop();
    const call = (sessionToken: string, host = "localhost:3101") => handoffPOST(new NextRequest(`http://${host}/api/prototype/live/handoff`, {
      method: "POST", body: JSON.stringify({ session: sessionToken }), headers: { "Content-Type": "application/json", host },
    }));
    const ok = await call("tok-4");
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body).toMatchObject({ voiceTurns: 1, trimmed: false });
    expect(verifyTranscript(body.transcript, "local")?.turns.at(-1)).toEqual({ role: "assistant", text: "Hei.", via: "voice" });
    expect((await call("et-annet-token")).status).toBe(404);
    expect((await call("tok-4", "demo.example")).status).toBe(404);
    vi.unstubAllEnvs();
  });
});
