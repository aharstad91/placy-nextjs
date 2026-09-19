"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ChevronRight, Info } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";
import { cn } from "@/lib/utils";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";
import { useRealtimeData } from "@/lib/hooks/useRealtimeData";
import type { TravelMode } from "@/lib/types";
import { POIRealtimeSection } from "../../blocks/POIRealtimeSection";
import { markerCircleStyle } from "../marker-style";
import { PoiDetailBody, hasGroundedNarrative } from "../PoiDetail";
import { StatusBadge } from "../SourcedContent";
import type { BoardCategory, BoardPOI } from "../board-data";
import { findBoardCategoryOf } from "../board-data";
import { useActivePOI, useBoard } from "../board-state";
import { useDesktopPlacePanel } from "../use-popup-mode";
import { byMinutesThenName, storyMinutes } from "./story-model";
import { useStoryTourOptional } from "./story-tour";

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
 * scroll-lista), så det dekker bare oversikten, ikke logoen over eller
 * Anja-linja under, og kolonnen beholder scroll-posisjonen sin, det åpne
 * stoppet og den åpne raden — tilbakeknappen legger bare laget bort igjen.
 * Kartet er urørt hele veien: punktet ble åpnet av trykket som førte hit, og
 * panelet flytter aldri kameraet.
 *
 * ## Hvorfor det ikke ser ut som et kort (2026-09-15)
 *
 * Første versjon var et hvitt kort med skygge, ring, radius og innrykk over
 * en dimmet oversikt. Andreas: «nå ser det ut som et kort oppå sidebaren …
 * jeg ville latt det føles som at sidebaren skifter innhold når du velger et
 * sted». Derfor: ingen skygge, ramme eller innrykk. Flaten fyller boksen og
 * har samme bakgrunn som kolonnen (Nyhavna overstyrer til krem i
 * `nyhavna-brand.css`), logo og Anja står fast, og bare innholdet mellom dem
 * skifter. Overgangen er en kort forskyvning med fading — oversikten glir litt
 * til venstre og ut (i `StoryColumn`), stedet kommer inn fra høyre; ved retur
 * reverseres det. Hele flaten beveger seg ikke, bare innholdet.
 *
 * Tilbakeknappen sier hvor du kommer tilbake («Tilbake til Oppvekst» på et
 * tema, «Tilbake til oversikten» på området), og «Se mer på Google» er en rad
 * blant de andre lenkene i faktalista, ikke en stor knapp nederst.
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
  const { state, dispatch, data } = useBoard();
  const activePoi = useActivePOI();
  const engagement = useEngagement();
  const placePanel = useDesktopPlacePanel();
  const tour = useStoryTourOptional();
  const stopName = tour?.stop?.label ?? null;

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
      // `preventScroll`: da flaten gled inn fra `translate-x-[110%]` fikk et
      // vanlig `focus()` nettleseren til å rulle hele det innrammede skallet
      // sidelengs for å vise knappen (målt i Chrome 2026-09-15). Forskyvningen
      // er nå 8 px, men fokus skal fortsatt flyttes uten å røre utsnittet.
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

  /* Forbeholdet om kartpunktets presisjon ligger bak et infoikon ved adressen
     (2026-09-15): som egen linje tok det nesten like mye plass som beskrivelsen.
     Panelet er desktop-only, så «bak et ikon» er ikke «borte på mobil» her.
     Lukkes ved bytte av sted. */
  const [noteOpen, setNoteOpen] = useState(false);
  useEffect(() => {
    setNoteOpen(false);
  }, [shownId]);

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

  /* «Lignende steder» (2026-09-15): veien videre uten å gå tilbake til
     oversikten. Steder fra GJELDENDE kategori — stoppet du står i, som er
     konteksten du kom fra, ikke stedets egen kategori utledet på nytt. Står
     du på området (ingen kategori), brukes stedets egen. Sortert på lagret
     reisetid for valgt reisemåte, steder uten tid sist (byMinutesThenName),
     valgt sted utelatt, maks fem. Ingen ny datainnhenting, ingen rangering
     utover reisetiden vi alt har. */
  const similarCategory: BoardCategory | null =
    tour?.stop ?? (shown ? findBoardCategoryOf(data.categories, shown) : null);
  const similar = useMemo(() => {
    if (!shown || !similarCategory) return [];
    return similarCategory.pois
      .filter((p) => p.id !== shown.id)
      .sort(byMinutesThenName(state.travelMode))
      .slice(0, 5);
  }, [shown, similarCategory, state.travelMode]);

  const isTransportPOI = !!(
    shown?.raw.enturStopplaceId ||
    shown?.raw.bysykkelStationId ||
    shown?.raw.hyreStationId
  );
  const realtimeData = useRealtimeData(open && isTransportPOI && shown ? shown.raw : null);

  if (!shown || !bodyPoi) return null;

  const circle = markerCircleStyle(shown.color);
  const minutes = storyMinutes(shown, state.travelMode);
  const headingId = `story-poi-panel-title-${shownId}`;
  const noteId = `story-poi-panel-note-${shownId}`;
  const precisionNote =
    shown.raw.locationPrecision === "approximate" ? shown.raw.locationNote : undefined;
  // Ekstern lenke KUN når vi ikke har grounded narrativ — har vi det, er
  // kildelenkene i attribusjonsblokken utveien, og en ekstra «gå til Google»
  // ville undergravd poenget med å beholde leseren.
  const searchUrl = hasGroundedNarrative(shown.raw.grounding)
    ? null
    : `https://www.google.com/search?udm=50&q=${encodeURIComponent(
        shown.address ? `${shown.name} ${shown.address}` : shown.name,
      )}`;
  const backLabel = stopName ? `Tilbake til ${stopName}` : "Tilbake til oversikten";

  return (
    <div
      data-testid="story-poi-panel"
      data-open={open}
      aria-hidden={!open}
      /* `inert` og ikke bare aria-hidden: laget står igjen i DOM for å kunne gli
         UT, og uten dette kunne du tabbe deg inn i et panel som ligger utenfor
         skjermen. */
      inert={!open}
      role="region"
      aria-labelledby={headingId}
      className={cn(
        /* Samme flate som kolonnen: ingen skygge, ring, radius eller innrykk.
           `bg-white` er kolonnens egen farge i omvisningen; Nyhavna overstyrer
           begge til krem i nyhavna-brand.css. */
        "absolute inset-0 z-30 flex flex-col bg-white",
        /* Kort forskyvning med fading, ikke en flate som glir inn. 8 px er nok
           til at retningen leses (fra høyre inn, tilbake til høyre ut) uten at
           det blir en bevegelse man venter på. */
        "transition-[transform,opacity] duration-[260ms] ease-out motion-reduce:transition-none",
        open ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-2 opacity-0",
      )}
    >
      {/* Fast topp: tilbakeknappen med navnet på stedet du kommer tilbake til.
          Den scroller ikke med, så veien ut er alltid på samme sted uansett hvor
          langt ned leseren har kommet. */}
      <div className="flex shrink-0 items-center px-6 pb-1 pt-1">
        <button
          ref={backRef}
          type="button"
          data-testid="story-poi-panel-close"
          onClick={close}
          className="-ml-2 inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3 text-[13.5px] font-medium text-stone-600 transition-colors duration-150 hover:bg-stone-900/[0.05] hover:text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
        >
          <ArrowLeft size={16} aria-hidden />
          <span>{backLabel}</span>
        </button>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {showImage && featuredImage && (
          <div
            key={shownId}
            data-testid="story-poi-panel-image"
            className="relative mb-4 aspect-[16/10] w-full overflow-hidden rounded-[6px] bg-stone-100"
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

        {/* Hodet er det ALLE steder har, samlet tett under tittelen: kategori
            og adresse på én linje, minuttene rett under. Et sted uten bilde og
            tekst er ferdig etter disse linjene, og skal se ferdig ut. */}
        <h2
          id={headingId}
          className="text-[21px] font-bold leading-[1.2] tracking-[-0.02em] text-stone-900"
        >
          {shown.name}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13.5px] text-stone-500">
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
          {precisionNote && (
            <button
              type="button"
              data-testid="story-poi-panel-note-toggle"
              aria-label="Om kartpunktets plassering"
              aria-expanded={noteOpen}
              aria-controls={noteId}
              onClick={() => setNoteOpen((v) => !v)}
              className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-stone-400 transition-colors hover:text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-400"
            >
              <Info size={14} aria-hidden />
            </button>
          )}
          <StatusBadge status={shown.raw.developmentStatus} />
        </p>
        {minutes !== undefined && (
          <p
            data-testid="story-poi-panel-minutes"
            className="mt-0.5 text-[13.5px] font-medium text-stone-700"
          >
            {minutes} min {TRAVEL_LABEL[state.travelMode]}
          </p>
        )}
        {precisionNote && noteOpen && (
          <p
            id={noteId}
            data-testid="precision-note"
            className="mt-2 rounded-[6px] bg-stone-900/[0.04] px-3 py-2 text-[13px] leading-[1.5] text-stone-600"
          >
            {precisionNote}
          </p>
        )}

        {isTransportPOI && (
          <div className="mt-4">
            <POIRealtimeSection realtimeData={realtimeData} />
          </div>
        )}

        {/* Uten `emptyText`: har stedet ikke tekst, står hodet alene. Merket
            «Planlagt» bæres av kategorilinja over, så kroppen skal ikke
            gjenta det. Forbeholdet ligger bak infoikonet over, og Google-lenka
            går inn blant de andre lenkene i faktalista. */}
        <div className="mt-4">
          <PoiDetailBody
            poi={bodyPoi}
            galleryClassName="-mx-6 px-6"
            showStatus={false}
            showPrecisionNote={false}
            searchUrl={searchUrl}
          />
        </div>

        {/* Etter beskrivelse, fakta og kilder, med moderat avstand — IKKE
            skjøvet til bunnen for å fylle skjermen (`mt-8`, ikke `mt-auto`).
            Kompakte rader med pil fram, ingen utfolding: et trykk bytter sted i
            samme flate (`showPlace` → OPEN_POI med detail), markøren følger, og
            scroll-effekten over starter innholdet på toppen. Kategorien i raden
            forblir den du står i. Skjult når kategorien ikke har andre steder,
            og finnes BARE under panel-policyen: ankerpanelet på andre boards
            skal stå som det er (R13). */}
        {placePanel && similar.length > 0 && similarCategory && (
          <section
            data-testid="story-poi-panel-similar"
            aria-labelledby={`${headingId}-similar`}
            className="mt-8"
          >
            <h3
              id={`${headingId}-similar`}
              className="text-[12px] font-semibold uppercase tracking-[0.06em] text-stone-500"
            >
              Lignende steder
            </h3>
            <ul className="mt-2 -mx-2">
              {similar.map((p) => {
                const Icon = getIcon(p.raw.category.icon);
                const min = storyMinutes(p, state.travelMode);
                return (
                  <li key={String(p.id)}>
                    <button
                      type="button"
                      data-testid="story-similar-row"
                      data-poi={String(p.id)}
                      onClick={() => {
                        // `showPlace` åpner punkt og panel i én dispatch under
                        // policyen (og flyr kameraet med holdFrame). Uten
                        // omvisning finnes ikke seksjonen — se gaten over.
                        tour?.showPlace(p);
                      }}
                      className="flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition-colors duration-150 hover:bg-stone-900/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-stone-400"
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: similarCategory.color }}
                      >
                        <Icon size={14} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-stone-900">
                        {p.name}
                      </span>
                      {min !== undefined && (
                        <span className="shrink-0 text-[13px] tabular-nums text-stone-500">
                          {min} min
                        </span>
                      )}
                      <ChevronRight size={16} className="shrink-0 text-stone-400" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

export default StoryPoiPanel;
