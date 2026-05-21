"use client";

import { useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Drawer, DrawerPortal } from "@/components/ui/drawer";
import { BoardScrollPanel } from "../desktop/BoardScrollPanel";

// Bi-snap: peek (30% av viewport) som default + full (100%). Brukeren drar
// manuelt mellom stages. Ingen auto-snap ved play eller phase-events —
// brukeren styrer sheet-posisjon hele tiden.
const SNAP_PEEK = "30%";
const SNAP_FULL = 1;
const SNAP_POINTS: (number | string)[] = [SNAP_PEEK, SNAP_FULL];

/**
 * Minimal mobile bottom-sheet for board-flata. Mounter BoardScrollPanel
 * direkte som content-tre — én sannhetskilde for sidebar-innhold på begge
 * plattformer.
 *
 * BottomPlayer mountes som scaffold-sibling utenfor sheet (alltid synlig
 * når aktivt spor) — derfor `mountBottomPlayer={false}` på BoardScrollPanel
 * her, så vi ikke får dobbel-rendring.
 */
export function BoardMobileSheet() {
  const [snap, setSnap] = useState<number | string | null>(SNAP_PEEK);

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
            translateY = (viewportH - snapPx). Derfor h-[100dvh].
            `pt-[env(safe-area-inset-top)]` skyver innhold under iPhone-notch
            ved 100%-snap. */}
        <DrawerPrimitive.Content
          data-slot="board-mobile-sheet"
          className="fixed inset-x-0 bottom-0 z-30 flex h-[100dvh] flex-col rounded-t-3xl bg-stone-50 pt-[env(safe-area-inset-top)] shadow-[0_-4px_24px_rgba(15,29,68,0.08)]"
        >
          {/* Drag-handle øverst — vaul translaterer hele sheet ned med
              (viewportH - snapPx), så toppen er det som vises på peek-stagen.
              Hele sheet er draggable (handleOnly ikke satt). Vaul håndterer
              scroll-vs-drag-konflikt automatisk: når BoardScrollPanel sin
              indre scroll er på topp, tar sheet over drag-gesten. */}
          <DrawerPrimitive.Handle className="mx-auto mt-3 mb-2 h-1.5 w-[100px] shrink-0 cursor-grab touch-none rounded-full bg-stone-300 active:cursor-grabbing" />

          {/* BoardScrollPanel håndterer all content + internal scroll. Vi gir
              den `flex-1 min-h-0` så den fyller resten av sheet under handle. */}
          <div className="flex-1 min-h-0">
            <BoardScrollPanel mountBottomPlayer={false} />
          </div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
