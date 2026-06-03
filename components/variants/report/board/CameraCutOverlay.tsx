"use client";

import { cn } from "@/lib/utils";

interface Props {
  /** Sann mens cut-en holder svart (fade inn → hold → fade ut styres av kalleren). */
  visible: boolean;
  /** Kategorien vi cutter TIL — vist som kapittel-signal i den svarte framen. */
  label?: string;
  /** Kategori-farge (hex) for aksent-streken. */
  color?: string;
  className?: string;
}

/**
 * Lyst cut-overlay for 3D-board-kameraet. Mens kameraet hopper (instant
 * reposisjon) til neste kategoris startpunkt, fader dette laget til lyst og
 * tilbake — så brukeren aldri ser en meningsløs fly-over på tvers (f.eks. over
 * vannet nord for Stasjonskvartalet). Kategori-label (sort tekst) + farge-aksent
 * fader inn for å signalisere et kapittel-skifte (ikke en lasteskjerm).
 *
 * Ren presentasjon: opacity følger `visible` via CSS-transition (matcher
 * CUT_FADE_MS i directoren). `pointer-events-none` så det aldri blokkerer
 * kart-interaksjon når det er usynlig. Holdes ute av marker-render-stien.
 */
export function CameraCutOverlay({ visible, label, color, className }: Props) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#f2e9dc] transition-opacity duration-[250ms] ease-out",
        visible ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {label && (
        <div
          className={cn(
            "flex flex-col items-center gap-2 transition-opacity duration-200",
            visible ? "opacity-100" : "opacity-0",
          )}
        >
          <span
            className="h-1 w-10 rounded-full"
            style={{ backgroundColor: color ?? "#1c1917" }}
          />
          <span className="text-lg font-medium tracking-wide text-stone-900">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
