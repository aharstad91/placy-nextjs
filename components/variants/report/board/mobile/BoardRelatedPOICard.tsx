"use client";

import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardPOI } from "../board-data";

interface Props {
  poi: BoardPOI;
  categoryColor: string;
  onClick: () => void;
}

export function BoardRelatedPOICard({ poi, categoryColor, onClick }: Props) {
  const Icon = getFilledIcon(poi.raw.category.icon);

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3.5 py-3 bg-white rounded-2xl border border-stone-200/80 shadow-[0_2px_8px_rgba(15,29,68,0.06)] text-left transition-all hover:shadow-[0_4px_14px_rgba(15,29,68,0.1)] hover:-translate-y-0.5 active:translate-y-0"
    >
      <div
        className="flex-none w-10 h-10 rounded-full flex items-center justify-center shadow-md"
        style={{ backgroundColor: categoryColor }}
      >
        <Icon className="w-5 h-5 text-white" weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-stone-900 truncate">{poi.name}</div>
        {poi.address && (
          <div className="text-xs text-stone-500 truncate">{poi.address}</div>
        )}
      </div>
    </button>
  );
}
