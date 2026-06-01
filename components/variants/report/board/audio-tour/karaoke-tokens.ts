import type { BoardAudioTimings } from "../board-data";

const WHITESPACE_RE = /\s/;

/**
 * Ord-token avledet fra ElevenLabs char-level alignment. `startMs`/`endMs`
 * tilsvarer første og siste tegn i tokenet. Ord er den minste enheten med
 * stabile timings — linjer grupperes dynamisk via DOM-måling i
 * `KaraokePitchText`.
 */
export interface KaraokeToken {
  text: string;
  startMs: number;
  endMs: number;
  charStartIndex: number;
  charEndIndex: number;
}

export interface KaraokeSentence {
  /** Sammenslått tekst — ord separert med enkelt mellomrom. */
  text: string;
  /** Ord-index i tokens-arrayen (start og slutt, inklusivt). */
  startTokenIdx: number;
  endTokenIdx: number;
  /** Character-offsets i original `characters`-array (inklusivt). */
  charStartIdx: number;
  charEndIdx: number;
  startMs: number;
  endMs: number;
}

const SENTENCE_TERMINATOR_RE = /[.!?…]/;

/**
 * Grupper ord-tokens til setninger basert på terminating punctuation
 * (`.`, `!`, `?`, `…`). Siste blokk uten terminator regnes som siste
 * setning. Brukes av teleprompter-rendering for vindu-basert visning.
 */
export function mapTokensToSentences(
  tokens: KaraokeToken[],
): KaraokeSentence[] {
  const sentences: KaraokeSentence[] = [];
  if (tokens.length === 0) return sentences;

  let start = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const last = t.text[t.text.length - 1];
    const isLast = i === tokens.length - 1;
    if (SENTENCE_TERMINATOR_RE.test(last) || isLast) {
      const startToken = tokens[start];
      const endToken = t;
      const slice = tokens.slice(start, i + 1);
      sentences.push({
        text: slice.map((tok) => tok.text).join(" "),
        startTokenIdx: start,
        endTokenIdx: i,
        charStartIdx: startToken.charStartIndex,
        charEndIdx: endToken.charEndIndex,
        startMs: startToken.startMs,
        endMs: endToken.endMs,
      });
      start = i + 1;
    }
  }
  return sentences;
}

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
