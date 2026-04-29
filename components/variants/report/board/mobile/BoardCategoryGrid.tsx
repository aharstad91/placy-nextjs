"use client";

import Image from "next/image";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";

export function BoardCategoryGrid() {
  const { state, data, dispatch } = useBoard();
  const visible = state.phase === "default";

  return (
    <div
      className={`absolute inset-x-0 bottom-0 pt-[18px] pointer-events-auto transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.32,0.72,0.28,1)] ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
      style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))" }}
      aria-hidden={!visible}
    >
      <h2 className="px-5 pb-3 text-[13px] font-semibold uppercase tracking-wider text-stone-500">
        Hva lurer du på?
      </h2>
      <div
        className="flex gap-3 px-5 pb-1.5 overflow-x-auto overflow-y-hidden snap-x snap-mandatory [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {data.categories.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            onSelect={() => dispatch({ type: "SELECT_CATEGORY", id: cat.id })}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  onSelect,
}: {
  category: BoardCategory;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="flex-none w-[168px] snap-start bg-white border border-stone-200/80 rounded-[18px] shadow-[0_4px_16px_rgba(15,29,68,0.08)] overflow-hidden text-left transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(15,29,68,0.14)] active:translate-y-0"
    >
      <div className="relative aspect-square bg-stone-100">
        {category.illustration && (
          <Image
            src={category.illustration.src}
            alt=""
            fill
            sizes="168px"
            className="object-cover"
          />
        )}
        <div
          className="absolute top-2.5 right-2.5 min-w-[26px] h-[26px] px-2 rounded-md flex items-center justify-center text-xs font-semibold text-white shadow-[0_2px_8px_rgba(27,45,92,0.35)]"
          style={{ backgroundColor: "#1a2952" }}
        >
          {category.pois.length}
        </div>
      </div>
      <div className="px-3.5 py-3 flex flex-col gap-1">
        <div className="text-sm font-semibold leading-tight text-stone-900">
          {category.question || category.label}
        </div>
        <div className="text-xs text-stone-500">{category.label}</div>
      </div>
    </button>
  );
}
