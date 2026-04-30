"use client";

import Image from "next/image";
import { Home } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";
import { THEME_SCENE_SRC } from "../../theme-icons";
import { hexWithAlpha } from "../marker-style";

/**
 * Desktop venstre-rail (104px bred). Viser Home øverst og kategori-ikoner under.
 * Klikk Home → RESET_TO_DEFAULT. Klikk kategori → SELECT_CATEGORY.
 */
export function BoardRail() {
  const { state, data, dispatch } = useBoard();

  return (
    <aside
      aria-label="Kategorinavigasjon"
      className="flex h-full w-[104px] flex-col items-center gap-2 border-r border-stone-200/80 bg-white/95 px-3 py-5 backdrop-blur"
    >
      <button
        type="button"
        aria-label="Tilbake til oversikt"
        aria-current={state.phase === "default" ? "page" : undefined}
        onClick={() => dispatch({ type: "RESET_TO_DEFAULT" })}
        className={`flex h-[72px] w-full flex-col items-center justify-center gap-1 rounded-2xl border transition-all ${
          state.phase === "default"
            ? "border-stone-300 bg-stone-100 text-stone-900"
            : "border-transparent text-stone-600 hover:bg-stone-100/60"
        }`}
      >
        <Home className="h-5 w-5" strokeWidth={2} />
        <span className="text-[11px] font-semibold leading-tight">Hjem</span>
      </button>

      <div className="my-1 h-px w-8 bg-stone-200" aria-hidden="true" />

      <nav className="flex w-full flex-col gap-1.5 overflow-y-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
  const firstWord = category.label.split(/\s+/)[0];
  // Akvarell-illustrasjon som rounded-xl kvadrat (matcher mobile category-grid +
  // rapport-tema-chips). Bygger på `THEME_SCENE_SRC` slik at samme asset-mappe
  // brukes overalt — én sannhetskilde for tema-illustrasjoner.
  const illustrationSrc = THEME_SCENE_SRC[category.id];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={`group flex h-[88px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border transition-all ${
        active
          ? "border-stone-300/60 shadow-[0_2px_8px_rgba(15,29,68,0.08)]"
          : "border-transparent hover:bg-stone-100/60"
      }`}
      style={
        active
          ? { backgroundColor: hexWithAlpha(category.color, 0.12) }
          : undefined
      }
    >
      <div
        className={`relative h-14 w-14 overflow-hidden rounded-xl bg-stone-100 transition-all ${
          active ? "ring-2 ring-white shadow-sm" : ""
        }`}
      >
        {illustrationSrc ? (
          <Image
            src={illustrationSrc}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <FallbackIcon category={category} />
        )}
      </div>
      <span
        className={`text-[11px] font-semibold leading-tight ${
          active ? "text-stone-900" : "text-stone-600"
        }`}
      >
        {firstWord}
      </span>
    </button>
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
      <Icon className="h-6 w-6 text-stone-400" weight="duotone" />
    </div>
  );
}

