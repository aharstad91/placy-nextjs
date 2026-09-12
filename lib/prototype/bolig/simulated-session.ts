"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TOPICS, type Block, type BoligFixture, type SessionStatus, type ToolResult, type TopicId, type VoiceSession } from "@/lib/prototype/bolig/contract";
import { blocksFromToolResult, mergeBlocks, upsertAnswer } from "@/lib/prototype/bolig/blocks";
import { placeResult, topicResult } from "@/lib/prototype/bolig/knowledge";

/**
 * Deterministisk, lokal simulering av samtalehendelser. Brukes for å bygge og
 * teste layout, kort, avbrudd og kategoritrykk UTEN betalt tale. Den er tydelig
 * merket i UI (`simulated: true`) og beviser ingenting om samtalekvalitet.
 *
 * Timing: «tenker» 600 ms → verktøyresultat (blokker) → «snakker» med ord
 * strømmet inn ca. hvert 45 ms → «lytter». Siste brukerhandling vinner.
 */

const GREETING = "Hei! Jeg kan hjelpe deg å bli kjent med området rundt boligen. Hva er viktig for deg i hverdagen, for eksempel dagligvare, barn og oppvekst eller turmuligheter?";

function scriptedAnswer(fixture: BoligFixture, result: ToolResult): string {
  if (result.kind === "topic") {
    const label = TOPICS.find(t => t.id === result.topic)?.label ?? result.topic;
    const nearest = result.places[0];
    const walk = nearest?.walk_min != null ? ` ${nearest.walk_min} minutter å gå` : "";
    const seller = result.seller[0] ? ` Selgeren forteller: ${result.seller[0].text}` : "";
    const unknown = result.unknowns[0] ? ` ${result.unknowns[0].answer}` : "";
    const lead = result.summary ?? `Om ${label.toLowerCase()} rundt boligen:`;
    const near = nearest ? ` Nærmest er ${nearest.name},${walk}.` : "";
    return `[Simulert svar] ${lead}${near}${seller}${unknown} Vil du vite mer om et av stedene?`;
  }
  if (result.kind === "place") {
    const fact = result.place.facts[0]?.text ?? "";
    const walk = result.place.walk_min != null ? ` Det er ${result.place.walk_min} minutter å gå.` : "";
    return `[Simulert svar] ${result.place.name} er ${result.place.kind.toLowerCase()}. ${fact}${walk}`;
  }
  if (result.kind === "error") return `[Simulert svar] ${result.error}`;
  return "[Simulert svar] Det har jeg ikke grunnlag for å si noe om.";
}

export function useSimulatedSession(fixture: BoligFixture): VoiceSession {
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [muted, setMuted] = useState(false);
  const [activeTopic, setActiveTopic] = useState<TopicId | null>(null);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const turn = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const live = useRef(false);

  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  const later = useCallback((ms: number, fn: () => void) => { const t = setTimeout(fn, ms); timers.current.push(t); }, []);

  const speak = useCallback((myTurn: number, text: string, extra: Block[]) => {
    if (!live.current || myTurn !== turn.current) return;
    const id = `sim-answer-${myTurn}`;
    setBlocks(previous => mergeBlocks(previous, extra));
    setStatus("speaking");
    const words = text.split(" ");
    words.forEach((word, index) => later(index * 45, () => {
      if (!live.current || myTurn !== turn.current) return;
      setBlocks(previous => upsertAnswer(previous, id, myTurn, (index ? " " : "") + word, index === words.length - 1));
      if (index === words.length - 1) setStatus("listening");
    }));
  }, [later]);

  const respond = useCallback((userText: string | null, result: ToolResult, callId: string) => {
    clearTimers();
    turn.current += 1;
    const myTurn = turn.current;
    setBlocks(previous => {
      const settled = previous.map(b => b.kind === "answer" && !b.done ? { ...b, done: true } : b);
      return userText ? [...settled, { id: `sim-user-${myTurn}`, turn: myTurn, kind: "user", text: userText }] : settled;
    });
    setStatus("thinking");
    later(600, () => speak(myTurn, scriptedAnswer(fixture, result), blocksFromToolResult(result, myTurn, callId)));
  }, [clearTimers, fixture, later, speak]);

  const start = useCallback(() => {
    clearTimers();
    live.current = true;
    turn.current += 1;
    const myTurn = turn.current;
    setBlocks([]);
    setActiveTopic(null);
    setSelectedPlaceId(null);
    setMuted(false);
    setStatus("connecting");
    later(500, () => speak(myTurn, GREETING, []));
  }, [clearTimers, later, speak]);

  const stop = useCallback(() => {
    clearTimers();
    live.current = false;
    turn.current += 1;
    setBlocks(previous => previous.map(b => b.kind === "answer" && !b.done ? { ...b, done: true } : b));
    setStatus("idle");
    setMuted(false);
  }, [clearTimers]);

  const interrupt = useCallback(() => {
    if (!live.current) return;
    clearTimers();
    turn.current += 1;
    setBlocks(previous => previous.map(b => b.kind === "answer" && !b.done ? { ...b, done: true } : b));
    setStatus("listening");
  }, [clearTimers]);

  const tapCategory = useCallback((topic: TopicId) => {
    if (!live.current) return;
    setActiveTopic(topic);
    setSelectedPlaceId(null);
    const prompt = TOPICS.find(t => t.id === topic)?.tapPrompt ?? topic;
    respond(prompt, topicResult(fixture, topic), `sim-topic-${topic}-${turn.current + 1}`);
  }, [fixture, respond]);

  const selectPlace = useCallback((placeId: string) => {
    setSelectedPlaceId(placeId);
    if (!live.current) return;
    const place = fixture.places.find(p => p.id === placeId);
    respond(place ? `Fortell om ${place.name}` : null, placeResult(fixture, placeId), `sim-place-${placeId}-${turn.current + 1}`);
  }, [fixture, respond]);

  const clearSelection = useCallback(() => setSelectedPlaceId(null), []);
  const toggleMute = useCallback(() => setMuted(m => !m), []);

  return useMemo<VoiceSession>(() => ({
    status, blocks, error: null, notice: "Simulering: lokale, forhåndsskrevne svar. Ikke ekte tale.", muted, activeTopic, selectedPlaceId, simulated: true, usage: null,
    start, stop, interrupt, toggleMute, tapCategory, selectPlace, clearSelection,
  }), [status, blocks, muted, activeTopic, selectedPlaceId, start, stop, interrupt, toggleMute, tapCategory, selectPlace, clearSelection]);
}
