"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, AudioLines, ChevronDown, Keyboard, LoaderCircle, Mic, MicOff, Power, Square } from "lucide-react";
import { useBoard } from "@/components/variants/report/board/board-state";
import { AREA_STEP, useStoryTour } from "@/components/variants/report/board/story/story-tour";
import { useAudioTourStore } from "@/lib/stores/audio-tour-store";
import { useRealtime } from "@/lib/realtime/use-realtime";
import { boardRealtimeContext, boardRealtimeInstructions, boardRealtimeTools, executeBoardTool } from "@/lib/realtime/board-tools";
import { cn } from "@/lib/utils";

const statusLabels = {
  idle: "Spør om livet på Nyhavna",
  connecting: "Kobler til …",
  listening: "Jeg lytter",
  thinking: "Ser nærmere på det …",
  speaking: "Placy snakker",
  error: "Kunne ikke koble til",
};

export function BoardVoiceAssistant({ compact = false }: { compact?: boolean }) {
  const { data, state, dispatch, mapCamera } = useBoard();
  const story = useStoryTour();
  const pauseTour = useAudioTourStore((s) => s.pause);
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState(!compact);
  const [sessionMode, setSessionMode] = useState<"voice" | "text">("voice");
  const [showText, setShowText] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const realtime = useRealtime({
    instructions: boardRealtimeInstructions(data),
    tools: boardRealtimeTools,
    getContext: () => JSON.stringify(boardRealtimeContext(data, state, story.stop ? String(story.stop.id) : null)),
    executeTool: (name, args) => executeBoardTool(name, args, {
      data, state, dispatch, mapCamera,
      onCategory: (index) => story.begin(index),
      onReset: () => story.begin(AREA_STEP),
    }),
  });
  const connected = !["idle", "error", "connecting"].includes(realtime.status);
  const running = connected || realtime.status === "connecting";
  const messages = realtime.messages.filter((m) => m.role !== "tool");
  const latestMessage = messages.at(-1);

  useEffect(() => {
    if (showHistory && transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [realtime.messages, showHistory]);

  const start = (mode: "voice" | "text", initialText?: string) => {
    setExpanded(true);
    setSessionMode(mode);
    pauseTour("manual");
    dispatch({ type: "END_INTRO" });
    void realtime.start({ mode, initialText });
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || realtime.status === "connecting") return;
    if (!connected) start("text", trimmed);
    else realtime.sendText(trimmed);
    setInput("");
    setShowText(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(input);
  };

  return (
    <section aria-label="Placy stemmeassistent" className="my-4 overflow-hidden rounded-[20px] border border-[#d8e5df] bg-[#f3f8f5] text-[#173b31]" data-testid="board-voice-assistant">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", running ? "bg-[#215d48] text-white" : "bg-white text-[#215d48]")}>
          {realtime.status === "connecting" ? <LoaderCircle size={19} className="animate-spin" /> : <AudioLines size={20} className={cn(realtime.status === "speaking" && "motion-safe:animate-pulse")} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold leading-5">{compact ? <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} className="flex items-center gap-1.5">Snakk med Placy<ChevronDown size={13} className={cn(expanded && "rotate-180")} /></button> : "Snakk med Placy"}</h3>
          <p role="status" className="mt-0.5 text-[11px] leading-4 text-[#4e6c60]">{connected && sessionMode === "text" && realtime.status === "listening" ? "Skriv til meg · mikrofonen er av" : connected && sessionMode === "voice" && realtime.muted ? "Mikrofon av · skriv eller slå på" : statusLabels[realtime.status]}</p>
        </div>
        <button type="button" role="switch" aria-checked={running} aria-label={running ? "Slå av stemmeassistent" : "Slå på stemmeassistent"} onClick={() => running ? realtime.stop() : start("voice")} className={cn("flex h-8 w-14 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#215d48]", running ? "justify-end bg-[#215d48]" : "justify-start bg-[#d8e3dd]")}>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm"><Power size={12} /></span>
        </button>
      </div>

      {expanded && <>
      {!running && !latestMessage && !realtime.error && (
        <div className="px-3.5 pb-3">
          <p className="text-[12px] leading-[1.55] text-[#496256]">Spør om området. Jeg viser deg stedene mens vi snakker.</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {["Hva skjer på Nyhavna?", "Vis meg kulturlivet"].map((prompt) => (
              <button key={prompt} type="button" onClick={() => send(prompt)} className="rounded-full border border-[#d7e3dc] bg-white/80 px-2.5 py-1.5 text-[11px] transition hover:border-[#709987] hover:bg-white">{prompt}</button>
            ))}
          </div>
        </div>
      )}

      {realtime.error && <p role="alert" className="mx-3.5 mb-3 rounded-xl bg-white px-3 py-2.5 text-[12px] leading-5 text-[#944d38]">{realtime.error}</p>}

      {latestMessage && !showHistory && (
        <div className="mx-3.5 mb-2 rounded-xl bg-white/90 px-3 py-2.5">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#698174]">{latestMessage.role === "user" ? "Du" : "Placy"}</p>
          <p className="max-h-28 overflow-y-auto whitespace-pre-wrap text-[12px] leading-[1.6] text-[#294c3b]">{latestMessage.text}</p>
        </div>
      )}

      {showHistory && messages.length > 0 && (
        <div ref={transcriptRef} aria-label="Samtalehistorikk" className="mx-3.5 mb-2 max-h-48 space-y-2 overflow-y-auto rounded-xl bg-white/90 px-3 py-2.5">
          {messages.map((message) => <div key={message.id}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#698174]">{message.role === "user" ? "Du" : "Placy"}</p>
            <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-[1.6] text-[#294c3b]">{message.text}</p>
          </div>)}
        </div>
      )}

      <div className="flex items-center gap-1 px-2.5 pb-2.5">
        {connected && sessionMode === "voice" && <button type="button" onClick={realtime.toggleMute} aria-label={realtime.muted ? "Slå på mikrofon" : "Slå av mikrofon"} aria-pressed={realtime.muted} className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[#dfeae3]">{realtime.muted ? <MicOff size={15} /> : <Mic size={15} />}</button>}
        {realtime.status === "speaking" && <button type="button" onClick={realtime.interrupt} aria-label="Avbryt svaret" className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-[#dfeae3]"><Square size={12} /></button>}
        <button type="button" onClick={() => setShowText((value) => !value)} aria-expanded={showText} className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] transition hover:bg-[#dfeae3]"><Keyboard size={14} />Skriv et spørsmål</button>
        {messages.length > 0 && <button type="button" onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1.5 text-[10px] transition hover:bg-[#dfeae3]">Samtalen<ChevronDown size={12} className={cn(showHistory && "rotate-180")} /></button>}
      </div>

      {showText && <form onSubmit={submit} className="mx-3.5 mb-3 flex items-center gap-2 rounded-xl border border-[#d7e3dc] bg-white pl-3 pr-1.5 py-1.5 focus-within:ring-2 focus-within:ring-[#709987]">
        <input aria-label="Spør Placy" placeholder="Hva lurer du på?" value={input} maxLength={2000} onChange={(event) => setInput(event.target.value)} className="min-w-0 flex-1 bg-transparent py-1 text-[12px] text-[#173b31] outline-none placeholder:text-[#7b8e84]" />
        <button type="submit" disabled={!input.trim() || realtime.status === "connecting"} aria-label="Send spørsmål" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#215d48] text-white transition hover:bg-[#173b31] disabled:opacity-35"><ArrowUp size={15} /></button>
      </form>}
      {realtime.usage.responses > 0 && <details className="px-3.5 pb-2 text-[10px] leading-4 text-[#698174]">
        <summary className="cursor-pointer">Forbruk denne samtalen{realtime.usage.complete ? ` · ca. $${realtime.usage.estimatedUsd.toFixed(4)}` : ""}</summary>
        <p>{realtime.usage.model} · {realtime.usage.responses} modellrunder</p>
        <p>{realtime.usage.inputTokens.toLocaleString("nb-NO")} inn / {realtime.usage.outputTokens.toLocaleString("nb-NO")} ut · {realtime.usage.cachedTokens.toLocaleString("nb-NO")} gjenbrukte tokens</p>
        <p>Estimat for modellens svar, uten separat taletranskripsjon. Endelig beløp i OpenAI. Nullstilles ved ny samtale.</p>
      </details>}
      <div className="border-t border-[#dfe9e2] px-3.5 py-1.5 text-[9px] leading-4 text-[#7c9083]">AI-stemme · samtale og boardinnhold behandles av OpenAI</div>
      </>}
    </section>
  );
}
