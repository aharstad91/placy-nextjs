"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CameraSnapshot } from "@/lib/board/board-types";
import type { BoardCategoryId } from "../board-data";
import { useBoard } from "../board-state";
import { NeighbourhoodSheet } from "./NeighbourhoodSheet";
import { NeighbourhoodCategoryCard } from "./NeighbourhoodCategoryCard";
import { CategoryPage } from "./CategoryPage";
import { FAQSection } from "../FAQSection";
import { useNeighbourhoodList } from "./use-neighbourhood-list";
import { TravelModeHeaderControl } from "./TravelModeHeaderControl";
import { StoryCard } from "../story/StoryCard";
import { StoryDeck } from "../story/StoryRail";
import { StoryPlayCard } from "../story/StoryPlayCard";
import { useStoryTour } from "../story/story-tour";
import { areaProse } from "../story/story-model";

/**
 * Nabolagsflaten — navigasjonsstakken (Unit 3b + 4).
 *
 * To trinn over ÉN montert kartinstans:
 *  1. **Nabolagslista** i en dragbar sheet. Kartutsnittet er filteret;
 *     `activeCategoryId` settes aldri, så markørsettet styres av utsnittet
 *     alene (R20 — ingen ny board-action, `markerStates` viser allerede alle
 *     kategoriers punkter når ingen kategori er aktiv).
 *  2. **Kategorisiden**, pushet over samme kart med egen tilbake-vei.
 *
 * Push lagrer kameraet, tilbake gjenoppretter det eksakt (R18). Ingen av
 * kamerabevegelsene her re-scoper lista: rektangelet publiseres kun av
 * brukerinitierte gester (R12), så lista står nøyaktig som brukeren forlot den.
 */
export function NeighbourhoodSurface({
  onSurfaceHeightChange,
}: {
  /** Den monterte flatens okklusjonshøyde → kartets bottom-padding og
   *  utsnitts-rektangelet. Sheeten og kategorisiden rapporterer hver sin. */
  onSurfaceHeightChange: (heightPx: number) => void;
}) {
  const { data, dispatch, mapCamera } = useBoard();
  const story = useStoryTour();
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const savedCameraRef = useRef<CameraSnapshot | null>(null);

  // Lås dokument-scrollen så lenge flaten står.
  //
  // Board-containeren er `h-[100dvh] overflow-hidden`, men det binder bare
  // CONTAINEREN — iOS Safari scroller fortsatt selve dokumentet når en gest
  // renner over sheetens scroll-ende. Da glir hele boardet oppover, kartet
  // forsvinner ut av toppen og under sheeten dukker det opp en stripe av
  // body-bakgrunnen. Det leser som et overflow-hull i lista, men er siden som
  // flytter seg. `overscroll-behavior: none` stopper kjedingen; `overflow:
  // hidden` stopper resten.
  useEffect(() => {
    const { body, documentElement: html } = document;
    const prev = {
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    html.style.overscrollBehavior = "none";
    return () => {
      body.style.overflow = prev.bodyOverflow;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      html.style.overscrollBehavior = prev.htmlOverscroll;
    };
  }, []);

  const openCategory =
    data.categories.find((c) => c.id === openCategoryId) ?? null;

  const handleOpen = useCallback(
    (categoryId: string) => {
      savedCameraRef.current = mapCamera?.snapshot() ?? null;
      // source "index" holder board-et i phase "default" — den gamle
      // "active"-overgangen tilhører den utdaterte mobil-kategorigriden.
      // `activeCategoryId` blir likevel satt, så `markerStates` snevrer
      // markørene inn til kategorien og demper resten (R18).
      dispatch({
        type: "SELECT_CATEGORY",
        id: categoryId as BoardCategoryId,
        source: "index",
      });
      setOpenCategoryId(categoryId);
    },
    [dispatch, mapCamera],
  );

  const handleBack = useCallback(() => {
    // Kameraet gjenopprettes FØRST og synkront: nabolagslista remonteres i
    // neste commit og publiserer da et utsnitt fra kameraets posisjon. Sto
    // kameraet fortsatt på kategori-rammen, ville lista blitt scopet til et
    // utsnitt brukeren aldri valgte.
    const saved = savedCameraRef.current;
    if (saved) mapCamera?.restore(saved);
    savedCameraRef.current = null;
    // RESET_TO_DEFAULT, ikke BACK_TO_DEFAULT: sistnevnte BEHOLDER
    // `activeCategoryId`, og markørene ville blitt stående låst til kategorien
    // etter at vi er tilbake på nabolagslista (R20).
    dispatch({ type: "RESET_TO_DEFAULT" });
    setOpenCategoryId(null);
  }, [dispatch, mapCamera]);

  // Kategorien forsvant fra data mens siden var åpen (språkbytte, ny
  // provisjonering). Fall tilbake til lista i stedet for å rendre ingenting —
  // og gjennom `handleBack`, så board-state og kamera ryddes likt som ellers.
  useEffect(() => {
    if (openCategoryId && !openCategory) handleBack();
  }, [openCategoryId, openCategory, handleBack]);

  // Omvisningen eier flaten mens den kjører: indeksen, boardets FAQ og hintet
  // ligger bak «Avslutt», ikke under fortellingen. Ellers er den bare en ny
  // header. Egen gren og ikke en betingelse inne i lista, fordi
  // `useNeighbourhoodList` da hadde fortsatt å scope markørsettet til utsnittet
  // — og omvisningen vil ha hele nabolaget liggende som tekstur (se
  // `storyEmphasis`).
  if (story.on) {
    return (
      <>
        {/* Ingen tittel: spørsmålet i stoppet er overskriften, og «I nærheten»
            over det gjorde stoppet til andrelinje i sitt eget kort. */}
        <NeighbourhoodSheet
          title=""
          tone="white"
          onHeightChange={onSurfaceHeightChange}
          contentRestKey="story"
        >
          <StoryCard />
        </NeighbourhoodSheet>
        <StoryDeck />
      </>
    );
  }

  if (openCategory) {
    return (
      <CategoryPage
        category={openCategory}
        onBack={handleBack}
        onHeightChange={onSurfaceHeightChange}
      />
    );
  }

  return (
    <NeighbourhoodList
      onOpenCategory={handleOpen}
      onHeightChange={onSurfaceHeightChange}
    />
  );
}

/** Sheeten + lista. Egen komponent så `useNeighbourhoodList` (som eier
 *  viewport-scopet) unmountes når kategorisiden pushes — da slippes
 *  markør-begrensningen automatisk, slik R16 krever. */
function NeighbourhoodList({
  onOpenCategory,
  onHeightChange,
}: {
  onOpenCategory: (categoryId: string) => void;
  onHeightChange: (heightPx: number) => void;
}) {
  const { viewportGestures, data } = useBoard();
  const list = useNeighbourhoodList();

  // R28: ett ikke-blokkerende hint om at kartet styrer lista. Uten det finnes
  // ingen affordans for koblingen — flaten har verken søkefelt eller
  // sikte-kryss, og en boligkjøper som kommer kaldt fra en annonse har ikke
  // Citymapper-brukerens innlærte forventning. Ingen modal, ingenting å avvise.
  //
  // Avvises ved første KART-gest, avlest fra tellerens kilde og ikke fra
  // rektangelet: `map.setPadding()` re-sentrerer kameraet, så et sheet-drag
  // flytter både `south` OG `north`. Den tidligere rektangel-diffen leste
  // derfor sin egen ankomst-sekvens som en panorering og skjulte hintet før
  // brukeren rakk å se det.
  const hintDismissed = viewportGestures > 0;

  return (
    <NeighbourhoodSheet onHeightChange={onHeightChange}>
      {/* Inngangen til omvisningen, over indeksen: tettheten møter deg først,
          men den som ikke selv begynner å zoome og trykke skal ha en vei inn. */}
      <StoryPlayCard />

      {!hintDismissed && (
        <p
          data-testid="neighbourhood-hint"
          className="mb-2 rounded-xl bg-stone-900/[0.045] px-3 py-2 text-[12.5px] leading-snug text-stone-600"
        >
          {/* Teksten sa «med gangtid hjemmefra» uansett hvilken modus som var
              aktiv. Det er samme defekt som selve kontrollen under finnes for:
              flaten påstår en reisemåte i prosa mens tilstanden kan være en
              annen. Nøytral formulering, så den ikke kan drifte på nytt. */}
          Dra i kartet — lista viser stedene i utsnittet, med reisetid
          hjemmefra.
        </p>
      )}

      {list.categories.length === 0 ? (
        <p
          data-testid="neighbourhood-empty"
          className="px-1 py-6 text-[14px] leading-snug text-stone-500"
        >
          Ingen steder i dette utsnittet. Zoom ut, eller dra kartet tilbake mot
          boligen.
        </p>
      ) : (
        <>
          {/* Enheten tallene i kortene under er i. Én kontroll over hele lista,
              ikke én per kategorikort: sheeten stabler ett kort PER kategori, så
              en kontroll i kortet ville gitt seks på skjermen samtidig.
              Høyrestilt så den lander over minutt-kolonnen. */}
          <div className="mb-1 flex justify-end">
            <TravelModeHeaderControl />
          </div>
          {list.categories.map((category) => (
            <NeighbourhoodCategoryCard
              key={category.id}
              category={category}
              onOpen={onOpenCategory}
            />
          ))}
        </>
      )}

      {/* Strøkets egne ord, over svarene. Samme kilde som områdestoppets prosa
          (`areaIntro`): teksten lå tidligere som FAQ-rad her, og da den ble
          løftet til intro på omvisningens første stopp, måtte den følge med hit
          — ellers mistet indeksen strøkets stemme. */}
      {data.areaIntro && (
        <div data-testid="neighbourhood-area-intro" className="mt-4 px-1">
          {areaProse(data.areaIntro).map((p, i) => (
            <p
              key={i}
              className={cn(
                "text-[14px] leading-[1.55] text-stone-600",
                i > 0 && "mt-3",
              )}
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Boardets egen FAQ, etter kategorikortene: bevisst slank, og svarene
          lenker INN i kategoriene framfor å gjenta innholdet deres. Lista over
          er utsnitts-scopet; denne er det ikke — den beskriver strøket, ikke
          det kameraet peker på. */}
      <FAQSection
        entries={data.globalFaq ?? []}
        poisById={data.poisById}
        categoryIds={data.categories.map((c) => c.id)}
        onSelectCategory={onOpenCategory}
        title="Om nabolaget"
        className="mt-3"
      />
    </NeighbourhoodSheet>
  );
}
