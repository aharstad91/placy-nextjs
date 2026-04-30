"use client";

import { useCallback, useEffect, useState } from "react";
import type { BoardCategory } from "./board-data";

export interface SubCategoryInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

/**
 * Deriver sub-kategorier fra et tema (BoardCategory) basert på POI-ene.
 * Sub-kategorier er den granulære `poi.raw.category` (f.eks. bakeri, restaurant)
 * — separert fra temaet de tilhører (f.eks. mat).
 *
 * Dedupliserer på category.id og sorterer etter count desc, slik at de største
 * sub-kategoriene kommer først i UI.
 */
export function deriveSubCategories(category: BoardCategory): SubCategoryInfo[] {
  const map = new Map<string, SubCategoryInfo>();
  for (const poi of category.pois) {
    const cat = poi.raw.category;
    const existing = map.get(cat.id);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(cat.id, {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        count: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export interface SubCategoryFilterApi {
  /** Set av sub-kategori-IDer som er skjult (negativ form — tom set = alle synlige). */
  hiddenIds: Set<string>;
  /** Toggle visibility for en enkelt sub-kategori-ID. */
  toggle: (id: string) => void;
  /**
   * Toggle alle sub-kategorier samtidig:
   * - Hvis alle for øyeblikket er synlige → skjul alle (legg alle IDer i hiddenIds)
   * - Ellers (noen/alle skjult) → vis alle (clear hiddenIds)
   */
  toggleAll: (allIds: string[]) => void;
  /** Tøm filteret manuelt. */
  reset: () => void;
}

/**
 * Filter-state for sub-kategorier innen aktivt tema.
 *
 * Resettes automatisk når `activeCategoryId` endres — filteret er kontekstuelt
 * per kategori, så bytte til ny kategori starter alltid med alle sub-kat synlig.
 *
 * Bruker negativ form (`hiddenIds`) som matcher Explorer-pattern
 * (`disabledCategories`): tom set = default "alt synlig", noe i set = filtrert.
 */
export function useSubCategoryFilter(
  activeCategoryId: string | null,
): SubCategoryFilterApi {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());

  // Reset filter når aktivt tema endres
  useEffect(() => {
    setHiddenIds(new Set());
  }, [activeCategoryId]);

  const toggle = useCallback((id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((allIds: string[]) => {
    setHiddenIds((prev) => {
      // Hvis alle er synlige (prev tom eller mangler noen IDer) → skjul alle.
      // Hvis alle er skjult → vis alle (clear).
      const allHidden = allIds.length > 0 && allIds.every((id) => prev.has(id));
      if (allHidden) {
        return new Set();
      }
      return new Set(allIds);
    });
  }, []);

  const reset = useCallback(() => {
    setHiddenIds(new Set());
  }, []);

  return { hiddenIds, toggle, toggleAll, reset };
}
