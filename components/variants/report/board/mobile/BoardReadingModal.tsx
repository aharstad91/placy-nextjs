"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Drawer, DrawerContent, DrawerOverlay, DrawerPortal } from "@/components/ui/drawer";
import { useBoard, useActiveCategory } from "../board-state";
import { BoardRelatedPOICard } from "./BoardRelatedPOICard";
import { BoardTabs } from "./BoardTabs";
import { BoardCategoryInfoTab } from "../BoardCategoryInfoTab";

export function BoardReadingModal() {
  const { state, dispatch, data } = useBoard();
  const cat = useActiveCategory();
  const open = state.phase === "reading";

  // Reset til Info-tab ved hver åpning
  const [tab, setTab] = useState("info");
  useEffect(() => {
    if (open) setTab("info");
  }, [open]);

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (!next) dispatch({ type: "BACK_TO_ACTIVE" });
      }}
    >
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerContent className="!h-[95dvh] !max-h-[95dvh] !mt-0 !p-0 !bg-stone-50 before:!hidden">
          {/* Drag-handle (vaul renders one by default i shadcn Drawer; vi overrider) */}
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

          {cat && (
            <div className="flex-1 overflow-y-auto px-5 pt-6 pb-8" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}>
              <header className="pb-5">
                <h2 className="text-2xl font-bold leading-tight text-stone-900">
                  {cat.label}
                </h2>
              </header>

              <BoardTabs
                value={tab}
                onChange={setTab}
                fullWidth
                tabs={[
                  { id: "info", label: "Beliggenhet" },
                  { id: "punkter", label: `Punkter (${cat.pois.length})` },
                ]}
              />

              {tab === "info" && (
                <BoardCategoryInfoTab
                  category={cat}
                  poisById={data.poisById}
                  imageSizes="100vw"
                />
              )}

              {tab === "punkter" && (
                <div className="space-y-2.5">
                  {cat.pois.map((poi) => (
                    <BoardRelatedPOICard
                      key={poi.id}
                      poi={poi}
                      categoryColor={cat.color}
                      onClick={() =>
                        dispatch({ type: "OPEN_POI", id: poi.id, categoryId: cat.id })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
