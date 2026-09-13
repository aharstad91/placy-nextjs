"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { findBoardPOI } from "@/components/variants/report/board/board-data";
import { useBoard } from "@/components/variants/report/board/board-state";
import { AREA_STEP, useStoryTour } from "@/components/variants/report/board/story/story-tour";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { boardToolTargets, executeBoardTool, type BoardToolResult } from "@/lib/realtime/board-tools";
import { nyhavnaMapTools } from "@/lib/realtime/map-tools";
import { NYHAVNA_GREETING_INSTRUCTION } from "@/lib/realtime/nyhavna-greeting";
import { useRealtime } from "@/lib/realtime/use-realtime";
import type { RealtimeMessage, RealtimeStatus } from "@/lib/realtime/types";

/**
 * Samtalen med guiden som ÉN tilstand for hele boardet (2026-09-13).
 *
 * Kontrollen (`BoardVoiceControl`) står flere steder: under fanene i
 * omvisningen, og på mobilens nabolagsliste før omvisningen er begynt. Lå
 * samtalen inne i kontrollen, ville hvert lagbytte som monterer kontrollen på
 * nytt ha lagt på. Derfor eier provideren forbindelsen, og kontrollene er bare
 * knapper mot den. Montert én gang, inne i board- og omvisningskonteksten.
 *
 * Bare boards med et frosset datagrunnlag (`demoSnapshotId`) har samtale;
 * andre boards får ingen kontekst, og kontrollen rendrer ingenting.
 *
 * ## Brukerens trykk er også samtale
 *
 * Omvisningen er personlig: brukeren kan snakke, men også trykke på et tema
 * eller et sted. Et slikt trykk meldes til guiden som en kort brukermelding
 * («Jeg valgte temaet …»), så turen bygges videre derfra i stedet for at
 * stemmen fortsetter på et tema brukeren nettopp forlot. Assistentens EGNE
 * kartendringer (via verktøy) meldes ikke tilbake – ellers hadde den svart på
 * seg selv. `voiceNav` er skillet.
 */
export interface BoardVoice {
  status: RealtimeStatus;
  /** Tilkobling eller samtale i gang: knappen viser stopp. */
  running: boolean;
  connecting: boolean;
  notice: string | null;
  error: string | null;
  /** Guidens siste setning, for å kunne følge med når lyden er lav. */
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

/** Trykk her avbryter ikke guiden; alt annet på siden er «brukeren tar over kartet». */
export const BOARD_VOICE_TESTID = "board-voice";

/** URL-flagg som legger et lite styringsobjekt på `window` for simulerte samtaler (lokal demo). */
const DEV_FLAG = "voicedev";

interface VoiceDevHook {
  /** Send en brukerytring som tekst – samme vei som talen, uten mikrofon. */
  say: (text: string) => void;
  /** Kjør en kartkommando lokalt, uten modell. */
  tool: (name: string, args: Record<string, unknown>) => BoardToolResult;
  status: () => RealtimeStatus;
  messages: () => RealtimeMessage[];
  start: () => void;
  stop: () => void;
}

function BoardVoiceSession({ children }: { children: ReactNode }) {
  const { data, state, dispatch, mapCamera } = useBoard();
  const story = useStoryTour();
  const pauseTour = useAudioTourStore((s) => s.pause);

  // Kart-ID-ene assistentens siste verktøykall førte til. Effektene under
  // konsumerer dem, så en endring guiden selv laget ikke meldes tilbake som
  // brukerens trykk.
  const voiceNav = useRef({ categoryIds: new Set<string>(), poiIds: new Set<string>() });
  const stopId = story.stop ? String(story.stop.id) : null;
  const activePoiId = state.activePOIId ? String(state.activePOIId) : null;

  const runBoardTool = (name: string, args: Record<string, unknown>): BoardToolResult => {
    const result = executeBoardTool(name, args, {
      data, state, dispatch, mapCamera,
      onCategory: (index) => story.begin(index),
      onReset: () => story.begin(AREA_STEP),
    });
    const targets = boardToolTargets(name, result, data);
    for (const id of targets.categoryIds) if (id !== stopId) voiceNav.current.categoryIds.add(id);
    for (const id of targets.poiIds) if (id !== activePoiId) voiceNav.current.poiIds.add(id);
    return result;
  };

  const realtime = useRealtime({
    instructions: "",
    tools: nyhavnaMapTools,
    greeting: NYHAVNA_GREETING_INSTRUCTION,
    getContext: () => JSON.stringify({ selected_category_id: stopId ?? state.activeCategoryId, selected_place_id: state.activePOIId, travel_mode: state.travelMode }),
    executeTool: runBoardTool,
    serverControlled: true,
    snapshotId: data.demoSnapshotId,
  });
  const { status, notice, error, messages, start, stop, interruptForMap, sendText } = realtime;
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

  // Brukeren valgte et tema i raden/rutenettet: guiden følger med dit.
  const prevStop = useRef(stopId);
  useEffect(() => {
    if (prevStop.current === stopId) return;
    prevStop.current = stopId;
    if (!stopId) return;
    if (voiceNav.current.categoryIds.delete(stopId)) return;
    if (!connected) return;
    // Tema-ID-en står i meldingen så guiden kan kalle open_theme uten å slå
    // den opp – mini-modellen sa «jeg åpner temaet» uten å gjøre det da
    // meldingen bare bar navnet (målt 2026-09-13).
    sendText(`Jeg valgte temaet «${story.stop?.label ?? stopId}» i kartet (tema-ID ${stopId}). Fortsett omvisningen derfra.`);
  }, [stopId, connected, sendText, story.stop?.label]);

  // Brukeren trykket på et sted (pinne eller rad): én kort kommentar, så videre.
  const prevPoi = useRef(activePoiId);
  useEffect(() => {
    if (prevPoi.current === activePoiId) return;
    prevPoi.current = activePoiId;
    if (!activePoiId) return;
    if (voiceNav.current.poiIds.delete(activePoiId)) return;
    if (!connected) return;
    const poi = findBoardPOI(data.categories, activePoiId);
    if (poi) sendText(`Jeg trykket på «${poi.name}» i kartet (kart-ID ${activePoiId}). Si én kort setning om stedet hvis du har grunnlag, og fortsett.`);
  }, [activePoiId, connected, data.categories, sendText]);

  const value = useMemo<BoardVoice>(() => ({
    status, running, connecting, notice, error, latest,
    toggle: () => {
      if (connecting) return;
      if (running) {
        stop();
        // Fremhevingen er samtalens; når den legger på, går markørene med.
        dispatch({ type: "CLEAR_HIGHLIGHTS" });
        return;
      }
      pauseTour("manual");
      dispatch({ type: "END_INTRO" });
      // Ny samtale, tom profil – også i kartet.
      dispatch({ type: "CLEAR_HIGHLIGHTS" });
      void start({ mode: "voice" });
    },
  }), [status, running, connecting, notice, error, latest, stop, start, pauseTour, dispatch]);

  // Lokal styring for simulerte samtaler og verifisering uten mikrofon
  // (`?voicedev=1`). Bare på den lokale demoen; ingen data forlater siden.
  useEffect(() => {
    if (typeof window === "undefined" || !new URLSearchParams(window.location.search).has(DEV_FLAG)) return;
    const host = window as Window & { placyVoice?: VoiceDevHook };
    host.placyVoice = {
      say: sendText,
      tool: runBoardTool,
      status: () => status,
      messages: () => messages,
      start: () => value.toggle(),
      stop: () => { if (running) value.toggle(); },
    };
    return () => { delete host.placyVoice; };
  });

  return <BoardVoiceContext.Provider value={value}>{children}</BoardVoiceContext.Provider>;
}
