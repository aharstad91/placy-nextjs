"use client";

import { Bike, Car, Footprints, type LucideIcon } from "lucide-react";
import { travelModeLabels } from "@/lib/utils";
import { ControlPanelRow } from "./ControlDropdown";
import type { TravelMode } from "@/lib/types";

/**
 * Modus-utvalget — listen over reisemåter, delt av alle inngangene til
 * `SET_TRAVEL_MODE` (R5): chipen på ruta, chipen i 3D, enheten over
 * minutt-kolonnen i nabolagslista, cellen i omvisningens kolonne og
 * kart-kontrollen nederst.
 *
 * Én komponent, ikke fem: rekkefølgen, etikettene, ikonene, aria-tekstene og
 * regelen for utilgjengelig data må være identiske på alle flatene. Er de ikke
 * det, drifter de fra hverandre — samme grunn til at `BoardMapControls` deler
 * `controlsBody` mellom pillen og FAB-popoveren.
 *
 * Tidene kommer fra PRECOMPUTED data (`POI.travelTime`), ikke fra Directions.
 * Derfor har listen ingen lastetilstand: tallene finnes i det panelet åpnes.
 *
 * ## Hvorfor det bare finnes én variant (2026-09-07)
 *
 * Fram til nå hadde komponenten to: `panel` (denne lista) og `segment` (tre
 * ikonknapper på rad, brukt i kart-pillen). Segmentet er borte fordi pillen
 * gikk over til dropdown — utbrettet skalerte ikke, og en 36 px ikonknapp kunne
 * aldri bære «Sykkel · 8 min» slik raden kan. Se `ControlDropdown`.
 */

/** Ikon per modus. Eksportert fordi flere flater viser aktiv modus' ikon
 *  kollapset (chip, dropdown-trigger) — to kart ville kunnet drifte. */
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
  /**
   * Reisetid per modus for det åpne punktet, i minutter. En modus uten verdi
   * her markeres som «ingen rute», ikke «undefined min».
   */
  minutesByMode?: Partial<Record<TravelMode, number>>;
}

export function TravelModeSelector({
  modes,
  active,
  onChange,
  minutesByMode,
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

  return (
    <div role="group" aria-label="Reisemåte" className="flex flex-col">
      {modes.map((mode) => {
        const minutes = minutesByMode?.[mode];
        return (
          <ControlPanelRow
            key={mode}
            icon={TRAVEL_MODE_ICONS[mode]}
            label={travelModeLabels[mode]}
            active={mode === active}
            onClick={() => onChange(mode)}
            /* Mangler ruten for denne modusen, sier vi det — aldri «undefined
               min». Er `minutesByMode` helt utelatt, er det ikke ruten som
               mangler: da finnes det ikke noe punkt å måle til ennå
               (omvisningens enhet over minutt-kolonnen åpnes før et sted er
               valgt), og «–» tre ganger ville lest som «ingen rute finnes». */
            meta={
              minutesByMode === undefined
                ? undefined
                : minutes === undefined
                  ? "–"
                  : `${minutes} min`
            }
          />
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
