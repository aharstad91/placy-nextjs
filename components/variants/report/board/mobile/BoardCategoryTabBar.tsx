"use client";

import Image from "next/image";
import { forwardRef, useEffect, useRef } from "react";
import { Home } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";
import { THEME_SCENE_SRC } from "../../theme-icons";
import {
  useAudioTourStore,
  type AudioTrackCategoryId,
} from "@/lib/stores/audio-tour-store";

/** Speil av samme hook i BoardRail. Holdt lokal for å unngå utilitsmodul
 *  for én hook med to consumers. */
function useTourActiveTrackCategory(): AudioTrackCategoryId | null {
  return useAudioTourStore((s) => {
    if (s.phase !== "playing" && s.phase !== "paused") return null;
    return s.tracks[s.trackIndex]?.categoryId ?? null;
  });
}

/**
 * Persistent horisontal kategori-tab-bar pinnet til viewport-bunn (Google
 * Maps-stil). Hjem-knapp først (matcher desktop BoardRail), deretter alle
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
 */
export function BoardCategoryTabBar() {
  const { state, data, dispatch } = useBoard();
  const activeRef = useRef<HTMLButtonElement>(null);
  const activeCategoryId = state.activeCategoryId;
  const tourTrack = useTourActiveTrackCategory();

  // R19b: audio vinner over scroll. Cinematic-state speiler tourTrack når den
  // er satt, ellers state.activeCategoryId.
  const effectiveActiveCategoryId =
    tourTrack && tourTrack !== "home" ? tourTrack : activeCategoryId;
  const homeEffectiveActive =
    tourTrack === "home" || (tourTrack === null && state.phase === "default");

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
          active={homeEffectiveActive}
          pulsesDuringTour={tourTrack === "home"}
          onClick={handleHomeClick}
        />

        {data.categories.map((cat) => {
          const isActive = effectiveActiveCategoryId === cat.id;
          return (
            <CategoryButton
              key={cat.id}
              ref={isActive ? activeRef : null}
              category={cat}
              active={isActive}
              pulsesDuringTour={tourTrack === cat.id}
              onClick={() => handleCategoryClick(cat)}
            />
          );
        })}
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-stone-200/70 to-transparent"
      />
    </nav>
  );
}

function HomeButton({
  active,
  pulsesDuringTour,
  onClick,
}: {
  active: boolean;
  pulsesDuringTour: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Hjem"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      data-active-during-tour={pulsesDuringTour ? "true" : undefined}
      data-rail-state-compact={active ? "active" : "inactive"}
      className="flex shrink-0 items-center justify-center w-14"
    >
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 bg-gradient-to-br from-amber-50 to-stone-200 ${
          active
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
    active: boolean;
    pulsesDuringTour: boolean;
    onClick: () => void;
  }
>(function CategoryButton({ category, active, pulsesDuringTour, onClick }, ref) {
  const illustrationSrc = THEME_SCENE_SRC[category.id];
  const Icon = getFilledIcon(category.icon);

  return (
    <button
      ref={ref}
      type="button"
      aria-label={category.label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      data-active-during-tour={pulsesDuringTour ? "true" : undefined}
      data-rail-state-compact={active ? "active" : "inactive"}
      style={{ ["--cat-glow" as string]: hexToGlow(category.color) }}
      className="flex shrink-0 snap-center items-center justify-center w-14"
    >
      <div
        className={`relative h-14 w-14 overflow-hidden rounded-2xl border-2 ${
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
    </button>
  );
});

/** Speil av samme funksjon i BoardRail.tsx — konverterer hex til rgba med
 *  alpha for cinematic-glow. Holdt lokal for å unngå utilitsmodul for én
 *  ren funksjon med to consumers. */
function hexToGlow(hex: string): string {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return "rgba(28, 25, 23, 0.35)";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, 0.5)`;
}
