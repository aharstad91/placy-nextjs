"use client";

import { Bike, Car, Footprints, type LucideIcon } from "lucide-react";
import { cn, travelModeLabels } from "@/lib/utils";
import type { TravelMode } from "@/lib/types";

/**
 * Modus-utvalget, delt mellom de to inngangene (R5).
 *
 * `panel` er chipens utvidede liste — alle tre tidene for det åpne punktet, så
 * leseren ser hva hun bytter TIL før hun bytter. `segment` er kart-kontrollens
 * ikon-rad, som bare viser hvilken modus som er aktiv.
 *
 * Én komponent, ikke to: rekkefølgen, etikettene, ikonene, aria-tekstene og
 * regelen for utilgjengelig data må være identiske på de to flatene. Er de ikke
 * det, drifter de fra hverandre — samme grunn til at `BoardMapControls` deler
 * `controlsBody` mellom pillen og FAB-popoveren.
 *
 * Tidene kommer fra PRECOMPUTED data (`POI.travelTime`), ikke fra Directions.
 * Derfor har panelet ingen lastetilstand: tallene finnes i det chipen åpnes.
 */

/** Ikon per modus. Eksportert fordi chipen viser aktiv modus' ikon kollapset —
 *  to kart ville kunnet drifte fra hverandre. */
export const TRAVEL_MODE_ICONS: Record<TravelMode, LucideIcon> = {
  walk: Footprints,
  bike: Bike,
  car: Car,
};

interface Props {
  /**
   * Modusene som faktisk har data på boardet, i visningsrekkefølge. Kommer fra
   * `availableTravelModes` — modus uten data skjules, de vises ikke tomme (R6).
   */
  modes: readonly TravelMode[];
  active: TravelMode;
  onChange: (mode: TravelMode) => void;
  variant: "panel" | "segment";
  /**
   * Reisetid per modus for det åpne punktet, i minutter. Bare `panel` bruker
   * dem. En modus uten verdi her markeres som «ingen rute», ikke «undefined min».
   */
  minutesByMode?: Partial<Record<TravelMode, number>>;
  /** Touch-vennlig høyde (mobil). Default false. */
  compact?: boolean;
}

export function TravelModeSelector({
  modes,
  active,
  onChange,
  variant,
  minutesByMode,
  compact = false,
}: Props) {
  // Én modus er ikke et valg. Da rendres ingen veksler i det hele tatt, og
  // flaten ser ut som før modusen fantes.
  if (modes.length < 2) return null;

  /* Finnes det i det hele tatt et tall å ta forbehold om? Ikke det samme som
   * «ble `minutesByMode` sendt inn»: et kallsted kan levere `{}` — da er hver
   * rad «–», og «alle tider er omtrentlige» ville stått over ingenting. */
  const hasAnyMinutes =
    minutesByMode !== undefined &&
    modes.some((m) => typeof minutesByMode[m] === "number");

  if (variant === "segment") {
    return (
      <div
        role="group"
        aria-label="Reisemåte"
        className="flex items-center gap-0.5"
      >
        {modes.map((mode) => {
          const Icon = TRAVEL_MODE_ICONS[mode];
          const isActive = mode === active;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              aria-pressed={isActive}
              aria-label={travelModeLabels[mode]}
              title={travelModeLabels[mode]}
              className={cn(
                "inline-flex items-center justify-center rounded-full transition-colors duration-200",
                compact ? "h-11 w-11" : "h-8 w-9",
                isActive
                  ? "bg-stone-900 text-white shadow-sm"
                  : "text-stone-500 hover:text-stone-700",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Reisemåte" className="flex flex-col">
      {modes.map((mode) => {
        const Icon = TRAVEL_MODE_ICONS[mode];
        const isActive = mode === active;
        const minutes = minutesByMode?.[mode];
        return (
          <button
            key={mode}
            type="button"
            onClick={() => onChange(mode)}
            aria-pressed={isActive}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150",
              isActive ? "bg-stone-100" : "hover:bg-stone-50",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive ? "text-stone-900" : "text-stone-500",
              )}
            />
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[13.5px]",
                isActive ? "font-semibold text-stone-900" : "text-stone-600",
              )}
            >
              {travelModeLabels[mode]}
            </span>
            {/* Mangler ruten for denne modusen, sier vi det — aldri «undefined min».
                Er `minutesByMode` helt utelatt, er det ikke ruten som mangler:
                da finnes det ikke noe punkt å måle til ennå (omvisningens
                enhet over minutt-kolonnen åpnes før et sted er valgt), og «–»
                tre ganger ville lest som «ingen rute finnes». */}
            {minutesByMode !== undefined && (
              <span
                className={cn(
                  "shrink-0 text-[13px] tabular-nums",
                  isActive ? "font-semibold text-stone-900" : "text-stone-500",
                )}
              >
                {minutes === undefined ? "–" : `${minutes} min`}
              </span>
            )}
          </button>
        );
      })}
      {/* Forbeholdet gjelder TALLENE, så det rendres bare når det finnes noen.
          Listeoverskriften i nabolagsflaten åpner panelet uten `minutesByMode`
          — der er det ingen tider å ta forbehold om. */}
      {hasAnyMinutes && (
        <p className="mt-1 border-t border-black/5 px-2.5 pt-1.5 text-[11.5px] text-stone-400">
          Alle tider er omtrentlige
        </p>
      )}
    </div>
  );
}
