import type { BoardAudioTimings } from "../board-data";

/**
 * Ord-token avledet fra ElevenLabs char-level alignment. `startMs`/`endMs`
 * tilsvarer første og siste tegn i tokenet, slik at karaoke-effekten kan
 * skifte opacity ved tokenets start uten å vente på siste tegn.
 */
export interface KaraokeToken {
  text: string;
  startMs: number;
  endMs: number;
  charStartIndex: number;
  charEndIndex: number;
}

const WHITESPACE_RE = /\s/;

/**
 * Mapper character-level timings til ord-tokens. Bruker `timings.characters`
 * som autoritativ kilde — ElevenLabs kan ha normalisert tekst (f.eks. tall
 * → ord), så input-tekst-strengen brukes ikke direkte. Returnerer tom array
 * når input mangler eller når lengdene divergerer (data-korrupsjon).
 */
export function mapCharTimingsToWords(
  timings: BoardAudioTimings | undefined,
): KaraokeToken[] {
  if (!timings) return [];
  const { characters, characterStartTimesSeconds, characterEndTimesSeconds } =
    timings;
  const len = characters.length;
  if (
    len === 0 ||
    characterStartTimesSeconds.length !== len ||
    characterEndTimesSeconds.length !== len
  ) {
    return [];
  }

  const tokens: KaraokeToken[] = [];
  let i = 0;
  while (i < len) {
    while (i < len && WHITESPACE_RE.test(characters[i])) i++;
    if (i >= len) break;
    const startIdx = i;
    while (i < len && !WHITESPACE_RE.test(characters[i])) i++;
    const endIdx = i - 1;
    tokens.push({
      text: characters.slice(startIdx, endIdx + 1).join(""),
      startMs: Math.round(characterStartTimesSeconds[startIdx] * 1000),
      endMs: Math.round(characterEndTimesSeconds[endIdx] * 1000),
      charStartIndex: startIdx,
      charEndIndex: endIdx,
    });
  }
  return tokens;
}
