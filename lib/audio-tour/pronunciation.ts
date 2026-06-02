/**
 * Norsk uttale-overstyring for ElevenLabs TTS (build-time).
 *
 * Problem: ElevenLabs feiluttaler enkelte norske ord/stedsnavn ("kajakk"→
 * "kaaajak", "Nidelva"→...). Phoneme/IPA-tags virker ikke for norsk på vår
 * modell (turbo_v2_5), og pronunciation-dictionaries støttes ikke der. Eneste
 * pålitelige spak er ALIAS-omstaving av selve teksten ("kajakk" → "kaják").
 *
 * Men manus brukes også som karaoke-transkript (KaraokeTeleprompter bygger ord
 * fra `timings.characters`). Hvis vi sendte den omstavede teksten rått, ville
 * karaoke vist "kaják". Derfor:
 *   1. `applyPronunciation` bytter ord KUN på TTS-input og gir et segment-kart.
 *   2. `remapTimingsToOriginal` mapper character-timings tilbake til ORIGINAL-
 *      teksten, slik at vist tekst + høydepunkt forblir riktig (original staving),
 *      mens lyden bruker omstavingen.
 *
 * Ordlista bor i scripts/tts/pronunciation-no.json (kirurgisk — kun ord der en
 * omstaving empirisk slår originalen; tunet via scripts/tts/tune-pronunciation.mjs).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface PronunciationSegment {
  /** Tegn-range i ORIGINAL-teksten (code units, [start, end)). */
  origStart: number;
  origEnd: number;
  /** Tegn-range i TTS-teksten (code units, [start, end)). */
  ttsStart: number;
  ttsEnd: number;
  /** true = dette segmentet er en omstavet alias (lengde kan avvike). */
  sub: boolean;
}

export interface ApplyPronunciationResult {
  /** Teksten som faktisk sendes til ElevenLabs (med aliaser innsatt). */
  ttsText: string;
  /** Ordnet kart mellom original- og TTS-tekst, for timing-remap. */
  segments: PronunciationSegment[];
  /** true hvis minst ett ord ble byttet. */
  changed: boolean;
}

export interface CharTimings {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Behold ledende stor bokstav fra det matchede ordet (Nidelva→Nid-elva,
 *  setningsstart "Kajakk"→"Kaják"). */
function applyLeadingCase(matched: string, alias: string): string {
  const c = matched.charAt(0);
  if (c && c === c.toUpperCase() && c !== c.toLowerCase()) {
    return alias.charAt(0).toUpperCase() + alias.slice(1);
  }
  return alias;
}

/**
 * Bytter ord fra `aliases` (case-insensitivt, hele ord) i `text`, og bygger
 * et segment-kart. Ingen treff → ttsText === text, changed=false.
 */
export function applyPronunciation(
  text: string,
  aliases: Record<string, string>,
): ApplyPronunciationResult {
  const keys = Object.keys(aliases || {}).filter((k) => k && aliases[k]);
  if (keys.length === 0) {
    return {
      ttsText: text,
      segments: [{ origStart: 0, origEnd: text.length, ttsStart: 0, ttsEnd: text.length, sub: false }],
      changed: false,
    };
  }
  // Lengste først (unngå at kortere nøkkel spiser en lengre). Ordgrense via
  // Unicode-lookarounds så æøåé behandles som bokstaver.
  const sorted = [...keys].sort((a, b) => b.length - a.length);
  const re = new RegExp(
    `(?<![\\p{L}\\p{N}])(${sorted.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );

  const segments: PronunciationSegment[] = [];
  let ttsText = "";
  let lastOrig = 0;
  let ttsPos = 0;
  let changed = false;

  const matches = Array.from(text.matchAll(re));
  for (const m of matches) {
    const start = m.index ?? 0;
    const matched = m[0];
    const key = keys.find((k) => k.toLowerCase() === matched.toLowerCase());
    if (!key) continue;
    const alias = applyLeadingCase(matched, aliases[key]);

    if (start > lastOrig) {
      const run = text.slice(lastOrig, start);
      segments.push({ origStart: lastOrig, origEnd: start, ttsStart: ttsPos, ttsEnd: ttsPos + run.length, sub: false });
      ttsText += run;
      ttsPos += run.length;
    }
    segments.push({ origStart: start, origEnd: start + matched.length, ttsStart: ttsPos, ttsEnd: ttsPos + alias.length, sub: true });
    ttsText += alias;
    ttsPos += alias.length;
    changed = true;
    lastOrig = start + matched.length;
  }

  if (lastOrig < text.length) {
    const run = text.slice(lastOrig);
    segments.push({ origStart: lastOrig, origEnd: text.length, ttsStart: ttsPos, ttsEnd: ttsPos + run.length, sub: false });
    ttsText += run;
  }

  return { ttsText, segments, changed };
}

/**
 * Mapper ElevenLabs character-timings (for TTS-teksten) tilbake til ORIGINAL-
 * teksten. Uendrede segmenter kopieres 1:1; alias-segmenter får sin tids-span
 * fordelt jevnt over original-ordets tegn. Returnerer null hvis alignmentet
 * ikke samsvarer med TTS-teksten (f.eks. uventet tekst-normalisering) — da
 * skal kaller falle tilbake til rå-alignment.
 */
export function remapTimingsToOriginal(
  originalText: string,
  ttsText: string,
  characters: string[],
  starts: number[],
  ends: number[],
  segments: PronunciationSegment[],
): CharTimings | null {
  // Guard: index-basert remap krever 1:1 mellom alignment og TTS-tekst.
  if (
    characters.length !== ttsText.length ||
    starts.length !== ttsText.length ||
    ends.length !== ttsText.length ||
    characters.join("") !== ttsText
  ) {
    return null;
  }

  const n = originalText.length;
  const outChars = originalText.split("");
  const outStart = new Array<number>(n);
  const outEnd = new Array<number>(n);

  for (const seg of segments) {
    const origLen = seg.origEnd - seg.origStart;
    if (!seg.sub) {
      for (let k = 0; k < origLen; k++) {
        outStart[seg.origStart + k] = starts[seg.ttsStart + k];
        outEnd[seg.origStart + k] = ends[seg.ttsStart + k];
      }
    } else {
      const spanStart = starts[seg.ttsStart];
      const spanEnd = ends[seg.ttsEnd - 1];
      const dur = spanEnd - spanStart;
      for (let k = 0; k < origLen; k++) {
        outStart[seg.origStart + k] = spanStart + (dur * k) / origLen;
        outEnd[seg.origStart + k] = spanStart + (dur * (k + 1)) / origLen;
      }
    }
  }

  return {
    characters: outChars,
    characterStartTimesSeconds: outStart,
    characterEndTimesSeconds: outEnd,
  };
}

let cachedAliases: Record<string, string> | null = null;

/**
 * Leser den kanoniske norske uttale-ordlista (scripts/tts/pronunciation-no.json,
 * felt `aliases`). Memoisert. Returnerer {} hvis fila mangler/er ugyldig, så
 * generateAudio aldri feiler på dette. Build-time only.
 */
export function loadPronunciationAliases(): Record<string, string> {
  if (cachedAliases) return cachedAliases;
  try {
    const path = join(process.cwd(), "scripts", "tts", "pronunciation-no.json");
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { aliases?: Record<string, string> };
    cachedAliases = parsed.aliases ?? {};
  } catch {
    cachedAliases = {};
  }
  return cachedAliases;
}
