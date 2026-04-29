"use client";

import { useEffect, useRef, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory, BoardPOIId } from "../board-data";
import { BoardLiveTransport } from "../mobile/BoardLiveTransport";

interface Props {
  category: BoardCategory;
}

/**
 * Accordion-liste for POI-er i Punkter-tabben (desktop).
 *
 * Multi-open (`type="multiple"`) — brukeren kan ha flere kort åpne samtidig
 * og styrer selv hvilke som er åpne. Ingen auto-lukking når et nytt åpnes.
 *
 * Sync mot global board-state:
 * - Når et nytt kort åpnes → dispatch OPEN_POI (markør på kart får path/label)
 * - Når det aktive kortet lukkes → fall back til siste gjenværende åpne, ellers BACK_TO_ACTIVE
 * - Når lukkes ikke-aktivt kort → ingen state-endring, kun lokal accordion-state
 * - POI-marker-klikk på kartet → state.activePOIId oppdateres → vi sørger for at
 *   tilsvarende kort også åpnes i lista
 */
export function BoardPOIAccordion({ category }: Props) {
  const { state, dispatch } = useBoard();
  const [openIds, setOpenIds] = useState<string[]>([]);

  // Spor om en activePOIId-endring kom fra accordion selv (klikk på trigger),
  // eller utenfra (POI-marker på kartet). Brukes til å unngå scroll-into-view
  // når brukeren allerede så på kortet.
  const selfTriggerRef = useRef<string | null>(null);

  // Token-pattern for scroll-rAF — siste call vinner, superseded calls aborts
  // silent. Mønster fra lib/map/use-interaction-controller.ts.
  const scrollTokenRef = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Reset på kategori-bytte
  useEffect(() => {
    setOpenIds([]);
  }, [category.id]);

  // Marker-klikk på kartet → state.activePOIId endres → åpne kortet + scroll
  useEffect(() => {
    const id = state.activePOIId;
    if (!id) return;

    // Hvis vi selv dispatchet OPEN_POI fra handleValueChange (accordion-klikk):
    // brukeren ser allerede kortet, ikke scroll.
    if (selfTriggerRef.current === id) {
      selfTriggerRef.current = null;
      return;
    }

    // Utenfra-trigger: sørg for at kortet er åpent
    setOpenIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

    // Scroll med token-guard så nye marker-klikk avbryter pågående scroll.
    const myToken = ++scrollTokenRef.current;
    requestAnimationFrame(() => {
      if (myToken !== scrollTokenRef.current) return;
      const el = rootRef.current?.querySelector(
        `[data-poi-id="${CSS.escape(id)}"]`,
      ) as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [state.activePOIId]);

  const handleValueChange = (newIds: string[]) => {
    const prev = openIds;
    setOpenIds(newIds);

    const added = newIds.find((id) => !prev.includes(id));
    if (added) {
      selfTriggerRef.current = added;
      dispatch({
        type: "OPEN_POI",
        id: added as BoardPOIId,
        categoryId: category.id,
      });
      return;
    }

    const removed = prev.find((id) => !newIds.includes(id));
    if (removed && removed === state.activePOIId) {
      if (newIds.length > 0) {
        const fallback = newIds[newIds.length - 1];
        selfTriggerRef.current = fallback;
        dispatch({
          type: "OPEN_POI",
          id: fallback as BoardPOIId,
          categoryId: category.id,
        });
      } else {
        dispatch({ type: "BACK_TO_ACTIVE" });
      }
    }
  };

  return (
    <div ref={rootRef}>
      <Accordion
        type="multiple"
        value={openIds}
        onValueChange={handleValueChange}
        className="flex flex-col gap-2.5 border-0 rounded-none overflow-visible"
      >
      {category.pois.map((poi) => {
        const Icon = getFilledIcon(poi.raw.category.icon);
        const isActive = state.activePOIId === poi.id;
        return (
          <AccordionItem
            key={poi.id}
            value={poi.id}
            data-poi-id={poi.id}
            className="rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_8px_rgba(15,29,68,0.06)] data-[state=open]:bg-white scroll-mt-2"
          >
            <AccordionTrigger
              className="items-center gap-3 px-3.5 py-3 text-left hover:no-underline data-[state=open]:bg-stone-50/40 [&>svg]:text-stone-400"
              style={
                isActive
                  ? { boxShadow: `inset 3px 0 0 ${category.color}` }
                  : undefined
              }
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className="flex h-10 w-10 flex-none items-center justify-center rounded-full shadow-md"
                  style={{ backgroundColor: category.color }}
                >
                  <Icon className="h-5 w-5 text-white" weight="fill" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-stone-900">
                    {poi.name}
                  </div>
                  {poi.address && (
                    <div className="truncate text-xs font-normal text-stone-500">
                      {poi.address}
                    </div>
                  )}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-3.5 pb-3.5 pt-0">
              <BoardLiveTransport poi={poi.raw} />
              {poi.body && (
                <div className="space-y-3 pt-2 text-stone-800">
                  {poi.body.split(/\n+/).map((p, i) => (
                    <p key={i} className="text-[15px] leading-relaxed">
                      {p}
                    </p>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
      </Accordion>
    </div>
  );
}
