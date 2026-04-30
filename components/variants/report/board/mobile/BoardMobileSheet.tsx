"use client";

import { useEffect, useRef, useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { Drawer, DrawerPortal } from "@/components/ui/drawer";
import { useBoard, type BoardPhase } from "../board-state";

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
  /**
   * Innhold som rendres i scrollbart område over tab-bar.
   * Phase-styres av kalleren (Unit 4/5 fyller). Ved phase=default
   * forventes barnet å være tomt eller null.
   */
  children?: React.ReactNode;
  /**
   * Pinned action-bar over tab-bar. Settes typisk kun når phase=poi.
   * Rendres som flex-shrink-0 utenfor scroll-området.
   */
  actionBar?: React.ReactNode;
  /**
   * Persistent tab-bar i bunnen. Alltid synlig, alltid mounted.
   */
  tabBar: React.ReactNode;
  /**
   * Kall ved snap-endring. Brukes av parent (BoardScaffold) for å
   * synkronisere map-padding-bottom — Unit 6.
   */
  onSnapChange?: (snap: number | string) => void;
}

/**
 * Multi-snap bottom-sheet (Google Maps-stil) for mobile board-flyt.
 *
 * Fire snap-stages: kollapset (kun tab-bar) | peek | halv | full.
 * Sheet er alltid mountet (`open={true}`, `dismissible={false}`),
 * map er aldri sløret (`modal={false}`, ingen overlay).
 *
 * Auto-snap ved phase-overgang via useEffect-watcher: phase=default→96px,
 * phase=active→320px, phase=poi→0.5. Bruker-drag respekteres til neste
 * phase-overgang.
 *
 * `handleOnly={true}` = kun trekk på drag-handle drar sheet. Tab-bar
 * horizontal-scroll er dermed isolert fra sheet-vertikal-drag.
 *
 * Phase=default: sheet snappet til 96px, viser kun tab-bar (children +
 * actionBar er ikke synlige fordi det er over visible-area).
 */
export function BoardMobileSheet({
  children,
  actionBar,
  tabBar,
  onSnapChange,
}: BoardMobileSheetProps) {
  const { state } = useBoard();
  const [snap, setSnapInternal] = useState<number | string | null>(
    getDefaultSnapForPhase(state.phase),
  );
  const lastNotifiedRef = useRef<number | string | null>(null);

  // Wrapper rundt setter — fyrer onSnapChange ved hver endring.
  // Brukes både av vaul (når bruker drar) og lokalt (auto-snap-watcher).
  const setSnap = (next: number | string | null) => {
    setSnapInternal(next);
    if (next !== null && next !== lastNotifiedRef.current) {
      lastNotifiedRef.current = next;
      onSnapChange?.(next);
    }
  };

  // Auto-snap ved phase-overgang. Watcher fyrer kun når phase faktisk
  // endrer seg, ikke på snap-endringer fra bruker-drag.
  useEffect(() => {
    setSnap(getDefaultSnapForPhase(state.phase));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase]);

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
            droppe auto-overlay. modal={false} + ingen overlay = kart synlig
            bak sheet. h-[92dvh] matcher stage-4-snap; vaul translate-er hele
            elementet basert på snap-stage, så ved stage 1 er kun bottom 96px synlig. */}
        <DrawerPrimitive.Content
          data-slot="board-mobile-sheet"
          className="fixed inset-x-0 bottom-0 z-30 flex h-[92dvh] flex-col bg-stone-50/95 backdrop-blur rounded-t-3xl shadow-[0_-4px_24px_rgba(15,29,68,0.08)]"
        >
          {/* Drag-handle. Synlig kun ved stage 2+ (over visible-area ved stage 1). */}
          <div className="mx-auto mt-3 mb-2 h-1.5 w-[100px] shrink-0 rounded-full bg-stone-300" />

          {/* Scrollbart innhold-slot. Phase-styres av kalleren (Unit 4/5).
              `min-h-0` så flex-shrink fungerer ved stage 1 (kollapser til 0). */}
          <div className="flex-1 overflow-y-auto min-h-0">{children}</div>

          {/* Pinned action-bar slot. Kun synlig ved phase=poi (Unit 5 sender). */}
          {actionBar && <div className="shrink-0">{actionBar}</div>}

          {/* Tab-bar slot — alltid synlig på tvers av snap-stages.
              Safe-area-inset-bottom ligger på selve tab-bar-komponenten (Unit 3). */}
          <div className="shrink-0 border-t border-stone-200/80">{tabBar}</div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
