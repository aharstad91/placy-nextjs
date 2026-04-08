"use client";

import { useState } from "react";
import {
  UtensilsCrossed,
  Palette,
  ShoppingBag,
  Bus,
  Dumbbell,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Theme definitions ────────────────────────────────────────────────────────

interface Theme {
  id: string;
  name: string;
  color: string;
  Icon: LucideIcon;
}

const THEMES: Theme[] = [
  { id: "food",      name: "Mat & Drikke",          color: "#ef4444", Icon: UtensilsCrossed },
  { id: "culture",   name: "Kultur & Opplevelser",  color: "#0ea5e9", Icon: Palette         },
  { id: "everyday",  name: "Hverdagsbehov",         color: "#22c55e", Icon: ShoppingBag     },
  { id: "transport", name: "Transport & Mobilitet", color: "#3b82f6", Icon: Bus             },
  { id: "fitness",   name: "Trening & Velvære",     color: "#ec4899", Icon: Dumbbell        },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface ExplorerOnboardingProps {
  projectName: string;
  tagline?: string;
  onConfirm: (selectedThemeIds: string[]) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExplorerOnboarding({
  projectName,
  tagline = "Oppdag hva som venter i nærområdet",
  onConfirm,
}: ExplorerOnboardingProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(THEMES.map((t) => t.id))
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const noneSelected = selected.size === 0;

  function handleConfirm() {
    if (noneSelected) return;
    onConfirm(Array.from(selected));
  }

  return (
    /*
     * Outer wrapper: full viewport, warm parchment background.
     * On mobile: flex column so sticky CTA can be pushed to bottom.
     * On desktop: centered card layout.
     */
    <div className="min-h-screen bg-[#faf9f7] flex flex-col items-center justify-between md:justify-center px-4 py-10 md:py-16">

      {/* ── Main content card ───────────────────────────────────────────── */}
      <div className="w-full max-w-lg flex flex-col gap-8">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header
          className="text-center"
          style={{ animation: "onboard-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          {/* Placy wordmark — small, uppercase, tracked */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#a0937d] mb-6 select-none">
            Placy
          </p>

          <h1 className="text-[clamp(1.6rem,5vw,2.25rem)] font-semibold leading-tight tracking-[-0.02em] text-[#1a1a1a]">
            {projectName}
          </h1>

          <p className="mt-2.5 text-[0.9375rem] text-[#6a6360] leading-relaxed">
            {tagline}
          </p>
        </header>

        {/* ── Theme selector ───────────────────────────────────────────── */}
        <section
          aria-label="Velg interesser"
          style={{ animation: "onboard-rise 0.5s 0.08s cubic-bezier(0.16, 1, 0.3, 1) both" }}
        >
          <fieldset className="border-none p-0 m-0">
            <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a0937d] mb-3 w-full">
              Hva vil du se?
            </legend>

            <ul className="flex flex-col gap-2" role="list">
              {THEMES.map((theme, i) => {
                const isChecked = selected.has(theme.id);
                const { Icon } = theme;

                return (
                  <li
                    key={theme.id}
                    style={{
                      animation: `onboard-rise 0.45s ${0.12 + i * 0.055}s cubic-bezier(0.16, 1, 0.3, 1) both`,
                    }}
                  >
                    <label
                      htmlFor={`theme-${theme.id}`}
                      className={[
                        // Base card
                        "group flex items-center gap-3.5 w-full px-4 py-3.5 rounded-xl border cursor-pointer",
                        "select-none transition-all duration-150",
                        // Active vs inactive state
                        isChecked
                          ? "bg-white border-[#ddd9d3] shadow-sm"
                          : "bg-transparent border-[#e8e4de] opacity-50",
                        // Hover — only visible on non-touch
                        "hover:opacity-100 hover:shadow-sm hover:border-[#cdc8c0]",
                      ].join(" ")}
                    >
                      {/* Hidden native checkbox — accessible but visually replaced */}
                      <input
                        id={`theme-${theme.id}`}
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(theme.id)}
                        className="sr-only"
                      />

                      {/* Color dot + icon */}
                      <span
                        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150"
                        style={{
                          backgroundColor: isChecked ? theme.color : "#d6d0c8",
                        }}
                        aria-hidden="true"
                      >
                        <Icon
                          className="w-4 h-4 text-white"
                          strokeWidth={2}
                        />
                      </span>

                      {/* Theme name */}
                      <span
                        className={[
                          "flex-1 text-sm font-medium transition-colors duration-150",
                          isChecked ? "text-[#1a1a1a]" : "text-[#8a857e]",
                        ].join(" ")}
                      >
                        {theme.name}
                      </span>

                      {/* Custom checkbox indicator */}
                      <span
                        className={[
                          "flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150",
                          isChecked
                            ? "border-[#1a1a1a] bg-[#1a1a1a]"
                            : "border-[#cdc8c0] bg-transparent",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        {isChecked && (
                          <svg
                            viewBox="0 0 10 8"
                            className="w-2.5 h-2 fill-none stroke-white"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="1 4 3.5 6.5 9 1" />
                          </svg>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        </section>
      </div>

      {/* ── Sticky CTA — separate from card so it sticks to bottom on mobile ── */}
      <div
        className="w-full max-w-lg mt-8 md:mt-6"
        style={{ animation: "onboard-rise 0.5s 0.42s cubic-bezier(0.16, 1, 0.3, 1) both" }}
      >
        {/* Inline validation */}
        {noneSelected && (
          <p
            role="alert"
            className="text-center text-xs text-[#c8513e] mb-2.5 font-medium"
          >
            Velg minst ett tema for å fortsette
          </p>
        )}

        <button
          onClick={handleConfirm}
          disabled={noneSelected}
          aria-disabled={noneSelected}
          className={[
            "w-full py-4 rounded-xl font-semibold text-sm tracking-wide transition-all duration-150",
            "flex items-center justify-center gap-2",
            noneSelected
              ? "bg-[#d6d0c8] text-[#a0998f] cursor-not-allowed"
              : "bg-[#1a1a1a] text-white hover:bg-[#2d2d2d] active:scale-[0.99] shadow-md hover:shadow-lg",
          ].join(" ")}
        >
          Utforsk nabolaget
          <span aria-hidden="true" className="text-base leading-none">→</span>
        </button>
      </div>

      {/* ── Keyframes injected inline to avoid globals.css dependency ──────── */}
      <style>{`
        @keyframes onboard-rise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="onboard-rise"] { animation: none !important; opacity: 1 !important; }
        }
      `}</style>
    </div>
  );
}
