"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn, travelModeLabels } from "@/lib/utils";
import { TRAVEL_MODE_ICONS, TravelModeSelector } from "../TravelModeSelector";
import {
  useActivePOI,
  useAvailableTravelModes,
  useBoard,
} from "../board-state";

/**
 * Reisemåten som ENHET over minutt-kolonnen.
 *
 * Lå velgeren i kategori-raden, hadde den samme form som stoppene — ikon over
 * navn — men gjorde noe helt annet: den flytter deg ikke, den endrer betydningen
 * av tall lenger opp. En tab-rad der én av brikkene er en innstilling lover et
 * stopp som ikke finnes.
 *
 * Her står den der tallene står, i overskriftsraden rett over lista. Da leser
 * den som en enhet — «disse tidene er i gange» — og ikke som en destinasjon.
 *
 * ## Helt ut i høyre kant (2026-09-02)
 *
 * Den lå før på `mr-[39px]`, målt inn i stedslista slik at etiketten landet
 * nøyaktig over «3 min»-kolonnen og ikke over chevronen. Målingen var riktig og
 * likevel feil: en brikke som står 39 px inn fra kanten leser ikke som «over
 * minuttene», den leser som tilfeldig plassert (Andreas, 2026-09-02). Raden den
 * står i har overskriften flust i venstre kant, og da er den eneste kanten
 * brikken kan svare på den høyre.
 *
 * `-mr-1.5` nuller knappens egen vannrette padding, så det er TEKSTEN som
 * flukter med kanten av lista under — ikke den usynlige treffflaten rundt den.
 *
 * Panelet er `TravelModeSelector variant="panel"` — samme komponent chipen på
 * ruta bruker. To innganger til samme tilstand er med vilje; er de ulike, leser
 * de som to funksjoner.
 */
export function StoryTravelCell() {
  const { state, dispatch } = useBoard();
  const modes = useAvailableTravelModes();
  const activePoi = useActivePOI();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Trykk utenfor lukker uten å bytte modus — samme regel som chipen på ruta.
  // Capture, så det skjer før flaten under rekker å reagere på trykket.
  useEffect(() => {
    if (!open) return;
    const onDown = (ev: PointerEvent) => {
      const t = ev.target;
      if (t instanceof Node && wrapperRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const change = useCallback(
    (mode: (typeof modes)[number]) => {
      // Modusbytte rører ALDRI navigasjonen — bare tallene. Du står i samme
      // stopp, med de samme stedene åpne, og ser tidene endre seg.
      dispatch({ type: "SET_TRAVEL_MODE", mode });
      setOpen(false);
    },
    [dispatch],
  );

  // Én modus er ikke et valg — samme regel som velgeren selv (R6).
  if (modes.length < 2) return null;

  const active = modes.includes(state.travelMode) ? state.travelMode : modes[0];
  const ActiveIcon = TRAVEL_MODE_ICONS[active];

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-label="Reisemåte"
        className={cn(
          "-mr-1.5 flex items-center gap-[3px] rounded-lg px-1.5 py-[3px]",
          "text-[12.5px] font-semibold tracking-[0.02em] whitespace-nowrap",
          "transition-colors duration-150",
          open
            ? "bg-stone-900/[0.06] text-stone-900"
            : "text-stone-500 hover:bg-stone-900/[0.05] hover:text-stone-900",
        )}
      >
        <ActiveIcon className="h-[13px] w-[13px] shrink-0" />
        <span>{travelModeLabels[active]}</span>
        <ChevronDown
          size={13}
          aria-hidden
          className={cn(
            "shrink-0 text-stone-400 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        // Folder NEDOVER, alltid: overskriften står øverst i fanen, og over den
        // er det bare faneraden. Chipen på ruta måler retningen ved åpning fordi
        // den kan ligge hvor som helst i viewporten — her kan den ikke.
        <div className="absolute right-0 top-full z-20 mt-1.5 w-[194px] rounded-2xl border border-stone-200 bg-white/[0.97] p-1.5 shadow-[0_14px_34px_rgba(28,25,23,0.2)] backdrop-blur">
          <TravelModeSelector
            variant="panel"
            modes={modes}
            active={active}
            // Tidene i panelet hører til det ÅPNE stedet. Uten et åpent sted
            // vises bare navnene: «–» tre ganger ville lest som «ingen rute
            // finnes», ikke som «du har ikke valgt et sted ennå».
            minutesByMode={activePoi?.raw.travelTime}
            onChange={change}
          />
        </div>
      )}
    </div>
  );
}
