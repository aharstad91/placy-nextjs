"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useBoard } from "./board-state";
import { TRAVEL_MODE_ICONS, TravelModeSelector } from "./TravelModeSelector";
import { useTravelChip } from "./use-travel-chip";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import { projectLatLngToScreen } from "@/components/map/project-latlng-to-screen";

/**
 * Tids-chipen når Google 3D er den aktive kartflaten (R11).
 *
 * ## Hvorfor et HTML-overlay og ikke en 3D-markør
 *
 * Tidsmerket i 3D var en inline-SVG i et `Marker3DInteractiveElement`, fordi
 * templaten til den markørtypen MÅ inneholde `<img>` eller `<svg>`. Et utvidbart
 * panel kan altså ikke bo der. Overlayet er samme mønster som
 * `BoardPOI3DMiniPopup`: React-komponent utenfor kart-elementet, posisjonert per
 * frame.
 *
 * ## Hvorfor `translate3d` skrives direkte til DOM
 *
 * Google 3D eksponerer ingen native `latLngToScreen`, så posisjonen må regnes ut
 * hver frame fra kameraets center, heading, tilt og range. Går den via
 * `setState` trigges React-reconciliation som ikke synkroniseres med paint, og
 * under kamera-animasjon (der Google alt driver GPU-en hardt) gir det dropped
 * frames som ser ut som hopping. `translate3d` går rett til compositoren.
 *
 * Innholdet — tall, modusliste, tilgjengelighet — kommer fra `useTravelChip`,
 * delt med 2D-chipen. Motorene skiller seg i posisjonering, ikke i innhold.
 */

interface Props {
  map3d: Map3DInstance | null;
}

/** Samme altitude som det gamle SVG-merket, litt over polylinen (3 m). */
const CHIP_ALTITUDE_M = 12;

/** Panelets omtrentlige høyde i piksler — brukes bare til å velge foldretning. */
const PANEL_HEIGHT_ESTIMATE = 180;

export function BoardTravelChip3D({ map3d }: Props) {
  const { state, dispatch } = useBoard();
  const { midpoint, minutes, travelMode, travelTime, modes, expandable, visible } =
    useTravelChip();

  const [open, setOpen] = useState(false);
  const [foldUp, setFoldUp] = useState(true);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  // Panelet skal ikke overleve inn i en annen POI-kontekst enn det ble åpnet i.
  useEffect(() => {
    setOpen(false);
  }, [state.activePOIId, state.phase]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const lat = midpoint?.lat;
  const lng = midpoint?.lng;

  // Per-frame projeksjon. Primitivene i dep-arrayet, ikke midtpunkt-OBJEKTET:
  // et nytt objekt med samme verdier ville restartet rAF-løkken hver render.
  useEffect(() => {
    if (!map3d || lat === undefined || lng === undefined) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
      return;
    }

    const update = () => {
      const el = wrapperRef.current;
      if (el) {
        const p = projectLatLngToScreen(map3d, lat, lng, CHIP_ALTITUDE_M);
        if (p) {
          el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`;
          el.style.opacity = "1";
        } else {
          // Bak kameraet eller utenfor projeksjonsdomenet — skjul.
          el.style.opacity = "0";
        }
      }
      rafRef.current = requestAnimationFrame(update);
    };
    update();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    };
  }, [map3d, lat, lng]);

  const toggle = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setFoldUp(rect.top > PANEL_HEIGHT_ESTIMATE);
    setOpen((wasOpen) => !wasOpen);
  }, []);

  if (!visible || !map3d) return null;

  const ActiveIcon = TRAVEL_MODE_ICONS[travelMode];

  return (
    <div
      ref={wrapperRef}
      data-testid="travel-chip-3d"
      // Åpent panel må over POI-popupen i 3D (`BoardPOI3DMiniPopup`, z-30).
      className={cn(
        "pointer-events-none fixed left-0 top-0 flex flex-col items-center",
        open ? "z-40" : "z-20",
      )}
      style={{ willChange: "transform", opacity: 0 }}
    >
      {open && (
        <div
          className={cn(
            "pointer-events-auto absolute left-1/2 w-48 -translate-x-1/2 rounded-xl border border-stone-200 bg-white/97 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur",
            foldUp ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          <TravelModeSelector
            variant="panel"
            modes={modes}
            active={travelMode}
            minutesByMode={travelTime}
            onChange={(mode) => {
              dispatch({ type: "SET_TRAVEL_MODE", mode });
              setOpen(false);
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={expandable ? toggle : undefined}
        aria-expanded={expandable ? open : undefined}
        aria-label={expandable ? "Bytt reisemåte" : undefined}
        disabled={!expandable}
        className={cn(
          "flex items-center gap-1.5 rounded-full border border-stone-200 bg-white/95 px-3 py-1.5 text-sm font-semibold text-stone-900 shadow-md backdrop-blur",
          expandable ? "pointer-events-auto cursor-pointer" : "cursor-default",
        )}
      >
        <ActiveIcon className="h-4 w-4 text-stone-600" />
        <span>{minutes} min</span>
        {expandable && (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-stone-400 transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        )}
      </button>
    </div>
  );
}
