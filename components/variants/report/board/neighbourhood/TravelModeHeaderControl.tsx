"use client";

import { cn, travelModeLabels } from "@/lib/utils";
import { useAvailableTravelModes, useBoard } from "../board-state";
import { ControlDropdown } from "../ControlDropdown";
import { TRAVEL_MODE_ICONS, TravelModeSelector } from "../TravelModeSelector";

/**
 * Reisemåte som ENHET over minutt-kolonnen — inngangen til
 * `SET_TRAVEL_MODE` i nabolagsflaten, og den ene som står der tallene står.
 *
 * Lista sier «3 min» uten å si 3 min MED HVA. Kart-kontrollen og chipene på
 * ruta eier hver sin flate, men tallene leses i sheeten, og der fantes ingen
 * kontroll. Plassert i en listeoverskrift leser den som en kolonneoverskrift —
 * en enhet på tallene under — og ikke som en destinasjon.
 *
 * Trigger + panel er `ControlDropdown` (delt med kart-kontrollen nederst);
 * her bare i `header`-variant, som er 11.5 px og leser som en kolonnetittel.
 *
 * ## Hvorfor panelet ikke viser tider
 *
 * Reisemåte-panelet kan vise alle tre tidene for ETT sted, så leseren ser hva
 * hun bytter TIL før hun bytter. Det krever et A→B-par, og nabolagslista har
 * ingen: radene i `NeighbourhoodCategoryCard` og `CategoryPage` er
 * ikke-interaktive i Fase 1 (utvidbar rad kommer senere). Vi sender derfor
 * ingen `minutesByMode`, og panelet dropper både tallene og forbeholdet om at
 * de er omtrentlige.
 */
export function TravelModeHeaderControl({
  className,
  onBeforeChange,
}: {
  className?: string;
  /** Kalles rett FØR modusen byttes, mens flaten fortsatt viser den gamle
   *  rekkefølgen. Kategorisiden bruker den til å notere hvilken rad som ligger
   *  øverst, så den kan legges tilbake dit etter at lista har sortert seg om. */
  onBeforeChange?: () => void;
}) {
  const { state, dispatch } = useBoard();
  const modes = useAvailableTravelModes();

  // Én modus er ikke et valg. Da rendres ingen veksler, og flaten ser ut som
  // før reisemåte fantes — samme regel som `TravelModeSelector` håndhever.
  if (modes.length < 2) return null;

  const active = modes.includes(state.travelMode) ? state.travelMode : modes[0];

  return (
    <ControlDropdown
      variant="header"
      direction="down"
      align="right"
      icon={TRAVEL_MODE_ICONS[active]}
      label={travelModeLabels[active]}
      ariaLabel="Reisemåte"
      testId="travel-mode-header-control"
      className={cn(className)}
      /* Panelet må aldri bli høyere enn plassen det faktisk har: sheeten er
         `overflow-hidden`, og et absolutt plassert panel teller ikke i
         innholdsmålingen, så flaten kan ikke vokse for å gi det plass. */
      clipSelector="[data-testid='neighbourhood-sheet'], [data-testid='category-panel']"
      /* Et åpent panel skal ikke overleve inn i en annen kontekst enn det ble
         åpnet i. */
      closeKey={`${state.activePOIId ?? ""}:${state.phase}`}
    >
      {(close) => (
        <TravelModeSelector
          modes={modes}
          active={active}
          onChange={(mode) => {
            onBeforeChange?.();
            dispatch({ type: "SET_TRAVEL_MODE", mode });
            close();
          }}
        />
      )}
    </ControlDropdown>
  );
}
