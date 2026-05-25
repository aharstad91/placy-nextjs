"use client";

import { useContext, useMemo } from "react";
import { AudioElementContext } from "../board/audio-tour/use-audio-element";
import { KaraokePitchText } from "../board/audio-tour/KaraokePitchText";
import {
  mapCharTimingsToWords,
  mapTokensToSentences,
} from "../board/audio-tour/karaoke-tokens";
import type { BoardAudioTimings } from "../board/board-data";

interface Props {
  text: string;
  timings?: BoardAudioTimings;
  isActive: boolean;
  className?: string;
}

/**
 * Sentence-vindu-rendering av karaoke-tekst — viser maks 2 setninger om
 * gangen (aktiv + neste). Aktive setning får pitch-effekt via
 * `KaraokePitchText`; neste fader inn på 40% opacity.
 *
 * Fallback til vanlig `KaraokePitchText` ved manglende timings eller
 * når komponenten ikke er aktiv (vises som klartekst — første 2
 * setninger som teaser).
 */
export function KaraokeTeleprompter({
  text,
  timings,
  isActive,
  className,
}: Props) {
  const audioCtx = useContext(AudioElementContext);
  const currentMs = (audioCtx?.currentTime ?? 0) * 1000;

  const tokens = useMemo(() => mapCharTimingsToWords(timings), [timings]);
  const sentences = useMemo(() => mapTokensToSentences(tokens), [tokens]);

  // Uten timings eller setninger: fallback til full karaoke-tekst
  if (sentences.length === 0 || !timings) {
    return (
      <KaraokePitchText
        text={text}
        timings={timings}
        isActive={isActive}
        className={className}
      />
    );
  }

  // Finn aktiv setning basert på currentTime. Når kortet ikke er aktivt
  // ennå, vis de første 2 setningene som teaser.
  let activeIdx = 0;
  if (isActive) {
    const idx = sentences.findIndex((s) => currentMs < s.endMs);
    activeIdx = idx === -1 ? sentences.length - 1 : idx;
  }

  const visible = sentences.slice(activeIdx, activeIdx + 2);

  return (
    <div
      className={`${className ?? ""} space-y-2`}
      style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,1)" }}
    >
      {visible.map((s, i) => {
        const subsetTimings: BoardAudioTimings = {
          characters: timings.characters.slice(s.charStartIdx, s.charEndIdx + 1),
          characterStartTimesSeconds: timings.characterStartTimesSeconds.slice(
            s.charStartIdx,
            s.charEndIdx + 1,
          ),
          characterEndTimesSeconds: timings.characterEndTimesSeconds.slice(
            s.charStartIdx,
            s.charEndIdx + 1,
          ),
        };
        const isPrimary = i === 0;
        return (
          <div
            key={`${activeIdx}-${i}`}
            className={`transition-opacity duration-300 ${
              isPrimary ? "opacity-100" : "opacity-50"
            }`}
          >
            <KaraokePitchText
              text={s.text}
              timings={subsetTimings}
              isActive={isPrimary && isActive}
              className=""
            />
          </div>
        );
      })}
    </div>
  );
}
