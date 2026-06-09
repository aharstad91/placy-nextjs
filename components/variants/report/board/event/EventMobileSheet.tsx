"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronDown, GripHorizontal } from "lucide-react";
import { useBoard } from "../board-state";
import { BoardMap } from "../BoardMap";
import { EventFilterPanel } from "./EventFilterPanel";
import type { BoardCategory } from "../board-data";
import type { EventBoardFilterResult } from "@/lib/event-board/useEventBoardFilter";
import type { BoardCollectionApi } from "@/lib/event-board/use-board-collection";

/**
 * Mobil bottom-sheet for event-board (Unit 7, R7 + R17).
 *
 * R7 mobile-first: <1024px rendrer event-board en bottom-sheet over et
 * persistent kart i stedet for desktop-sidekolonnen. Speiler det adaptive
 * mobil-mønsteret (bottom-sheet på mobil, sidekolonne på desktop) — IKKE den
 * audio-tour-drevne reels-stacken (events har ingen audio/karaoke), så vi
 * gjenbruker IKKE `MapLayer`/`ReelsStack` her. Boligrapportenes mobil-sti
 * (audio-reels) er urørt — denne komponenten rendres KUN i event-modus.
 *
 * R17 — kart-synlighet aldri helt skjult:
 *  - peek (32%): event-lista er synlig, kartet fyller resten (aldri skjult).
 *  - half (62%): mer av lista, kartet beholder en stripe i topp.
 *  - full (92%): maksimal liste-/detalj-flate, men kartet beholder ~8% stripe
 *    i topp — aldri 100% (R17: kartet skal aldri forsvinne helt).
 *
 * "Min samling" via persistent affordance: en FAB over kartet (topp-høyre),
 * synlig og trykkbar i ALLE faser (peek/half/full) — uavhengig av sheet-høyden.
 *
 * Marker-tap → board-state phase "poi" (BoardMap dispatcher OPEN_POI). Vi hever
 * da sheet-en til half slik at per-event-detaljen (EventFilterPanel swapper til
 * EventDetailPanel ved phase "poi", Unit 6) blir synlig UTEN å skjule kartet.
 */

type SheetPhase = "peek" | "half" | "full";

// Sheet-høyde i prosent av viewport. Full er bevisst < 100 (R17: kartet
// beholder alltid en stripe i topp). Peek-høyden brukes også som
// `mapPaddingBottom` så markører holder seg over sheet-kanten.
const SHEET_HEIGHT_PCT: Record<SheetPhase, number> = {
  peek: 32,
  half: 62,
  full: 92,
};

export function EventMobileSheet({
  has3dAddon,
  eventFilter,
  categories,
  collection,
  onOpenCollection,
}: {
  has3dAddon: boolean;
  /** Unit 4: filter-resultat (liste/seksjoner/dag-state). */
  eventFilter: EventBoardFilterResult;
  /** Board-kategoriene (tema-chip-etiketter/farger til EventFilterPanel). */
  categories: BoardCategory[];
  /** Unit 5: "Min samling"-søm (lagre-toggle + affordance). Null → ingen UI. */
  collection: BoardCollectionApi | null;
  /** Unit 5: åpne samling-draweren (del-URL/QR). */
  onOpenCollection: () => void;
}) {
  const { state } = useBoard();
  const [sheetPhase, setSheetPhase] = useState<SheetPhase>("peek");

  // Marker-tap → board phase "poi" (OPEN_POI). Hev sheet-en til (minst) half så
  // per-event-detaljen blir synlig — men la kartet beholde en stripe (R17:
  // aldri full ved auto-heving, brukeren kan dra til full selv). Når detaljen
  // lukkes (BACK_TO_DEFAULT → phase tilbake til "default") fall tilbake til peek
  // hvis brukeren stod i peek da den åpnet — vi holder det enkelt: half ved
  // åpning, ellers la brukerens manuelle høyde stå.
  useEffect(() => {
    if (state.phase === "poi") {
      setSheetPhase((p) => (p === "peek" ? "half" : p));
    }
  }, [state.phase]);

  const heightPct = SHEET_HEIGHT_PCT[sheetPhase];

  // Tap på drag-handle/header sykler peek → half → full. Chevron i full
  // kollapser direkte til peek.
  const cycleUp = () =>
    setSheetPhase((p) => (p === "peek" ? "half" : p === "half" ? "full" : "full"));
  const collapse = () => setSheetPhase("peek");

  const collectionCount = collection?.collectionPoiIds.size ?? 0;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-stone-100">
      {/* Persistent kart — fyller hele flaten, ligger under sheet-en. Aldri
          unmountet (WebGL-trygt). mapPaddingBottom holder markører over
          sheet-kanten i peek. */}
      <div className="absolute inset-0">
        <BoardMap
          has3dAddon={has3dAddon}
          compactControls
          mapPaddingBottom={Math.round((SHEET_HEIGHT_PCT.peek / 100) * 700)}
        />
      </div>

      {/* "Min samling"-affordance — persistent FAB over kartet (topp-høyre),
          synlig/trykkbar i ALLE faser (R17). Viser antall lagrede. */}
      {collection && (
        <button
          type="button"
          onClick={onOpenCollection}
          disabled={collectionCount === 0}
          aria-label="Min samling"
          className={`absolute right-4 top-[max(1rem,env(safe-area-inset-top))] z-30 flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold shadow-lg transition ${
            collectionCount > 0
              ? "bg-sky-500 text-white"
              : "bg-white/90 text-stone-400 ring-1 ring-black/10 backdrop-blur-sm"
          }`}
        >
          <Bookmark size={15} className="shrink-0" />
          <span>Min samling</span>
          <span
            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
              collectionCount > 0 ? "bg-white/25" : "bg-stone-200 text-stone-500"
            }`}
          >
            {collectionCount}
          </span>
        </button>
      )}

      {/* Bottom-sheet — peek/half/full. Kartet er aldri helt skjult (full = 92%). */}
      <div
        data-testid="event-sheet"
        data-sheet-phase={sheetPhase}
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col overflow-hidden rounded-t-3xl bg-[#f2e9dc] shadow-2xl transition-[height] duration-500 ease-out"
        style={{ height: `${heightPct}%` }}
      >
        {/* Header — drag-handle + tap-to-expand. Tap sykler høyden opp;
            chevron i full kollapser til peek. */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={cycleUp}
            aria-label={sheetPhase === "peek" ? "Vis mer av programmet" : "Utvid"}
            className="flex w-full flex-col items-center justify-center gap-1 pt-2.5 pb-1.5"
          >
            <GripHorizontal size={18} className="text-stone-400" aria-hidden />
          </button>
          {sheetPhase === "full" && (
            <button
              type="button"
              onClick={collapse}
              aria-label="Vis mindre"
              className="absolute right-3 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-stone-500 ring-1 ring-black/5"
            >
              <ChevronDown size={18} />
            </button>
          )}
        </div>

        {/* Sheet-innhold — EventFilterPanel swapper selv til EventDetailPanel
            ved board phase "poi" (Unit 6). Samme delte overflate som desktop. */}
        <div className="flex min-h-0 flex-1 flex-col">
          <EventFilterPanel
            filter={eventFilter}
            categories={categories}
            collection={collection}
            onOpenCollection={onOpenCollection}
          />
        </div>
      </div>
    </div>
  );
}
