"use client";

import { useBoard, useActiveCategory } from "../board-state";
import { BoardSwitcherChip } from "./BoardSwitcherChip";

export function BoardPeekCard() {
  const { state, dispatch } = useBoard();
  const cat = useActiveCategory();

  // Synlig i active OG poi (sheet-en er fortsatt over). Skjul i default + reading.
  const visible = state.phase === "active";

  return (
    <div
      className={`absolute inset-x-0 bottom-0 px-4 pt-3.5 transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0.28,1)] pointer-events-auto ${
        visible ? "translate-y-0" : "translate-y-[110%]"
      }`}
      style={{
        paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
        background:
          "linear-gradient(180deg, transparent 0%, rgba(184,194,232,0.4) 30%, rgb(231,235,250) 60%)",
      }}
      aria-hidden={!visible}
    >
      <BoardSwitcherChip />
      <div className="bg-white/65 backdrop-blur-md rounded-[18px] px-[18px] pt-4 pb-[18px] shadow-[0_8px_30px_rgba(15,29,68,0.14)] flex flex-col gap-2.5">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          {cat?.label ?? ""}
        </div>
        <p className="text-base leading-snug font-medium text-stone-900 m-0">
          {cat?.lead || cat?.question || "…"}
        </p>
        <div className="flex items-center gap-2.5 mt-1">
          <button
            type="button"
            onClick={() => dispatch({ type: "OPEN_READING" })}
            className="bg-[#1a2952] text-white px-[18px] py-2.5 rounded-full text-sm font-semibold transition-all hover:bg-[#25366d] active:scale-[0.97]"
          >
            Les mer
          </button>
        </div>
      </div>
    </div>
  );
}
