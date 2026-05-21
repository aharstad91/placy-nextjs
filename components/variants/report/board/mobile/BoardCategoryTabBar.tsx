"use client";

import Image from "next/image";
import { forwardRef, useEffect, useRef } from "react";
import { Home } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";
import { THEME_SCENE_SRC } from "../../theme-icons";
import {
  useAudioTourSectionProgress,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";

type RailStateCompact = "active" | "played" | "inactive";

/** Idle/ended → scroll styrer; ellers driver audio tab-staten. */
function useTourActive(): boolean {
  return useAudioTourStore(
    (s) => s.phase === "playing" || s.phase === "paused" || s.phase === "error",
  );
}

/** Scroll/klikk eier "active"-slotten (UX-affordance så et meny-klikk alltid
 *  føles bekreftet), audio eier pulse + "played"-spor. */
function deriveRailState(
  tourActive: boolean,
  progress: ReturnType<typeof useAudioTourSectionProgress>,
  scrollActive: boolean,
): RailStateCompact {
  if (scrollActive) return "active";
  if (tourActive && progress !== null && progress !== "unplayed") return "played";
  return "inactive";
}

/**
 * Persistent horisontal kategori-tab-bar pinnet til viewport-bunn (Google
 * Maps-stil). Hjem-knapp først, deretter alle
 * kategorier som thumbnail. Speiler tab-pattern fra BoardTabs (pill-bakgrunn,
 * alltid én aktiv) — kategori-tittel vises i sheet-headeren, ikke som label
 * under firkantene.
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
 *
 * Rail-state-compact speiler audio-tour-progress per spor (active|played|
 * inactive) når turen er aktiv; ellers driver scroll-state den ene aktive.
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
      data-cinematic-active="true"
      className="relative bg-stone-200/70 backdrop-blur-md border-t border-stone-300/60"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div
        className="flex gap-3 overflow-x-auto px-3 pt-2.5 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "pan-x" }}
      >
        <HomeButton
          scrollActive={state.phase === "default"}
          onClick={handleHomeClick}
        />

        {data.categories.map((cat) => (
          <CategoryButton
            key={cat.id}
            ref={cat.id === activeCategoryId ? activeRef : null}
            category={cat}
            scrollActive={cat.id === activeCategoryId}
            onClick={() => handleCategoryClick(cat)}
          />
        ))}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-stone-200/70 to-transparent"
      />
    </nav>
  );
}

function HomeButton({
  scrollActive,
  onClick,
}: {
  scrollActive: boolean;
  onClick: () => void;
}) {
  const tourActive = useTourActive();
  const progress = useAudioTourSectionProgress("home");
  const railState = deriveRailState(tourActive, progress, scrollActive);
  const isActive = railState === "active";

  return (
    <button
      type="button"
      aria-label="Hjem"
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      data-active-during-tour={
        tourActive && progress === "active" ? "true" : undefined
      }
      data-rail-state-compact={railState}
      className="flex shrink-0 items-center justify-center w-14"
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-gradient-to-br from-amber-50 to-stone-200 ${
          isActive
            ? "border-stone-900 text-stone-900 shadow-md"
            : "border-transparent text-stone-700 shadow-sm"
        }`}
      >
        <Home className="h-6 w-6" strokeWidth={2} />
      </div>
    </button>
  );
}

const CategoryButton = forwardRef<
  HTMLButtonElement,
  {
    category: BoardCategory;
    scrollActive: boolean;
    onClick: () => void;
  }
>(function CategoryButton({ category, scrollActive, onClick }, ref) {
  const illustrationSrc = THEME_SCENE_SRC[category.id];
  const Icon = getFilledIcon(category.icon);
  const tourActive = useTourActive();
  const progress = useAudioTourSectionProgress(category.id);
  const railState = deriveRailState(tourActive, progress, scrollActive);
  const isActive = railState === "active";

  return (
    <button
      ref={ref}
      type="button"
      aria-label={category.label}
      aria-current={isActive ? "page" : undefined}
      onClick={onClick}
      data-active-during-tour={
        tourActive && progress === "active" ? "true" : undefined
      }
      data-rail-state-compact={railState}
      style={{ ["--cat-glow" as string]: hexToGlow(category.color) }}
      className="flex shrink-0 snap-center items-center justify-center w-14"
    >
      <div
        className={`relative h-14 w-14 overflow-hidden rounded-2xl border-2 ${
          isActive
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
    </button>
  );
});

/** Konverterer hex-farge til rgba med 0.5 alpha for cinematic-glow. */
function hexToGlow(hex: string): string {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return "rgba(28, 25, 23, 0.35)";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, 0.5)`;
}
