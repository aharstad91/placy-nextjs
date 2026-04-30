"use client";

import { ChevronDown, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { SubCategoryInfo } from "./use-sub-category-filter";

interface Props {
  subCategories: SubCategoryInfo[];
  hiddenIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (allIds: string[]) => void;
  variant?: "desktop" | "mobile";
}

/**
 * Filter for sub-kategorier innen et tema. Renderes over Punkter-listen.
 *
 * Skjules helt når temaet har <2 sub-kategorier (ingen filter-verdi).
 *
 * Bruker shadcn Popover (Radix) som portaler til document.body — fungerer
 * også fra inne i vaul-drawer (mobile reading-modal). Hvis stacking-problemer
 * oppstår kan vi senere falle tilbake til inline disclosure.
 */
export function SubCategoryFilter({
  subCategories,
  hiddenIds,
  onToggle,
  onToggleAll,
  variant = "desktop",
}: Props) {
  if (subCategories.length < 2) return null;

  const allIds = subCategories.map((s) => s.id);
  const visibleCount = subCategories.filter((s) => !hiddenIds.has(s.id)).length;
  const totalCount = subCategories.length;
  const hasPartialFilter =
    visibleCount > 0 && visibleCount < totalCount;
  const allHidden = visibleCount === 0;
  const allVisible = visibleCount === totalCount;

  const visiblePoiCount = subCategories
    .filter((s) => !hiddenIds.has(s.id))
    .reduce((sum, s) => sum + s.count, 0);
  const totalPoiCount = subCategories.reduce((sum, s) => sum + s.count, 0);

  const isMobile = variant === "mobile";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50",
            isMobile ? "h-9 px-3.5" : "h-9 px-3.5",
          )}
          aria-label={
            hasPartialFilter
              ? `Filter: ${visibleCount} av ${totalCount} sub-kategorier synlig`
              : "Filtrér sub-kategorier"
          }
        >
          <SlidersHorizontal className="h-4 w-4 text-stone-500" />
          <span>Filtrér</span>
          <span className="tabular-nums text-stone-500">
            {hasPartialFilter
              ? `(${visiblePoiCount}/${totalPoiCount})`
              : allHidden
                ? `(0/${totalPoiCount})`
                : `(${totalPoiCount})`}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 !p-1.5"
      >
        <div className="flex flex-col">
          {subCategories.map((sub) => {
            const Icon = getFilledIcon(sub.icon);
            const isVisible = !hiddenIds.has(sub.id);
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onToggle(sub.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-50"
                aria-pressed={isVisible}
              >
                <div
                  className={cn(
                    "flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-white shadow-sm transition-all",
                    !isVisible && "opacity-30 grayscale",
                  )}
                  style={{ backgroundColor: sub.color || "#94a3b8" }}
                >
                  <Icon className="h-3.5 w-3.5 text-white" weight="fill" />
                </div>
                <span
                  className={cn(
                    "flex-1 truncate",
                    !isVisible && "text-stone-400",
                  )}
                >
                  {sub.name}
                </span>
                <span className="tabular-nums text-xs text-stone-400">
                  {sub.count}
                </span>
              </button>
            );
          })}

          <div className="my-1 h-px bg-stone-100" />

          <button
            type="button"
            onClick={() => onToggleAll(allIds)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-stone-500 transition-colors hover:bg-stone-50"
          >
            {allVisible ? (
              <EyeOff className="h-4 w-4 flex-none" />
            ) : (
              <Eye className="h-4 w-4 flex-none" />
            )}
            <span className="flex-1">
              {allVisible ? "Skjul alle" : "Vis alle"}
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
