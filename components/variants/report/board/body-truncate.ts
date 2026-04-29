/**
 * Truncation-utility for category.body i board-rapport.
 *
 * Brukes av BoardDetailPanel (desktop) og BoardReadingModal (mobile) for å
 * vise en kort versjon med "Les mer"-disclosure når kropps-teksten er lang.
 *
 * Regler:
 * - Hvis total lengde <= threshold: ingen truncation, returner alle paragrafer.
 * - Hvis flere paragrafer og første er kort: ta så mange paragrafer som passer
 *   under threshold (men alltid minst én).
 * - Hvis første paragraf alene > threshold: kutt den ved siste setningsslutt
 *   (./?/!) før threshold. Hvis ingen setningsslutt finnes, kutt ved siste
 *   ordgrense (whitespace) før threshold og legg til ellipsis.
 */

export const BODY_TRUNCATE_THRESHOLD = 280;

export interface TruncatedBody {
  /** Paragrafer i den korte (kollapsede) visningen. */
  truncatedParagraphs: string[];
  /** Paragrafer i full visning. */
  fullParagraphs: string[];
  /** True hvis truncation faktisk fjernet noe — knappen vises kun da. */
  needsTruncation: boolean;
}

export function truncateBody(
  body: string,
  threshold: number = BODY_TRUNCATE_THRESHOLD,
): TruncatedBody {
  const fullParagraphs = body.split(/\n+/).filter((p) => p.trim().length > 0);
  const totalLength = fullParagraphs.join(" ").length;

  if (totalLength <= threshold || fullParagraphs.length === 0) {
    return {
      truncatedParagraphs: fullParagraphs,
      fullParagraphs,
      needsTruncation: false,
    };
  }

  // Flere paragrafer og første er kort nok: akkumuler paragrafer.
  if (fullParagraphs.length > 1 && fullParagraphs[0].length <= threshold) {
    const collected: string[] = [];
    let runningLength = 0;
    for (const p of fullParagraphs) {
      const next = runningLength === 0 ? p.length : runningLength + 1 + p.length;
      if (next > threshold && collected.length > 0) break;
      collected.push(p);
      runningLength = next;
      if (runningLength >= threshold) break;
    }
    // Hvis vi tok alle paragrafer, er ingen trunkering nødvendig (defensiv).
    if (collected.length === fullParagraphs.length) {
      return { truncatedParagraphs: fullParagraphs, fullParagraphs, needsTruncation: false };
    }
    return {
      truncatedParagraphs: collected,
      fullParagraphs,
      needsTruncation: true,
    };
  }

  // Første paragraf er > threshold: kutt ved siste setningsslutt før threshold.
  const first = fullParagraphs[0];
  const slice = first.slice(0, threshold);
  const sentenceEnd = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("?"),
    slice.lastIndexOf("!"),
  );

  let truncated: string;
  if (sentenceEnd > 60) {
    // Inkluder selve tegnet.
    truncated = first.slice(0, sentenceEnd + 1);
  } else {
    // Fallback: kutt ved siste ordgrense + ellipsis.
    const wordBoundary = slice.lastIndexOf(" ");
    const cut = wordBoundary > 60 ? wordBoundary : threshold;
    truncated = first.slice(0, cut).trimEnd() + "…";
  }

  return {
    truncatedParagraphs: [truncated],
    fullParagraphs,
    needsTruncation: true,
  };
}
