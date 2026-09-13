"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useBoard } from "@/components/variants/report/board/board-state";
import { AREA_STEP, useStoryTour } from "@/components/variants/report/board/story/story-tour";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { boardRealtimeTools, executeBoardTool } from "@/lib/realtime/board-tools";
import { useRealtime } from "@/lib/realtime/use-realtime";
import type { RealtimeStatus } from "@/lib/realtime/types";

/**
 * Samtalen med Placy som ÉN tilstand for hele boardet (2026-09-13).
 *
 * Kontrollen (`BoardVoiceControl`) står flere steder: under fanene i
 * omvisningen, og på mobilens nabolagsliste før omvisningen er begynt. Lå
 * samtalen inne i kontrollen, ville hvert lagbytte som monterer kontrollen på
 * nytt ha lagt på. Derfor eier provideren forbindelsen, og kontrollene er bare
 * knapper mot den. Montert én gang, inne i board- og omvisningskonteksten.
 *
 * Bare boards med et frosset datagrunnlag (`demoSnapshotId`) har samtale;
 * andre boards får ingen kontekst, og kontrollen rendrer ingenting.
 */
export interface BoardVoice {
  status: RealtimeStatus;
  /** Tilkobling eller samtale i gang: knappen viser stopp. */
  running: boolean;
  connecting: boolean;
  notice: string | null;
  error: string | null;
  /** Placys siste setning, for å kunne følge med når lyden er lav. */
  latest: string | null;
  /** Spill/stopp. Starter alltid tale, aldri tekst. */
  toggle: () => void;
}

const BoardVoiceContext = createContext<BoardVoice | null>(null);

export function useBoardVoice(): BoardVoice | null {
  return useContext(BoardVoiceContext);
}

export function BoardVoiceProvider({ children }: { children: ReactNode }) {
  const { data } = useBoard();
  if (!data.demoSnapshotId) return <>{children}</>;
  return <BoardVoiceSession>{children}</BoardVoiceSession>;
}

/** Trykk her avbryter ikke Placy; alt annet på siden er «brukeren tar over kartet». */
export const BOARD_VOICE_TESTID = "board-voice";

function BoardVoiceSession({ children }: { children: ReactNode }) {
  const { data, state, dispatch, mapCamera } = useBoard();
  const story = useStoryTour();
  const pauseTour = useAudioTourStore((s) => s.pause);

  const runBoardTool = (name: string, args: Record<string, unknown>) => {
    const result = executeBoardTool(name, args, {
      data, state, dispatch, mapCamera,
      onCategory: (index) => story.begin(index),
      onReset: () => story.begin(AREA_STEP),
    });
    if (!result || typeof result !== "object") return { error: "Kartet kunne ikke oppdateres." };
    const output = result as Record<string, unknown>;
    if (typeof output.error === "string") return { error: output.error };
    if (name === "show_place") return { ok: true, shown: String(output.name ?? "Stedet"), poi_id: String(args.poi_id) };
    if (name === "show_category") return { ok: true, shown: String(output.shown ?? "Kategorien"), category_id: String(args.category_id) };
    if (name === "reset_board") return { ok: true, shown: String(output.shown ?? "Hele nabolaget") };
    if (name === "set_travel_mode") return { ok: true, shown: "Reisemåte oppdatert" };
    return { error: "Ukjent kartkommando." };
  };

  // Hilsenen nevner to av boardets EGNE spørsmål, valgt her og ikke av
  // modellen: bedt om «to eksempler fra katalogen» fant den på «finn kaféer»
  // (2026-09-13). Ett fra det valgte temaet når et tema er valgt, ellers fra
  // nabolagets spørsmål; resten fra nabolaget.
  const examples = [...(story.stop?.editorial?.faq ?? []), ...(data.globalFaq ?? [])].map((entry) => entry.question).slice(0, 2);
  const greeting = `Hils kort på norsk, standard østnorsk talemål, uten engelsk aksent. Presenter deg som Placy og si at brukeren kan spørre om nabolaget${examples.length ? `, for eksempel: ${examples.map((q) => `«${q}»`).join(" eller ")}` : ""}. Ikke kall verktøy før brukeren har spurt.`;

  const realtime = useRealtime({
    instructions: "",
    tools: boardRealtimeTools,
    greeting,
    getContext: () => JSON.stringify({ selected_category_id: story.stop ? String(story.stop.id) : state.activeCategoryId, selected_place_id: state.activePOIId, travel_mode: state.travelMode }),
    executeTool: runBoardTool,
    serverControlled: true,
    snapshotId: data.demoSnapshotId,
  });
  const { status, notice, error, messages, start, stop, interruptForMap } = realtime;
  const connecting = status === "connecting";
  const connected = !["idle", "error", "connecting"].includes(status);
  const running = connected || connecting;
  const latest = messages.filter((message) => message.role === "assistant").at(-1)?.text ?? null;

  useEffect(() => {
    if (!connected) return;
    const manualClick = (event: MouseEvent) => {
      if (event.target instanceof Element && !event.target.closest(`[data-testid="${BOARD_VOICE_TESTID}"]`)) interruptForMap();
    };
    document.addEventListener("click", manualClick, true);
    return () => document.removeEventListener("click", manualClick, true);
  }, [connected, interruptForMap]);

  const value = useMemo<BoardVoice>(() => ({
    status, running, connecting, notice, error, latest,
    toggle: () => {
      if (connecting) return;
      if (running) { stop(); return; }
      pauseTour("manual");
      dispatch({ type: "END_INTRO" });
      void start({ mode: "voice" });
    },
  }), [status, running, connecting, notice, error, latest, stop, start, pauseTour, dispatch]);

  return <BoardVoiceContext.Provider value={value}>{children}</BoardVoiceContext.Provider>;
}
