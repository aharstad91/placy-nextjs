"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, AudioLines, ChevronDown, ExternalLink, Keyboard, LoaderCircle, MapPin, Mic, MicOff, RotateCcw, Square } from "lucide-react";
import { useBoard } from "@/components/variants/report/board/board-state";
import { AREA_STEP, useStoryTour } from "@/components/variants/report/board/story/story-tour";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { boardRealtimeTools, executeBoardTool } from "@/lib/realtime/board-tools";
import { useRealtime } from "@/lib/realtime/use-realtime";
import { cn } from "@/lib/utils";

import type { RealtimeReference } from "@/lib/realtime/types";

const suggestions = ["Hvor kan jeg ta kaffe?", "Vis meg kunst og kultur", "Hva skjer langs promenaden?"];
const statusLabels = {
  idle: "Klar når du er",
  connecting: "Kobler til Placy …",
  listening: "Klar for spørsmålet ditt",
  thinking: "Placy undersøker …",
  speaking: "Placy svarer",
  error: "Samtalen er stoppet",
};

function safeSourceUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function checkedLabel(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? null
    : `Kontrollert ${new Intl.DateTimeFormat("nb-NO", { day: "numeric", month: "short", year: "numeric" }).format(date)}`;
}

export function BoardVoiceAssistant({ compact = false }: { compact?: boolean }) {
  const { data, state, dispatch, mapCamera } = useBoard();
  const story = useStoryTour();
  const pauseTour = useAudioTourStore((s) => s.pause);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(!compact);
  const [showHistory, setShowHistory] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const assistantRef = useRef<HTMLElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

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

  const realtime = useRealtime({
    instructions: "",
    tools: boardRealtimeTools,
    getContext: () => JSON.stringify({ selected_category_id: story.stop ? String(story.stop.id) : state.activeCategoryId, selected_place_id: state.activePOIId, travel_mode: state.travelMode }),
    executeTool: runBoardTool,
    serverControlled: true,
    snapshotId: data.demoSnapshotId,
  });
  const connected = !["idle", "error", "connecting"].includes(realtime.status);
  const running = connected || realtime.status === "connecting";
  const messages = realtime.messages.filter((message) => message.role !== "tool");
  const references = realtime.references;
  const latestMessage = messages.at(-1);
  const error = mapError ?? realtime.error;

  useEffect(() => {
    if (!connected) return;
    const manualClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !assistantRef.current?.contains(event.target)) realtime.interruptForMap();
    };
    document.addEventListener("click", manualClick, true);
    return () => document.removeEventListener("click", manualClick, true);
  }, [connected, realtime.interruptForMap]);

  useEffect(() => {
    if (showHistory && transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [realtime.messages, showHistory]);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  const prepareBoard = () => {
    setExpanded(true);
    pauseTour("manual");
    dispatch({ type: "END_INTRO" });
  };

  const chooseMode = (mode: "voice" | "text") => {
    if (realtime.status === "connecting") return;
    prepareBoard();
    if (connected) void realtime.switchMode(mode);
    else void realtime.start({ mode });
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || realtime.status === "connecting") return;
    prepareBoard();
    if (!connected) void realtime.start({ mode: "text", initialText: trimmed });
    else realtime.sendText(trimmed);
    setInput("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  const showPlace = (reference: RealtimeReference) => {
    if (!reference.mapPoiId) return;
    realtime.interruptForMap();
    const result = runBoardTool("show_place", { poi_id: reference.mapPoiId });
    setMapError("error" in result && typeof result.error === "string" ? result.error : null);
  };

  const startNewConversation = () => {
    setMapError(null);
    runBoardTool("reset_board", {});
    void realtime.newConversation({ mode: "text" });
  };

  const statusText = realtime.status === "listening" && realtime.mode === "text"
    ? "Tekst er på · mikrofonen er av"
    : realtime.status === "listening" && realtime.mode === "voice" && realtime.muted
      ? "Mikrofonen er av · du kan fortsatt skrive"
      : statusLabels[realtime.status];

  if (!data.demoSnapshotId) return null;

  return (
    <section ref={assistantRef} aria-label="Placy-assistent" className="my-4 overflow-hidden rounded-[20px] border border-[#d8e5df] bg-[#f3f8f5] text-[#173b31]" data-testid="board-voice-assistant">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", running ? "bg-[#215d48] text-white" : "bg-white text-[#215d48]")}>
          {realtime.status === "connecting" ? <LoaderCircle size={19} className="animate-spin" /> : <AudioLines size={20} className={cn(realtime.status === "speaking" && "motion-safe:animate-pulse")} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-5">{compact ? <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex items-center gap-1.5">Utforsk med Placy<ChevronDown size={13} className={cn(expanded && "rotate-180")} /></button> : "Utforsk med Placy"}</h3>
          <p role="status" aria-live="polite" className="mt-0.5 text-[11px] leading-4 text-[#4e6c60]">{realtime.notice ?? statusText}</p>
        </div>
        {(running || messages.length > 0) && !error && <button type="button" disabled={realtime.status === "connecting"} onClick={startNewConversation} aria-label="Ny samtale" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#215d48] transition hover:bg-[#e3eee8]"><RotateCcw size={15} /></button>}
      </div>

      {expanded && <>
        {!messages.length && !running && !error && <div className="px-3.5 pb-3">
          <p className="text-[12px] leading-[1.55] text-[#496256]">Spør om kaféer, kultur, parker eller promenaden. Placy kan vise omtalte steder i kartet.</p>
          <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Velg hvordan du vil starte">
            <button type="button" onClick={() => chooseMode("text")} aria-label="Start med tekst" className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#b9cec3] bg-white px-3 text-[12px] font-semibold transition hover:border-[#709987]"><Keyboard size={15} />Skriv</button>
            <button type="button" onClick={() => chooseMode("voice")} aria-label="Start med tale" className="flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#215d48] px-3 text-[12px] font-semibold text-white transition hover:bg-[#173b31]"><Mic size={15} />Snakk</button>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {suggestions.map((prompt) => <button key={prompt} data-testid="start-suggestion" type="button" onClick={() => send(prompt)} className="rounded-full border border-[#d7e3dc] bg-white/80 px-2.5 py-1.5 text-left text-[11px] transition hover:border-[#709987] hover:bg-white">{prompt}</button>)}
          </div>
          <p className="mt-2 text-[10px] leading-4 text-[#698174]">Mikrofonen starter først når du velger Snakk. Stemme: Ash.</p>
        </div>}

        {error && <div ref={alertRef} tabIndex={-1} role="alert" className="mx-3.5 mb-3 rounded-xl bg-white px-3 py-2.5 text-[12px] leading-5 text-[#944d38] outline-none">
          <p>{error}</p>
          <p className="mt-1 text-[#5b665f]">Kartet virker fortsatt. Du kan fortsette med tekst eller starte på nytt.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => chooseMode("text")} className="rounded-full bg-[#215d48] px-3 py-1.5 font-semibold text-white">Fortsett med tekst</button>
            <button type="button" onClick={startNewConversation} className="rounded-full border border-[#d7e3dc] px-3 py-1.5 font-semibold text-[#215d48]">Ny samtale</button>
          </div>
        </div>}

        {latestMessage && !showHistory && <div className="mx-3.5 mb-2 rounded-xl bg-white/90 px-3 py-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#698174]">{latestMessage.role === "user" ? "Du" : "Placy"}</p>
          <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[12px] leading-[1.6] text-[#294c3b]">{latestMessage.text}</p>
        </div>}

        {showHistory && messages.length > 0 && <div ref={transcriptRef} aria-label="Samtalehistorikk" className="mx-3.5 mb-2 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-white/90 px-3 py-2.5">
          {messages.map((message) => <div key={message.id}><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#698174]">{message.role === "user" ? "Du" : "Placy"}</p><p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-[1.6] text-[#294c3b]">{message.text}</p></div>)}
        </div>}

        {references.length > 0 && <div aria-label="Steder og kilder" className="mx-3.5 mb-2 max-h-48 overflow-y-auto space-y-2 rounded-xl border border-[#dce8e1] bg-white/75 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#698174]">Steder og kilder i samtalen</p>
          {references.map((reference) => <div key={reference.id} className="border-t border-[#e4ece7] pt-2 first:border-0 first:pt-0">
            {reference.mapPoiId ? <button type="button" onClick={() => showPlace(reference)} aria-label={`Vis ${reference.name} i kartet`} className="flex min-h-8 w-full items-center gap-2 text-left text-[12px] font-semibold text-[#215d48] hover:underline"><MapPin size={14} className="shrink-0" />{reference.name}</button> : <div><p className="text-[12px] font-semibold text-[#294c3b]">{reference.name}</p><p className="mt-0.5 text-[10px] text-[#788b81]">Ikke plassert i kartet</p></div>}
            {reference.sources?.length ? <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#698174]">{reference.sources.map((source, index) => {
              const url = safeSourceUrl(source.url);
              const label = source.label ?? source.title ?? source.page ?? "Kilde";
              const checked = checkedLabel(source.checkedAt);
              return <span key={source.id ?? `${reference.id}-${index}`} className="inline-flex flex-wrap items-center gap-1">{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-[#a9bbb1] underline-offset-2">{label}<ExternalLink size={10} /></a> : <span>{label}</span>}{checked && <span className="text-[#89998f]">· {checked}</span>}</span>;
            })}</div> : null}
          </div>)}
        </div>}

        {running && <div className="mx-3.5 mb-2 grid grid-cols-2 gap-1 rounded-xl bg-[#e2ece6] p-1" aria-label="Samtalemodus">
          <button type="button" disabled={realtime.status === "connecting"} onClick={() => chooseMode("text")} aria-label="Bytt til tekst" aria-pressed={realtime.mode === "text"} className={cn("flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold", realtime.mode === "text" ? "bg-white shadow-sm" : "text-[#557066]")}><Keyboard size={13} />Skriv</button>
          <button type="button" disabled={realtime.status === "connecting"} onClick={() => chooseMode("voice")} aria-label="Bytt til tale" aria-pressed={realtime.mode === "voice"} className={cn("flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold", realtime.mode === "voice" ? "bg-white shadow-sm" : "text-[#557066]")}><Mic size={13} />Snakk</button>
        </div>}

        <div className="flex items-center gap-1 px-2.5 pb-2.5">
          {connected && realtime.mode === "voice" && <button type="button" onClick={realtime.toggleMute} aria-label={realtime.muted ? "Slå på mikrofon" : "Slå av mikrofon"} aria-pressed={realtime.muted} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[#dfeae3]">{realtime.muted ? <MicOff size={15} /> : <Mic size={15} />}</button>}
          {realtime.status === "speaking" && <button type="button" onClick={realtime.interrupt} aria-label="Avbryt svaret" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[#dfeae3]"><Square size={12} /></button>}
          {running && <button type="button" onClick={realtime.stop} className="rounded-full px-2 py-1.5 text-[11px] text-[#557066] transition hover:bg-[#dfeae3]">Avslutt</button>}
          {messages.length > 0 && <button type="button" onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1.5 text-[10px] transition hover:bg-[#dfeae3]">Samtalen<ChevronDown size={12} className={cn(showHistory && "rotate-180")} /></button>}
        </div>

        {(running || realtime.mode === "text" || Boolean(error)) && <form onSubmit={submit} className="mx-3.5 mb-3 flex items-center gap-2 rounded-xl border border-[#d7e3dc] bg-white py-1.5 pl-3 pr-1.5 focus-within:ring-2 focus-within:ring-[#709987]">
          <input aria-label="Spør Placy" placeholder="Hva lurer du på?" value={input} maxLength={2000} onChange={(event) => setInput(event.target.value)} className="min-w-0 flex-1 bg-transparent py-1 text-[12px] text-[#173b31] outline-none placeholder:text-[#7b8e84]" />
          <button type="submit" disabled={!input.trim() || realtime.status === "connecting"} aria-label="Send spørsmål" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#215d48] text-white transition hover:bg-[#173b31] disabled:opacity-35"><ArrowUp size={15} /></button>
        </form>}

        {realtime.usage.responses > 0 && <details className="px-3.5 pb-2 text-[10px] leading-4 text-[#698174]"><summary className="cursor-pointer">Forbruk denne samtalen{realtime.usage.complete ? ` · ca. $${realtime.usage.estimatedUsd.toFixed(4)}` : ""}</summary><p>{realtime.usage.model} · {realtime.usage.responses} modellrunder</p><p>{realtime.usage.inputTokens.toLocaleString("nb-NO")} inn / {realtime.usage.outputTokens.toLocaleString("nb-NO")} ut · {realtime.usage.cachedTokens.toLocaleString("nb-NO")} gjenbrukte tokens</p></details>}
        <div className="border-t border-[#dfe9e2] px-3.5 py-1.5 text-[9px] leading-4 text-[#7c9083]">AI-stemme · samtale og boardinnhold behandles av OpenAI</div>
      </>}
    </section>
  );
}
