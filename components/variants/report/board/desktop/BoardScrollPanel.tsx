"use client";

import { useEffect, useMemo, useRef } from "react";
import { useBoard } from "../board-state";
import type { BoardCategory, BoardCategoryId } from "../board-data";
import { useBoardActiveSection } from "@/lib/hooks/useBoardActiveSection";
import { BottomPlayer } from "../audio-tour/BottomPlayer";
import { CategoryAudioButton } from "../audio-tour/CategoryAudioButton";
import {
  useAudioTourPhase,
  useAudioTourSectionProgress,
} from "@/lib/stores/audio-tour-store";
import { KaraokePitchText } from "../audio-tour/KaraokePitchText";
import { CategoryFeaturedChips } from "../CategoryFeaturedChips";
import { CategoryIndex } from "../CategoryIndex";
import { SidebarHero } from "../SidebarHero";
import { pickFeaturedPOIs } from "@/lib/board/featured-pois";

const FEATURED_CHIP_COUNT = 5;

const HOME_SECTION_ID = "home";

/**
 * Single continuous scroll panel. Hjem-seksjon (SidebarHero + CategoryIndex)
 * etterfølges av én seksjon per kategori med pitch-tekst og featured chips.
 * Scroll-tracking via useBoardActiveSection dispatcher SELECT_CATEGORY
 * {source:"scroll"} så kart-pins følger scroll-narrativet.
 *
 * Spotify-anatomi: top-hero har stor play-knapp som primær audio-tour-CTA.
 * Bottom-player rendres KUN under aktiv tour (idle/ended → null) — ingen
 * dobbel CTA. Per-kategori CategoryAudioButton lar bruker hoppe direkte til
 * ett spor; CategoryIndex øverst gir nav-snarvei til alle kategorier.
 */
export function BoardScrollPanel() {
  const { data, state, dispatch } = useBoard();
  const containerRef = useRef<HTMLDivElement>(null);
  // Når true: vi animerer en programmatic scroll (audio/Home-RESET). IO vil
  // fyre på alle mellomliggende seksjoner mens scroll passerer, og uten denne
  // guarden ville scroll-tracking-effekten dispatche SELECT_CATEGORY for hver
  // av dem — som ville rocket target-seksjonen ut av sentrum og gitt overshoot.
  const programmaticScrollRef = useRef(false);

  const { activeSectionId, registerSectionRef } = useBoardActiveSection(
    containerRef,
    HOME_SECTION_ID,
  );

  // Scroll → state: bubble visible section into BoardContext. Deps inkluderer
  // KUN activeSectionId — effekten skal være enveis (scroll → state). Hadde
  // state.activeCategoryId vært i deps, ville effekten fyrt på eksterne
  // state-endringer (audio-tour-sync, player-jump) før IO rekker å oppdatere
  // activeSectionId, og dispatch'et basert på utdatert initial-activeSectionId
  // ("home") — som ville angret den eksterne endringen. Closure-capture leser
  // state.activeCategoryId ved fire-time uansett.
  useEffect(() => {
    if (programmaticScrollRef.current) return;
    if (!activeSectionId) return;
    if (activeSectionId === HOME_SECTION_ID) {
      if (state.activeCategoryId !== null) {
        dispatch({ type: "RESET_TO_DEFAULT" });
      }
      return;
    }
    if (activeSectionId !== state.activeCategoryId) {
      dispatch({
        type: "SELECT_CATEGORY",
        id: activeSectionId as BoardCategoryId,
        source: "scroll",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId, dispatch]);

  // State → scroll: when activeCategoryId changes externally (audio-tour-sync,
  // BottomPlayer category-jump, Home-marker RESET), scroll the matching section
  // into view. programmaticScrollRef suppresses scroll-tracking dispatches
  // during the smooth-scroll animation.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const targetId = state.activeCategoryId ?? HOME_SECTION_ID;
    if (targetId === activeSectionId) return;
    const target = container.querySelector<HTMLElement>(
      `[data-board-section="${CSS.escape(targetId)}"]`,
    );
    if (!target) return;

    programmaticScrollRef.current = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });

    // scrollend er ikke universelt støttet (Safari < 17.4 mangler det), så vi
    // har en setTimeout-fallback. Smooth scroll på normalt content tar typisk
    // 300–600ms; 900ms gir buffer for lange hopp.
    const clearGuard = () => {
      programmaticScrollRef.current = false;
    };
    const fallback = window.setTimeout(clearGuard, 900);
    const onScrollEnd = () => {
      window.clearTimeout(fallback);
      clearGuard();
      container.removeEventListener("scrollend", onScrollEnd);
    };
    container.addEventListener("scrollend", onScrollEnd);

    return () => {
      window.clearTimeout(fallback);
      container.removeEventListener("scrollend", onScrollEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeCategoryId]);

  // tour-mode-attribute for CSS body-dimming (tour-mode.css).
  const tourPhase = useAudioTourPhase();
  const tourActive = tourPhase === "playing" || tourPhase === "paused";

  return (
    <section
      aria-label="Nabolags-narrativ"
      data-tour-active={tourActive ? "true" : undefined}
      className="flex h-full w-[400px] flex-col border-r border-stone-200/80 bg-stone-50"
    >
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="h-full overflow-y-auto pb-[40vh]"
        >
          <HomeSection
            scrollActive={state.activeCategoryId === null}
            registerRef={registerSectionRef(HOME_SECTION_ID)}
          />
          {data.categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              scrollActive={state.activeCategoryId === cat.id}
              registerRef={registerSectionRef(cat.id)}
            />
          ))}
        </div>
        {/* Soft fade i topp/bunn av scroll-flaten — gir 1.5-visible-rytmen
         *  myke kanter så tekst toner ut mot edge istedenfor å klippes. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-gradient-to-b from-stone-50 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-stone-50 to-transparent"
        />
      </div>
      <BottomPlayer />
    </section>
  );
}

/** Beregner data-section-state med scroll-fallback. Under aktiv tour vinner
 *  tour-progress (played|active|unplayed); ellers driver scroll alene
 *  (active|inactive). Speil av rail-prinsippet — uten tour er det scroll-
 *  posisjonen som signaliserer "her er du." */
function deriveSectionState(
  tourProgress: ReturnType<typeof useAudioTourSectionProgress>,
  scrollActive: boolean,
): "played" | "active" | "unplayed" | "inactive" {
  if (tourProgress !== null) return tourProgress;
  return scrollActive ? "active" : "inactive";
}

/** Home-seksjonens scroll-trackede wrapper. Holder hero + indeks i samme IO-
 *  enhet så de regnes som "home" mens brukeren leser dem. Hjem-pitchens
 *  karaoke er bevisst utelatt — pitchen er audio-only (megler leser den)
 *  og duplisering som ord-for-ord-tekst i topp ville konkurrert med audio.
 *  Velkomst-teksten i SidebarHero er en kort, separat oppsummering. */
function HomeSection({
  scrollActive,
  registerRef,
}: {
  scrollActive: boolean;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const progress = useAudioTourSectionProgress("home");
  const sectionState = deriveSectionState(progress, scrollActive);

  return (
    <section
      id={HOME_SECTION_ID}
      data-board-section={HOME_SECTION_ID}
      data-section-state={sectionState}
      ref={registerRef}
      className="flex flex-col"
    >
      <SidebarHero />
      <CategoryIndex />
    </section>
  );
}

function CategorySection({
  category,
  scrollActive,
  registerRef,
}: {
  category: BoardCategory;
  scrollActive: boolean;
  registerRef: (el: HTMLElement | null) => void;
}) {
  const { dispatch } = useBoard();
  const progress = useAudioTourSectionProgress(category.id);
  const isAudioActive = progress === "active";
  const sectionState = deriveSectionState(progress, scrollActive);
  const karaokeText = category.audio?.manus;
  const karaokeTimings = category.audio?.timings;
  const featuredPois = useMemo(
    () => pickFeaturedPOIs(category.pois, FEATURED_CHIP_COUNT, category.id),
    [category.pois, category.id],
  );

  return (
    <section
      id={category.id}
      data-board-section={category.id}
      data-section-state={sectionState}
      ref={registerRef}
      className="flex min-h-[65vh] flex-col border-t border-stone-200/60 px-6 py-12"
    >
      <h2 className="text-2xl font-bold leading-tight text-stone-900">
        {category.label}
      </h2>
      <CategoryAudioButton category={category} />
      {karaokeText ? (
        <KaraokePitchText
          text={karaokeText}
          timings={karaokeTimings}
          isActive={isAudioActive}
          className="mt-4 text-[15px] leading-relaxed text-stone-700"
        />
      ) : (
        <>
          {category.lead && (
            <p
              data-board-body
              className="mt-4 text-[15px] leading-relaxed text-stone-700"
            >
              {category.lead}
            </p>
          )}
          {category.body && (
            <p
              data-board-body
              className="mt-3 whitespace-pre-line text-[14px] leading-relaxed text-stone-600"
            >
              {category.body}
            </p>
          )}
        </>
      )}
      {featuredPois.length > 0 && (
        <div className="mt-6">
          <CategoryFeaturedChips
            pois={featuredPois}
            category={category}
            onChipClick={(poi) =>
              dispatch({
                type: "OPEN_POI",
                id: poi.id,
                categoryId: category.id,
              })
            }
          />
        </div>
      )}
    </section>
  );
}
