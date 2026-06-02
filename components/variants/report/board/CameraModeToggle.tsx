"use client";

import { Hand, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

export type CameraMode = "auto" | "free";

interface Props {
  mode: CameraMode;
  onModeChange: (mode: CameraMode) => void;
  className?: string;
}

/**
 * Segment-bredde (px). Tommelen og hver knapp deler nøyaktig denne bredden, så
 * `translateX(SEG)` lander tommelen presist på det andre segmentet.
 */
const SEG = 84;

const SEGMENTS: { mode: CameraMode; label: string; aria: string }[] = [
  {
    mode: "auto",
    label: "Auto",
    aria: "Automatisk kamera — dronen roterer rolig rundt prosjektet",
  },
  {
    mode: "free",
    label: "Fri",
    aria: "Fri kamerakontroll — du styrer vinkelen selv",
  },
];

/**
 * Tab-aktig segment-kontroll som visualiserer om 3D-kameraet er i AUTO-modus
 * (kontinuerlig drone-orbit) eller FRI modus (brukeren styrer vinkelen selv).
 *
 * En mørk «tommel» glir/morfer mellom de to segmentene ved skifte. I auto-modus
 * roterer Orbit-ikonet sakte for å forsterke at kameraet beveger seg av seg
 * selv; i fri modus signaliserer hånd-ikonet at brukeren har kontrollen.
 *
 * Drar/zoomer brukeren i kartet settes modus til «free» automatisk (håndtert i
 * BoardMap3D) — denne kontrollen reflekterer da bare tilstanden, og lar brukeren
 * gi kontrollen tilbake til dronen med ett klikk.
 */
export function CameraModeToggle({ mode, onModeChange, className }: Props) {
  const isFree = mode === "free";

  return (
    <div
      role="group"
      aria-label="Kameramodus"
      className={cn(
        "relative inline-flex items-center rounded-full border border-white/50 bg-white/80 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md",
        className,
      )}
    >
      {/* Morphing-tommel — glir mellom segmentene med en spenstig ease. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-stone-900 shadow-sm transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)]"
        style={{
          width: SEG,
          transform: isFree ? `translateX(${SEG}px)` : "translateX(0)",
        }}
      />

      {SEGMENTS.map((seg) => {
        const active = seg.mode === mode;
        const Icon = seg.mode === "auto" ? Orbit : Hand;
        return (
          <button
            key={seg.mode}
            type="button"
            onClick={() => onModeChange(seg.mode)}
            aria-pressed={active}
            aria-label={seg.aria}
            style={{ width: SEG }}
            className={cn(
              "relative z-[1] inline-flex h-8 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors duration-200",
              active ? "text-white" : "text-stone-500 hover:text-stone-700",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                seg.mode === "auto" &&
                  active &&
                  "animate-[spin_7s_linear_infinite]",
              )}
            />
            <span>{seg.label}</span>
          </button>
        );
      })}
    </div>
  );
}
