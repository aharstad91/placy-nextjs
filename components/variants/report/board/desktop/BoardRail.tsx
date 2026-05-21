"use client";

import Image from "next/image";
import { Home } from "lucide-react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { useBoard } from "../board-state";
import type { BoardCategory } from "../board-data";
import { THEME_SCENE_SRC } from "../../theme-icons";
import {
  useAudioTourSectionProgress,
  useAudioTourStore,
} from "@/lib/stores/audio-tour-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type RailState = "active" | "played" | "inactive";

/** Aktiv-tour-modus er kun playing/paused/error. Idle/ended → scroll styrer
 *  rail-navigasjonen igjen (matcher at BottomPlayer/PlayerBanner skjules på
 *  `ended`). */
function useTourActive(): boolean {
  return useAudioTourStore(
    (s) => s.phase === "playing" || s.phase === "paused" || s.phase === "error",
  );
}

/**
 * Desktop venstre-rail (80px bred). Kun ikon/illustrasjon — kategori-label
 * leveres via tooltip på hover. Discord-mønster. Bredde gir 8px luft hver side
 * rundt 48px button + 4px active-ring — ellers klipper nav-overflow ringen.
 * Klikk Home → RESET_TO_DEFAULT. Klikk kategori → SELECT_CATEGORY.
 *
 * Tre uavhengige signaler under aktiv tour:
 *   - `data-rail-state="active"` (scale + ring): scroll/klikket ikon. R19b sin
 *     "audio vinner over scroll" gjelder IKKE her — bruker-klikk på en rail-
 *     ikon må kunne lyse opp som "selected" selv om megleren prater en annen
 *     kategori. Uten dette føles meny-klikk dødt.
 *   - `data-rail-state="played"` (full opacity, ingen scale): kategorier som
 *     allerede er gjennomgått av megleren, ELLER er den som spilles akkurat nå
 *     (når den ikke samtidig er scroll-active). "Du har vært her"-spor.
 *   - `data-active-during-tour` (pulse): hvilken kategori audio nå narrerer.
 *     Kan ligge på samme ikon som "active" (passiv lyttemodus, scroll følger
 *     audio) eller på et annet ikon enn "active" (split-brain etter klikk).
 *
 * Inaktiv tur (idle/ended): scroll driver alene; "played"/pulse forsvinner.
 */
export function BoardRail() {
  const { state, data, dispatch } = useBoard();

  return (
    <TooltipProvider>
      <aside
        aria-label="Kategorinavigasjon"
        data-cinematic-active="true"
        className="flex h-full w-[80px] flex-col items-center gap-2 border-r border-stone-200/80 bg-white/95 px-2 py-4 backdrop-blur"
      >
        <HomeRailButton
          scrollActive={state.phase === "default"}
          onSelect={() => dispatch({ type: "RESET_TO_DEFAULT" })}
        />

        <div className="my-1 h-px w-6 bg-stone-200" aria-hidden="true" />

        <nav className="flex w-full flex-col items-center gap-5 overflow-y-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {data.categories.map((cat) => (
            <RailButton
              key={cat.id}
              category={cat}
              scrollActive={state.activeCategoryId === cat.id}
              onSelect={() =>
                dispatch({
                  type: "SELECT_CATEGORY",
                  id: cat.id,
                  source: "rail",
                })
              }
            />
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  );
}

/** Beregner rail-state. Scroll/klikk vinner alltid `active`-slotten — UX-
 *  prinsipp: klikk på en meny-ikon må gi visuell "selected"-respons. Det
 *  overstyrer R19b kun for denne ene visuelle slotten. Audio-narrasjon
 *  signaleres parallelt via pulse (`data-active-during-tour`) og via
 *  "played"-stien (kategorien beholder full opacity selv før den er ferdig).
 *
 *  Under aktiv tur (playing/paused/error):
 *    - scrollActive → "active" (uansett audio-status)
 *    - audio-current eller allerede-spilt → "played" (full opacity)
 *    - ellers → "inactive" (0.3)
 *  Inaktiv tur (idle/ended): scroll alene driver active|inactive. */
function deriveRailState(
  tourActive: boolean,
  progress: ReturnType<typeof useAudioTourSectionProgress>,
  scrollActive: boolean,
): RailState {
  if (scrollActive) return "active";
  if (tourActive && progress !== null && progress !== "unplayed") return "played";
  return "inactive";
}

function HomeRailButton({
  scrollActive,
  onSelect,
}: {
  scrollActive: boolean;
  onSelect: () => void;
}) {
  const tourActive = useTourActive();
  const progress = useAudioTourSectionProgress("home");
  const railState = deriveRailState(tourActive, progress, scrollActive);
  const isActive = railState === "active";
  const isPlayed = railState === "played";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Tilbake til oversikt"
          aria-current={isActive ? "page" : undefined}
          onClick={onSelect}
          data-active-during-tour={
            tourActive && progress === "active" ? "true" : undefined
          }
          data-rail-state={railState}
          className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${
            isActive || isPlayed
              ? "border-stone-300 bg-stone-100 text-stone-900 shadow-sm"
              : "border-transparent text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent>Hjem</TooltipContent>
    </Tooltip>
  );
}

function RailButton({
  category,
  scrollActive,
  onSelect,
}: {
  category: BoardCategory;
  scrollActive: boolean;
  onSelect: () => void;
}) {
  const tourActive = useTourActive();
  const progress = useAudioTourSectionProgress(category.id);
  const railState = deriveRailState(tourActive, progress, scrollActive);
  const isActive = railState === "active";
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
          aria-current={isActive ? "page" : undefined}
          aria-label={category.label}
          data-active-during-tour={
            tourActive && progress === "active" ? "true" : undefined
          }
          data-rail-state={railState}
          style={{ ["--cat-glow" as string]: hexToGlow(category.color) }}
          className="group flex h-12 w-12 items-center justify-center rounded-2xl"
        >
          <div
            className={
              isActive
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

/** Konverterer hex-farge til rgba med 0.4 alpha for cinematic-glow. */
function hexToGlow(hex: string): string {
  const m = /^#?([a-f0-9]{6})$/i.exec(hex);
  if (!m) return "rgba(28, 25, 23, 0.35)";
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 0xff}, ${(n >> 8) & 0xff}, ${n & 0xff}, 0.5)`;
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
