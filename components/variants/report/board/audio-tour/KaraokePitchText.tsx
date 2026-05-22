"use client";

import {
  Fragment,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AudioElementContext } from "./use-audio-element";
import { mapCharTimingsToWords } from "./karaoke-tokens";
import type { BoardAudioTimings } from "../board-data";

interface KaraokePitchTextProps {
  /** Manus-teksten — vises i full opacity som fallback når karaoke ikke kan kjøre. */
  text: string;
  /** Character-level alignment fra audio-build. Undefined for legacy-spor (audioVersion <5). */
  timings?: BoardAudioTimings;
  /** True når dette sporet faktisk spilles akkurat nå. Manual-mode → false. */
  isActive: boolean;
  /** Optional class for ytre <p>. */
  className?: string;
}

/**
 * Read-along-tekst som synkes til voice-over på **visuell linje-nivå** (rad).
 * Ord er enheten med stabile timings, men linjer (slik teksten faktisk wrapper
 * i sidebaren) er enheten brukeren ser. Vi grupperer ord til linjer via DOM-
 * måling i `useLayoutEffect`, og lar hver linje skifte opacity 0.4 → 1.0 ved
 * sitt første ords startMs.
 *
 * Hvorfor linje, ikke ord eller setning:
 *   - Ord-for-ord skapte for høy kognitiv last under bruker-test
 *   - Hele setning betyr at 3-4 visuelle linjer lyser opp samtidig, som er
 *     for stort visuelt sprang
 *   - Linje matcher hvordan øyet leser én rad om gangen
 *
 * Antagelse: sidebar-bredden er stabil per render. Vi tar én måling per
 * `[isActive, words]`-endring. Endrer sidebar-bredden seg (resize), kreves
 * ny måling — ikke i scope nå.
 *
 * Fallback (klartekst i full opacity):
 *   - timings mangler (legacy-spor uten alignment)
 *   - isActive === false (annet spor aktivt eller manual-mode)
 *   - ord-mapper returnerer tom array (data-korrupsjon)
 */
export function KaraokePitchText({
  text,
  timings,
  isActive,
  className,
}: KaraokePitchTextProps) {
  const audioCtx = useContext(AudioElementContext);
  const currentTime = audioCtx?.currentTime ?? 0;
  const words = useMemo(() => mapCharTimingsToWords(timings), [timings]);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // wordLineMap[i] = linje-index for ord i (-1 hvis ikke målt enda).
  // wordPositionInLine[i] = 0-basert posisjon innenfor linjen (driver stagger-delay).
  // lineStartMs[idx] = første ords startMs i linje idx.
  const [{ wordLineMap, wordPositionInLine, lineStartMs }, setLineState] =
    useState<{
      wordLineMap: number[];
      wordPositionInLine: number[];
      lineStartMs: number[];
    }>({ wordLineMap: [], wordPositionInLine: [], lineStartMs: [] });

  useLayoutEffect(() => {
    if (!isActive || words.length === 0) {
      setLineState({
        wordLineMap: [],
        wordPositionInLine: [],
        lineStartMs: [],
      });
      return;
    }
    const map: number[] = new Array(words.length).fill(-1);
    const positions: number[] = new Array(words.length).fill(0);
    const starts: number[] = [];
    let currentLineTop = Number.NEGATIVE_INFINITY;
    let currentLineIdx = -1;
    let posInLine = 0;
    for (let i = 0; i < words.length; i++) {
      const el = wordRefs.current[i];
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      // 2px tolerance for sub-pixel rendering / line-height jitter
      if (Math.abs(top - currentLineTop) > 2) {
        currentLineIdx++;
        currentLineTop = top;
        starts.push(words[i].startMs);
        posInLine = 0;
      }
      map[i] = currentLineIdx;
      positions[i] = posInLine;
      posInLine++;
    }
    setLineState({
      wordLineMap: map,
      wordPositionInLine: positions,
      lineStartMs: starts,
    });
  }, [isActive, words]);

  if (!isActive) {
    return (
      <p data-board-body className={className}>
        {text}
      </p>
    );
  }
  if (words.length === 0) {
    return <p className={className}>{text}</p>;
  }

  const currentMs = currentTime * 1000;
  const hasMeasurement = lineStartMs.length > 0;

  return (
    <p className={className} data-karaoke="active">
      {words.map((word, i) => {
        const lineIdx = wordLineMap[i] ?? -1;
        // Før måling (første render): vis alle ord som ikke-lit, da er
        // useLayoutEffect rett rundt hjørnet og kan overskrive før paint.
        const isLit = hasMeasurement
          ? lineIdx >= 0 && currentMs >= lineStartMs[lineIdx]
          : false;
        // Stagger innenfor linjen: ord 0 starter umiddelbart, hvert
        // påfølgende ord 35ms senere. En 6-ords linje vaskes fra venstre
        // til høyre på ~175ms + 300ms transition-duration = ~475ms total.
        const staggerDelayMs = isLit ? (wordPositionInLine[i] ?? 0) * 35 : 0;
        return (
          <Fragment key={`${i}-${word.charStartIndex}`}>
            <span
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              className="transition-opacity duration-300 ease-out"
              style={{
                opacity: isLit ? 1 : 0.4,
                transitionDelay: `${staggerDelayMs}ms`,
              }}
              data-line-index={lineIdx}
              data-line-lit={isLit ? "true" : "false"}
            >
              {word.text}
            </span>
            {i < words.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </p>
  );
}
