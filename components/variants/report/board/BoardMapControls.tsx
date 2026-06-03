"use client";

import { Hand, Orbit } from "lucide-react";
import { cn } from "@/lib/utils";

export type CameraMode = "auto" | "free";

interface Props {
  /** Aktiv map-motor: 2D (Mapbox) eller 3D (Google). */
  view: "2d" | "3d";
  onViewChange: (view: "2d" | "3d") => void;
  /** Kameramodus (auto/fri) — kun relevant i 3D. */
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  /** Recovery-hint synlig — transient melding når brukeren tok over kameraet
   *  ved å dra (auto → fri implisitt). */
  showFreeHint?: boolean;
}

/** Segment-bredde (px) for Auto/Fri. Tommelen og hver knapp deler denne så
 *  `translateX(SEG)` lander tommelen presist på Fri-segmentet. */
const SEG = 76;

const CAMERA_SEGMENTS: { mode: CameraMode; label: string; aria: string }[] = [
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

const VIEW_OPTIONS: { value: "2d" | "3d"; label: string; aria: string }[] = [
  { value: "2d", label: "Kart", aria: "2D-kart" },
  { value: "3d", label: "3D", aria: "3D-kart" },
];

/**
 * Samlet kontroll-cluster for board-kartet — ÉN pille, sentrert NEDERST I
 * MIDTEN. Auto/Fri (kameramodus, glidende tommel, kun i 3D) + en divider +
 * Kart/3D (motor-bytte, split-knapp) lever i samme beholder. Bygget som én
 * komponent vi kan utvide (samme prinsipp som player-raden: funksjonalitet i
 * bunn).
 *
 * Bunn-midten er bevisst valgt: Google-attribusjonen er låst nederst-VENSTRE
 * (kan ikke flyttes per Googles vilkår), Mapbox-attribusjonen nederst-HØYRE —
 * midten er fri. Auto/Fri skjules i 2D (irrelevant over Mapbox-kartet); da
 * krymper pillen til kun Kart/3D.
 */
export function BoardMapControls({
  view,
  onViewChange,
  cameraMode,
  onCameraModeChange,
  showFreeHint = false,
}: Props) {
  const is3d = view === "3d";
  const isFree = cameraMode === "free";

  return (
    <>
      {/* Recovery-hint — sentrert over pillen, kun 3D + etter drag-takeover. */}
      {is3d && (
        <div
          role="status"
          className={cn(
            "pointer-events-none absolute bottom-[4.75rem] left-1/2 z-30 max-w-[20rem] -translate-x-1/2 rounded-xl bg-stone-900/85 px-3 py-2 text-center text-xs font-medium text-white shadow-lg ring-1 ring-black/5 backdrop-blur-md transition-opacity duration-300",
            showFreeHint ? "opacity-100" : "opacity-0",
          )}
        >
          Du styrer kameraet nå — trykk{" "}
          <span className="font-semibold">Auto</span> for å la dronen fortsette.
        </div>
      )}

      {/* Samlet pille, sentrert nederst. */}
      <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/50 bg-white/80 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md">
        {/* Auto/Fri — segment-kontroll med glidende tommel (kun 3D). */}
        {is3d && (
          <>
            <div role="group" aria-label="Kameramodus" className="relative flex items-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-stone-900 shadow-sm transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)]"
                style={{
                  width: SEG,
                  transform: isFree ? `translateX(${SEG}px)` : "translateX(0)",
                }}
              />
              {CAMERA_SEGMENTS.map((seg) => {
                const active = seg.mode === cameraMode;
                const Icon = seg.mode === "auto" ? Orbit : Hand;
                return (
                  <button
                    key={seg.mode}
                    type="button"
                    onClick={() => onCameraModeChange(seg.mode)}
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

            {/* Divider mellom kameramodus og motor-bytte. */}
            <span aria-hidden className="mx-0.5 h-5 w-px bg-stone-300/70" />
          </>
        )}

        {/* Kart/3D — split-knapp (to knapper, aktiv fylt mørk). */}
        <div role="group" aria-label="Kartvisning" className="flex items-center gap-0.5">
          {VIEW_OPTIONS.map((opt) => {
            const active = view === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onViewChange(opt.value)}
                aria-pressed={active}
                aria-label={opt.aria}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors duration-200",
                  active
                    ? "bg-stone-900 text-white shadow-sm"
                    : "text-stone-500 hover:text-stone-700",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
