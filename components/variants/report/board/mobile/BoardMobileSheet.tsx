"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Drawer, DrawerPortal } from "@/components/ui/drawer";
import { ChevronLeft, X } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import {
  useActiveCategory,
  useActivePOI,
  useBoard,
  useFilteredActiveCategory,
  type BoardPhase,
} from "../board-state";
import { BoardCategoryInfoTab } from "../BoardCategoryInfoTab";
import {
  BoardPOIActionBar,
  BoardPOIDetails,
} from "../BoardPOIDetails";
import { SubCategoryFilter } from "../SubCategoryFilter";
import { deriveSubCategories } from "../use-sub-category-filter";
import { BoardPunkterAccordion } from "./BoardPunkterAccordion";
import { BoardTabs } from "./BoardTabs";

// Snap-points: stage 1 (skjult bak tab-bar) | stage 2 (peek) | stage 3 (halv) | stage 4 (full).
// Tab-baren er pinnet til viewport-bunn UTENFOR sheeten (mountes i
// BoardScaffold med z-50). Stage 1 = "96px" tilsvarer derfor tab-bar-høyden:
// sheet er fullstendig dekket av tab-baren visuelt — kun kart + tab-bar
// synes. Stage 2 (320px) = sheet stikker ~224px opp OVER tab-baren.
// Stage 4 (1.0) = full viewport-høyde; tab-baren dekker bunn 96px av sheet,
// men content kompenserer via padding-bottom-[96px] så ingenting kuttes.
const SNAP_POINTS: (number | string)[] = ["96px", "320px", 0.5, 1];

// Tab-bar dimensjon (px) — må matche faktisk render-høyde i
// BoardCategoryTabBar. Brukes som padding-bottom på sheet-content slik at
// rullbart innhold og pinned action-bar ikke skjules av tab-baren.
const TAB_BAR_HEIGHT_PX = 96;

// Cross-fade ved POI-bytte: fade-ut → swap → fade-inn. Total ~200ms.
const FADE_OUT_MS = 100;
const FADE_IN_MS = 100;

function getDefaultSnapForPhase(phase: BoardPhase): number | string {
  switch (phase) {
    case "default":
      // Default-fase viser velkommen-content (boligprosjekt-info + CTA),
      // matcher desktop BoardDetailPanel.DefaultEmptyState. Sheet er alltid
      // synlig på peek så brukeren forstår hva siden handler om før de
      // velger kategori. Bruker kan dra sheet ned til "96px" for å se mer
      // av kartet hvis ønskelig.
      return "320px";
    case "active":
      return "320px";
    case "poi":
      return 0.5;
  }
}

export interface BoardMobileSheetProps {
  /** Kall ved snap-endring. Brukes av parent (BoardScaffold) for å
   *  synkronisere map-padding-bottom — Unit 6. */
  onSnapChange?: (snap: number | string) => void;
}

/**
 * Multi-snap bottom-sheet (Google Maps-stil) for mobile board-flyt.
 * Erstatter BoardCategoryGrid + BoardPeekCard + BoardReadingModal + BoardPOISheet.
 *
 * Fire snap-stages: skjult-bak-tab-bar | peek | halv | full.
 * Sheet er alltid mountet (`open=true`, `dismissible=false`), kart er
 * aldri sløret (`modal=false`, ingen overlay). Hele sheet er draggable
 * (drag-handle, header og content alle reagerer på drag) — ekte app-feeling.
 *
 * Tab-baren er IKKE i sheeten — den mountes som søsken i BoardScaffold med
 * z-50, alltid synlig over sheet og kart. Sheet kan dras helt ned uten å
 * skjule primær-navigasjonen.
 *
 * Drag-til-å-lukke: hvis brukeren drar sheet ned til stage 1 (96px) mens
 * en kategori eller POI er aktiv, dispatcher vi RESET_TO_DEFAULT — dvs.
 * swipe-ned er en gyldig "lukk kategori"-gest.
 *
 * Phase-rendering:
 * - default: sheet skjult bak tab-bar (snap=96px)
 * - active: kategori-header + Beliggenhet/Punkter-tabs + content (snap=320px)
 * - poi: tilbake-knapp + POI-header + BoardPOIDetails + pinned action-bar (snap=0.5)
 */
export function BoardMobileSheet({ onSnapChange }: BoardMobileSheetProps = {}) {
  const { state, dispatch, data, subFilter } = useBoard();
  const cat = useActiveCategory();
  const filteredCat = useFilteredActiveCategory();
  const poi = useActivePOI();

  // Snap-state lokal. Auto-synkroniseres med phase via watcher under.
  const [snap, setSnapInternal] = useState<number | string | null>(
    getDefaultSnapForPhase(state.phase),
  );
  const lastNotifiedRef = useRef<number | string | null>(null);

  const setSnap = (next: number | string | null) => {
    setSnapInternal(next);
    if (next !== null && next !== lastNotifiedRef.current) {
      lastNotifiedRef.current = next;
      onSnapChange?.(next);
    }
    // Drag-ned-for-å-lukke: hvis brukeren snapper sheet til stage 1 mens en
    // kategori/POI er aktiv, tolker vi det som "lukk". Phase-watcheren under
    // setter da snap tilbake til "96px" (no-op) men nullstiller activeCategoryId
    // og activePOIId så markørene viser oversikt igjen.
    if (next === "96px" && state.phase !== "default") {
      dispatch({ type: "RESET_TO_DEFAULT" });
    }
  };

  // Auto-snap ved phase-overgang.
  useEffect(() => {
    setSnap(getDefaultSnapForPhase(state.phase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

  // Lokal tab-state for active-fasen. Reset til "info" ved kategori-bytte.
  const [tab, setTab] = useState<"info" | "punkter">("info");
  const prevCategoryRef = useRef(state.activeCategoryId);

  useEffect(() => {
    const categoryChanged = prevCategoryRef.current !== state.activeCategoryId;
    if (state.phase === "poi") {
      setTab("punkter");
    } else if (categoryChanged) {
      setTab("info");
    }
    prevCategoryRef.current = state.activeCategoryId;
  }, [state.phase, state.activeCategoryId]);

  // Cross-fade-state: vi rendrer det "viste" POI-id-et, som lagger ett tick
  // bak aktiv POI under fade-ut. Når fade-ut er ferdig, swap-er vi til ny
  // POI og kjører fade-inn. Rapid multi-click → timer resettes, last click wins.
  // Mønster portet fra dagens BoardPOISheet (slettes i Unit 7).
  const [displayedPoiId, setDisplayedPoiId] = useState<string | null>(
    poi?.id ?? null,
  );
  const [bodyVisible, setBodyVisible] = useState(true);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPOIPhase = state.phase === "poi";

  useEffect(() => {
    const targetId = poi?.id ?? null;

    // Phase ikke poi: synkroniser uten animasjon.
    if (!isPOIPhase) {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
      setDisplayedPoiId(targetId);
      setBodyVisible(true);
      return;
    }

    // Initiell mount eller ny POI fra null: vis direkte.
    if (displayedPoiId === null && targetId !== null) {
      setDisplayedPoiId(targetId);
      setBodyVisible(true);
      return;
    }

    // Allerede synkronisert: ingenting å gjøre.
    if (displayedPoiId === targetId) return;

    // POI byttet mens sheet er i poi-fase: fade-ut, swap, fade-inn.
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    setBodyVisible(false);
    fadeOutTimerRef.current = setTimeout(() => {
      setDisplayedPoiId(targetId);
      setBodyVisible(true);
      fadeOutTimerRef.current = null;
    }, FADE_OUT_MS);

    return () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
    };
  }, [isPOIPhase, poi?.id, displayedPoiId]);

  // Resolve "displayed" POI/cat fra board-data basert på displayedPoiId. Under
  // fade-ut viser vi forrige POI-data; etter swap viser vi ny POI-data.
  const displayedPoi = displayedPoiId
    ? data.categories
        .flatMap((c) => c.pois.map((p) => ({ poi: p, cat: c })))
        .find((entry) => entry.poi.id === displayedPoiId) ?? null
    : null;

  const renderPoiCat = displayedPoi?.cat ?? cat;
  const renderPoi = displayedPoi?.poi ?? poi;
  const PoiIcon = renderPoi ? getFilledIcon(renderPoi.raw.category.icon) : null;
  const poiHeaderColor =
    renderPoi?.raw.category.color || renderPoiCat?.color || "#94a3b8";

  // Sub-kategorier deriveres fra ufiltrert kategori (UI-stable).
  const subCategories = useMemo(
    () => (cat ? deriveSubCategories(cat) : []),
    [cat],
  );
  const hasSubFilter = subCategories.length >= 2;

  const punkterLabel =
    cat && filteredCat
      ? hasSubFilter && subFilter.hiddenIds.size > 0
        ? `Punkter (${filteredCat.pois.length}/${cat.pois.length})`
        : `Punkter (${filteredCat.pois.length})`
      : "Punkter";

  return (
    <Drawer
      open={true}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
      dismissible={false}
      modal={false}
    >
      <DrawerPortal>
        {/* DrawerPrimitive.Content direkte (ikke shadcn DrawerContent) for å
            droppe auto-overlay. Vaul antar at sheet-elementet har full
            viewport-høyde og at snap-points uttrykker SYNLIG høyde fra bunn:
            translateY = (viewportH - snapPx). Derfor h-[100dvh]; stage-4-snap
            (1.0) gir hele viewporten synlig, stage 1 (96px) gir tab-bar-
            tilsvarende høyde synlig — som er dekket av tab-baren med z-50.
            `pt-[env(safe-area-inset-top)]` skyver innhold under iPhone-notch/
            status-bar når sheet er på 100%-snap.
            handleOnly er IKKE satt — hele sheet er draggable for app-feeling.
            Vaul håndterer scroll-vs-drag-konflikt automatisk: kun når content
            er scrollet til topp (scrollTop=0), tar sheet over drag. */}
        <DrawerPrimitive.Content
          data-slot="board-mobile-sheet"
          className="fixed inset-x-0 bottom-0 z-30 flex h-[100dvh] flex-col bg-stone-50/95 backdrop-blur rounded-t-3xl shadow-[0_-4px_24px_rgba(15,29,68,0.08)] pt-[env(safe-area-inset-top)]"
        >
          {/* Drag-handle ligger ØVERST i sheet fordi vaul translater hele
              elementet ned med (viewportH - snapPx) — toppen av sheet er det
              som vises i snap-spalten. Beholdes som visuell affordance selv
              om hele sheet er draggable. */}
          <DrawerPrimitive.Handle className="mx-auto mt-3 mb-2 h-1.5 w-[100px] shrink-0 cursor-grab touch-none rounded-full bg-stone-300 active:cursor-grabbing" />

          {/* Scrollbart innhold-slot. Phase-styres internt.
              `min-h-0` så flex-shrink fungerer ved lave stages.
              Padding-bottom = TAB_BAR_HEIGHT_PX så scroll-content ikke
              skjules av den eksterne tab-baren ved stage 4 (full).
              `touchAction: "pan-y"` lar browseren håndtere native vertikal
              scroll OG lar vaul få pointer-events for sheet-drag i parallell.
              Default `touch-action: auto` introduserer en first-touch-delay
              på iOS Safari mens browser avgjør scroll-vs-tap, som
              materialiserer seg som "drag virker ikke første gang". */}
          <div
            className="flex-1 overflow-y-auto min-h-0"
            style={{
              paddingBottom: `${TAB_BAR_HEIGHT_PX}px`,
              touchAction: "pan-y",
              overscrollBehavior: "contain",
            }}
          >
            {state.phase === "default" && (
              <DefaultHomeContent
                heroImage={data.home.heroImage}
                address={data.home.address}
                name={data.home.name}
                heroIntro={data.home.heroIntro}
              />
            )}

            {state.phase === "active" && cat && filteredCat && (
              <div className="px-5 pt-2">
                <header className="flex items-start justify-between pb-3">
                  <h2 className="text-2xl font-bold leading-tight text-stone-900">
                    {cat.label}
                  </h2>
                  <button
                    type="button"
                    aria-label="Lukk kategori"
                    onClick={() => dispatch({ type: "RESET_TO_DEFAULT" })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-stone-600 shadow-sm hover:text-stone-900"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                <BoardTabs
                  value={tab}
                  onChange={(v) => setTab(v as "info" | "punkter")}
                  fullWidth
                  tabs={[
                    { id: "info", label: "Beliggenhet" },
                    { id: "punkter", label: punkterLabel },
                  ]}
                />

                {tab === "info" && (
                  <div className="pt-3 pb-5">
                    <BoardCategoryInfoTab
                      category={cat}
                      poisById={data.poisById}
                      imageSizes="100vw"
                    />
                  </div>
                )}

                {tab === "punkter" && (
                  <div className="pt-3 pb-5">
                    {hasSubFilter && (
                      <div className="pb-3">
                        <SubCategoryFilter
                          subCategories={subCategories}
                          hiddenIds={subFilter.hiddenIds}
                          onToggle={subFilter.toggle}
                          onToggleAll={subFilter.toggleAll}
                          variant="mobile"
                        />
                      </div>
                    )}
                    {filteredCat.pois.length === 0 ? (
                      <EmptyFilterState onShowAll={subFilter.reset} />
                    ) : (
                      <BoardPunkterAccordion category={filteredCat} />
                    )}
                  </div>
                )}
              </div>
            )}

            {state.phase === "poi" && renderPoi && renderPoiCat && PoiIcon && (
              <div
                className="px-5 pt-2 pb-4 transition-opacity ease-out"
                style={{
                  opacity: bodyVisible ? 1 : 0,
                  transitionDuration: `${bodyVisible ? FADE_IN_MS : FADE_OUT_MS}ms`,
                }}
              >
                <header className="flex items-start gap-3 pb-3">
                  <button
                    type="button"
                    aria-label="Tilbake til kategori"
                    onClick={() => dispatch({ type: "BACK_TO_ACTIVE" })}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm hover:text-stone-900"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-md"
                    style={{ backgroundColor: poiHeaderColor }}
                  >
                    <PoiIcon className="h-6 w-6 text-white" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2 className="text-xl font-bold leading-tight text-stone-900 truncate">
                      {renderPoi.name}
                    </h2>
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mt-0.5 truncate">
                      {renderPoiCat.label}
                    </div>
                  </div>
                </header>

                {renderPoi.address && (
                  <div className="text-sm text-stone-600 pb-4 border-b border-stone-200/80">
                    {renderPoi.address}
                  </div>
                )}

                <div className="pt-4">
                  <BoardPOIDetails poi={renderPoi.raw} hideActionBar />
                </div>
              </div>
            )}
          </div>

          {/* Pinned action-bar — siste flex-child så den havner i bunn av
              sheet-elementet. Synlig kun ved stage 4 (full) siden vaul kun
              eksponerer toppen av sheet via translation; på lavere stages er
              bunn av sheet utenfor viewporten. Apple/Google Maps-mønster:
              actions vises når brukeren har dratt sheet helt opp.
              margin-bottom = TAB_BAR_HEIGHT_PX så action-bar ikke skjules av
              den eksterne tab-baren. */}
          {state.phase === "poi" && renderPoi && (
            <div
              className="shrink-0 border-t border-stone-200/80 bg-stone-50/95 backdrop-blur px-5 pt-3"
              style={{
                paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
                marginBottom: `${TAB_BAR_HEIGHT_PX}px`,
              }}
            >
              <BoardPOIActionBar poi={renderPoi.raw} />
            </div>
          )}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}

/** Velkommen-content i default-fase — speiler desktop BoardDetailPanel.
 *  DefaultEmptyState. Brukes når ingen kategori er valgt, gir brukeren
 *  prosjekt-kontekst (hero-bilde, navn, intro) før de utforsker. */
function DefaultHomeContent({
  heroImage,
  address,
  name,
  heroIntro,
}: {
  heroImage?: string;
  address?: string;
  name: string;
  heroIntro?: string;
}) {
  return (
    <div className="flex flex-col">
      {heroImage && (
        <div className="relative aspect-[4/3] w-full flex-none bg-stone-200">
          <Image
            src={heroImage}
            alt={name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="flex flex-col gap-3 px-5 py-5">
        {address && (
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {address}
          </div>
        )}
        <h2 className="text-2xl font-bold leading-tight text-stone-900">
          {name}
        </h2>
        {heroIntro && (
          <p className="text-[15px] leading-relaxed text-stone-700">
            {heroIntro}
          </p>
        )}
        <p className="pt-2 text-sm text-stone-500">
          Velg en kategori for å utforske nabolaget.
        </p>
      </div>
    </div>
  );
}

function EmptyFilterState({ onShowAll }: { onShowAll: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-200 bg-white/40 px-4 py-8 text-center">
      <p className="text-sm text-stone-600">
        Ingen punkter matcher det aktuelle filteret.
      </p>
      <button
        type="button"
        onClick={onShowAll}
        className="mt-3 text-sm font-semibold text-stone-700 underline underline-offset-2 hover:text-stone-900"
      >
        Vis alle igjen
      </button>
    </div>
  );
}
