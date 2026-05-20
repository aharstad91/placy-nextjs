"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useBoard } from "../board-state";
import type { BoardCategory, BoardCategoryId, BoardHome } from "../board-data";
import { useBoardActiveSection } from "@/lib/hooks/useBoardActiveSection";
import { BottomPlayer } from "../audio-tour/BottomPlayer";
import { CategoryAudioButton } from "../audio-tour/CategoryAudioButton";
import { useAudioTourPhase } from "@/lib/stores/audio-tour-store";

const HOME_SECTION_ID = "home";

/**
 * Unit 0 spike: single continuous scroll panel that replaces BoardDetailPanel
 * in phase="default". Renders Hjem (project intro) followed by one section per
 * category with slim pitch-stub text (theme.lead + theme.body). Scroll-tracking
 * via useBoardActiveSection dispatches SELECT_CATEGORY{source:"scroll"} så
 * kart-pins følger scroll-narrativet.
 *
 * Audio-tour-UI er konsentrert i en bottom-sticky BottomPlayer: idle viser
 * "Start tour"-CTA, aktiv viser mini-player med thumbnail, label og transport-
 * controls. Per-kategori "Spill av denne seksjonen"-CTA i CategorySection lar
 * bruker hoppe direkte til ett spor.
 */
export function BoardScrollPanel({
  hideBottomPlayer = false,
}: {
  /** Skjul BottomPlayer når en overlay (POI) ligger oppå panelet — overlay-
   *  headeren har transport-rollen i den modusen. */
  hideBottomPlayer?: boolean;
} = {}) {
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
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto pb-[40vh]"
      >
        <HomeSection
          home={data.home}
          registerRef={registerSectionRef(HOME_SECTION_ID)}
        />
        {data.categories.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            registerRef={registerSectionRef(cat.id)}
          />
        ))}
      </div>
      {!hideBottomPlayer && <BottomPlayer />}
    </section>
  );
}

function HomeSection({
  home,
  registerRef,
}: {
  home: BoardHome;
  registerRef: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      id={HOME_SECTION_ID}
      data-board-section={HOME_SECTION_ID}
      ref={registerRef}
      className="flex flex-col"
    >
      {home.heroImage && (
        <div className="relative aspect-[4/3] w-full flex-none bg-stone-200">
          <Image
            src={home.heroImage}
            alt={home.name}
            fill
            sizes="400px"
            className="object-cover"
            priority
          />
        </div>
      )}
      <div className="flex flex-col gap-3 px-6 py-6">
        {home.address && (
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {home.address}
          </div>
        )}
        <h2 className="text-2xl font-bold leading-tight text-stone-900">
          {home.name}
        </h2>
        {home.heroIntro && (
          <p
            data-board-body
            className="text-[15px] leading-relaxed text-stone-700"
          >
            {home.heroIntro}
          </p>
        )}
      </div>
    </section>
  );
}

function CategorySection({
  category,
  registerRef,
}: {
  category: BoardCategory;
  registerRef: (el: HTMLElement | null) => void;
}) {
  return (
    <section
      id={category.id}
      data-board-section={category.id}
      ref={registerRef}
      className="flex flex-col border-t border-stone-200/80 px-6 py-8"
    >
      <h2 className="text-2xl font-bold leading-tight text-stone-900">
        {category.label}
      </h2>
      <CategoryAudioButton category={category} />
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
    </section>
  );
}
