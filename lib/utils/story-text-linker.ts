/**
 * Story Text Linker — segment-adapter over den delte POI-matcheren.
 *
 * Matcher POI-navn i narrativ tekst og splitter til segmenter som kan rendres med
 * interaktive POI-omtaler inline. Tynn adapter rundt `@/lib/curation/poi-matcher`.
 *
 * Per-adapter-vedtak (§5.3 / PRD 07 Unit 5):
 *  - ordgrense: `"none"` — kombinert alternasjon, matcher delvise treff
 *    (f.eks. "Sentrum" inne i "Sentrumsterminalen"). Bevart fra dagens atferd.
 *  - `AS`/`SA`-stripping: JA — legger til strippet alias-kandidat per POI.
 *  - kategori-prioritet: N/A — segment-laget har ingen kategori-akse.
 *  - min navnelengde: 3 tegn.
 */

import type { POI } from "@/lib/types";
import {
  findPoiMatches,
  type MatchCandidate,
} from "@/lib/curation/poi-matcher";

export interface TextSegment {
  type: "text" | "poi" | "external";
  content: string;
  poi?: POI;
  url?: string;
}

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

/**
 * Splitt tekst på markdown-lenker `[text](url)` først, returner alternerende
 * tekst- og eksterne segmenter. Kjøres før POI-matching slik at markdown-lenker
 * bevares verbatim.
 */
function splitMarkdownLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MARKDOWN_LINK_RE.lastIndex = 0;
  while ((match = MARKDOWN_LINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: "external", content: match[1], url: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}

/**
 * Bygg matcher-kandidater fra POI-settet med segment-adapterens vedtak:
 * min navnelengde 3, `AS`/`SA`-strippede alias (samme `key`=poi.id), lengste
 * navn først (kjernen re-sorterer også, men vi speiler den opprinnelige
 * `poiByName`-konstruksjonen for første-vinner-semantikk per navn).
 */
function buildCandidates(pois: POI[]): MatchCandidate<POI>[] {
  // Speiler den opprinnelige `poiByName`-Map-en: navn → POI, sist-vinner ved
  // identisk navn, lengste navn først ved innsetting.
  const byName = new Map<string, POI>();
  const sortedPOIs = pois
    .filter((p) => p.name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length);
  for (const poi of sortedPOIs) {
    byName.set(poi.name, poi);
    const cleaned = poi.name.replace(/ AS$/i, "").replace(/ SA$/i, "").trim();
    if (cleaned !== poi.name && cleaned.length >= 3) byName.set(cleaned, poi);
  }
  return Array.from(byName.entries()).map(([name, poi]) => ({
    name,
    key: poi.id,
    ref: poi,
  }));
}

/**
 * Parse tekst og match POI-navn til lenkede segmenter.
 *
 * Strategi:
 * 1. Splitt på markdown-lenker `[text](url)` — bevar som eksterne segmenter.
 * 2. POI-match gjenstående ren-tekst-segmenter via den delte kjerne-matcheren.
 */
export function linkPOIsInText(text: string, pois: POI[]): TextSegment[] {
  if (!text) return [{ type: "text", content: text }];

  // Pass 1: trekk ut markdown-lenker
  const withExternals = splitMarkdownLinks(text);

  // Ingen POIs — returner som-er (eksterne + ren tekst)
  if (pois.length === 0) return withExternals;

  const candidates = buildCandidates(pois);
  if (candidates.length === 0) return withExternals;

  // Første-forekomst-per-POI deles på tvers av alle tekst-segmenter.
  const used = new Set<string>();

  // Pass 2: POI-match hvert ren-tekst-segment, la eksterne være urørt
  const result: TextSegment[] = [];
  for (const seg of withExternals) {
    if (seg.type !== "text") {
      result.push(seg);
      continue;
    }
    const matches = findPoiMatches(
      seg.content,
      candidates,
      { boundary: "none" },
      used,
    );
    let cursor = 0;
    for (const mt of matches) {
      if (mt.start > cursor) {
        result.push({ type: "text", content: seg.content.slice(cursor, mt.start) });
      }
      result.push({ type: "poi", content: mt.text, poi: mt.ref });
      cursor = mt.end;
    }
    if (cursor < seg.content.length) {
      result.push({ type: "text", content: seg.content.slice(cursor) });
    }
  }

  return result.length > 0 ? result : withExternals;
}
