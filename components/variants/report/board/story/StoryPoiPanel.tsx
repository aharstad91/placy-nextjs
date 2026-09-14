"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";
import type { TravelMode } from "@/lib/types";
import { markerCircleStyle } from "../marker-style";
import { PoiDetailBody, hasGroundedNarrative } from "../PoiDetail";
import { StatusBadge } from "../SourcedContent";
import type { BoardPOI } from "../board-data";
import { useActivePOI, useBoard } from "../board-state";
import { useDesktopPlacePanel } from "../use-popup-mode";
import { storyMinutes } from "./story-model";

/**
 * Stedets EGEN side, over sidekolonnen (2026-08-28, utvidet 2026-09-15).
 *
 * ## Hvem som får en side
 *
 * Opprinnelig bare ankrene: `poi.isAnchor` er sant for kjøpesentre og
 * idrettsanlegg, og registeret deres (åtte kategorirader, 50 virksomheter) blir
 * en vegg midt i en liste om det foldes inn i raden. Alt annet foldet seg ut der
 * raden sto.
 *
 * Fra 2026-09-15 kan boardet be om at ALLE steder åpner her (`placePanel` på
 * BoardProvider, gatet på desktop i `useDesktopPlacePanel`). Da er panelet ikke
 * lenger ankerets unntak, men den ene detaljflaten — og den må se bevisst ut
 * for et sted som bare har navn, kategori og fire minutter, like mye som for
 * et med bilde og to avsnitt. Derfor er hodet bygget av det ALLE steder har
 * (navn, kategori, minutter), og bildet og teksten er tillegg som forsvinner
 * uten å etterlate hull. Ingen «vi har ikke innhold»-avsnitt: et tomt sted er
 * en kort side, ikke en beklagelse.
 *
 * ## Hvorfor et lag og ikke en ny rute
 *
 * Omvisningen står bak og skal stå der. Panelet ligger `absolute inset-0` i
 * oversiktens egen boks (den `relative` flex-boksen i `StoryColumn` som holder
 * scroll-lista, 2026-09-15 — før det hele `<aside>`), så det dekker bare
 * oversikten, ikke logoen over eller Anja-linja under, og kolonnen beholder
 * scroll-posisjonen sin, det åpne stoppet og den åpne raden — tilbakeknappen
 * legger bare laget bort igjen. Kartet er urørt hele veien: punktet ble åpnet
 * av trykket som førte hit, og panelet flytter aldri kameraet.
 *
 * ## Hvorfor det ikke er modalen
 *
 * Modalen dekker skjermen og tar kartet med seg. Her er hele poenget at kartet
 * blir stående synlig ved siden av teksten — du leser om stedet mens du ser hvor
 * det ligger. Modalen er fortsatt mobilens stedsflate, og desktop-flaten på
 * boards uten omvisning (se `POIExploreModalHost`).
 *
 * ## Hvorfor det ikke er en dialog
 *
 * Panelet er en `region`, ikke en `dialog`: kartet ved siden av skal fortsatt
 * kunne brukes mens siden står åpen, så ingen fokusfelle. Det tastaturet får er
 * det en ikke-modal flate skylder: fokus inn på tilbakeknappen når den åpner,
 * og tilbake der det kom fra når den lukker.
 */

const TRAVEL_LABEL: Record<TravelMode, string> = {
  walk: "til fots",
  bike: "på sykkel",
  car: "med bil",
};

export function StoryPoiPanel() {
  const { state, dispatch } = useBoard();
  const activePoi = useActivePOI();
  const engagement = useEngagement();
  const placePanel = useDesktopPlacePanel();

  const open = state.exploreOpen && activePoi !== null;

  /* Holder på stedet mens laget glir UT. Uten det ville panelet blitt tomt i
     samme frame som knappen ble trykket, og utgangen sett ut som en hvit
     firkant som skyves til høyre. */
  const [shown, setShown] = useState<BoardPOI | null>(null);
  useEffect(() => {
    if (open && activePoi) setShown(activePoi);
  }, [open, activePoi]);

  /* Under panel-policyen ER lukking «legg fra deg stedet»: markøren skal
     også slippes, ellers står punktet valgt i kartet uten noen flate som viser
     det. Uten policy (ankerpanelet på andre boards) beholdes markøren som før —
     der ble punktet åpnet av en gest som fortsatt gjelder. */
  const closeAction = placePanel ? "BACK_TO_DEFAULT" : "CLOSE_EXPLORE";
  const close = () => dispatch({ type: closeAction });

  // Escape lukker laget, ikke omvisningen bak det. Modalen har samme tast, men
  // de to er aldri åpne samtidig (`tourOwnsPlaces` i POIExploreModalHost).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: closeAction });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dispatch, closeAction]);

  /* Fokus (2026-09-15). Ved åpning flyttes fokus til tilbakeknappen — det er
     den ene handlingen alle sider har, og den ligger først i lesesrekkefølgen.
     Ved lukking går fokus tilbake til det som hadde det før (raden, markøren),
     hvis det fortsatt finnes; ellers til body, så det ikke blir stående på et
     inert element utenfor skjermen. */
  const backRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  // `shown` settes én render ETTER `open`; før det finnes ingen knapp å flytte
  // fokus til, så effekten venter på at laget faktisk er i DOM.
  const visible = open && shown !== null;
  useEffect(() => {
    if (visible && !wasOpen.current) {
      const prev = document.activeElement;
      restoreRef.current = prev instanceof HTMLElement ? prev : null;
      // `preventScroll`: kortet står på `translate-x-[110%]` i den framen fokus
      // flyttes (overgangen inn har ikke begynt), og et vanlig `focus()` fikk
      // nettleseren til å rulle hele det innrammede skallet sidelengs for å
      // vise knappen — kolonnen forsvant ut til venstre (målt i Chrome
      // 2026-09-15). Fokus skal flyttes, ikke utsnittet.
      backRef.current?.focus({ preventScroll: true });
    } else if (!visible && wasOpen.current) {
      const prev = restoreRef.current;
      restoreRef.current = null;
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
      else document.body.focus();
    }
    wasOpen.current = visible;
  }, [visible]);

  /* Bytte av sted i et åpent panel skal starte på toppen: leseren har scrollet
     ned i sted A, og sted B skal ikke arve den posisjonen. */
  const scrollRef = useRef<HTMLDivElement>(null);
  const shownId = shown ? String(shown.id) : null;
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [shownId]);

  /* Bildefeil nøklet på stedets id: et brutt bilde for A skal ikke skjule
     bildet for B, og et bilde for A som lander sent skal ikke vises i B —
     `key` på bildeboksen sørger for at elementet byttes, ikke gjenbrukes. */
  const [brokenImageId, setBrokenImageId] = useState<string | null>(null);

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

  const featuredImage = shown?.raw.featuredImage;
  const showImage = Boolean(featuredImage) && brokenImageId !== shownId;

  /* Hovedbildet skal ikke stå to ganger: står samme URL også i galleriet, får
     PoiDetailBody galleriet uten den. Resten av stedet sendes urørt videre. */
  const bodyPoi = useMemo(() => {
    if (!shown) return null;
    const gallery = shown.raw.galleryImages;
    if (!featuredImage || !gallery?.includes(featuredImage)) return shown;
    return {
      ...shown,
      raw: { ...shown.raw, galleryImages: gallery.filter((u) => u !== featuredImage) },
    };
  }, [shown, featuredImage]);

  if (!shown || !bodyPoi) return null;

  const circle = markerCircleStyle(shown.color);
  const minutes = storyMinutes(shown, state.travelMode);
  const headingId = `story-poi-panel-title-${shownId}`;
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
          rundt kortet i det hele tatt leses. Uten den er kortet hvitt på hvitt, og
          rammen ser ut som luft i én og samme flate.

          Uskarpheten gjør den andre halvparten av jobben: en tekstlinje som er
          kuttet på midten av kortets kant ser ut som en feil så lenge den er
          skarp, og som bakgrunn i det den er myk. Da er det tydelig HVA som
          ligger under — omvisningen, fortsatt der du forlot den — uten at den
          konkurrerer om blikket. */}
      <div
        aria-hidden
        className={cn(
          /* Ingen radius her: boksen panelet ligger i (oversikten mellom
             logoen og Anja-linja, 2026-09-15) er ikke avrundet selv. */
          "absolute inset-0 bg-stone-900/[0.18] backdrop-blur-[3px]",
          "transition-opacity [transition-duration:420ms] motion-reduce:transition-none",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Selve kortet: litt mindre enn boksen på alle kanter, så du SER
          omvisningen ligge under det hele veien rundt (Andreas, 2026-08-28:
          «kunne vi fått en slags layered look, så vi ser at den ligger over»).

          2026-09-15: panelet monteres nå i oversiktens egen boks (mellom logoen
          og Anja-linja), ikke over hele kolonnen. Boksen har ingen avrundede
          hjørner, så det er ikke lenger noen kolonneradius å løpe konsentrisk
          med — kortet får sin egen 14 px, og innrykket er 12 px i sidene og
          8 px oppe/nede så det ikke stjeler høyde fra en boks som alt er
          klemt mellom to andre.

          Hvorfor MINDRE og ikke større: et kort som stikker utenfor ville måttet
          bryte ut av boksens `overflow-hidden`, og du ville fortsatt ikke sett
          flaten det ligger på — bare kartet. Det er nettopp omvisningen som skal
          være synlig under. */}
      <div
        role="region"
        aria-labelledby={headingId}
        className={cn(
          "absolute inset-x-3 inset-y-2 flex flex-col overflow-hidden rounded-[14px] bg-white",
          "shadow-[0_16px_40px_-8px_rgba(28,25,23,0.45)] ring-1 ring-black/[0.06]",
          "transition-transform [transition-duration:420ms] motion-reduce:transition-none",
          "[transition-timing-function:cubic-bezier(0.32,0.72,0,1)]",
          open ? "translate-x-0" : "translate-x-[110%]",
        )}
      >
        {/* Fast topp: bare tilbakeknappen. Den scroller ikke med, så veien ut
            er alltid på samme sted uansett hvor langt ned leseren har kommet. */}
        <div className="flex shrink-0 items-center px-4 pb-2 pt-4">
          <button
            ref={backRef}
            type="button"
            data-testid="story-poi-panel-close"
            onClick={close}
            aria-label="Tilbake til oversikten"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-900/[0.05] text-stone-600 transition-colors duration-150 hover:bg-stone-900/10 hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
          >
            <ArrowLeft size={18} />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {showImage && featuredImage && (
            <div
              key={shownId}
              data-testid="story-poi-panel-image"
              className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-[10px] bg-stone-100"
            >
              <Image
                src={featuredImage}
                alt={shown.name}
                fill
                sizes="438px"
                className="object-cover"
                onError={() => setBrokenImageId(shownId)}
              />
            </div>
          )}

          {/* Hodet er det ALLE steder har. Et sted uten bilde og tekst er
              ferdig etter disse linjene, og skal se ferdig ut. */}
          <h2
            id={headingId}
            className="text-[21px] font-bold leading-[1.2] tracking-[-0.02em] text-stone-900"
          >
            {shown.name}
          </h2>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13.5px] text-stone-500">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 flex-none rounded-full border-2"
              style={{
                borderColor: circle.borderColor,
                backgroundColor: circle.backgroundColor,
              }}
            />
            <span>{shown.raw.category.name}</span>
            {shown.address && (
              <>
                <span aria-hidden>·</span>
                <span className="min-w-0 truncate">{shown.address}</span>
              </>
            )}
            <StatusBadge status={shown.raw.developmentStatus} />
          </p>
          {minutes !== undefined && (
            <p
              data-testid="story-poi-panel-minutes"
              className="mt-3 text-[13.5px] font-medium text-stone-700"
            >
              {minutes} min {TRAVEL_LABEL[state.travelMode]}
            </p>
          )}

          {/* Uten `emptyText`: har stedet ikke tekst, står hodet alene. Merket
              «Planlagt» bæres av kategorilinja over, så kroppen skal ikke
              gjenta det. */}
          <div className="mt-4">
            <PoiDetailBody poi={bodyPoi} galleryClassName="-mx-6 px-6" showStatus={false} />
          </div>
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
