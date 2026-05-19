"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useBoard } from "../board-state";
import type { BoardCategory, BoardCategoryId, BoardHome } from "../board-data";
import { useBoardActiveSection } from "@/lib/hooks/useBoardActiveSection";
import { PlayerBanner } from "../audio-tour/PlayerBanner";
import { StartTourButton } from "../audio-tour/StartTourButton";
import { useAudioTourPhase } from "@/lib/stores/audio-tour-store";

const HOME_SECTION_ID = "home";

/**
 * Unit 0 spike: single continuous scroll panel that replaces BoardDetailPanel
 * in phase="default". Renders Hjem (project intro) followed by one section per
 * category with slim pitch-stub text (theme.lead + theme.body). Scroll-tracking
 * via useBoardActiveSection dispatches SELECT_CATEGORY{source:"scroll"} so the
 * map veksler pins as the user scrolls through the narrative.
 *
 * External activeCategoryId changes (e.g. rail click) cause the corresponding
 * section to scrollIntoView. Bi-directional sync is feedback-loop-safe because
 * the dispatch is idempotent when activeSectionId already matches.
 *
 * Audio-tour UI (PlayerBanner sticky-top, StartTourButton in Home-section) is
 * mounted so MP3-data (already present in boardData) is reachable from the
 * scroll-narrative shell. Components self-gate on `audioTourEnabled` and
 * tourPhase, so the spike still validates as audio-OFF on projects without the
 * flag.
 */
export function BoardScrollPanel() {
  const { data, state, dispatch } = useBoard();
  const containerRef = useRef<HTMLDivElement>(null);

  const { activeSectionId, registerSectionRef } = useBoardActiveSection(
    containerRef,
    HOME_SECTION_ID,
  );

  // Scroll → state: bubble visible section into BoardContext.
  useEffect(() => {
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
  }, [activeSectionId, state.activeCategoryId, dispatch]);

  // State → scroll: when activeCategoryId changes externally (rail click,
  // Home-marker RESET, audio-tour-sync), scroll the matching section into view.
  // IMPORTANT: deps intentionally exclude `activeSectionId` — this effect must
  // only react to *external* state changes. Including activeSectionId here
  // creates a race where the effect fires with stale state.activeCategoryId
  // during natural scroll (IO updates activeSectionId before the dispatched
  // SELECT_CATEGORY has flushed), causing scroll-back-to-Home flicker.
  // The activeSectionId closure is still read at fire time for the bail check.
  useEffect(() => {
    if (!containerRef.current) return;
    const targetId = state.activeCategoryId ?? HOME_SECTION_ID;
    if (targetId === activeSectionId) return;
    const target = containerRef.current.querySelector<HTMLElement>(
      `[data-board-section="${CSS.escape(targetId)}"]`,
    );
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeCategoryId]);

  // PlayerBanner sticky-top + body-dimming during active tour, mirroring
  // BoardDetailPanel's tour-mode-attr pattern (see tour-mode.css).
  const tourPhase = useAudioTourPhase();
  const showPlayerBanner = tourPhase !== "idle" && tourPhase !== "ended";
  const tourActive = tourPhase === "playing" || tourPhase === "paused";

  return (
    <section
      aria-label="Nabolags-narrativ"
      data-tour-active={tourActive ? "true" : undefined}
      className="flex h-full w-[400px] flex-col border-r border-stone-200/80 bg-stone-50"
    >
      {showPlayerBanner && <PlayerBanner />}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto pb-[60vh]"
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
        <StartTourButton />
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
      className="border-t border-stone-200/80 px-6 py-8"
    >
      <h2 className="text-2xl font-bold leading-tight text-stone-900">
        {category.label}
      </h2>
      {category.lead && (
        <p
          data-board-body
          className="mt-3 text-[15px] leading-relaxed text-stone-700"
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
