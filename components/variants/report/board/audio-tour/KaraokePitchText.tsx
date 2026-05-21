"use client";

import { Fragment, useContext, useMemo } from "react";
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
 * Karaoke-tekst som synkes til voice-over. Ord-spans skifter fra opacity 0.4
 * (gråtonet) til 1.0 (opplyst) når currentTime når tokenets startMs. Opacity-
 * transition har 200ms ease-out så overgangen ikke flimrer.
 *
 * Fallback (klartekst i full opacity):
 *   - timings mangler (legacy-spor uten alignment)
 *   - isActive === false (annet spor aktivt eller manual-mode)
 *   - token-mapper returnerer tom array (data-korrupsjon)
 *
 * Komponenten kalles innenfor `<AudioElementProvider>` i prod, men leser
 * konteksten via `useContext` slik at den ikke kaster utenfor provider —
 * tester kan mounte uten provider og få currentTime=0.
 */
export function KaraokePitchText({
  text,
  timings,
  isActive,
  className,
}: KaraokePitchTextProps) {
  const audioCtx = useContext(AudioElementContext);
  const currentTime = audioCtx?.currentTime ?? 0;
  const tokens = useMemo(() => mapCharTimingsToWords(timings), [timings]);

  if (!isActive) {
    // Plain-tekst fallback når dette sporet ikke spiller. Dim'es som vanlig
    // body-tekst under tour (data-board-body) — vi peker oppmerksomheten mot
    // den seksjonen som faktisk leses opp.
    return (
      <p data-board-body className={className}>
        {text}
      </p>
    );
  }
  if (tokens.length === 0) {
    // Aktivt spor men tomme tokens (legacy uten timings eller data-korrupsjon)
    // — ikke dim, dette ER den aktive seksjonen, bare uten karaoke-effekt.
    return <p className={className}>{text}</p>;
  }

  const currentMs = currentTime * 1000;

  return (
    <p className={className} data-karaoke="active">
      {tokens.map((token, i) => {
        const isLit = currentMs >= token.startMs;
        return (
          <Fragment key={`${i}-${token.charStartIndex}`}>
            <span
              className="transition-opacity duration-200 ease-out"
              style={{ opacity: isLit ? 1 : 0.4 }}
              data-token-index={i}
              data-token-lit={isLit ? "true" : "false"}
            >
              {token.text}
            </span>
            {i < tokens.length - 1 ? " " : null}
          </Fragment>
        );
      })}
    </p>
  );
}
