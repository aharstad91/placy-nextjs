"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Drawer, DrawerPortal } from "@/components/ui/drawer";
import { X } from "lucide-react";
import {
  useActiveCategory,
  useBoard,
  useFilteredActiveCategory,
  type BoardPhase,
} from "../board-state";
import { BoardCategoryInfoTab } from "../BoardCategoryInfoTab";
import { SubCategoryFilter } from "../SubCategoryFilter";
import { deriveSubCategories } from "../use-sub-category-filter";
import { BoardCategoryTabBar } from "./BoardCategoryTabBar";
import { BoardPunkterAccordion } from "./BoardPunkterAccordion";
import { BoardTabs } from "./BoardTabs";

// Snap-points: stage 1 (kun tab-bar) | stage 2 (peek) | stage 3 (halv) | stage 4 (full).
// Mix av px-strings og prosent: tab-bar-høyde er kjent i piksler (uavhengig
// av viewport), halv/full er meningsfulle som prosent.
const SNAP_POINTS: (number | string)[] = ["96px", "320px", 0.5, 0.92];

function getDefaultSnapForPhase(phase: BoardPhase): number | string {
  switch (phase) {
    case "default":
      return "96px";
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
 * Fire snap-stages: kollapset (kun tab-bar) | peek | halv | full.
 * Sheet er alltid mountet (`open=true`, `dismissible=false`), kart er
 * aldri sløret (`modal=false`, ingen overlay), kun handle drar (`handleOnly=true`).
 *
 * Phase-rendering:
 * - default: tomt content-område, kun tab-bar synlig (snap=96px)
 * - active: kategori-header + Beliggenhet/Punkter-tabs + content (Unit 4)
 * - poi: POI-header + BoardPOIDetails + pinned action-bar (Unit 5 — kommer)
 */
export function BoardMobileSheet({ onSnapChange }: BoardMobileSheetProps = {}) {
  const { state, dispatch, data, subFilter } = useBoard();
  const cat = useActiveCategory();
  const filteredCat = useFilteredActiveCategory();

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
      handleOnly={true}
    >
      <DrawerPortal>
        {/* DrawerPrimitive.Content direkte (ikke shadcn DrawerContent) for å
            droppe auto-overlay. h-[92dvh] matcher stage-4-snap; vaul translate-er
            hele elementet basert på snap-stage, så ved stage 1 er kun bottom 96px synlig. */}
        <DrawerPrimitive.Content
          data-slot="board-mobile-sheet"
          className="fixed inset-x-0 bottom-0 z-30 flex h-[92dvh] flex-col bg-stone-50/95 backdrop-blur rounded-t-3xl shadow-[0_-4px_24px_rgba(15,29,68,0.08)]"
        >
          {/* Drag-handle. Synlig kun ved stage 2+ (over visible-area ved stage 1). */}
          <div className="mx-auto mt-3 mb-2 h-1.5 w-[100px] shrink-0 rounded-full bg-stone-300" />

          {/* Scrollbart innhold-slot. Phase-styres internt.
              `min-h-0` så flex-shrink fungerer ved stage 1 (kollapser til 0). */}
          <div className="flex-1 overflow-y-auto min-h-0">
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

            {/* phase=poi: Unit 5 fyller med POI-header + BoardPOIDetails + cross-fade. */}
          </div>

          {/* Pinned action-bar slot — Unit 5 fyller når phase=poi. */}

          {/* Tab-bar — alltid synlig på tvers av snap-stages. */}
          <div className="shrink-0 border-t border-stone-200/80 bg-stone-50">
            <BoardCategoryTabBar
              onSnapChange={setSnap}
              currentSnap={snap}
            />
          </div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
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
