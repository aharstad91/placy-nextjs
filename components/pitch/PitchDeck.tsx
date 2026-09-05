"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface PitchDeckProps {
  /** Én <PitchSlide> per slide, i rekkefølge. */
  children: ReactNode;
  /** Vises i toppstripa, venstre side — f.eks. «Placy · Wesselsløkka». */
  label: string;
}

/**
 * Presentasjonsskall for pitch-rutene: én slide om gangen, piltast-navigasjon
 * og deep-link via URL-hash (#3). Bygget som web-side og ikke slide-fil fordi
 * demoen midt i pitchen ER produktet — et levende board skal kunne ligge rett
 * i slide-flaten, og lenka skal kunne videresendes internt hos kunden etterpå.
 */
export default function PitchDeck({ children, label }: PitchDeckProps) {
  const slides = Children.toArray(children);
  const total = slides.length;
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      setIndex(clamped);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${clamped + 1}`);
      }
    },
    [total],
  );

  // Deep-link: #3 åpner slide 3. Kjøres én gang ved mount.
  useEffect(() => {
    const fromHash = Number.parseInt(window.location.hash.replace("#", ""), 10);
    if (Number.isFinite(fromHash) && fromHash >= 1 && fromHash <= total) {
      setIndex(fromHash - 1);
    }
  }, [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // La tastetrykk inne i iframen (demoen) og i skjemafelt være i fred.
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        go(index + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(total - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, total, go]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    // Kun horisontale sveip teller — vertikale er scroll inne i sliden.
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    go(dx < 0 ? index + 1 : index - 1);
  }

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#faf9f7] text-[#1a1a1a]"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Toppstripe: hvor er vi, og hvor langt er vi kommet */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#eae6e1] bg-[#faf9f7]/95 px-5 py-3 backdrop-blur md:px-10">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#a0937d]">
          {label}
        </span>
        <span className="text-[11px] tabular-nums text-[#a0a0a0]">
          {index + 1} / {total}
        </span>
      </header>

      {/* Slide-flaten. Hver slide scroller internt hvis innholdet er høyere
          enn vinduet — viktig på mobil, hvor lenka videresendes. */}
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {slides[index]}
      </main>

      {/* Bunnstripe: prikker + piler. Prikkene er klikkbare slik at man kan
          hoppe rett til demoen hvis samtalen tar en snarvei. */}
      <footer className="flex shrink-0 items-center justify-between border-t border-[#eae6e1] bg-[#faf9f7]/95 px-5 py-3 backdrop-blur md:px-10">
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`Gå til slide ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-6 bg-[#1a1a1a]"
                  : "w-1.5 bg-[#d6d0c8] hover:bg-[#a0937d]"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <NavButton
            onClick={() => go(index - 1)}
            disabled={index === 0}
            label="Forrige"
          >
            <ArrowLeft className="h-4 w-4" />
          </NavButton>
          <NavButton
            onClick={() => go(index + 1)}
            disabled={index === total - 1}
            label="Neste"
          >
            <ArrowRight className="h-4 w-4" />
          </NavButton>
        </div>
      </footer>
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#eae6e1] bg-white text-[#1a1a1a] transition-colors hover:bg-[#f2efe9] disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white"
    >
      {children}
    </button>
  );
}
