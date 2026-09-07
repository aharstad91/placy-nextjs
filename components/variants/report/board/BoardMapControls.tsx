"use client";

import {
  Box,
  Hand,
  Map as MapIcon,
  Orbit,
  Radar,
  Satellite,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { cn, travelModeLabels } from "@/lib/utils";
import type { TravelMode } from "@/lib/types";
import { ControlDropdown, ControlPanelRow } from "./ControlDropdown";
import { TRAVEL_MODE_ICONS, TravelModeSelector } from "./TravelModeSelector";

export type CameraMode = "auto" | "free";

/** Kart-veksleren har tre visninger: Mapbox-vektor (2d), Google-motoren rett
 *  ovenfra (sat — tilt 0, nord opp), og Google-motoren i skrå vinkel (3d).
 *  sat og 3d deler motor — byttet mellom dem er en kameraflyvning, ikke et
 *  motorbytte (se BoardMap.handleModeChange + kamera-directoren). */
export type BoardView = "2d" | "sat" | "3d";

interface Props {
  /** Aktiv visning: 2D (Mapbox), Satelitt (Google ovenfra) eller 3D (Google skrå). */
  view: BoardView;
  onViewChange: (view: BoardView) => void;
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
  /**
   * Vis kartvisnings-velgeren. Gaten flyttet INN i komponenten 2026-08-14:
   * pillen var tidligere montert bare når prosjektet hadde 3D-tillegget, så en
   * kontroll som gjelder alle boards (reisemåte) ville vært usynlig på nøyaktig
   * de boardsene som trenger den mest. Default true.
   */
  showViewToggle?: boolean;
  /**
   * Reisemodusene boardet har data for, i visningsrekkefølge. Tom eller
   * ett-element → ingen veksler rendres (R6).
   */
  travelModes?: readonly TravelMode[];
  travelMode?: TravelMode;
  onTravelModeChange?: (mode: TravelMode) => void;
  /**
   * Vis av/på-knappen for rekkevidde-konturer (5/10/15 min).
   *
   * Gates på DATA, ikke på et flagg: kalleren setter den bare når minst én
   * reisemåte har konturer. Et board uten konturer skal ikke ha en knapp som
   * ikke gjør noe. Default false.
   */
  showContourToggle?: boolean;
  /**
   * Reisemåtene som faktisk HAR konturer (`contourTravelModes`). Et delvis sett
   * er lovlig — pipelinen kan ha gått for gange og ikke for bil — og da er
   * knappen død for nettopp den reisemåten. Med dette settet sier den det selv
   * (avslått + forklaring) i stedet for å slå på et lag som ikke tegner noe.
   * Utelatt → knappen antas å gjelde alle moduser.
   */
  contourModes?: readonly TravelMode[];
  /** Konturene vises nå. */
  contoursOn?: boolean;
  onContoursToggle?: () => void;
  /** Progressiv avsløring (mobil to-flate, R11): kollaps kontrollene til ett ⚙
   *  FAB som åpner en popover med de samme kontrollene. Holder kart-flaten ren
   *  — kontrollene er der når du vil ha dem, ikke alltid utbrettet. Default
   *  false (desktop/event beholder den fulle pillen). */
  collapsed?: boolean;
  /**
   * Bredden (px) en sidekolonne dekker fra venstre. Beholderen starter der i
   * stedet for i kartets venstre kant, så «sentrert nederst i midten» betyr
   * midten av det brukeren SER — desktop-panelet ligger oppå kartet
   * (2026-08-27), og en pille sentrert i lerretet ville krøpet inn under det på
   * smale vinduer. Default 0 (mobil har ingen sidekolonne).
   */
  insetLeftPx?: number;
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

/**
 * Kartvisningene, i rekkefølge. `source` grupperer dem etter MOTOR: Kart er
 * Mapbox-vektorkartet, mens Satelitt og 3D er samme Google-motor i to vinkler.
 * Grupperingen tegnes som en hårstrek mellom radene i panelet — uten den leses
 * de tre som tre likestilte kart, og brukeren skjønner ikke hvorfor
 * Satelitt→3D glir mens Kart→Satelitt klipper.
 */
const VIEW_OPTIONS: {
  value: BoardView;
  label: string;
  aria: string;
  icon: LucideIcon;
  source: "mapbox" | "google";
}[] = [
  { value: "2d", label: "Kart", aria: "2D-kart", icon: MapIcon, source: "mapbox" },
  {
    value: "sat",
    label: "Satelitt",
    aria: "Satellitt ovenfra",
    icon: Satellite,
    source: "google",
  },
  { value: "3d", label: "3D", aria: "3D-kart", icon: Box, source: "google" },
];

/**
 * Samlet kontroll-cluster for board-kartet — ÉN pille, sentrert NEDERST I
 * MIDTEN.
 *
 * ## Rekkefølgen er argumentet (2026-09-07)
 *
 * `reisemåte · rekkevidde · kartvisning · kameramodus` leser som «hvordan jeg
 * reiser · hvor langt jeg kommer · hvilket kart · hvordan kameraet står».
 * Rekkevidde sto tidligere SIST, plassert som om den var et kartlag på linje
 * med Satelitt. Den er ikke det: konturene er 5/10/15 minutter MED den valgte
 * reisemåten (`contourTravelModes` leser dem per profil), så den hører inntil
 * reisemåten. Naboskapet er hele forklaringen brukeren får — og den holder,
 * fordi knappen dessuten sier fra når den valgte reisemåten mangler konturer.
 *
 * ## Hvorfor to dropdowns og ikke seks knapper
 *
 * Reisemåte og kartvisning lå utbrettet (tre ikonknapper + tre tekstknapper).
 * Det skalerte ikke: pillen sto på kapasitetsgrensen ved 320 px, «Rekkevidde»
 * måtte kappes til ikon på mobil for å få plass (2026-09-03), og hver ny
 * kontroll ville kostet en etikett. Begge er nå `ControlDropdown` — samme
 * trigger + panel som enheten over minutt-kolonnen i nabolagslista. Ett trykk
 * ekstra, halve bredden, og radene bærer mer enn ikonknappene kunne (reisemåte
 * viser tid per modus der et sted er valgt).
 *
 * Bunn-midten er bevisst valgt: Google-attribusjonen er låst nederst-VENSTRE
 * (kan ikke flyttes per Googles vilkår), Mapbox-attribusjonen nederst-HØYRE —
 * midten er fri. Auto/Fri skjules utenfor 3D (irrelevant over Mapbox-kartet og
 * i rett-ovenfra-satelitten); da krymper pillen.
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
  showViewToggle = true,
  travelModes = [],
  travelMode = "walk",
  onTravelModeChange,
  showContourToggle = false,
  contourModes = [],
  contoursOn = false,
  onContoursToggle,
  insetLeftPx = 0,
}: Props) {
  // Auto/Fri vises kun i 3D OG når det finnes en orbit å vise (voice-over-tier).
  // I Satelitt er segmentet også skjult (R4): auto-orbit er av — et roterende
  // rett-ovenfra-kart er desorienterende, og «nord opp» er selve posituren.
  const showCamera = view === "3d" && showCameraMode;
  const showTravelModes = travelModes.length > 1 && Boolean(onTravelModeChange);
  const showContours = showContourToggle && Boolean(onContoursToggle);
  const isFree = cameraMode === "free";
  const seg = compact ? SEG_COMPACT : SEG_DEFAULT;
  // Touch-vennlig høyde på mobil (44px) vs. kompakt desktop (32px).
  const btnH = compact ? "h-11" : "h-8";
  const [fabOpen, setFabOpen] = useState(false);

  // Panelene folder opp fra pillen (den er låst til bunnen), og ned fra
  // FAB-popoveren (den henger fra topp-høyre).
  const panelDirection = collapsed ? "down" : "up";

  const activeMode = travelModes.includes(travelMode) ? travelMode : travelModes[0];
  const activeView = VIEW_OPTIONS.find((o) => o.value === view) ?? VIEW_OPTIONS[0];

  /* Har den VALGTE reisemåten konturer? Et tomt `contourModes` betyr «ikke
   * oppgitt», ikke «ingen» — gaten for om knappen finnes i det hele tatt er
   * `showContourToggle`. */
  const contoursAvailable =
    contourModes.length === 0 || contourModes.includes(travelMode);

  // Gruppene, i leserekkefølge. Bygget som liste så skilletegnene kan legges
  // MELLOM dem: hver gruppe er valgfri, og en betinget divider per gruppe
  // («vis meg hvis noe kommer etter») var fire sammenkjedede betingelser som
  // måtte oppdateres hver gang rekkefølgen endret seg.
  const groups: { key: string; node: ReactNode }[] = [];

  if (showTravelModes) {
    groups.push({
      key: "travel",
      node: (
        <ControlDropdown
          variant="bar"
          direction={panelDirection}
          icon={TRAVEL_MODE_ICONS[activeMode]}
          label={travelModeLabels[activeMode]}
          ariaLabel="Reisemåte"
          compact={compact}
          testId="map-travel-mode-control"
        >
          {(close) => (
            <TravelModeSelector
              modes={travelModes}
              active={activeMode}
              onChange={(mode) => {
                onTravelModeChange!(mode);
                close();
              }}
            />
          )}
        </ControlDropdown>
      ),
    });
  }

  if (showContours) {
    groups.push({
      key: "contours",
      node: (
        <button
          type="button"
          onClick={onContoursToggle}
          aria-pressed={contoursOn}
          aria-label="Vis rekkevidde-konturer"
          disabled={!contoursAvailable}
          title={
            contoursAvailable
              ? undefined
              : `Ingen rekkevidde for ${travelModeLabels[travelMode].toLowerCase()}`
          }
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors duration-200",
            compact ? "px-3" : "px-3.5",
            btnH,
            !contoursAvailable && "cursor-not-allowed text-stone-400 opacity-50",
            contoursAvailable &&
              (contoursOn
                ? "bg-stone-900 text-white shadow-sm"
                : "text-stone-600 hover:bg-stone-900/[0.05] hover:text-stone-900"),
          )}
        >
          <Radar className="h-4 w-4" />
          {/* Ikon-bare på mobil. Pillen sto alt på kapasitetsgrensen ved
              320 px, og en tekst-etikett i tillegg dyttet den ut over
              venstre kant (målt 2026-09-03). Betydningen bæres av
              aria-label, som skjermlesere leser uansett bredde. */}
          {!compact && <span>Rekkevidde</span>}
        </button>
      ),
    });
  }

  if (showViewToggle) {
    groups.push({
      key: "view",
      node: (
        <ControlDropdown
          variant="bar"
          direction={panelDirection}
          icon={activeView.icon}
          label={activeView.label}
          ariaLabel="Kartvisning"
          compact={compact}
          testId="map-view-control"
        >
          {(close) => (
            <div role="group" aria-label="Kartvisning" className="flex flex-col">
              {VIEW_OPTIONS.map((opt, i) => (
                <Fragment key={opt.value}>
                  {/* Hårstrek der MOTOREN skifter — Kart er Mapbox, Satelitt og
                      3D er Google i to vinkler. */}
                  {i > 0 && opt.source !== VIEW_OPTIONS[i - 1].source && (
                    <span
                      aria-hidden
                      className="mx-2.5 my-1 h-px bg-black/[0.07]"
                    />
                  )}
                  <ControlPanelRow
                    icon={opt.icon}
                    label={opt.label}
                    ariaLabel={opt.aria}
                    active={view === opt.value}
                    onClick={() => {
                      onViewChange(opt.value);
                      close();
                    }}
                  />
                </Fragment>
              ))}
            </div>
          )}
        </ControlDropdown>
      ),
    });
  }

  if (showCamera) {
    groups.push({
      key: "camera",
      node: (
        <div role="group" aria-label="Kameramodus" className="relative flex items-center">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-stone-900 shadow-sm transition-transform duration-[420ms] ease-[cubic-bezier(0.34,1.4,0.5,1)]"
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
      ),
    });
  }

  // Kontroll-innholdet — delt mellom den fulle pillen og FAB-popoveren så de
  // aldri driver fra hverandre.
  const controlsBody = groups.map((group, i) => (
    <Fragment key={group.key}>
      {i > 0 && <span aria-hidden className="mx-0.5 h-5 w-px bg-stone-300/70" />}
      {group.node}
    </Fragment>
  ));

  // Ingen grupper = ingen pille. En tom, halvtransparent kapsel midt på kartet
  // er verre enn ingen kontroll.
  if (groups.length === 0) return null;

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
        style={{ left: insetLeftPx }}
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-30 transition-[opacity,transform] duration-500 ease-out",
          controlsReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        )}
      >
        {freeHint}

        {/* Popover med kontrollene — folder ut UNDER FAB-en (topp-høyre).

            `flex-wrap` + `max-w`: innholdet kan fortsatt bli bredere enn
            skjermen når alle gruppene vises, og uten brekking rant popoveren ut
            over venstre skjermkant (målt 2026-09-03). En nestet vannrett
            scroller er forkastet — én scroller per flate er prinsippet på
            mobil. Radiusen går fra pille til avrundet boks når den brekker,
            ellers ville andre rad hatt en halvmåne-kant. */}
        {fabOpen && (
          <div
            data-testid="board-map-controls"
            className="pointer-events-auto absolute right-4 top-16 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-end gap-1 rounded-3xl border border-white/50 bg-white/85 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-md"
          >
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

  // ---- Full pille (desktop + event) ----
  return (
    <div
      style={{ left: insetLeftPx }}
      className={cn(
        "pointer-events-none absolute inset-y-0 right-0 z-30 transition-[opacity,transform] duration-500 ease-out",
        controlsReady ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      {freeHint}

      {/* Samlet pille, sentrert nederst. Mobil løftes litt så den klarer
          kart-sheetens bunnkant og Google-attribusjonen. */}
      <div
        data-testid="board-map-controls"
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
