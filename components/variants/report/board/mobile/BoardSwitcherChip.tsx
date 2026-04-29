"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
import { useBoard, useActiveCategory } from "../board-state";

export function BoardSwitcherChip() {
  const { data, dispatch } = useBoard();
  const active = useActiveCategory();

  // Stablede thumbnails: 3 første kategorier som IKKE er aktiv
  const otherCategories = data.categories
    .filter((c) => c.id !== active?.id)
    .slice(0, 3);

  return (
    <div className="flex justify-end mb-2.5">
      <button
        type="button"
        aria-label="Bytt kategori"
        onClick={() => dispatch({ type: "RESET_TO_DEFAULT" })}
        className="flex items-center gap-3 h-11 px-3.5 rounded-full bg-white/85 backdrop-blur shadow-[0_4px_12px_rgba(15,29,68,0.14)] text-stone-900 transition-all duration-150 hover:bg-white/95 active:scale-[0.96]"
      >
        <Menu className="w-5 h-5 flex-none" strokeWidth={2} />
        <div className="flex items-center" aria-hidden="true">
          {otherCategories.map((cat, idx) => (
            <div
              key={cat.id}
              className={`w-7 h-7 rounded-lg bg-stone-200 border-2 border-white shadow-[0_1px_3px_rgba(15,29,68,0.18)] overflow-hidden ${
                idx > 0 ? "-ml-2.5" : ""
              }`}
            >
              {cat.illustration && (
                <Image
                  src={cat.illustration.src}
                  alt=""
                  width={28}
                  height={28}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      </button>
    </div>
  );
}
