"use client";

import { useEffect, useRef } from "react";
import { useLive } from "@/lib/live/use-live";
import {
  CHAT_VOICE_DATASET,
  CHAT_VOICE_GREETING,
  parseVoiceCommand,
  VOICE_EVENTS,
  voiceWidgetState,
  type VoiceWidgetState,
} from "@/lib/demo/leangenbukta-chat/voice-channel";
import type { LiveBoardState } from "@/lib/live/types";

/** Chatboksen har ikke noe kart; serveren sender heller ingen kartdirektiver hit. */
const NO_MAP = () => ({ error: "Denne samtalen har ikke noe kart. Ikke påstå at noe vises." });
const NO_BOARD: LiveBoardState = { selected_category_id: null, selected_place_id: null, travel_mode: "walk" };
const noBoard = () => NO_BOARD;

function publish(state: VoiceWidgetState) {
  window.dispatchEvent(new CustomEvent(VOICE_EVENTS.state, { detail: state }));
}

/**
 * Usynlig bro mellom chatwidgeten (`public/embed/placy-chat.js`) og
 * `useLive`. All UI ligger i widgeten; her finnes bare taleforbindelsen.
 * Protokollen står i `lib/demo/leangenbukta-chat/voice-channel.ts`.
 */
export function LeangenbuktaVoiceBridge() {
  const live = useLive({
    dataset: CHAT_VOICE_DATASET,
    surface: "chat",
    greeting: CHAT_VOICE_GREETING,
    executeTool: NO_MAP,
    getContext: noBoard,
  });
  const { status, error, notice, messages, start, stop, sendText } = live;
  const latest = useRef<VoiceWidgetState | null>(null);
  const actions = useRef({ start, stop, sendText });
  useEffect(() => { actions.current = { start, stop, sendText }; }, [start, stop, sendText]);

  useEffect(() => {
    latest.current = voiceWidgetState({ status, error, notice, messages });
    publish(latest.current);
  }, [status, error, notice, messages]);

  useEffect(() => {
    const onHello = () => { if (latest.current) publish(latest.current); };
    const onCommand = (event: Event) => {
      const command = parseVoiceCommand((event as CustomEvent).detail);
      if (!command) return;
      if (command.type === "start") void actions.current.start();
      else if (command.type === "stop") actions.current.stop();
      else actions.current.sendText(command.text);
    };
    window.addEventListener(VOICE_EVENTS.hello, onHello);
    window.addEventListener(VOICE_EVENTS.command, onCommand);
    return () => {
      window.removeEventListener(VOICE_EVENTS.hello, onHello);
      window.removeEventListener(VOICE_EVENTS.command, onCommand);
      // Siden uten bro skal ikke vise en taleknapp som ikke virker.
      if (latest.current) publish({ ...latest.current, available: false });
    };
  }, []);

  return null;
}
