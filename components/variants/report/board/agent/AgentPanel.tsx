"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import type { KeyboardEvent } from "react";
import { ArrowUp, ChevronRight, Mic, MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BOARD_CHAT_MESSAGE_MAX,
  type AgentEntry,
  type AgentInput,
  type AgentSuggestion,
} from "@/lib/board-agent/types";

/**
 * Samtaleflaten for boardets agentmodus «Spør Anja» (U3, 2026-09-25) — rene
 * presentasjonskomponenter styrt av props. Tilstand, nettverk, kart og tale
 * eies av koordinatoren (`components/variants/report/board/agent/…`, bygges
 * av tech lead); dette panelet vet ikke hvor et innslag kom fra, bare hvordan
 * det skal se ut.
 *
 * Struktur: fast topp (valgfri), scrollende logg, fast composer nederst.
 * Loggen autoscroller til bunnen når nye innslag kommer og leseren FØLGER
 * samtalen — men ikke hvis hun har scrollet opp for å lese noe tidligere; da
 * vises i stedet en liten «Nye meldinger ↓»-knapp.
 */

const MAX_TEXTAREA_PX = 104; // ~4 linjer ved 16px/1.5
const BOTTOM_THRESHOLD_PX = 32;

export interface AgentPanelProps {
  /** Guidens navn, f.eks. «Anja». */
  name: string;
  entries: AgentEntry[];
  /** Vises som klikkbare chips under siste innslag, og i tom tilstand. */
  suggestions: AgentSuggestion[];
  input: AgentInput;
  onInputChange: (input: AgentInput) => void;
  /** Skriv (og tekst under aktiv tale). */
  onSend: (text: string) => void;
  onSuggestion: (suggestion: AgentSuggestion) => void;
  /** «Ikke nå» / lukk-knapp på forslagsraden. */
  onDismissSuggestions: () => void;
  /** Trykk på et stedskort → kartet fokuserer igjen. */
  onPlaceFocus: (poiId: string) => void;
  /** Et tekstsvar er på vei: send deaktivert, skriving tillatt. */
  busy: boolean;
  /** Rendres i Snakk-modus over composeren (status/mikrofon/avslutt — BoardVoiceControl). */
  voiceSlot?: React.ReactNode;
  /** Valgfri fast slot øverst i panelet, over loggen. */
  topSlot?: React.ReactNode;
  emptyTitle: string;
  emptyBody: string;
  /** Desktopkolonne vs. mobil-sheet. */
  variant: "column" | "sheet";
  className?: string;
}

function reducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function formatSourceDate(checkedAt: string): string {
  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) return checkedAt;
  return date.toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

/** Diskret markør på tale-innslag (`via: "voice"`) — ingen tekst, bare et lite ikon. */
function VoiceMark() {
  return <Mic size={11} aria-hidden className="mr-1 inline-block shrink-0 translate-y-[-1px] opacity-60" />;
}

function SuggestionChips({
  suggestions,
  onSuggestion,
  onDismissSuggestions,
}: {
  suggestions: AgentSuggestion[];
  onSuggestion: (suggestion: AgentSuggestion) => void;
  onDismissSuggestions: () => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.key}
          type="button"
          data-testid="agent-suggestion"
          onClick={() => onSuggestion(suggestion)}
          className="rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-[13px] font-medium text-stone-800 transition-colors duration-150 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
        >
          {suggestion.label}
        </button>
      ))}
      <button
        type="button"
        data-testid="agent-suggestions-dismiss"
        aria-label="Ikke nå"
        onClick={onDismissSuggestions}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-900/[0.05] hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-400"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

/** Brukerens eget initiativ — skrevet, sagt, et FAQ-spørsmål eller et tema. */
function OutgoingBubble({ children }: { children: ReactNode }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-stone-900 px-4 py-2.5 text-[14px] leading-[1.5] text-white">
      <p className="whitespace-pre-wrap break-words">{children}</p>
    </div>
  );
}

/**
 * Ett innslag. Memoisert: talen oppdaterer siste innslag for hvert ord, og
 * resten av historikken skal ikke rendre på nytt for det.
 */
const EntryRow = memo(function EntryRow({
  entry,
  onPlaceFocus,
}: {
  entry: AgentEntry;
  onPlaceFocus: (poiId: string) => void;
}) {
  switch (entry.kind) {
    case "user":
      return (
        <OutgoingBubble>
          {entry.via === "voice" && <VoiceMark />}
          {entry.text}
        </OutgoingBubble>
      );

    case "assistant":
      return (
        <div className="mr-auto max-w-[85%] rounded-2xl rounded-bl-md bg-stone-100 px-4 py-2.5 text-[14px] leading-[1.5] text-stone-900">
          <p className="whitespace-pre-wrap break-words">
            {entry.via === "voice" && <VoiceMark />}
            {entry.text}
          </p>
          {entry.links && entry.links.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {entry.links.map((link) => (
                <a
                  key={link.id}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="break-words text-[13px] font-medium text-stone-700 underline decoration-stone-400 underline-offset-2 hover:text-stone-900"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
          {entry.sources && entry.sources.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 border-t border-stone-300/60 pt-2">
              {entry.sources.map((source) => (
                <li key={source.id} className="break-words text-[11.5px] leading-[1.4] text-stone-500">
                  Kilde: {source.label} · kontrollert {formatSourceDate(source.checkedAt)}
                </li>
              ))}
            </ul>
          )}
          {entry.notice && (
            <p className="mt-2 break-words text-[12px] leading-[1.4] text-amber-700">{entry.notice}</p>
          )}
        </div>
      );

    case "place": {
      return (
        <button
          type="button"
          data-testid="agent-place-entry"
          onClick={() => onPlaceFocus(entry.poiId)}
          className="mr-auto flex w-full max-w-[85%] items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-400"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-200 text-stone-600"
          >
            <MapPin size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-stone-900">{entry.name}</span>
            {entry.categoryLabel && (
              <span className="block truncate text-[12.5px] text-stone-500">{entry.categoryLabel}</span>
            )}
          </span>
          <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
        </button>
      );
    }

    case "faq":
      return <OutgoingBubble>{entry.question}</OutgoingBubble>;

    case "theme":
      return <OutgoingBubble>{entry.label}</OutgoingBubble>;

    case "pending":
      return (
        <div
          data-testid="agent-pending"
          role="status"
          aria-live="polite"
          aria-label="Svaret er på vei"
          className="mr-auto flex items-center gap-1 rounded-2xl rounded-bl-md bg-stone-100 px-4 py-3"
        >
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              aria-hidden
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400"
              style={{ animationDelay: `${dot * 120}ms` }}
            />
          ))}
        </div>
      );

    case "status": {
      const isError = entry.tone === "error";
      return (
        <p
          data-testid="agent-status"
          role={isError ? "alert" : "status"}
          className={cn(
            "mx-auto max-w-[90%] break-words rounded-full px-3.5 py-1.5 text-center text-[12.5px] font-medium",
            isError ? "bg-rose-50 text-rose-700" : "bg-stone-100 text-stone-500",
          )}
        >
          {entry.text}
        </p>
      );
    }

    default:
      return null;
  }
});

export function AgentPanel({
  name,
  entries,
  suggestions,
  input,
  onInputChange,
  onSend,
  onSuggestion,
  onDismissSuggestions,
  onPlaceFocus,
  busy,
  voiceSlot,
  topSlot,
  emptyTitle,
  emptyBody,
  variant,
  className,
}: AgentPanelProps) {
  const logRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  // Siste innslag, etter identitet: feeden bytter det ut (svar på vei -> svar)
  // og lar det vokse (talen transkriberes ord for ord) uten at lengden endres.
  const tail = entries[entries.length - 1];
  const prevFeed = useRef({ count: entries.length, tail });

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const el = logRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  // Nye eller voksende innslag: følg automatisk hvis leseren allerede sto
  // nederst, ellers varsle med knappen i stedet for å rive henne bort fra det
  // hun leser. Et nytt innslag glir; et innslag som vokser følger uten
  // animasjon, så teksten ikke rykker for hvert ord.
  useEffect(() => {
    const grew = entries.length !== prevFeed.current.count;
    const changed = tail !== prevFeed.current.tail;
    prevFeed.current = { count: entries.length, tail };
    if (!grew && !changed) return;
    if (atBottom) {
      scrollToBottom(grew && !reducedMotion() ? "smooth" : "auto");
    } else {
      setHasNewBelow(true);
    }
    // atBottom leses med vilje kun ved endringstidspunktet, ikke som dependency —
    // ellers ville en scroll-drevet oppdatering av atBottom trigget denne på nytt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, tail]);

  const handleScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD_PX;
    setAtBottom(nearBottom);
    if (nearBottom) setHasNewBelow(false);
  };

  const jumpToBottom = () => {
    scrollToBottom(reducedMotion() ? "auto" : "smooth");
    setAtBottom(true);
    setHasNewBelow(false);
  };

  const trailingSuggestions = entries.length > 0 && suggestions.length > 0;

  return (
    <div
      data-testid="agent-panel"
      data-variant={variant}
      className={cn(
        "flex h-full min-h-0 flex-col",
        // column: ligger i kolonnens egen boks og skal lese som SAMME flate
        // (Nyhavnas kremtone e.l.) — ingen egen bakgrunn her. sheet: egen
        // flate over kartet på mobil, og skal derfor være hvit.
        variant === "sheet" && "bg-white",
        className,
      )}
    >
      {topSlot}

      <div className="relative min-h-0 flex-1">
        <div
          ref={logRef}
          data-testid="agent-log"
          role="log"
          aria-live="polite"
          onScroll={handleScroll}
          className="flex h-full flex-col gap-3 overflow-y-auto px-4 py-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {entries.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
              <div>
                <p className="text-[15px] font-semibold text-stone-900">{emptyTitle}</p>
                <p className="mt-1 text-[13.5px] leading-[1.5] text-stone-500">{emptyBody}</p>
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.key}
                      type="button"
                      data-testid="agent-suggestion"
                      onClick={() => onSuggestion(suggestion)}
                      className="rounded-full border border-stone-300 bg-white px-3.5 py-1.5 text-[13px] font-medium text-stone-800 transition-colors duration-150 hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            entries.map((entry) => (
              <EntryRow key={entry.id} entry={entry} onPlaceFocus={onPlaceFocus} />
            ))
          )}

          {trailingSuggestions && (
            <SuggestionChips
              suggestions={suggestions}
              onSuggestion={onSuggestion}
              onDismissSuggestions={onDismissSuggestions}
            />
          )}
        </div>

        {hasNewBelow && (
          <button
            type="button"
            data-testid="agent-new-messages"
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-stone-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
          >
            Nye meldinger ↓
          </button>
        )}
      </div>

      <Composer
        name={name}
        input={input}
        onInputChange={onInputChange}
        onSend={onSend}
        busy={busy}
        voiceSlot={voiceSlot}
      />
    </div>
  );
}

function Composer({
  name,
  input,
  onInputChange,
  onSend,
  busy,
  voiceSlot,
}: Pick<AgentPanelProps, "name" | "input" | "onInputChange" | "onSend" | "busy" | "voiceSlot">) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  };

  useEffect(resize, [text]);

  const trySend = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      trySend();
    }
  };

  const canSend = text.trim().length > 0 && !busy;

  return (
    <div className="shrink-0 border-t border-stone-200 px-4 pb-4 pt-3">
      <div className="mb-2 flex items-center gap-1.5">
        <button
          type="button"
          data-testid="agent-input-write"
          aria-pressed={input === "write"}
          onClick={() => onInputChange("write")}
          className={cn(
            "rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors duration-150",
            input === "write" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
          )}
        >
          Skriv
        </button>
        <button
          type="button"
          data-testid="agent-input-talk"
          aria-pressed={input === "talk"}
          onClick={() => onInputChange("talk")}
          className={cn(
            "rounded-full px-3 py-1 text-[12.5px] font-semibold transition-colors duration-150",
            input === "talk" ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200",
          )}
        >
          Snakk
        </button>
      </div>

      {input === "talk" && voiceSlot && (
        <div data-testid="agent-voice-slot" className="mb-2">
          {voiceSlot}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          data-testid="agent-composer-input"
          aria-label={`Skriv en melding til ${name}`}
          value={text}
          maxLength={BOARD_CHAT_MESSAGE_MAX}
          placeholder={input === "talk" ? "Eller skriv …" : `Skriv til ${name} …`}
          rows={1}
          onChange={(event) => setText(event.target.value.slice(0, BOARD_CHAT_MESSAGE_MAX))}
          onKeyDown={handleKeyDown}
          className="max-h-[104px] min-h-[40px] flex-1 resize-none rounded-2xl border border-stone-300 bg-white px-3.5 py-2 text-[14px] leading-[1.5] text-stone-900 outline-none placeholder:text-stone-400 focus-visible:border-stone-500"
        />
        <button
          type="button"
          data-testid="agent-composer-send"
          aria-label="Send"
          disabled={!canSend}
          onClick={trySend}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ArrowUp size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
