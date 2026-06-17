"use client";

import {
  useLayoutEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Image from "next/image";
import { useReels } from "./reels-state";
import { useReelsBeatNav } from "./use-reels-beat-nav";
import { useReelsTogglePlay } from "./use-reels-toggle-play";
import { CategoryReel } from "./CategoryReel";
import {
  cardIndexToAudioIndex,
  posterForVideo,
  type CategoryReelCard,
  type ReelsCard,
} from "./reels-data";

const TRANSITION = "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)";
const TRANSITION_MS = 320;
const COMMIT_PX = 80; // distanse-terskel for å committe et slide
const FLICK_VY = 0.4; // px/ms — rask flikk committer selv på kort drag
const FLICK_MIN_PX = 24; // men flikk krever et minste utslag
const DIR_LOCK_PX = 6; // utslag før vi avgjør drag-vs-tapp / retning
const EDGE_RESISTANCE = 0.3; // gummibånd når retningen mangler nabo-kategori

function asCategory(card: ReelsCard | undefined): CategoryReelCard | null {
  return card && card.kind === "category" ? card : null;
}

/**
 * Statisk «peek» av en nabo-kategori under swipe — posterbildet (= videoens
 * første frame, så overgangen til det fulle kortet er sømløs) med samme ramme +
 * label som CategoryReel. Ingen video/karaoke (kun synlig mens man drar).
 */
function NeighborSlide({ card }: { card: CategoryReelCard }) {
  const poster = posterForVideo(card.videoBgSrc) ?? card.illustrationSrc;
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {poster && (
        <Image src={poster} alt="" fill sizes="100vw" className="object-cover" />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-black/95 via-black/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
      <div className="absolute left-0 right-0 px-6" style={{ bottom: "13%" }}>
        <span
          className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-white/95"
          style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,1)" }}
        >
          {card.label}
        </span>
      </div>
    </div>
  );
}

/**
 * Vertikal swipe-stack for kategori-beats (mobil) — swiper.js-følelsen: den
 * aktive videoen følger fingeren under drag, nabo-kategorien glir inn fra
 * kanten, og slippet snapper til neste/forrige (eller spretter tilbake under
 * terskel). Innen kategori-blokken animeres slidet; ved blokk-kantene (første/
 * siste kategori → nabolaget/oppsummert, som er kart-flater) gis motstand og et
 * fast slipp committer det diskré hoppet (advanceBeat/prevBeat). Tapp = pause.
 *
 * Track-transformen styres IMPERATIVT via ref (ingen re-render pr. pointermove);
 * en layout-effect re-sentrerer sporet før paint når aktivt kort skifter, så
 * innholds-byttet ikke blinker.
 */
export function ReelSwipeStack({
  phase,
  onDraggingChange,
}: {
  phase: string;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const { state, setActiveIndex } = useReels();
  const { advanceBeat, prevBeat } = useReelsBeatNav();
  const togglePlay = useReelsTogglePlay();

  const { cards, activeIndex } = state;
  const current = asCategory(cards[activeIndex]);
  const prevCat = asCategory(cards[activeIndex - 1]);
  const nextCat = asCategory(cards[activeIndex + 1]);

  const trackRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const draggingRef = useRef(false);
  const didSwipeRef = useRef(false);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setTrack = (transform: string, animate: boolean) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? TRANSITION : "none";
    el.style.transform = transform;
  };

  // Re-sentrer sporet (uten transition) før paint når aktivt kort endrer seg —
  // gjelder både slide-commit (etter animasjonen) og eksterne hopp (velgeren).
  useLayoutEffect(() => {
    setTrack("translateY(0px)", false);
  }, [activeIndex]);

  useLayoutEffect(() => {
    return () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    };
  }, []);

  const springBack = () => setTrack("translateY(0px)", true);

  const commitSlide = (dir: 1 | -1) => {
    setTrack(dir === 1 ? "translateY(-100%)" : "translateY(100%)", true);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      // layout-effect re-sentrerer sporet før paint → sømløst innholds-bytte.
      setActiveIndex(activeIndex + dir);
    }, TRANSITION_MS);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (commitTimerRef.current) return; // midt i en commit-animasjon
    e.currentTarget.setPointerCapture?.(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    draggingRef.current = false;
    didSwipeRef.current = false;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = startRef.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    const dx = e.clientX - s.x;
    if (!draggingRef.current) {
      if (Math.abs(dy) < DIR_LOCK_PX && Math.abs(dx) < DIR_LOCK_PX) return;
      if (Math.abs(dx) > Math.abs(dy)) {
        startRef.current = null; // horisontalt → ikke en vertikal swipe
        return;
      }
      draggingRef.current = true;
      onDraggingChange(true);
    }
    const atEdge = (dy < 0 && !nextCat) || (dy > 0 && !prevCat);
    setTrack(`translateY(${atEdge ? dy * EDGE_RESISTANCE : dy}px)`, false);
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const s = startRef.current;
    startRef.current = null;
    const wasDragging = draggingRef.current;
    draggingRef.current = false;
    if (!wasDragging) return; // tapp → onClick håndterer pause
    onDraggingChange(false);
    didSwipeRef.current = true; // en drag skjedde → ikke la click pause
    if (!s) return springBack();
    const dy = e.clientY - s.y;
    const dx = e.clientX - s.x;
    const vy = dy / Math.max(Date.now() - s.t, 1);
    const vertical = Math.abs(dy) > Math.abs(dx);
    const commit =
      vertical &&
      (Math.abs(dy) >= COMMIT_PX ||
        (Math.abs(vy) > FLICK_VY && Math.abs(dy) > FLICK_MIN_PX));
    if (!commit) return springBack();
    if (dy < 0) {
      if (nextCat) commitSlide(1);
      else {
        springBack();
        advanceBeat();
      }
    } else if (prevCat) {
      commitSlide(-1);
    } else {
      springBack();
      prevBeat();
    }
  };

  const onPointerCancel = () => {
    startRef.current = null;
    if (draggingRef.current) {
      draggingRef.current = false;
      onDraggingChange(false);
    }
    springBack();
  };

  const onClick = () => {
    if (didSwipeRef.current) {
      didSwipeRef.current = false;
      return;
    }
    togglePlay();
  };

  if (!current) return null; // ikke-kategori → ReelSwipeStack brukes ikke

  const audioIndex = cardIndexToAudioIndex(cards, activeIndex);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div ref={trackRef} className="absolute inset-0 will-change-transform">
        {prevCat && (
          <div className="absolute inset-x-0 h-full" style={{ top: "-100%" }}>
            <NeighborSlide card={prevCat} />
          </div>
        )}
        <div className="absolute inset-0">
          <CategoryReel card={current} audioIndex={audioIndex} isActive />
        </div>
        {nextCat && (
          <div className="absolute inset-x-0 h-full" style={{ top: "100%" }}>
            <NeighborSlide card={nextCat} />
          </div>
        )}
      </div>

      {/* Gest- og tapp-fanger på toppen — sporet bak flyttes via ref, denne ligger
          i ro. Tapp = pause (med didSwipe-guard), pointer-drag = vertikal swipe. */}
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerCancel}
        aria-label={phase === "playing" ? "Pause" : "Spill av"}
        className="absolute inset-0 touch-none"
      />
    </div>
  );
}
