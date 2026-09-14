"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useBoard } from "@/components/variants/report/board/board-state";
import { AREA_STEP, useStoryTour } from "@/components/variants/report/board/story/story-tour";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { revealAfterCamera } from "@/lib/demo/nyhavna-lokal/reveal-transition";
import { DISCOVERY_CATEGORIES, radiusOptions } from "@/lib/demo/nyhavna-lokal/radius";
import { LOCAL_VOICE_PACING } from "@/lib/demo/nyhavna-lokal/voice-instructions";
import type { LiveVoice } from "@/lib/live/voices";
import { useLive } from "@/lib/live/use-live";
import { useNarrationFocus } from "@/lib/demo/nyhavna-lokal/use-narration-focus";
import type { BoardPOIId } from "@/components/variants/report/board/board-data";
import { useFaqProgress } from "@/lib/demo/nyhavna-lokal/use-faq-progress";
import { parseLinkedText, boardLinkResolvers } from "@/lib/board/poi-link-text";
import type { FaqEntry } from "@/lib/generators/faq-generator";
import type { LiveMessage, LiveStatus } from "@/lib/live/types";
import { boardToolTargets, executeBoardTool, type BoardToolResult } from "@/lib/realtime/board-tools";
import { greetingInstruction, NYHAVNA_GREETING_INSTRUCTION } from "@/lib/realtime/nyhavna-greeting";

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
  morePlaces?: { current: number; options: { radiusKm: number; count: number }[]; show: (radiusKm: number) => void };
  voiceSelection?: { value: LiveVoice | ""; select: (value: LiveVoice | "") => void };
  guided?: boolean;
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
  faq?: {
    explored: ReadonlySet<string>;
    active: ReadonlySet<string>;
    select: (entry: FaqEntry) => void;
    reset: () => void;
  };
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
  tool: (name: string, args: Record<string, unknown>) => Promise<BoardToolResult>;
  /** Spill en lydfil INN i samtalen som mikrofon, så hele Live-banen kan testes med ekte tale. */
  play: (url: string) => Promise<void>;
  status: () => LiveStatus;
  messages: () => LiveMessage[];
  start: () => void;
  stop: () => void;
}

function BoardVoiceSession({ children }: { children: ReactNode }) {
  const { data, state, dispatch, mapCamera, reserveData, revealedPlaceIds, revealPlaces } = useBoard();
  const story = useStoryTour();
  const pauseTour = useAudioTourStore((s) => s.pause);

  // Kart-ID-ene assistentens siste verktøykall førte til. Effektene under
  // konsumerer dem, så en endring guiden selv laget ikke meldes tilbake som
  // brukerens trykk.
  const voiceNav = useRef({ categoryIds: new Set<string>(), poiIds: new Set<string>() });
  const stopId = story.stop ? String(story.stop.id) : null;
  const activePoiId = state.activePOIId ? String(state.activePOIId) : null;

  const progressRef = useRef<ReturnType<typeof useFaqProgress> | null>(null);
  const localDemo = data.demoDataset === "nyhavna-lokal";
  const [selectedVoice, setSelectedVoice] = useState<LiveVoice | "">("");
  const faqIds = useMemo(() => localDemo ? [...(data.globalFaq ?? []), ...data.categories.flatMap(c => c.editorial?.faq ?? [])].map(f => f.id) : [], [data.globalFaq, data.categories, localDemo]);

  const commandVersion = useRef(0);
  useEffect(() => () => { commandVersion.current++; }, []);
  const runBoardTool = useCallback(async (name: string, args: Record<string, unknown>): Promise<BoardToolResult> => {
    const version = ++commandVersion.current;
    const revealing = localDemo && name === "reveal_places";
    const ids = Array.isArray(args.poi_ids) ? args.poi_ids.filter((id): id is string => typeof id === "string") : [];
    const validReveal = revealing && reserveData && typeof args.category_id === "string"
      ? radiusOptions(reserveData.demoRadiusPlaces ?? [], args.category_id, revealedPlaceIds ?? new Set()).options.find(o => o.radiusKm === args.radius_km)
      : undefined;
    if (revealing && (!validReveal || validReveal.ids.length !== ids.length || ids.some(id => !validReveal.ids.includes(id)))) return { error: "Ugyldig radiusutvidelse." };
    if (revealing) {
      if (!mapCamera || !reserveData) return { error: "Kartet er ikke klart. Ingen nye steder er vist." };
      const index = data.categories.findIndex(c => String(c.id) === args.category_id);
      if (index >= 0 && (String(data.categories[index]?.id) !== stopId || activePoiId)) {
        voiceNav.current.categoryIds.add(String(args.category_id));
        story.begin(index);
      }
    }
    const painted = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const toolData = revealing && revealPlaces && reserveData && mapCamera
      ? await revealAfterCamera({
        painted,
        wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
        current: () => commandVersion.current === version,
        frame: () => mapCamera.fitCoordinates([data.home.coordinates, ...ids.flatMap(id => reserveData.poisById.get(id)?.coordinates ?? [])], { maxZoom: 15, durationMs: 1400, maxRangeM: 100000 }),
        reveal: () => revealPlaces(ids),
      }) : data;
    if (!toolData) return { error: "Visningen ble avbrutt av et nytt valg." };
    const result = executeBoardTool(revealing ? "highlight_places" : name, revealing ? { ...args, poi_ids: ids } : args, {
      data: toolData, state, dispatch, mapCamera: revealing ? null : mapCamera,
      followHighlightCategory: localDemo,
      highlightLimit: revealing ? ids.length : undefined,
      onCategory: (index) => { if (!revealing && (String(data.categories[index]?.id) !== stopId || activePoiId)) story.begin(index); },
      onReset: () => story.begin(AREA_STEP),
    });
    if (revealing && "ok" in result) {
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    if (localDemo && "ok" in result && !result.rejected?.length && Array.isArray(args.answered_faq_ids)) {
      progressRef.current?.queue(args.answered_faq_ids.filter((id): id is string => typeof id === "string"));
    }
    const targets = boardToolTargets(revealing ? "highlight_places" : name, result, toolData, state.activeCategoryId);
    for (const id of targets.categoryIds) if (id !== stopId) voiceNav.current.categoryIds.add(id);
    for (const id of targets.poiIds) if (id !== activePoiId) voiceNav.current.poiIds.add(id);
    return result;
  }, [data, state, dispatch, mapCamera, story, localDemo, stopId, activePoiId, revealPlaces, reserveData, revealedPlaceIds]);

  const live = useLive({
    voice: selectedVoice || undefined,
    // Hilsenen og datagrunnlaget følger BOARDET, ikke koden: to demoer deler
    // denne flaten med hvert sitt innhold, og guiden skal si stedets egen
    // åpning og svare ut av stedets egne data.
    greeting: (data.demoGreeting ? greetingInstruction(data.demoGreeting) : NYHAVNA_GREETING_INSTRUCTION) + (localDemo ? `\n${LOCAL_VOICE_PACING}` : ""),
    dataset: data.demoDataset,
    getContext: () => ({ selected_category_id: stopId ?? (state.activeCategoryId ? String(state.activeCategoryId) : null), selected_place_id: activePoiId, travel_mode: state.travelMode, ...(localDemo ? { revealed_place_ids: [...(revealedPlaceIds ?? [])] } : {}) }),
    executeTool: runBoardTool,
    snapshotId: data.demoSnapshotId,
  });
  const { status, notice, error, messages, latest, start, stop, sendContext, sendText, replaceMicrophoneTrack } = live;
  const narrationPlaces = useMemo(() => state.highlightedPoiIds.flatMap(id => {
    const poi = data.poisById.get(id);
    return poi ? [{ id: String(id), name: poi.name.split(" – ")[0] }] : [];
  }), [state.highlightedPoiIds, data.poisById]);
  useNarrationFocus(localDemo, narrationPlaces, status, messages,
    id => dispatch({ type: "FOCUS_NARRATION", id: id as BoardPOIId | null }));
  const progress = useFaqProgress(faqIds, status, messages, live.interruptionVersion);
  progressRef.current = progress;
  const { clear: clearFaq, read: readFaq } = progress;
  const connecting = status === "connecting";
  const connected = !["idle", "error", "connecting"].includes(status);
  const running = connected || connecting;

  // Karttilstanden er stille kontekst: serveren skal vite hva brukeren ser på
  // uten at stemmen sier noe om det. Hooken dedupliserer uendret tilstand.
  useEffect(() => {
    if (!connected) return;
    sendContext({ kind: "state", selected_category_id: stopId ?? (state.activeCategoryId ? String(state.activeCategoryId) : null), selected_place_id: activePoiId, travel_mode: state.travelMode, ...(localDemo ? { revealed_place_ids: [...(revealedPlaceIds ?? [])] } : {}) });
  }, [connected, sendContext, stopId, state.activeCategoryId, activePoiId, state.travelMode, localDemo, revealedPlaceIds]);

  // Brukeren valgte et tema i raden/rutenettet: serveren åpner kapittelet,
  // fremhever stedene og gir stemmen en kommentar.
  const prevStop = useRef(stopId);
  useEffect(() => {
    if (prevStop.current === stopId) return;
    prevStop.current = stopId;
    if (!stopId) return;
    if (voiceNav.current.categoryIds.delete(stopId)) return;
    if (!connected || activePoiId) return;
    sendContext({ kind: "theme", id: stopId, label: story.stop?.label });
  }, [stopId, activePoiId, connected, sendContext, story.stop?.label]);

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

  const selectFaq = useCallback((entry: FaqEntry) => {
    if (!faqIds.includes(entry.id)) return;
    const poiIds = parseLinkedText(entry.answer, boardLinkResolvers(data.poisById, data.categories.map(c => String(c.id))))
      .flatMap(node => node.kind === "poi" ? [node.poiId] : []);
    if (poiIds.length) executeBoardTool("highlight_places", { poi_ids: poiIds }, { data, state, dispatch, mapCamera });
    if (connected) {
      clearFaq();
      sendText(entry.question);
    } else {
      readFaq(entry.id);
    }
  }, [faqIds, data, state, dispatch, mapCamera, connected, clearFaq, readFaq, sendText]);

  const highlightedCategory = state.highlightedPoiIds.length ? data.poisById.get(state.highlightedPoiIds[0])?.category.id : null;
  const selectedCategory = stopId ?? (state.activeCategoryId ? String(state.activeCategoryId) : null) ?? highlightedCategory;
  const radius = radiusOptions(reserveData?.demoRadiusPlaces ?? [], selectedCategory ?? "", revealedPlaceIds ?? new Set());
  const showMore = (radiusKm: number) => {
    const option = radius.options.find(o => o.radiusKm === radiusKm);
    if (!option || connecting) return;
    if (connected) {
      sendText(`Vis flere steder i kategorien ${selectedCategory} innen ${radiusKm} kilometer. Bruk reveal_more_places med category_id ${selectedCategory} og radius_km ${radiusKm}.`);
    } else {
      runBoardTool("reveal_places", { poi_ids: option.ids, category_id: selectedCategory, radius_km: radiusKm });
    }
  };

  const value: BoardVoice = {
    status, running, connecting, notice, error, latest, guided: localDemo,
    ...(localDemo && selectedCategory && (DISCOVERY_CATEGORIES as readonly string[]).includes(selectedCategory) ? { morePlaces: { current: radius.current, options: radius.options.map(o => ({ radiusKm: o.radiusKm, count: o.ids.length })), show: showMore } } : {}),
    ...(localDemo ? { voiceSelection: { value: selectedVoice, select: setSelectedVoice } } : {}),
    ...(localDemo ? { faq: { explored: progress.explored, active: progress.active, select: selectFaq, reset: progress.reset } } : {}),
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
  };

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
