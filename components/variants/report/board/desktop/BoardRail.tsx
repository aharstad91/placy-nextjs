"use client";

import Image from "next/image";
import { Home } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";
import { THEME_SCENE_SRC } from "../../theme-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Desktop venstre-rail (80px bred). Kun ikon/illustrasjon — kategori-label
 * leveres via tooltip på hover. Discord-mønster. Bredde gir 8px luft hver side
 * rundt 48px button + 4px active-ring — ellers klipper nav-overflow ringen.
 * Klikk Home → RESET_TO_DEFAULT. Klikk kategori → SELECT_CATEGORY.
 */
export function BoardRail() {
  const { state, data, dispatch } = useBoard();

  return (
    <TooltipProvider>
      <aside
        aria-label="Kategorinavigasjon"
        className="flex h-full w-[80px] flex-col items-center gap-2 border-r border-stone-200/80 bg-white/95 px-2 py-4 backdrop-blur"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Tilbake til oversikt"
              aria-current={state.phase === "default" ? "page" : undefined}
              onClick={() => dispatch({ type: "RESET_TO_DEFAULT" })}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all ${
                state.phase === "default"
                  ? "border-stone-300 bg-stone-100 text-stone-900 shadow-sm"
                  : "border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-900"
              }`}
            >
              <Home className="h-5 w-5" strokeWidth={2} />
            </button>
          </TooltipTrigger>
          <TooltipContent>Hjem</TooltipContent>
        </Tooltip>

        <div className="my-1 h-px w-6 bg-stone-200" aria-hidden="true" />

        <nav className="flex w-full flex-col items-center gap-5 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.categories.map((cat) => (
            <RailButton
              key={cat.id}
              category={cat}
              active={state.activeCategoryId === cat.id}
              onSelect={() => dispatch({ type: "SELECT_CATEGORY", id: cat.id })}
            />
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

function RailButton({
  category,
  active,
  onSelect,
}: {
  category: BoardCategory;
  active: boolean;
  onSelect: () => void;
}) {
  // Akvarell-illustrasjon som rounded-xl kvadrat (matcher mobile category-grid +
  // rapport-tema-chips). Bygger på `THEME_SCENE_SRC` slik at samme asset-mappe
  // brukes overalt — én sannhetskilde for tema-illustrasjoner.
  const illustrationSrc = THEME_SCENE_SRC[category.id];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? "page" : undefined}
          aria-label={category.label}
          className="group flex h-12 w-12 items-center justify-center rounded-2xl"
        >
          <div
            className={
              active
                ? "relative h-12 w-12 overflow-hidden rounded-xl transition-shadow shadow-[0_0_0_2px_white,_0_0_0_4px_#1c1917,_0_4px_12px_rgba(15,29,68,0.15)]"
                : "relative h-12 w-12 overflow-hidden rounded-xl transition-shadow shadow-[0_0_0_1px_rgba(231,229,228,0.8)] group-hover:shadow-[0_0_0_2px_white,_0_0_0_4px_#d6d3d1,_0_4px_12px_rgba(15,29,68,0.10)]"
            }
          >
            {illustrationSrc ? (
              <Image
                src={illustrationSrc}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
              />
            ) : (
              <FallbackIcon category={category} />
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent>{category.label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Fallback når et tema mangler akvarell-illustrasjon (f.eks. custom kategori
 * uten asset i `THEME_SCENE_SRC`). Viser stone-100-bakgrunn med outline-ikon.
 */
function FallbackIcon({ category }: { category: BoardCategory }) {
  const Icon = getFilledIcon(category.icon);
  return (
    <div className="flex h-full w-full items-center justify-center">
      <Icon className="h-5 w-5 text-stone-400" weight="duotone" />
    </div>
  );
}
