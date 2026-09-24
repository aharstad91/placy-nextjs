"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLive } from "@/lib/live/use-live";
import {
  parseVoiceCommand,
  VOICE_EVENTS,
  voiceWidgetState,
  type VoiceHandoff,
  type VoiceWidgetState,
} from "@/lib/demo/leangenbukta-chat/voice-channel";
import type { LiveBoardState } from "@/lib/live/types";

/** Chatboksen har ikke noe kart; serveren sender heller ingen kartdirektiver hit. */
const NO_MAP = () => ({ error: "Denne samtalen har ikke noe kart. Ikke påstå at noe vises." });
const NO_BOARD: LiveBoardState = { selected_category_id: null, selected_place_id: null, travel_mode: "walk" };
const noBoard = () => NO_BOARD;
const HANDOFF_ENDPOINT = "/api/prototype/live/handoff";
const HANDOFF_TIMEOUT_MS = 8000;

function publish(state: VoiceWidgetState) {
  window.dispatchEvent(new CustomEvent(VOICE_EVENTS.state, { detail: state }));
}

/** Bytter sesjonstokenet mot et signert historikktoken, eller null ved enhver feil. */
async function fetchHandoff(sessionToken: string): Promise<{ transcript: string; voiceTurns: number; trimmed: boolean } | null> {
  try {
    const response = await fetch(HANDOFF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session: sessionToken }),
      signal: AbortSignal.timeout(HANDOFF_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { transcript?: unknown; voiceTurns?: unknown; trimmed?: unknown };
    if (typeof body.transcript !== "string" || !body.transcript) return null;
    return { transcript: body.transcript, voiceTurns: typeof body.voiceTurns === "number" ? body.voiceTurns : 0, trimmed: body.trimmed === true };
  } catch {
    return null;
  }
}

export interface SiteChatVoiceBridgeProps {
  /** Datasettet stemmen snakker ut fra; samme som tekstchattens profil. */
  dataset: string;
  /** Hilsenen er en instruksjon til stemmen, ikke en ferdig replikk (se `useLive`). */
  greeting: string;
  /** Hilsenen når tekstchattens historikk ligger i sesjonen. */
  continuedGreeting: string;
}

/**
 * Usynlig bro mellom chatwidgeten (`public/embed/placy-chat.js`) og
 * `useLive`. All UI ligger i widgeten; her finnes bare taleforbindelsen og
 * overføringen av historikk begge veier. Brukes av nettsidekopiene
 * (Leangenbukta, Nyhavna) med hver sin datasett-ID og hilsen.
 * Protokollen står i `lib/demo/leangenbukta-chat/voice-channel.ts`.
 */
export function SiteChatVoiceBridge({ dataset, greeting, continuedGreeting }: SiteChatVoiceBridgeProps) {
  // Tekstchattens token for NESTE start; settes av start-kommandoen.
  const transcriptRef = useRef<string | null>(null);
  const handoffRef = useRef<VoiceHandoff | null>(null);
  const handoffId = useRef(0);
  const mounted = useRef(true);
  const [handoffVersion, setHandoffVersion] = useState(0);
  const latest = useRef<VoiceWidgetState | null>(null);

  const setHandoff = useCallback((handoff: VoiceHandoff) => {
    if (!mounted.current) return;
    handoffRef.current = handoff;
    // Straks, ikke etter neste render: widgeten skal vite at en overføring
    // pågår før den håndterer at talen er slutt, så ingen melding sendes med
    // gammel historikk i mellomtiden.
    if (latest.current) {
      latest.current = { ...latest.current, handoff };
      publish(latest.current);
    }
    setHandoffVersion((version) => version + 1);
  }, []);

  const onSessionEnded = useCallback(({ sessionToken, settled }: { sessionToken: string; settled: Promise<boolean> }) => {
    const id = ++handoffId.current;
    setHandoff({ id, status: "pending" });
    void (async () => {
      // Serverens opprydding lukker opptaket; først da er alle turene med.
      // En hengende DELETE skal ikke holde tekstchatten igjen; opptaket kan
      // leses også før lukking, bare uten de aller siste ordene.
      await Promise.race([settled.catch(() => false), new Promise((resolve) => setTimeout(resolve, HANDOFF_TIMEOUT_MS))]);
      const result = await fetchHandoff(sessionToken);
      if (id !== handoffId.current) return;
      setHandoff(result ? { id, status: "ready", ...result } : { id, status: "failed" });
    })();
  }, [setHandoff]);

  const live = useLive({
    dataset,
    surface: "chat",
    greeting,
    continuedGreeting,
    getTranscript: () => transcriptRef.current,
    onSessionEnded,
    executeTool: NO_MAP,
    getContext: noBoard,
  });
  const { status, error, notice, messages, continuity, start, stop, sendText } = live;
  const actions = useRef({ start, stop, sendText });
  useEffect(() => { actions.current = { start, stop, sendText }; }, [start, stop, sendText]);

  useEffect(() => {
    latest.current = voiceWidgetState({ status, error, notice, messages, continuity, handoff: handoffRef.current });
    publish(latest.current);
  }, [status, error, notice, messages, continuity, handoffVersion]);

  useEffect(() => {
    mounted.current = true;
    const onHello = () => { if (latest.current) publish(latest.current); };
    const onCommand = (event: Event) => {
      const command = parseVoiceCommand((event as CustomEvent).detail);
      if (!command) return;
      if (command.type === "start") {
        transcriptRef.current = command.transcript ?? null;
        void actions.current.start();
      } else if (command.type === "stop") actions.current.stop();
      else actions.current.sendText(command.text);
    };
    window.addEventListener(VOICE_EVENTS.hello, onHello);
    window.addEventListener(VOICE_EVENTS.command, onCommand);
    return () => {
      mounted.current = false;
      window.removeEventListener(VOICE_EVENTS.hello, onHello);
      window.removeEventListener(VOICE_EVENTS.command, onCommand);
      // Siden uten bro skal ikke vise en taleknapp som ikke virker.
      if (latest.current) publish({ ...latest.current, available: false });
    };
  }, []);

  return null;
}
