"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";
import { markerCircleStyle } from "../marker-style";
import { PoiDetailBody, hasGroundedNarrative } from "../PoiDetail";
import type { BoardPOI } from "../board-data";
import { useActivePOI, useBoard } from "../board-state";

/**
 * Stedets EGEN side, over sidekolonnen (2026-08-28).
 *
 * ## Hvorfor noen steder trenger en side og andre ikke
 *
 * Regelen er ikke «mye innhold» — den er ikke avgjørbar, og to utviklere ville
 * trukket grensen ulikt. Regelen er om stedet INNEHOLDER andre steder:
 * `poi.isAnchor` er sant for kjøpesentre og idrettsanlegg, og bare der.
 *
 * Forskjellen er reell og ikke et spørsmål om lengde. Et vanlig sted er to
 * avsnitt og fire faktalinjer — det folder seg ut i raden der du står, og lista
 * rundt blir stående så du ser hvor stedet hører hjemme. Ankeret er et REGISTER:
 * Sirkus Shopping har åtte kategorirader med 50 virksomheter under seg, og de
 * virksomhetene finnes ikke noe annet sted i grensesnittet (absorpsjonen fjerner
 * dem fra temaet). Foldet inn i en rad blir registeret en vegg midt i en liste,
 * og radene under det dyttes en skjermhøyde ned.
 *
 * ## Hvorfor et lag og ikke en ny rute
 *
 * Omvisningen står bak og skal stå der. Panelet ligger `absolute inset-0` i
 * sidekolonnens egen boks (`<aside>` er `relative`), så kolonnen beholder
 * scroll-posisjonen sin, det åpne stoppet og den åpne raden — krysset legger
 * bare laget bort igjen. Kartet er urørt hele veien: punktet ble åpnet av
 * trykket som førte hit, og panelet flytter aldri kameraet.
 *
 * ## Hvorfor det ikke er modalen
 *
 * Modalen dekker skjermen og tar kartet med seg. Her er hele poenget at kartet
 * blir stående synlig ved siden av teksten — du leser om stedet mens du ser hvor
 * det ligger. Modalen er fortsatt mobilens stedsflate, og desktop-flaten på
 * boards uten omvisning (se `POIExploreModalHost`).
 */
export function StoryPoiPanel() {
  const { state, dispatch } = useBoard();
  const activePoi = useActivePOI();
  const engagement = useEngagement();

  const open = state.exploreOpen && activePoi !== null;

  /* Holder på stedet mens laget glir UT. Uten det ville panelet blitt tomt i
     samme frame som krysset ble trykket, og utgangen sett ut som en hvit
     firkant som skyves til høyre. */
  const [shown, setShown] = useState<BoardPOI | null>(null);
  useEffect(() => {
    if (open && activePoi) setShown(activePoi);
  }, [open, activePoi]);

  const close = () => dispatch({ type: "CLOSE_EXPLORE" });

  // Escape lukker laget, ikke omvisningen bak det. Modalen har samme tast, men
  // de to er aldri åpne samtidig (`tourOwnsPlaces` i POIExploreModalHost).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "CLOSE_EXPLORE" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dispatch]);

  /* Moat 2-signalet. Samme kontrakt som modalens: ÉN gang per åpning, i en
     effekt, med `poi.id` som nøkkel så et bytte av sted mens laget står åpent
     teller som en ny åpning.

     ToS-grense: vi logger AT flaten ble åpnet. ALDRI klikk på enkelte
     kildelenker eller Search Suggestions. */
  const emitKey = open && activePoi ? String(activePoi.id) : null;
  const lastEmitted = useRef<string | null>(null);
  useEffect(() => {
    if (emitKey === null) {
      lastEmitted.current = null;
      return;
    }
    if (lastEmitted.current === emitKey) return;
    lastEmitted.current = emitKey;
    if (activePoi) {
      engagement.emit("poi_explore_opened", {
        poiId: String(activePoi.id),
        payload: {
          category_id: activePoi.categoryId,
          has_grounding: hasGroundedNarrative(activePoi.raw.grounding),
        },
      });
    }
    // activePoi er stabil for en gitt emitKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emitKey]);

  if (!shown) return null;

  const Icon = getFilledIcon(shown.raw.category.icon);
  const circle = markerCircleStyle(shown.raw.category.color);
  // Ekstern lenke KUN når vi ikke har grounded narrativ — har vi det, er
  // kildelenkene i attribusjonsblokken utveien, og en ekstra «gå til Google»
  // ville undergravd poenget med å beholde leseren.
  const fallbackUrl = hasGroundedNarrative(shown.raw.grounding)
    ? null
    : `https://www.google.com/search?udm=50&q=${encodeURIComponent(
        shown.address ? `${shown.name} ${shown.address}` : shown.name,
      )}`;

  return (
    <div
      data-testid="story-poi-panel"
      data-open={open}
      aria-hidden={!open}
      /* `inert` og ikke bare aria-hidden: laget står igjen i DOM for å kunne gli
         UT, og uten dette kunne du tabbe deg inn i et panel som ligger utenfor
         skjermen. */
      inert={!open}
      className={cn("absolute inset-0 z-30", !open && "pointer-events-none")}
    >
      {/* Skyggen kortet kaster NEDOVER på omvisningen — og grunnen til at rammen
          på 12 px i det hele tatt leses. Uten den er kortet hvitt på hvitt, og
          rammen ser ut som luft i én og samme flate.

          Uskarpheten gjør den andre halvparten av jobben: en tekstlinje som er
          kuttet på midten av kortets kant ser ut som en feil så lenge den er
          skarp, og som bakgrunn i det den er myk. Da er det tydelig HVA som
          ligger under — omvisningen, fortsatt der du forlot den — uten at den
          konkurrerer om blikket. */}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-[26px] bg-stone-900/[0.18] backdrop-blur-[3px]",
          "transition-opacity [transition-duration:420ms]",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Selve kortet: 12 px mindre enn kolonnen på alle kanter, så du SER
          omvisningen ligge under det hele veien rundt (Andreas, 2026-08-28:
          «kunne vi fått en slags layered look, så vi ser at den ligger over»).
          Radien er kolonnens minus innrykket (26 − 12), som er det som gjør at
          hjørnene løper konsentrisk i stedet for å se ut som to ulike former.

          Hvorfor MINDRE og ikke større: et kort som stikker utenfor ville måttet
          bryte ut av kolonnens `overflow-hidden`, og du ville fortsatt ikke sett
          flaten det ligger på — bare kartet. Det er nettopp omvisningen som skal
          være synlig under. */}
      <div
        className={cn(
          "absolute inset-3 flex flex-col overflow-hidden rounded-[14px] bg-white",
          "shadow-[0_16px_40px_-8px_rgba(28,25,23,0.45)] ring-1 ring-black/[0.06]",
          "transition-transform [transition-duration:420ms]",
          "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-x-0" : "translate-x-[110%]",
        )}
      >
        {/* Hodet bærer det raden bar: ikonet i kategoriens farge, navnet, og
          adressen som undertekst. Krysset står der en lukkeknapp alltid har
          ligget. */}
        <div className="flex shrink-0 items-start gap-3 px-6 pb-3 pt-6">
          <span
            aria-hidden
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-2"
            style={{
              borderColor: circle.borderColor,
              backgroundColor: circle.backgroundColor,
              color: circle.borderColor,
            }}
          >
            <Icon className="h-[18px] w-[18px]" weight="fill" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-[19px] font-bold leading-[1.2] tracking-[-0.02em] text-stone-900">
              {shown.name}
            </h2>
            <p className="mt-0.5 truncate text-[13.5px] text-stone-500">
              {shown.address ?? shown.raw.category.name}
            </p>
          </div>
          <button
            type="button"
            data-testid="story-poi-panel-close"
            onClick={close}
            aria-label="Lukk"
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-stone-900/[0.05] text-stone-500 transition-colors duration-150 hover:bg-stone-900/10 hover:text-stone-900"
          >
            <X size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PoiDetailBody
            poi={shown}
            galleryClassName="-mx-6 px-6"
            emptyText="Vi har ikke noe redaksjonelt innhold om dette stedet ennå."
          />
        </div>

        {fallbackUrl && (
          <div className="shrink-0 border-t border-stone-200/80 px-6 py-3">
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-stone-100 px-3 py-2.5 text-[13px] font-medium text-stone-700 transition hover:bg-stone-200"
            >
              <ExternalLink aria-hidden className="h-3.5 w-3.5" />
              Se mer på Google
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default StoryPoiPanel;
