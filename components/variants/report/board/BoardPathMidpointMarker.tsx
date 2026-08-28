"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Marker } from "react-map-gl/mapbox";
import { cn } from "@/lib/utils";
import { useBoard } from "./board-state";
import { TRAVEL_MODE_ICONS, TravelModeSelector } from "./TravelModeSelector";
import { useTravelChip } from "./use-travel-chip";

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
  // Innholdet er delt med 3D-chipen (use-travel-chip) — motorene skal skille
  // seg i posisjonering, ikke i tall.
  const { midpoint, minutes, travelMode, travelTime, modes, expandable, visible } =
    useTravelChip();

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

  if (!visible || !midpoint) return null;

  const ActiveIcon = TRAVEL_MODE_ICONS[travelMode];

  return (
    <Marker
      longitude={midpoint.lng}
      latitude={midpoint.lat}
      // Chipen forankres OVER midtpunktet, ikke på det. Med `anchor="center"`
      // lå den rett oppå linja den beskriver, og på korte ruter er chipen bredere
      // enn hele ruta — da så et modusbytte ut som om ingenting skjedde, selv om
      // geometrien var byttet. Målt 2026-08-14: 3 min i bil ≈ 110 px, chipen er
      // 104 px. Nå ligger linja synlig under den.
      anchor="bottom"
      offset={[0, -8]}
      // R12: chipen ligger ALLTID over POI-popupen, ikke bare når panelet er
      // åpent.
      //
      // Første forsøk lot den kollapsede chipen ligge på z-4 med begrunnelsen at
      // popupen er det leseren nettopp åpnet. Målt i browser 2026-08-14: når
      // rutens midtpunkt havner under popup-kortet — som skjer på korte ruter —
      // fanget popupen klikket, og chipen var da bokstavelig talt umulig å
      // trykke på. En kontroll som ikke kan klikkes er verre enn et kort som
      // delvis dekkes, og popupen kan lukkes mens chipen ikke kan flyttes.
      //
      // Tallet må være over 20: `.mapboxgl-popup` ligger på z-20 i en SØSKEN-
      // container av markørene (`.mapboxgl-map` > popup vs.
      // `.mapboxgl-canvas-container` > marker), så lavere verdier taper uansett.
      style={{ pointerEvents: "none", zIndex: 30 }}
    >
      <div
        ref={wrapperRef}
        // Merkelappen `<Map onClick>` filtrerer på: et klikk her er IKKE et
        // bakgrunnsklikk. Uten den leste kartet chip-klikket som «klikk på
        // bakgrunn», dispatchet BACK_TO_DEFAULT, og chipen forsvant under
        // fingeren. Speiler `closest("gmp-marker-3d-interactive")`-gaten i
        // BoardMap3D. Vi kan IKKE bruke markørens egen `stopPropagation` slik
        // BoardMarker gjør — den ville stoppet eventet før Reacts delegerte
        // handlere, så ingen knapp inne i panelet ville virket.
        data-travel-chip=""
        className="relative flex flex-col items-center"
      >
        {/* Panelet ligger absolutt over/under chipen så chipen selv ikke flytter
            seg når det åpnes — den sitter på en geografisk posisjon. */}
        {open && (
          <div
            className={cn(
              "pointer-events-auto absolute left-1/2 w-48 -translate-x-1/2 rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur",
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
