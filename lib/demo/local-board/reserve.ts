import { radiusOptions } from "@/lib/demo/local-board/radius";
import type { BoardData } from "@/components/variants/report/board/board-data";

/** The complete dataset stays local; only curated/revealed places reach board surfaces. */
export function visibleReserveBoard(data: BoardData, revealed: ReadonlySet<string>): BoardData {
  if (!data.demoReservePlaceIds?.length) return data;
  const hidden = new Set(data.demoReservePlaceIds.filter(id => !revealed.has(id)));
  return {
    ...data,
    categories: data.categories.map(c => ({
      ...c,
      pois: c.pois.filter(p => !hidden.has(p.id)),
      topRankedPois: c.topRankedPois.filter(p => !hidden.has(p.id)),
      ...(c.editorial ? { editorial: { ...c.editorial, highlights: c.editorial.highlights?.filter(p => !hidden.has(p.id)) } } : {}),
    })),
    poisById: new Map([...data.poisById].filter(([id]) => !hidden.has(id))),
  };
}

export function nextReserveIds(data: BoardData, categoryId: string, revealed: ReadonlySet<string>): string[] {
  return radiusOptions(data.demoRadiusPlaces ?? [], categoryId, revealed).options[0]?.ids ?? [];
}
