"use client";

import Image from "next/image";
import { forwardRef, useEffect, useRef } from "react";
import { Home } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";
import { THEME_SCENE_SRC } from "../../theme-icons";

/**
 * Persistent horisontal kategori-tab-bar pinnet til viewport-bunn (Google
 * Maps-stil). Hjem-knapp først (matcher desktop BoardRail), deretter alle
 * kategorier som thumbnail + tekst-label (12px under).
 *
 * Mountes som søsken til BoardMobileSheet i BoardScaffold med høy z-index
 * — alltid synlig, alltid over sheet og kart. Sheet kan dras ned uten å
 * skjule denne primær-navigasjonen.
 *
 * Datasett kan ha 6–18 kategorier. ~6 knapper synlig per 390px-viewport;
 * resten oppdages via horisontal swipe + right-edge gradient-fade affordance
 * + scrollIntoView ved kategori-bytte.
 *
 * Snap-styring: tab-bar dispatcher kun til BoardState (SELECT_CATEGORY,
 * RESET_TO_DEFAULT). BoardMobileSheet sin egen useEffect-watcher på phase
 * snapper sheet til riktig stage. Ingen direkte kobling.
 */
export function BoardCategoryTabBar() {
  const { state, data, dispatch } = useBoard();
  const activeRef = useRef<HTMLButtonElement>(null);
  const activeCategoryId = state.activeCategoryId;

  useEffect(() => {
    if (!activeCategoryId) return;
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [activeCategoryId]);

  const handleHomeClick = () => {
    dispatch({ type: "RESET_TO_DEFAULT" });
  };

  const handleCategoryClick = (cat: BoardCategory) => {
    if (cat.id === activeCategoryId) return;
    dispatch({ type: "SELECT_CATEGORY", id: cat.id });
  };

  return (
    <nav
      aria-label="Kategorinavigasjon"
      className="relative bg-stone-50 border-t border-stone-200/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="flex gap-3 overflow-x-auto px-3 pt-2 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x" }}
      >
        <HomeButton
          active={state.phase === "default"}
          onClick={handleHomeClick}
        />

        {data.categories.map((cat) => {
          const isActive = activeCategoryId === cat.id;
          return (
            <CategoryButton
              key={cat.id}
              ref={isActive ? activeRef : null}
              category={cat}
              active={isActive}
              onClick={() => handleCategoryClick(cat)}
            />
          );
        })}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-stone-50 to-transparent"
      />
    </nav>
  );
}

function HomeButton({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Tilbake til oversikt"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className="flex shrink-0 flex-col items-center gap-1 pt-0.5 w-14"
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-colors ${
          active
            ? "border-stone-900 bg-stone-100 text-stone-900"
            : "border-transparent bg-stone-100 text-stone-600"
        }`}
      >
        <Home className="h-6 w-6" strokeWidth={2} />
      </div>
      <span className="text-[11px] font-medium text-stone-700 truncate max-w-[56px]">
        Hjem
      </span>
    </button>
  );
}

const CategoryButton = forwardRef<
  HTMLButtonElement,
  {
    category: BoardCategory;
    active: boolean;
    onClick: () => void;
  }
>(function CategoryButton({ category, active, onClick }, ref) {
  const illustrationSrc = THEME_SCENE_SRC[category.id];
  const Icon = getFilledIcon(category.icon);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={category.label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className="flex shrink-0 snap-center flex-col items-center gap-1 pt-0.5 w-14"
    >
      <div
        className={`relative h-14 w-14 overflow-hidden rounded-2xl border-2 transition-all ${
          active
            ? "border-stone-900 shadow-md"
            : "border-transparent shadow-sm"
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
          <div className="flex h-full w-full items-center justify-center bg-stone-100">
            <Icon className="h-6 w-6 text-stone-500" weight="duotone" />
          </div>
        )}
      </div>
      <span className="text-[11px] font-medium text-stone-700 truncate max-w-[56px]">
        {category.label}
      </span>
    </button>
  );
});
