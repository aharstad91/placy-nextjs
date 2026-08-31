"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn, travelModeLabels } from "@/lib/utils";
import { useAvailableTravelModes, useBoard } from "../board-state";
import { TRAVEL_MODE_ICONS, TravelModeSelector } from "../TravelModeSelector";

/**
 * Reisemåte som ENHET over minutt-kolonnen — den tredje inngangen til
 * `SET_TRAVEL_MODE` i nabolagsflaten, og den første som står der tallene står.
 *
 * Lista sier «3 min» uten å si 3 min MED HVA. Kart-kontrollen og chipene på
 * ruta eier hver sin flate, men tallene leses i sheeten, og der fantes ingen
 * kontroll. Plassert i en listeoverskrift leser den som en kolonneoverskrift —
 * en enhet på tallene under — og ikke som en destinasjon.
 *
 * ## Hvorfor panelet ikke viser tider
 *
 * `variant="panel"` kan vise alle tre tidene for ETT sted, så leseren ser hva
 * hun bytter TIL før hun bytter. Det krever et A→B-par, og nabolagslista har
 * ingen: radene i `NeighbourhoodCategoryCard` og `CategoryPage` er
 * ikke-interaktive i Fase 1 (utvidbar rad kommer senere). Vi sender derfor
 * ingen `minutesByMode`, og panelet dropper både tallene og forbeholdet om at
 * de er omtrentlige.
 *
 * ## Hvorfor foldretningen er fast
 *
 * `BoardPathMidpointMarker` måler retning ved åpning fordi chipen sitter på en
 * geografisk posisjon og kan havne hvor som helst i viewporten. Denne står i
 * en overskriftsrad øverst i sin egen flate — det finnes ingen tilstand der
 * oppover er riktig.
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

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Panelet skal aldri overleve inn i en annen kontekst enn det ble åpnet i —
  // samme regel som chipen på ruta håndhever. Uten denne blir et åpent panel
  // stående over innhold det ikke lenger hører til.
  useEffect(() => {
    setOpen(false);
  }, [state.activePOIId, state.phase]);

  /* Trykk utenfor lukker uten å bytte. Capture, så flaten under ikke rekker å
   * reagere på trykket først.
   *
   * IKKE legg til `stopPropagation()` eller `preventDefault()` her. Lytteren er
   * bevisst passiv: den leser hvor trykket kom, og slipper det videre. Grep-
   * handlen til sheeten starter draget sitt på det samme `pointerdown`-eventet,
   * og en «defensiv» stopp her ville drept muligheten til å dra flaten så lenge
   * panelet står åpent — uten at noen test fanger det. */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  /* Panelet må aldri bli høyere enn plassen det faktisk har.
   *
   *  Sheeten er `overflow-hidden`, og panelet er `position: absolute` — det
   *  teller derfor ikke med i `measureContent()`, så sheetens innholdstak kan
   *  aldri vokse for å gi det plass. Da magneten fantes, ble flaten som regel
   *  dratt til et ytterpunkt ved slipp; nå blir brukeren stående der hun
   *  slapp, og lave hvilestillinger er langt vanligere. På den korteste
   *  skjermen vi støtter (gulvet er 236 px) trenger panelet mer enn det som
   *  finnes under kontrollen i ankomsttilstanden, og siste rad ble klippet
   *  bort — usynlig, men fortsatt «åpen».
   *
   *  Måler ved åpning i stedet for å gjette: taket er avstanden ned til
   *  sheetens egen underkant. Tre rader får plass i praksis; i det trange
   *  tilfellet blir menyen rullbar i stedet for avkuttet. */
  const [maxH, setMaxH] = useState<number | undefined>(undefined);

  const toggle = useCallback(() => {
    setOpen((wasOpen) => {
      if (wasOpen) return false;
      const wrap = wrapperRef.current;
      const clip = wrap?.closest("[data-testid='neighbourhood-sheet'], [data-testid='category-panel']");
      if (wrap && clip) {
        const room = clip.getBoundingClientRect().bottom - wrap.getBoundingClientRect().bottom;
        setMaxH(Math.max(96, room - 12));
      } else {
        setMaxH(undefined);
      }
      return true;
    });
  }, []);

  // Én modus er ikke et valg. Da rendres ingen veksler, og flaten ser ut som
  // før reisemåte fantes — samme regel som `TravelModeSelector` håndhever.
  if (modes.length < 2) return null;

  const active = modes.includes(state.travelMode) ? state.travelMode : modes[0];
  const ActiveIcon = TRAVEL_MODE_ICONS[active];

  return (
    <div ref={wrapperRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        data-testid="travel-mode-header-control"
        onClick={toggle}
        aria-expanded={open}
        aria-label="Reisemåte"
        className={cn(
          "flex items-center gap-1 rounded-lg px-1.5 py-0.5",
          "text-[11.5px] font-semibold tracking-wide whitespace-nowrap",
          "transition-colors duration-150",
          open ? "bg-black/[0.06] text-stone-900" : "text-stone-500 hover:bg-black/[0.05]",
        )}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{travelModeLabels[active]}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-stone-400 transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          style={maxH === undefined ? undefined : { maxHeight: maxH }}
          className="absolute right-0 top-full z-20 mt-1.5 w-48 overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white/95 p-1.5 shadow-xl ring-1 ring-black/5 backdrop-blur"
        >
          <TravelModeSelector
            variant="panel"
            modes={modes}
            active={active}
            onChange={(mode) => {
              onBeforeChange?.();
              dispatch({ type: "SET_TRAVEL_MODE", mode });
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
