"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useBoard, type BoardState } from "@/components/variants/report/board/board-state";
import { findBoardPOI, type BoardData, type BoardPOIId } from "@/components/variants/report/board/board-data";
import { useStoryTour, type StoryTourSnapshot } from "@/components/variants/report/board/story/story-tour";
import { useBoardVoice, type BoardVoiceAgentLink } from "@/components/variants/report/board/voice/board-voice";
import { newClientId } from "@/lib/browser/client-id";
import type { CameraSnapshot } from "@/lib/board/board-types";
import type { LiveSessionEnded } from "@/lib/live/use-live";
import { askBoardChat, BOARD_CHAT_FALLBACK_ERROR } from "@/lib/board-agent/client";
import { feedReducer } from "@/lib/board-agent/feed";
import { agentSuggestions, suggestionKey } from "@/lib/board-agent/suggestions";
import type { AgentEntry, AgentInput, AgentMode, AgentPlaceOrigin, AgentSuggestion, BoardChatIntent, BoardChatMapState, BoardDirective } from "@/lib/board-agent/types";

/**
 * Samtalekoordinatoren for Boardets agentmodus «Spør Anja» (prototype, 2026-09-25).
 *
 * Planen: `docs/plans/2026-09-25-1220-feat-nyhavna-board-agentmodus-prototype-plan.md`
 * (KTD2–KTD5). Én provider per board, montert inne i talekonteksten, og bare
 * når ruta har bedt om prototypen (`agentMode` på `ReportReelsPage`).
 *
 * ## Modusen er presentasjon, ikke navigasjon (KTD2)
 *
 * «Utforsk» er dagens board. Ved inngang til «Spør Anja» tas et øyeblikksbilde
 * av board-tilstanden, omvisningen og kameraet; ved utgang legges det tilbake
 * nøyaktig, så samtalen kan styre kartet fritt uten at utforskingen mister
 * plassen sin. Samtalen selv (feed, historikktoken, brukte forslag) lever her,
 * ikke i kartreduseren, og overlever modusbytter i den åpne økten.
 *
 * ## Én vei inn for brukerens valg (KTD5)
 *
 * Et kartklikk (`useMapPinClick`), et forslag eller et stedskort i samtalen
 * går gjennom `selectPlace`: stedet velges i kartet, et stedsinnslag vises
 * straks, og Anja svarer — muntlig når talen står (talens egen kontekstkanal
 * i `board-voice.tsx` melder stedet), ellers som tekst via Board-tekstbanen.
 * Anjas EGNE kartkommandoer går gjennom `voice.runTool`, som merker dem, så de
 * aldri kommer tilbake som et nytt brukerinitiativ.
 *
 * Et nytt valg før forrige svar er ferdig avbryter det forrige kallet: feeden
 * og kartet skal vise siste bevisste valg, ikke et foreldet svar om et annet
 * sted. Samme initiativ to ganger på rad gir ingenting nytt.
 *
 * ## Tekst og tale er én samtale (KTD4)
 *
 * Tekst starter aldri talen. Talen startes først når brukeren velger «Snakk»
 * og godtar mikrofonen, og den får tekstbanens signerte historikk med seg
 * (`linkAgent`). Når talen er slutt, byttes sesjonstokenet mot et nytt signert
 * token, så neste skrevne spørsmål kjenner det som ble sagt.
 */

export interface BoardAgent {
  name: string;
  mode: AgentMode;
  setMode: (mode: AgentMode) => void;
  input: AgentInput;
  setInput: (input: AgentInput) => void;
  entries: AgentEntry[];
  suggestions: AgentSuggestion[];
  busy: boolean;
  send: (text: string) => void;
  selectPlace: (poiId: string, origin: AgentPlaceOrigin) => void;
  selectSuggestion: (suggestion: AgentSuggestion) => void;
  dismissSuggestions: () => void;
  /** Et stedskort i samtalen ble trykket: kartet viser stedet igjen, uten nytt svar. */
  focusPlace: (poiId: string) => void;
}

const BoardAgentContext = createContext<BoardAgent | null>(null);

/** Null når boardet ikke har agentmodusen — da er alt som før. */
export function useBoardAgent(): BoardAgent | null {
  return useContext(BoardAgentContext);
}

export function BoardAgentProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;
  return <BoardAgentSession>{children}</BoardAgentSession>;
}

const HANDOFF_ENDPOINT = "/api/prototype/live/handoff";
const HANDOFF_TIMEOUT_MS = 8000;

/** Hilsenen når talen tar over en samtale som alt er i gang i panelet. */
const CONTINUED_GREETING =
  "Samtalen fortsetter muntlig fra det dere har skrevet i panelet ved siden av kartet. Si kort på norsk at du gjerne fortsetter muntlig, knytt an til det dere nettopp snakket om med noen få ord, og spør hva mer de lurer på. Ikke si at dette er en ny samtale, og ikke gjenta svar du alt har gitt. Høyst to setninger.";

const HANDOFF_FAILED = "Talen ble ikke overført til den skrevne samtalen. Anja husker det som ble skrevet før talen.";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

async function fetchHandoff(sessionToken: string): Promise<string | null> {
  try {
    const response = await fetch(HANDOFF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ session: sessionToken }),
      signal: AbortSignal.timeout(HANDOFF_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { transcript?: unknown };
    return typeof body.transcript === "string" && body.transcript ? body.transcript : null;
  } catch {
    return null;
  }
}

/** Temaet et svars kartdirektiver viser, eller null når de spriker eller mangler. */
function directiveCategory(directives: readonly BoardDirective[], categories: BoardData["categories"]): string | null {
  for (const directive of directives) {
    if (directive.name === "show_category" && typeof directive.args.category_id === "string") return directive.args.category_id;
  }
  const ids = directives.flatMap((d) => (d.name === "highlight_places" && Array.isArray(d.args.poi_ids) ? d.args.poi_ids : d.name === "show_place" ? [d.args.poi_id] : []));
  const themes = new Set(ids.flatMap((id) => {
    const poi = typeof id === "string" ? findBoardPOI(categories, id as BoardPOIId) : null;
    return poi ? [String(poi.categoryId)] : [];
  }));
  return themes.size === 1 ? [...themes][0] : null;
}

interface ExploreSnapshot {
  board: BoardState;
  story: StoryTourSnapshot;
  camera: CameraSnapshot | null;
}

function BoardAgentSession({ children }: { children: ReactNode }) {
  const { data, state, dispatch, mapCamera } = useBoard();
  const story = useStoryTour();
  const voice = useBoardVoice();

  const [mode, setModeState] = useState<AgentMode>("explore");
  const [input, setInputState] = useState<AgentInput>("write");
  const [entries, dispatchFeed] = useReducer(feedReducer, []);
  const [busy, setBusy] = useState(false);
  const [contextCategoryId, setContextCategoryId] = useState<string | null>(null);
  const [used, setUsed] = useState<ReadonlySet<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  // Alt de asynkrone stiene leser, i refs: et svar som kommer etter et
  // modusbytte skal se modusen NÅ, ikke den da kallet startet.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const transcriptRef = useRef<string | null>(null);
  const handoffRef = useRef<Promise<void> | null>(null);
  const requestRef = useRef<{ controller: AbortController; pendingId: string } | null>(null);
  const lastInitiativeRef = useRef<string | null>(null);
  const snapshotRef = useRef<ExploreSnapshot | null>(null);
  const latest = useRef({ state, story, voice, mapCamera });
  latest.current = { state, story, voice, mapCamera };

  const mapState = (): BoardChatMapState => {
    const { state, story } = latest.current;
    return {
      selectedCategoryId: story.stop ? String(story.stop.id) : state.activeCategoryId ? String(state.activeCategoryId) : null,
      selectedPlaceId: state.activePOIId ? String(state.activePOIId) : null,
      travelMode: state.travelMode,
    };
  };

  const markUsed = useCallback((key: string) => {
    setUsed((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
  }, []);

  /** Anjas kartkommandoer, i rekkefølge, og bare mens samtalen fortsatt eier kartet. */
  const applyDirectives = useCallback(async (directives: readonly BoardDirective[]) => {
    for (const directive of directives) {
      if (modeRef.current !== "agent") return;
      const run = latest.current.voice?.runTool;
      if (!run) return;
      await run(directive.name, directive.args);
      await nextFrame();
    }
  }, []);

  const ask = useCallback(async (request: { message?: string; intent?: BoardChatIntent }, forEntryId: string | null) => {
    const previous = requestRef.current;
    if (previous) {
      previous.controller.abort();
      dispatchFeed({ type: "replace", id: previous.pendingId, entries: [] });
    }
    const controller = new AbortController();
    const pendingId = `pending-${newClientId()}`;
    requestRef.current = { controller, pendingId };
    setBusy(true);
    dispatchFeed({ type: "add", entry: { id: pendingId, kind: "pending", forEntryId } });
    // En talesamtale som nettopp ble avsluttet leverer historikken sin først.
    if (handoffRef.current) await handoffRef.current;
    const outcome = await askBoardChat({ ...request, transcript: transcriptRef.current, board: mapState() }, controller.signal);
    if (requestRef.current?.controller !== controller) return;
    requestRef.current = null;
    setBusy(false);
    if (outcome.ok) {
      transcriptRef.current = outcome.reply.transcript;
      dispatchFeed({
        type: "replace",
        id: pendingId,
        entries: [{ id: `a-${newClientId()}`, kind: "assistant", text: outcome.reply.reply, via: "text", sources: outcome.reply.sources, links: outcome.reply.links, notice: outcome.reply.notice }],
      });
      // Forslagene følger det Anja nettopp viste: temaet, eller de fremhevede stedenes felles tema.
      const shown = directiveCategory(outcome.reply.directives, data.categories);
      if (shown) setContextCategoryId(shown);
      await applyDirectives(outcome.reply.directives);
      return;
    }
    if (outcome.aborted) return;
    dispatchFeed({ type: "replace", id: pendingId, entries: [{ id: `s-${newClientId()}`, kind: "status", tone: "error", text: outcome.error || BOARD_CHAT_FALLBACK_ERROR }] });
    // mapState leses fra refs; resten er stabilt.
  }, [applyDirectives, data.categories]);

  // ---- Talen ----------------------------------------------------------------

  const onSessionEnded = useCallback((ended: LiveSessionEnded) => {
    const finish = async () => {
      let transcript: string | null = null;
      if (ended.sessionToken === undefined) {
        transcript = ended.handoff?.status === "ready" ? ended.handoff.transcript : null;
      } else {
        // Serverens opprydding lukker opptaket; først da er alle turene med.
        await Promise.race([ended.settled.catch(() => false), new Promise((resolve) => setTimeout(resolve, HANDOFF_TIMEOUT_MS))]);
        transcript = await fetchHandoff(ended.sessionToken);
      }
      if (transcript) transcriptRef.current = transcript;
      else dispatchFeed({ type: "add", entry: { id: `s-${newClientId()}`, kind: "status", tone: "info", text: HANDOFF_FAILED } });
    };
    const done = finish().finally(() => { if (handoffRef.current === done) handoffRef.current = null; });
    handoffRef.current = done;
  }, []);

  const link = useMemo<BoardVoiceAgentLink>(() => ({
    getTranscript: () => transcriptRef.current,
    continuedGreeting: CONTINUED_GREETING,
    onSessionEnded,
  }), [onSessionEnded]);
  const linkAgent = voice?.linkAgent;
  useEffect(() => {
    if (!linkAgent) return;
    linkAgent(link);
    return () => linkAgent(null);
  }, [linkAgent, link]);

  // Transkriptet fra talen blir innslag i samme historikk.
  const voiceMessages = voice?.messages;
  useEffect(() => {
    if (voiceMessages) dispatchFeed({ type: "voice", messages: voiceMessages });
  }, [voiceMessages]);

  // ---- Modus og inndata -------------------------------------------------------

  const setMode = useCallback((next: AgentMode) => {
    if (next === modeRef.current) return;
    const { state, story, voice, mapCamera } = latest.current;
    // Et nytt besøk i samtalen kan spørre om det samme stedet igjen.
    lastInitiativeRef.current = null;
    if (next === "agent") {
      snapshotRef.current = { board: state, story: story.snapshot(), camera: mapCamera?.snapshot() ?? null };
      // Forslagene begynner der leseren står: temaet, eller det åpne stedets tema.
      const place = state.activePOIId ? findBoardPOI(data.categories, state.activePOIId) : null;
      const here = story.stop?.id ?? state.activeCategoryId ?? place?.categoryId ?? null;
      if (here) setContextCategoryId(String(here));
      modeRef.current = "agent";
      setModeState("agent");
      return;
    }
    voice?.hangUp();
    setInputState("write");
    const saved = snapshotRef.current;
    snapshotRef.current = null;
    if (saved) {
      dispatch({ type: "RESTORE_STATE", state: saved.board });
      story.restore(saved.story);
      if (saved.camera) mapCamera?.restore(saved.camera);
    }
    modeRef.current = "explore";
    setModeState("explore");
  }, [data.categories, dispatch]);

  const setInput = useCallback((next: AgentInput) => {
    const voice = latest.current.voice;
    setInputState(next);
    if (!voice) return;
    if (next === "write") voice.hangUp();
    else if (!voice.running && !voice.consentPending) voice.toggle();
  }, []);

  // ---- Brukerens initiativ --------------------------------------------------

  /** Samme initiativ to ganger på rad er ett initiativ. */
  const fresh = (key: string) => {
    if (lastInitiativeRef.current === key) return false;
    lastInitiativeRef.current = key;
    return true;
  };

  const selectPlace = useCallback((poiId: string, origin: AgentPlaceOrigin) => {
    const poi = findBoardPOI(data.categories, poiId as BoardPOIId);
    if (!poi || !fresh(suggestionKey.place(String(poi.id)))) return;
    markUsed(suggestionKey.place(String(poi.id)));
    setContextCategoryId(String(poi.categoryId));
    dispatch({ type: "OPEN_POI", id: poi.id, source: "agent" });
    // Et kartklikk står der fingeren er; fra samtalen flyr kartet til stedet.
    if (origin !== "map") latest.current.mapCamera?.flyToPoint(poi.coordinates, { minZoom: 16, durationMs: 1000 });
    const entryId = `p-${newClientId()}`;
    const category = data.categories.find((c) => c.id === poi.categoryId);
    dispatchFeed({ type: "add", entry: { id: entryId, kind: "place", poiId: String(poi.id), name: poi.name, categoryLabel: category?.label ?? null, origin } });
    // Talen står: stedet meldes som kontekst av talens egen effekt, og Anja svarer muntlig.
    if (latest.current.voice?.connected) return;
    void ask({ intent: { kind: "place", poiId: String(poi.id) } }, entryId);
  }, [data.categories, dispatch, markUsed, ask]);

  const selectFaq = useCallback((faqId: string) => {
    const entry = [...(data.globalFaq ?? []), ...data.categories.flatMap((c) => c.editorial?.faq ?? [])].find((f) => f.id === faqId);
    if (!entry || !fresh(suggestionKey.faq(faqId))) return;
    markUsed(suggestionKey.faq(faqId));
    const owner = data.categories.find((c) => c.editorial?.faq?.some((f) => f.id === faqId));
    if (owner) setContextCategoryId(String(owner.id));
    const entryId = `f-${newClientId()}`;
    dispatchFeed({ type: "add", entry: { id: entryId, kind: "faq", faqId, question: entry.question } });
    const voice = latest.current.voice;
    if (voice?.connected) {
      if (voice.faq) voice.faq.select(entry);
      else voice.sendText(entry.question);
      return;
    }
    void ask({ intent: { kind: "faq", faqId } }, entryId);
  }, [data.categories, data.globalFaq, markUsed, ask]);

  const selectTheme = useCallback((categoryId: string) => {
    const index = data.categories.findIndex((c) => String(c.id) === categoryId);
    const category = data.categories[index];
    if (!category || !fresh(suggestionKey.theme(categoryId))) return;
    markUsed(suggestionKey.theme(categoryId));
    setContextCategoryId(categoryId);
    const entryId = `t-${newClientId()}`;
    dispatchFeed({ type: "add", entry: { id: entryId, kind: "theme", categoryId, label: category.label } });
    const { voice, story } = latest.current;
    // Talen: et umerket temabytte meldes som kontekst, og serveren åpner kapittelet.
    if (voice?.connected) {
      story.begin(index);
      return;
    }
    void voice?.runTool("show_category", { category_id: categoryId });
    void ask({ intent: { kind: "theme", categoryId } }, entryId);
  }, [data.categories, markUsed, ask]);

  const send = useCallback((raw: string) => {
    const text = raw.trim();
    if (!text) return;
    lastInitiativeRef.current = `text:${newClientId()}`;
    const voice = latest.current.voice;
    if (voice?.connected) {
      // Under talen går skrevet tekst inn i talesamtalen; transkriptet viser den.
      voice.sendText(text);
      return;
    }
    const entryId = `u-${newClientId()}`;
    dispatchFeed({ type: "add", entry: { id: entryId, kind: "user", text, via: "text" } });
    void ask({ message: text }, entryId);
  }, [ask]);

  const selectSuggestion = useCallback((suggestion: AgentSuggestion) => {
    if (suggestion.kind === "place") selectPlace(suggestion.poiId, "suggestion");
    else if (suggestion.kind === "faq") selectFaq(suggestion.faqId);
    else selectTheme(suggestion.categoryId);
  }, [selectPlace, selectFaq, selectTheme]);

  const focusPlace = useCallback((poiId: string) => {
    const poi = findBoardPOI(data.categories, poiId as BoardPOIId);
    if (!poi) return;
    dispatch({ type: "OPEN_POI", id: poi.id, source: "agent" });
    latest.current.mapCamera?.flyToPoint(poi.coordinates, { minZoom: 16, durationMs: 900 });
  }, [data.categories, dispatch]);

  const suggestions = useMemo(
    () => agentSuggestions(data, { categoryId: contextCategoryId, used, dismissed, limit: entries.length ? 3 : 4 }),
    [data, contextCategoryId, used, dismissed, entries.length],
  );

  const dismissSuggestions = useCallback(() => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const suggestion of suggestions) next.add(suggestion.key);
      return next;
    });
  }, [suggestions]);

  const value: BoardAgent = {
    name: voice?.name ?? "Anja",
    mode, setMode, input, setInput, entries, suggestions, busy,
    send, selectPlace, selectSuggestion, dismissSuggestions, focusPlace,
  };

  return <BoardAgentContext.Provider value={value}>{children}</BoardAgentContext.Provider>;
}
