"use client";

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useBoard } from "@/components/variants/report/board/board-state";
import { AREA_STEP, useStoryTour } from "@/components/variants/report/board/story/story-tour";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { useLive } from "@/lib/live/use-live";
import type { LiveMessage, LiveStatus } from "@/lib/live/types";
import { boardToolTargets, executeBoardTool, type BoardToolResult } from "@/lib/realtime/board-tools";
import { NYHAVNA_GREETING_INSTRUCTION } from "@/lib/realtime/nyhavna-greeting";

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
 * ## Brukerens trykk er kontekst, ikke en brukertur
 *
 * Omvisningen er personlig: brukeren kan snakke, men også trykke på et tema
 * eller et sted. På Live går et slikt trykk til SERVEREN som kontekst
 * (`sendContext`), ikke som en simulert brukerytring. Serveren eier
 * omvisningstilstanden, fremhever kapittelets steder selv og gir stemmen en
 * kort kommentar – i stedet for at nettleseren dikter opp en setning brukeren
 * aldri sa. Assistentens EGNE kartendringer meldes ikke tilbake; ellers hadde
 * den svart på seg selv. `voiceNav` er skillet.
 *
 * Kartklikk avbryter heller ikke stemmen lenger: Live er full duplex og stopper
 * selv når brukeren begynner å snakke.
 */
export interface BoardVoice {
  status: LiveStatus;
  /** Tilkobling eller samtale i gang: knappen viser stopp. */
  running: boolean;
  connecting: boolean;
  notice: string | null;
  error: string | null;
  /** Guidens siste setning, for å kunne følge med når lyden er lav. */
  latest: string | null;
  /** Spill/stopp. */
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

/** Kontrollens egen rot, slik at tester og styling kan finne den. */
export const BOARD_VOICE_TESTID = "board-voice";

/** URL-flagg som legger et lite styringsobjekt på `window` for simulerte samtaler (lokal demo). */
const DEV_FLAG = "voicedev";

interface VoiceDevHook {
  /** Send en brukerytring som tekst – samme vei som talen, uten mikrofon. */
  say: (text: string) => void;
  /** Kjør en kartkommando lokalt, uten modell. */
  tool: (name: string, args: Record<string, unknown>) => BoardToolResult;
  /** Spill en lydfil INN i samtalen som mikrofon, så hele Live-banen kan testes med ekte tale. */
  play: (url: string) => Promise<void>;
  status: () => LiveStatus;
  messages: () => LiveMessage[];
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

  const live = useLive({
    greeting: NYHAVNA_GREETING_INSTRUCTION,
    getContext: () => ({ selected_category_id: stopId ?? (state.activeCategoryId ? String(state.activeCategoryId) : null), selected_place_id: activePoiId, travel_mode: state.travelMode }),
    executeTool: runBoardTool,
    snapshotId: data.demoSnapshotId,
  });
  const { status, notice, error, messages, latest, start, stop, sendContext, sendText, replaceMicrophoneTrack } = live;
  const connecting = status === "connecting";
  const connected = !["idle", "error", "connecting"].includes(status);
  const running = connected || connecting;

  // Karttilstanden er stille kontekst: serveren skal vite hva brukeren ser på
  // uten at stemmen sier noe om det. Hooken dedupliserer uendret tilstand.
  useEffect(() => {
    if (!connected) return;
    sendContext({ kind: "state", selected_category_id: stopId ?? (state.activeCategoryId ? String(state.activeCategoryId) : null), selected_place_id: activePoiId, travel_mode: state.travelMode });
  }, [connected, sendContext, stopId, state.activeCategoryId, activePoiId, state.travelMode]);

  // Brukeren valgte et tema i raden/rutenettet: serveren åpner kapittelet,
  // fremhever stedene og gir stemmen en kommentar.
  const prevStop = useRef(stopId);
  useEffect(() => {
    if (prevStop.current === stopId) return;
    prevStop.current = stopId;
    if (!stopId) return;
    if (voiceNav.current.categoryIds.delete(stopId)) return;
    if (!connected) return;
    sendContext({ kind: "theme", id: stopId, label: story.stop?.label });
  }, [stopId, connected, sendContext, story.stop?.label]);

  // Brukeren trykket på et sted (pinne eller rad): én kort kommentar, så videre.
  const prevPoi = useRef(activePoiId);
  useEffect(() => {
    if (prevPoi.current === activePoiId) return;
    prevPoi.current = activePoiId;
    if (!activePoiId) return;
    if (voiceNav.current.poiIds.delete(activePoiId)) return;
    if (!connected) return;
    sendContext({ kind: "place", id: activePoiId });
  }, [activePoiId, connected, sendContext]);

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
      void start();
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
      // Lydklippet sendes som mikrofonspor, ikke som tekst: da går hele veien
      // gjennom Live – lytting, avbrudd og transkripsjon – slik en ekte
      // stemme ville gjort det.
      play: async (url: string) => {
        const context = new AudioContext();
        try {
          const clip = await context.decodeAudioData(await (await fetch(url)).arrayBuffer());
          const destination = context.createMediaStreamDestination();
          const source = context.createBufferSource();
          source.buffer = clip;
          source.connect(destination);
          const track = destination.stream.getAudioTracks()[0] ?? null;
          await replaceMicrophoneTrack(track);
          await new Promise<void>((resolve) => { source.onended = () => resolve(); source.start(); });
          await replaceMicrophoneTrack(null);
          track?.stop();
        } finally {
          await context.close();
        }
      },
      status: () => status,
      messages: () => messages,
      start: () => value.toggle(),
      stop: () => { if (running) value.toggle(); },
    };
    return () => { delete host.placyVoice; };
  });

  return <BoardVoiceContext.Provider value={value}>{children}</BoardVoiceContext.Provider>;
}
