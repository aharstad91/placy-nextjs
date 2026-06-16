"use client";

import { Hand, Orbit, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type CameraMode = "auto" | "free";

interface Props {
  /** Aktiv map-motor: 2D (Mapbox) eller 3D (Google). */
  view: "2d" | "3d";
  onViewChange: (view: "2d" | "3d") => void;
  /** Kameramodus (auto/fri) — kun relevant i 3D. */
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  /** Vis Auto/Fri-segmentet. false (basic-tier uten voice-over) → kun Kart/3D.
   *  Auto-modus orbiterer KUN når `autoOrbit` (= hasVoiceOver) er på; uten
   *  voice-over er "Auto" en tom modus (kameraet står stille), så toggelen
   *  skjules og pillen krymper til motor-byttet. Default true. */
  showCameraMode?: boolean;
  /** Recovery-hint synlig — transient melding når brukeren tok over kameraet
   *  ved å dra (auto → fri implisitt). */
  showFreeHint?: boolean;
  /** Kontrollene er klare til å brukes. false = skjult (brukes under intro-
   *  flythrough der kart-interaksjon er deaktivert). Animerer inn fra bunn
   *  med opacity når den går fra false → true. Default true. */
  controlsReady?: boolean;
  /** Kompakt mobil-variant: smalere segmenter, touch-vennlig høyde (44px) og
   *  litt løftet posisjon så pillen klarer kart-sheetens bunnkant og Google-
   *  attribusjonen. Default false (desktop). */
  compact?: boolean;
  /** Progressiv avsløring (mobil to-flate, R11): kollaps kontrollene til ett ⚙
   *  FAB som åpner en popover med Auto/Fri + Kart/3D. Holder kart-flaten ren —
   *  kontrollene er der når du vil ha dem, ikke alltid utbrettet. Default false
   *  (desktop/event beholder den fulle pillen). */
  collapsed?: boolean;
}

/** Segment-bredde (px) for Auto/Fri. Tommelen og hver knapp deler denne så
 *  `translateX(seg)` lander tommelen presist på Fri-segmentet. Kompakt mobil
 *  bruker en smalere verdi. */
const SEG_DEFAULT = 76;
const SEG_COMPACT = 62;

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
 *
 * `collapsed` (mobil to-flate, R11): samme kontroller, men kollapset til ett ⚙
 * FAB som folder ut en popover. Holder kart-flaten ren.
 */
export function BoardMapControls({
  view,
  onViewChange,
  cameraMode,
  onCameraModeChange,
  showCameraMode = true,
  showFreeHint = false,
  controlsReady = true,
  compact = false,
  collapsed = false,
}: Props) {
  // Auto/Fri vises kun i 3D OG når det finnes en orbit å vise (voice-over-tier).
  const showCamera = view === "3d" && showCameraMode;
  const isFree = cameraMode === "free";
  const seg = compact ? SEG_COMPACT : SEG_DEFAULT;
  // Touch-vennlig høyde på mobil (44px) vs. kompakt desktop (32px).
  const btnH = compact ? "h-11" : "h-8";
  const [fabOpen, setFabOpen] = useState(false);

  // Kontroll-innholdet (Auto/Fri + divider + Kart/3D) — delt mellom den fulle
  // pillen og FAB-popoveren så de aldri driver fra hverandre.
  const controlsBody = (
    <>
      {showCamera && (
        <>
          <div role="group" aria-label="Kameramodus" className="relative flex items-center">
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 left-0 rounded-full bg-stone-900 shadow-sm transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)]",
              )}
              style={{
                width: seg,
                transform: isFree ? `translateX(${seg}px)` : "translateX(0)",
              }}
            />
            {CAMERA_SEGMENTS.map((segment) => {
              const active = segment.mode === cameraMode;
              const Icon = segment.mode === "auto" ? Orbit : Hand;
              return (
                <button
                  key={segment.mode}
                  type="button"
                  onClick={() => onCameraModeChange(segment.mode)}
                  aria-pressed={active}
                  aria-label={segment.aria}
                  style={{ width: seg }}
                  className={cn(
                    "relative z-[1] inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors duration-200",
                    btnH,
                    active ? "text-white" : "text-stone-500 hover:text-stone-700",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      segment.mode === "auto" &&
                        active &&
                        "animate-[spin_7s_linear_infinite]",
                    )}
                  />
                  <span>{segment.label}</span>
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
                "inline-flex items-center justify-center rounded-full px-3.5 text-sm font-medium transition-colors duration-200",
                btnH,
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
    </>
  );

  // Recovery-hint (delt) — sentrert over kontrollene etter drag-takeover.
  const freeHint = showCamera ? (
    <div
      role="status"
      className={cn(
        "pointer-events-none absolute bottom-[4.75rem] left-1/2 max-w-[20rem] -translate-x-1/2 rounded-xl bg-stone-900/85 px-3 py-2 text-center text-xs font-medium text-white shadow-lg ring-1 ring-black/5 backdrop-blur-md transition-opacity duration-300",
        showFreeHint ? "opacity-100" : "opacity-0",
      )}
    >
      Du styrer kameraet nå — trykk{" "}
      <span className="font-semibold">Auto</span> for å la dronen fortsette.
    </div>
  ) : null;

  // ---- Collapsed (mobil to-flate, R11): ⚙ FAB + popover ----
  if (collapsed) {
    return (
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-30 transition-[opacity,transform] duration-500 ease-out",
          controlsReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        {freeHint}

        {/* Popover med kontrollene — folder ut UNDER FAB-en (topp-høyre). */}
        {fabOpen && (
          <div className="pointer-events-auto absolute right-4 top-16 flex items-center gap-1 rounded-full border border-white/50 bg-white/85 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md">
            {controlsBody}
          </div>
        )}

        {/* ⚙ FAB — topp-høyre. Bunn-midt er nå opptatt av den vedvarende
            transport-baren; topp-høyre klarer transporten, map-forward-captionen
            (topp-midt) og lukk-chevronen (topp-venstre). */}
        <button
          type="button"
          onClick={() => setFabOpen((o) => !o)}
          aria-label="Kart-innstillinger"
          aria-expanded={fabOpen}
          className="pointer-events-auto absolute right-4 top-[max(1rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full border border-white/50 bg-white/80 text-stone-700 shadow-lg ring-1 ring-black/5 backdrop-blur-md active:scale-95"
        >
          {fabOpen ? <X className="h-5 w-5" /> : <SlidersHorizontal className="h-5 w-5" />}
        </button>
      </div>
    );
  }

  // ---- Full pille (desktop + event) — uendret ----
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-30 transition-[opacity,transform] duration-500 ease-out",
        controlsReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      {freeHint}

      {/* Samlet pille, sentrert nederst. Mobil løftes litt så den klarer
          kart-sheetens bunnkant og Google-attribusjonen. */}
      <div
        className={cn(
          "pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/50 bg-white/80 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md",
          compact ? "bottom-7" : "bottom-5",
        )}
      >
        {controlsBody}
      </div>
    </div>
  );
}
