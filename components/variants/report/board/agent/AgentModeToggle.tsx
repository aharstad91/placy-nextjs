"use client";

import { useEffect, useRef } from "react";
import type { AgentMode } from "@/lib/board-agent/types";
import { cn } from "@/lib/utils";

/**
 * Sidebarens to flater som én segmentert veksler: «Utforsk» / «Spør <navn>»
 * (U3, 2026-09-25). Presentasjonell — modusen selv eies av koordinatoren.
 *
 * `role="radiogroup"` med to `role="radio"`: gruppen er ÉN tab-stopp (kun det
 * valgte alternativet har `tabIndex 0`, det roving-mønsteret WAI-ARIA ber om),
 * piltastene bytter valg OG flytter fokus mellom dem, Enter/Space er knappens
 * egen native oppførsel siden hvert alternativ er et ekte `<button>`.
 *
 * På mobil bor veksleren i to ulike sheets (utforsking og samtale), så et
 * bytte monterer en NY veksler og fokuset ville falt til `<body>`. Byttet
 * husker derfor at fokus var her, og den nye veksleren tar det imot.
 */

let refocusAfterSwitch = false;

const OPTIONS: ReadonlyArray<{ mode: AgentMode; label: (name: string) => string }> = [
  { mode: "explore", label: () => "Utforsk" },
  { mode: "agent", label: (name) => `Spør ${name}` },
];

export interface AgentModeToggleProps {
  mode: AgentMode;
  onChange: (mode: AgentMode) => void;
  /** Guidens navn — brukt i «Spør <navn>». */
  name: string;
  className?: string;
}

export function AgentModeToggle({ mode, onChange, name, className }: AgentModeToggleProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!refocusAfterSwitch) return;
    refocusAfterSwitch = false;
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) return;
    optionRefs.current[OPTIONS.findIndex((option) => option.mode === mode)]?.focus();
    // Bare ved montering: en veksler som blir stående beholder fokuset selv.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (next: AgentMode) => {
    if (next !== mode) {
      refocusAfterSwitch = true;
      // Står veksleren (desktop), er det ingen ny veksler som skal ta imot.
      setTimeout(() => { refocusAfterSwitch = false; }, 400);
    }
    onChange(next);
  };

  const moveFocus = (fromIndex: number, direction: 1 | -1) => {
    const nextIndex = (fromIndex + direction + OPTIONS.length) % OPTIONS.length;
    select(OPTIONS[nextIndex].mode);
    optionRefs.current[nextIndex]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Sidebarens modus"
      className={cn(
        "inline-flex w-full items-center gap-0.5 rounded-full bg-stone-100 p-1",
        className,
      )}
    >
      {OPTIONS.map((option, index) => {
        const checked = option.mode === mode;
        return (
          <button
            key={option.mode}
            ref={(el) => {
              optionRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => select(option.mode)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                moveFocus(index, 1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                moveFocus(index, -1);
              }
            }}
            className={cn(
              "flex-1 truncate rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors duration-150",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400",
              checked ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-800",
            )}
          >
            {option.label(name)}
          </button>
        );
      })}
    </div>
  );
}
