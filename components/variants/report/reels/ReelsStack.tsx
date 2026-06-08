"use client";

import { useEffect, useRef } from "react";
import { useReels } from "./reels-state";

interface Props {
  renderCard: (cardIndex: number) => React.ReactNode;
}

export function ReelsStack({ renderCard }: Props) {
  const { state, setActiveIndex } = useReels();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Array<HTMLElement | null>>([]);
  // Undertrykker IntersectionObserver-en mens vi scroller programmatisk (auto-
  // advance / handlePlay), så IO ikke setter en mellom-index midt i hoppet.
  const suppressIORef = useRef(false);

  useEffect(() => {
    const sections = sectionRefs.current.filter((s): s is HTMLElement => !!s);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressIORef.current) return;
        let bestEntry: IntersectionObserverEntry | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
            bestEntry = entry;
          }
        }
        if (!bestEntry) return;
        const idx = Number(
          (bestEntry.target as HTMLElement).dataset.cardIndex ?? -1,
        );
        if (idx >= 0) setActiveIndex(idx);
      },
      {
        root: containerRef.current,
        threshold: [0.5, 0.7, 0.9],
      },
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [setActiveIndex, state.cards.length]);

  // Scroll-follow: når activeIndex settes UTENFRA (handlePlay → welcome,
  // auto-advance welcome→home→kategori), scroll feeden dit. Brukerens egen
  // swipe driver IO som allerede matcher scrollTop, så da er dette en no-op.
  useEffect(() => {
    const c = containerRef.current;
    const section = sectionRefs.current[state.activeIndex];
    if (!c || !section) return;
    const target = section.offsetTop;
    if (Math.abs(c.scrollTop - target) < 8) return; // allerede der (swipe)
    suppressIORef.current = true;
    c.scrollTop = target; // umiddelbart — overgangen skjer bak fullskjerm-kartet
    const t = setTimeout(() => {
      suppressIORef.current = false;
    }, 250);
    return () => clearTimeout(t);
  }, [state.activeIndex]);

  // Lås scroll når et card er i map-full — bruker pan'er kartet, ikke scroller.
  // I tillegg: pointer-events: none på containeren så touch-events går rett
  // til kart-sheeten (BoardMap, z-15 over feeden). Interaktive knapper i
  // CategoryReel setter selv pointer-events: auto for å overstyre.
  const inMapFull = state.currentPhase === "map-full";

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-10 snap-y snap-mandatory [&::-webkit-scrollbar]:hidden ${
        inMapFull ? "overflow-hidden pointer-events-none" : "overflow-y-scroll"
      }`}
      style={{ scrollbarWidth: "none" }}
    >
      {state.cards.map((_, i) => (
        <section
          key={i}
          ref={(el) => {
            sectionRefs.current[i] = el;
          }}
          data-card-index={i}
          className="h-full w-full snap-start snap-always relative"
        >
          {renderCard(i)}
        </section>
      ))}
    </div>
  );
}
