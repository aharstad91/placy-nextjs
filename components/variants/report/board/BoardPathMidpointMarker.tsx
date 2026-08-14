"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Marker } from "react-map-gl/mapbox";
import { cn } from "@/lib/utils";
import { useBoardRoute } from "./board-route";
import { useActivePOI, useAvailableTravelModes, useBoard } from "./board-state";
import { pathMidpoint } from "./path-midpoint";
import { TRAVEL_MODE_ICONS, TravelModeSelector } from "./TravelModeSelector";

/**
 * Tids-chipen på rutens midtpunkt — og den ene av to innganger til
 * reisemodus-valget (R5).
 *
 * Plasseringen er et bevisst valg fra 2026-04-30: midt på ruta, ikke i sentrum
 * av viewporten og ikke på POI-markøren (som ville blitt dekket). Mapbox
 * `<Marker>` projiserer lat/lng → skjerm automatisk, så chipen følger kartet ved
 * pan og zoom uten ekstra kode.
 *
 * Kollapset viser den aktiv modus og tiden. Klikk utvider til alle tre tidene
 * for punktet — hentet fra PRECOMPUTED data, ikke fra Directions, så panelet har
 * ingen lastetilstand.
 *
 * Treffområdet ligger på selve chipen, ikke på markør-wrapperen: wrapperen er
 * `pointer-events-none` slik at et klikk på en POI-markør nær rutens midtpunkt
 * fortsatt treffer markøren, ikke chipen.
 *
 * Rutedata kommer fra `BoardRouteProvider` — samme svar som rutelinja og
 * 3D-ruten leser. Chipen fyrer ingen egen Directions-forespørsel.
 */

/** Panelets omtrentlige høyde i piksler — brukes bare til å velge foldretning. */
const PANEL_HEIGHT_ESTIMATE = 180;

export function BoardPathMidpointMarker() {
  const { state, dispatch } = useBoard();
  const { data: routeData } = useBoardRoute();
  const activePOI = useActivePOI();
  const modes = useAvailableTravelModes();

  const [open, setOpen] = useState(false);
  const [foldUp, setFoldUp] = useState(true);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Panelet skal aldri overleve inn i en annen POI-kontekst enn det ble åpnet i
  // — samme prinsipp som `exploreOpen`, som nullstilles ved all navigasjon.
  useEffect(() => {
    setOpen(false);
  }, [state.activePOIId, state.phase]);

  // Klikk utenfor lukker uten å endre modus.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const toggle = useCallback(() => {
    // Retningen avgjøres ved åpning, ikke som en fast regel: rutens midtpunkt kan
    // ligge hvor som helst i viewporten, og et panel som alltid foldet oppover
    // ville gått utenfor kartflaten når chipen står nær toppen.
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setFoldUp(rect.top > PANEL_HEIGHT_ESTIMATE);
    setOpen((wasOpen) => !wasOpen);
  }, []);

  if (state.phase !== "poi" || !routeData) return null;
  const midpoint = pathMidpoint(routeData.coordinates);
  if (!midpoint) return null;

  const travelTime = activePOI?.raw.travelTime;
  const activeMinutes = travelTime?.[state.travelMode];
  // Fallback til rutens egen varighet: chipen har alltid vist Directions-tallet,
  // og precomputet verdi kan mangle på et punkt som ble lagt til utenom
  // provisjonerings-løpet.
  const minutes =
    typeof activeMinutes === "number" && Number.isFinite(activeMinutes)
      ? activeMinutes
      : Math.max(1, Math.round(routeData.travelMinutes));

  const ActiveIcon = TRAVEL_MODE_ICONS[state.travelMode];
  const expandable = modes.length > 1;

  return (
    <Marker
      longitude={midpoint.lng}
      latitude={midpoint.lat}
      anchor="center"
      // R12: kollapset ligger chipen på z-4, under de andre kart-overleggene.
      // Er panelet åpent, er det panelet leseren holder på med, så det må over
      // POI-popupen. Tallet må være over 20: `.mapboxgl-popup` ligger på z-20 i
      // en SØSKEN-container av markørene (`.mapboxgl-map` > popup vs.
      // `.mapboxgl-canvas-container` > marker), så en z-6 på markøren taper
      // uansett. Målt i browser 2026-08-14 — 6 var ikke nok, 30 er.
      style={{ pointerEvents: "none", zIndex: open ? 30 : 4 }}
    >
      <div ref={wrapperRef} className="relative flex flex-col items-center">
        {/* Panelet ligger absolutt over/under chipen så chipen selv ikke flytter
            seg når det åpnes — den sitter på en geografisk posisjon. */}
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
              active={state.travelMode}
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
            // Bare den utvidbare varianten tar imot klikk. Uten veksler er chipen
            // ren informasjon, og skal ikke stjele markør-klikk.
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
    </Marker>
  );
}
