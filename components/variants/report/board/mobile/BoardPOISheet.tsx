"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Drawer, DrawerContent, DrawerOverlay, DrawerPortal } from "@/components/ui/drawer";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard, useActiveCategory, useActivePOI } from "../board-state";
import { BoardRelatedPOICard } from "./BoardRelatedPOICard";
import { BoardPOIActionBar, BoardPOIDetails } from "../BoardPOIDetails";

const SNAP_POINTS: (number | string)[] = [0.5, 0.85, 0.95];
const DEFAULT_SNAP: number | string = 0.85;

export function BoardPOISheet() {
  const { state, dispatch } = useBoard();
  const cat = useActiveCategory();
  const poi = useActivePOI();
  const open = state.phase === "poi";

  // Snap-point styres lokalt — vaul kontrollert via activeSnapPoint/setActiveSnapPoint.
  // Reset til DEFAULT_SNAP ved hver åpning, og når POI byttes (in-place swap).
  const [snap, setSnap] = useState<number | string | null>(DEFAULT_SNAP);

  useEffect(() => {
    if (open) setSnap(DEFAULT_SNAP);
  }, [open, state.activePOIId]);

  const Icon = poi ? getFilledIcon(poi.raw.category.icon) : null;

  // Andre POI-er i kategorien (eks. aktiv POI selv)
  const related = cat && poi ? cat.pois.filter((p) => p.id !== poi.id) : [];

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
        <DrawerContent className="!h-[90dvh] !max-h-[90dvh] !mt-0 !p-0 !bg-stone-50 before:!hidden">
          {/* Drag-handle (overrider shadcn-default som er hidden by default på bottom-direction) */}
          <div className="mx-auto mt-3 h-1.5 w-[60px] rounded-full bg-stone-300 shrink-0" />

          {/* Close-knapp */}
          <button
            type="button"
            aria-label="Lukk"
            onClick={() => dispatch({ type: "BACK_TO_ACTIVE" })}
            className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md flex items-center justify-center text-stone-700"
          >
            <X className="w-5 h-5" />
          </button>

          {cat && poi && Icon && (
            <>
              {/* Scrollbart innhold — body. Action-bar er separat, pinned i bunnen. */}
              <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4">
                {/* Header: ikon-circle + navn + kategori-label */}
                <header className="flex items-start gap-3.5 pb-4 pr-12">
                  <div
                    className="flex-none w-12 h-12 rounded-full flex items-center justify-center shadow-md"
                    style={{ backgroundColor: cat.color }}
                  >
                    <Icon className="w-6 h-6 text-white" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h2 className="text-xl font-bold leading-tight text-stone-900">
                      {poi.name}
                    </h2>
                    <div className="text-xs font-semibold uppercase tracking-wider text-stone-500 mt-1">
                      {cat.label}
                    </div>
                  </div>
                </header>

                {/* Info-linje: adresse */}
                {poi.address && (
                  <div className="text-sm text-stone-600 pb-4 border-b border-stone-200/80">
                    {poi.address}
                  </div>
                )}

                {/* Dynamisk detalj-blokk: rating, åpningstider, live transport, child POIs — alt gated.
                    Action-bar skjules her (rendres som pinned bottom-bar utenfor scroll). */}
                <div className="pt-4">
                  <BoardPOIDetails poi={poi.raw} hideActionBar />
                </div>

                {/* Andre i kategorien */}
                {related.length > 0 && (
                  <section className="pt-6">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 pb-3">
                      Andre i kategorien
                    </h3>
                    <div className="space-y-2.5">
                      {related.map((other) => (
                        <BoardRelatedPOICard
                          key={other.id}
                          poi={other}
                          categoryColor={cat.color}
                          onClick={() =>
                            dispatch({ type: "OPEN_POI", id: other.id, categoryId: cat.id })
                          }
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Pinned action-bar — alltid synlig nederst, utenfor scroll-området.
                  Safe-area-inset-bottom håndteres på iOS slik at knappene ikke
                  havner under hjemme-indikatoren. */}
              <div
                className="shrink-0 border-t border-stone-200/80 bg-stone-50/95 backdrop-blur px-5 pt-3 pb-3"
                style={{
                  paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
                }}
              >
                <BoardPOIActionBar poi={poi.raw} />
              </div>
            </>
          )}
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
