"use client";

import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardCategory } from "../board-data";
import { BoardPOIDetails } from "../BoardPOIDetails";
import { markerCircleStyle } from "../marker-style";

interface Props {
  category: BoardCategory;
}

/**
 * Inline POI-accordion for Punkter-tab i mobil ReadingModal.
 *
 * Speiler styling fra `desktop/BoardPOIAccordion` (samme rounded-2xl-kort, samme
 * trigger-layout: ikon-circle + navn + adresse). Til forskjell fra desktop:
 * - Klikk på trigger dispatcher IKKE `OPEN_POI` — vi bytter ikke fase fra
 *   `reading` til `poi`. Brukeren beholder list-konteksten og åpner POI inline.
 * - Ingen sync mot `state.activePOIId` (kart-marker-highlight) — det ville
 *   krevd en ny `HIGHLIGHT_POI`-action. Holdt scope til R1 og en lokal callback.
 *
 * Multi-open (`type="multiple"`) — flere kort kan være åpne samtidig.
 *
 * Per memory `feedback_disclosure_animations`: max-height-animasjonen fra
 * Accordion er signal nok ved expand; ingen auto-scroll når kort åpnes.
 */
export function BoardPunkterAccordion({ category }: Props) {
  const [openIds, setOpenIds] = useState<string[]>([]);

  // Reset på kategori-bytte (samme mønster som desktop)
  useEffect(() => {
    setOpenIds([]);
  }, [category.id]);

  return (
    <Accordion
      type="multiple"
      value={openIds}
      onValueChange={setOpenIds}
      className="flex flex-col gap-2.5 border-0 rounded-none overflow-visible"
    >
      {category.pois.map((poi) => {
        const Icon = getFilledIcon(poi.raw.category.icon);
        // Sub-kategori-farge differensierer POIer innen temaet (samme logikk
        // som desktop BoardPOIAccordion og BoardMarker fall-through).
        const subColor = poi.raw.category.color || category.color;
        const circle = markerCircleStyle(subColor);
        return (
          <AccordionItem
            key={poi.id}
            value={poi.id}
            className="rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_8px_rgba(15,29,68,0.06)] data-[state=open]:bg-white"
          >
            <AccordionTrigger className="min-w-0 items-center gap-3 px-3.5 py-3 text-left hover:no-underline data-[state=open]:bg-stone-50/40 [&>svg]:text-stone-400">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: circle.borderColor,
                    backgroundColor: circle.backgroundColor,
                    color: circle.borderColor,
                  }}
                >
                  <Icon className="h-4 w-4" weight="fill" />
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
            <AccordionContent className="px-3.5 pb-3.5 pt-2">
              <BoardPOIDetails poi={poi.raw} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
