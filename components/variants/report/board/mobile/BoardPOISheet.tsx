"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Drawer, DrawerContent, DrawerOverlay, DrawerPortal } from "@/components/ui/drawer";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard, useActiveCategory, useActivePOI } from "../board-state";
import { BoardPOIActionBar, BoardPOIDetails } from "../BoardPOIDetails";

// Snap-points: 0.5 = peek (kart-konteksten synlig under), 1 = full (hele
// sheet inkl. pinned action-bar). Drawer-høyden er natural til innholdet
// (DrawerContent har h-auto max-h-[85dvh]), så snap-1 = natural-height,
// ikke 85% av viewport. Sparse POIer får kort sheet, rich POIer får høyere.
const SNAP_POINTS: (number | string)[] = [0.5, 1];
const DEFAULT_SNAP: number | string = 1;

// Cross-fade ved POI-bytte: fade-ut → swap → fade-inn. Total ~200ms.
const FADE_OUT_MS = 100;
const FADE_IN_MS = 100;

export function BoardPOISheet() {
  const { state, dispatch, data } = useBoard();
  const cat = useActiveCategory();
  const poi = useActivePOI();
  const open = state.phase === "poi";

  // Snap-point styres lokalt — vaul kontrollert via activeSnapPoint/setActiveSnapPoint.
  // Reset til DEFAULT_SNAP ved hver åpning, og når POI byttes (in-place swap).
  const [snap, setSnap] = useState<number | string | null>(DEFAULT_SNAP);

  useEffect(() => {
    if (open) setSnap(DEFAULT_SNAP);
  }, [open, state.activePOIId]);

  // Cross-fade-state: vi rendrer det "viste" POI-id-et, som lagger ett tick
  // bak aktiv POI under fade-ut. Når fade-ut er ferdig, swap-er vi til ny
  // POI og kjører fade-inn. Rapid multi-click → timer resettes, last click wins.
  const [displayedPoiId, setDisplayedPoiId] = useState<string | null>(
    poi?.id ?? null
  );
  const [bodyVisible, setBodyVisible] = useState(true);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const targetId = poi?.id ?? null;

    // Sheet ikke åpen: synkroniser uten animasjon.
    if (!open) {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
      setDisplayedPoiId(targetId);
      setBodyVisible(true);
      return;
    }

    // Initiell mount eller ny POI fra null: vis direkte (fade-inn via mount).
    if (displayedPoiId === null && targetId !== null) {
      setDisplayedPoiId(targetId);
      setBodyVisible(true);
      return;
    }

    // Allerede synkronisert: ingenting å gjøre.
    if (displayedPoiId === targetId) return;

    // POI byttet mens sheet er åpent: fade-ut, swap, fade-inn.
    // Rapid multi-click cancellerer pågående timer — last click wins.
    if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    setBodyVisible(false);
    fadeOutTimerRef.current = setTimeout(() => {
      setDisplayedPoiId(targetId);
      setBodyVisible(true);
      fadeOutTimerRef.current = null;
    }, FADE_OUT_MS);

    return () => {
      // Cleanup ved unmount eller før neste effect-run
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
    };
  }, [open, poi?.id, displayedPoiId]);

  // Resolve "displayed" POI/cat fra board-data basert på displayedPoiId. Under
  // fade-ut viser vi forrige POI-data; etter swap viser vi ny POI-data.
  // Under category-skift kan displayedPoi ligge i en annen kategori; vi søker
  // bredt for å finne korrekt snapshot.
  const displayedPoi = displayedPoiId
    ? data.categories
        .flatMap((c) => c.pois.map((p) => ({ poi: p, cat: c })))
        .find((entry) => entry.poi.id === displayedPoiId) ?? null
    : null;

  const renderCat = displayedPoi?.cat ?? cat;
  const renderPoi = displayedPoi?.poi ?? poi;
  const Icon = renderPoi ? getFilledIcon(renderPoi.raw.category.icon) : null;

  // Sub-kat-farge med tema-farge som fallback. Samme fall-through som
  // BoardMarker / BoardPunkterAccordion / BoardMap — sikrer at samme POI har
  // samme farge på kart og i sheet (f.eks. Trondheim Bysykkel grønn, ikke
  // Transport-temaets blå).
  const headerColor =
    renderPoi?.raw.category.color || renderCat?.color || "#94a3b8";

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) dispatch({ type: "BACK_TO_ACTIVE" });
      }}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerContent className="!h-auto !max-h-[85dvh] !mt-0 !p-0 !bg-stone-50 before:!hidden">
          {/* Drag-handle leveres av shadcn DrawerContent for bottom-direction. */}

          {/* Close-knapp */}
          <button
            type="button"
            aria-label="Lukk"
            onClick={() => dispatch({ type: "BACK_TO_ACTIVE" })}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center text-stone-700"
          >
            <X className="w-5 h-5" />
          </button>

          {renderCat && renderPoi && Icon && (
            <>
              {/* Scrollbart innhold — body. Action-bar er separat, pinned i bunnen.
                  Body cross-fader ved POI-bytte (opacity-transition styres av
                  bodyVisible-state). Action-bar persisterer for stabil visuell
                  forankring. */}
              <div
                className="flex-1 overflow-y-auto px-5 pt-5 pb-4 transition-opacity ease-out"
                style={{
                  opacity: bodyVisible ? 1 : 0,
                  transitionDuration: `${bodyVisible ? FADE_IN_MS : FADE_OUT_MS}ms`,
                }}
              >
                {/* Header: ikon-circle + navn + kategori-label */}
                <header className="flex items-start gap-3.5 pb-4 pr-12">
                  <div
                    className="flex-none w-12 h-12 rounded-full flex items-center justify-center shadow-md"
                    style={{ backgroundColor: headerColor }}
                  >
                    <Icon className="w-6 h-6 text-white" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2 className="text-xl font-bold leading-tight text-stone-900">
                      {renderPoi.name}
                    </h2>
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mt-1">
                      {renderCat.label}
                    </div>
                  </div>
                </header>

                {/* Info-linje: adresse */}
                {renderPoi.address && (
                  <div className="text-sm text-stone-600 pb-4 border-b border-stone-200/80">
                    {renderPoi.address}
                  </div>
                )}

                {/* Dynamisk detalj-blokk: rating, åpningstider, live transport, child POIs — alt gated.
                    Action-bar skjules her (rendres som pinned bottom-bar utenfor scroll).
                    Sheet er fokusert på aktiv POI; for å bla mellom POIer i kategorien
                    bruker brukeren Punkter-tab i ReadingModal eller map-markers. */}
                <div className="pt-4">
                  <BoardPOIDetails poi={renderPoi.raw} hideActionBar />
                </div>
              </div>

              {/* Pinned action-bar — alltid synlig nederst, utenfor scroll-området.
                  Safe-area-inset-bottom håndteres på iOS slik at knappene ikke
                  havner under hjemme-indikatoren. Persisterer (ingen fade) for
                  stabil visuell forankring under POI-bytte. */}
              <div
                className="shrink-0 border-t border-stone-200/80 bg-stone-50/95 backdrop-blur px-5 pt-3 pb-3"
                style={{
                  paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                <BoardPOIActionBar poi={renderPoi.raw} />
              </div>
            </>
          )}
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
