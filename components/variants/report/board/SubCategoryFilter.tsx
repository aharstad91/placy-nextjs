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
import { markerCircleStyle } from "./marker-style";

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
 * - Desktop-varianten bruker shadcn Popover (Radix) som portaler til
 *   document.body — fungerer godt i tett desktop-layout.
 * - Mobile-varianten rendrer en horisontal-scrollende chip-rad direkte
 *   over POI-listen (ingen popover) — alltid synlig og kjapp å bruke
 *   med tommelen.
 */
export function SubCategoryFilter({
  subCategories,
  hiddenIds,
  onToggle,
  onToggleAll,
  variant = "desktop",
}: Props) {
  if (subCategories.length < 2) return null;

  if (variant === "mobile") {
    return (
      <MobileChipRow
        subCategories={subCategories}
        hiddenIds={hiddenIds}
        onToggle={onToggle}
        onToggleAll={onToggleAll}
      />
    );
  }

  return (
    <DesktopPopover
      subCategories={subCategories}
      hiddenIds={hiddenIds}
      onToggle={onToggle}
      onToggleAll={onToggleAll}
    />
  );
}

function DesktopPopover({
  subCategories,
  hiddenIds,
  onToggle,
  onToggleAll,
}: Omit<Props, "variant">) {
  const allIds = subCategories.map((s) => s.id);
  const visibleCount = subCategories.filter((s) => !hiddenIds.has(s.id)).length;
  const totalCount = subCategories.length;
  const hasPartialFilter = visibleCount > 0 && visibleCount < totalCount;
  const allHidden = visibleCount === 0;
  const allVisible = visibleCount === totalCount;

  const visiblePoiCount = subCategories
    .filter((s) => !hiddenIds.has(s.id))
    .reduce((sum, s) => sum + s.count, 0);
  const totalPoiCount = subCategories.reduce((sum, s) => sum + s.count, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200/80 bg-white px-3.5 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50"
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
      <PopoverContent align="start" sideOffset={6} className="w-64 !p-1.5">
        <div className="flex flex-col">
          {subCategories.map((sub) => {
            const Icon = getFilledIcon(sub.icon);
            const isVisible = !hiddenIds.has(sub.id);
            const circle = markerCircleStyle(sub.color);
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
                    "flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 transition-all",
                    !isVisible && "opacity-30 grayscale",
                  )}
                  style={{
                    borderColor: circle.borderColor,
                    backgroundColor: circle.backgroundColor,
                    color: circle.borderColor,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" weight="fill" />
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

function MobileChipRow({
  subCategories,
  hiddenIds,
  onToggle,
  onToggleAll,
}: Omit<Props, "variant">) {
  const allIds = subCategories.map((s) => s.id);
  const visibleCount = subCategories.filter((s) => !hiddenIds.has(s.id)).length;
  const totalCount = subCategories.length;
  const allVisible = visibleCount === totalCount;

  return (
    <div
      className="-mx-5 flex gap-2 overflow-x-auto overflow-y-hidden px-5 pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label="Filtrér sub-kategorier"
    >
      <button
        type="button"
        onClick={() => onToggleAll(allIds)}
        className={cn(
          "inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
          allVisible
            ? "border-stone-300 bg-stone-100 text-stone-600"
            : "border-stone-200/80 bg-white text-stone-700 shadow-sm hover:bg-stone-50",
        )}
        aria-label={allVisible ? "Skjul alle sub-kategorier" : "Vis alle sub-kategorier"}
      >
        {allVisible ? (
          <EyeOff className="h-3.5 w-3.5 text-stone-500" />
        ) : (
          <Eye className="h-3.5 w-3.5 text-stone-500" />
        )}
        <span>{allVisible ? "Skjul alle" : "Vis alle"}</span>
      </button>

      {subCategories.map((sub) => {
        const isVisible = !hiddenIds.has(sub.id);
        const circle = markerCircleStyle(sub.color);
        return (
          <button
            key={sub.id}
            type="button"
            onClick={() => onToggle(sub.id)}
            aria-pressed={isVisible}
            className={cn(
              "inline-flex h-9 flex-none items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors",
              isVisible
                ? "border-stone-200/80 bg-white text-stone-700 shadow-sm hover:bg-stone-50"
                : "border-stone-200 bg-stone-100 text-stone-400",
            )}
          >
            <span
              className={cn(
                "h-3 w-3 flex-none rounded-full border-2 transition-all",
                !isVisible && "opacity-30 grayscale",
              )}
              style={{
                borderColor: circle.borderColor,
                backgroundColor: circle.backgroundColor,
              }}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">{sub.name}</span>
            <span
              className={cn(
                "tabular-nums text-xs",
                isVisible ? "text-stone-400" : "text-stone-300",
              )}
            >
              {sub.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
