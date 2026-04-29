"use client";

import { Home } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";

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
  const Icon = getFilledIcon(category.icon);
  const firstWord = category.label.split(/\s+/)[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={`group flex h-[72px] w-full flex-col items-center justify-center gap-1 rounded-2xl border transition-all ${
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
        className="flex h-9 w-9 items-center justify-center rounded-full shadow-sm"
        style={{ backgroundColor: category.color }}
      >
        <Icon className="h-4 w-4 text-white" weight="fill" />
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

/** Hex til rgba med alpha. Defaulter til stone-400 hvis hex mangler/er ugyldig. */
function hexWithAlpha(hex: string | undefined, alpha: number): string {
  const clean = (hex ?? "#94a3b8").replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
