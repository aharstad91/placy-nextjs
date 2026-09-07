"use client";

import { travelModeInSentence } from "@/lib/utils";
import type { TravelMode } from "@/lib/types";
import { TRAVEL_MODE_ICONS } from "./TravelModeSelector";

/**
 * Etiketten på én rekkevidde-kontur: «🚶 5 min».
 *
 * ## Hvorfor ikonet står her og ikke bare i kontrollen
 *
 * Etiketten sa tidligere bare «5 min», og da sto det ingen steder på kartet HVA
 * de fem minuttene var (Andreas, 2026-09-07: «det er ikke noe informasjon om at
 * walk gir x rekkevidde-områder i kartet ved 5, 10 og 15 min»). Reisemåten var
 * bare å finne i kart-kontrollen nederst, som et eget valg ved siden av
 * rekkevidde — to knapper som ikke hang sammen.
 *
 * Reisemåte-glyfen gjentas derfor på ALLE tre etikettene, ikke bare den
 * innerste. Gjentakelsen er poenget: bytter du til sykkel, endrer tre steder på
 * kartet seg samtidig, og koblingen mellom de to kontrollene blir noe du ser i
 * stedet for noe du må slutte deg til. Ikonet er det SAMME (`TRAVEL_MODE_ICONS`)
 * som triggeren i kontrollen og radene i nabolagslista bruker.
 *
 * Delt komponent fordi begge motorene tegner etiketten selv — Mapbox som
 * `Marker`, Google som HTML posisjonert per frame. Sto de i to filer, ville de
 * drevet fra hverandre i typografi og bakgrunn, og «5 min» ville lest som to
 * ulike kart.
 */

interface Props {
  minutes: string;
  mode: TravelMode;
}

export function ContourLabelChip({ minutes, mode }: Props) {
  const Icon = TRAVEL_MODE_ICONS[mode];
  return (
    <span
      /* pointer-events-none: etiketten skal aldri stjele et klikk fra en markør
         som ligger i nærheten. */
      className="pointer-events-none inline-flex select-none items-center gap-1 rounded-full bg-white/[.92] px-2 py-[3px] text-[11px] font-semibold leading-none text-stone-700 shadow-sm ring-1 ring-black/[0.07] backdrop-blur-sm"
    >
      <Icon aria-hidden className="h-3 w-3 shrink-0 text-stone-500" />
      <span className="tabular-nums">{minutes} min</span>
      {/* Ikonet er stumt for skjermlesere; ordet står her. */}
      <span className="sr-only"> {travelModeInSentence[mode]}</span>
    </span>
  );
}
