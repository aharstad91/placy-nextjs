/**
 * Story Text Linker
 *
 * Matches POI names in narrative text and splits into segments
 * that can be rendered with interactive POI mentions inline.
 */

import type { POI } from "@/lib/types";

export interface TextSegment {
  type: "text" | "poi" | "external";
  content: string;
  poi?: POI;
  url?: string;
}

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;

/**
 * Split text on markdown links `[text](url)` first, returning alternating
 * text and external segments. Used before POI matching so markdown links
 * are preserved verbatim.
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
 * Parse text and match POI names to create linked segments.
 *
 * Strategy:
 * 1. Split on markdown links `[text](url)` — preserve as external segments
 * 2. POI-match remaining plain-text segments
 */
export function linkPOIsInText(text: string, pois: POI[]): TextSegment[] {
  if (!text) return [{ type: "text", content: text }];

  // Pass 1: extract markdown links
  const withExternals = splitMarkdownLinks(text);

  // No POIs — return as-is (externals + plain text)
  if (pois.length === 0) return withExternals;

  // Build lookup: name → POI (longest names first to avoid partial matches)
  const poiByName = new Map<string, POI>();
  const sortedPOIs = pois
    .filter((p) => p.name.length >= 3)
    .sort((a, b) => b.name.length - a.name.length);

  for (const poi of sortedPOIs) {
    poiByName.set(poi.name, poi);
    const cleaned = poi.name.replace(/ AS$/i, "").replace(/ SA$/i, "").trim();
    if (cleaned !== poi.name && cleaned.length >= 3) poiByName.set(cleaned, poi);
  }

  const names = Array.from(poiByName.keys()).sort((a, b) => b.length - a.length);
  if (names.length === 0) return withExternals;

  const escaped = names.map((n) => escapeRegex(n));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const matched = new Set<string>();

  // Pass 2: POI-match each plain-text segment, leave externals untouched
  const result: TextSegment[] = [];
  for (const seg of withExternals) {
    if (seg.type !== "text") {
      result.push(seg);
      continue;
    }
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(seg.content)) !== null) {
      const matchedText = match[0];
      const poi = findPOI(matchedText, poiByName);
      if (!poi || matched.has(poi.id)) continue;
      matched.add(poi.id);
      if (match.index > lastIndex) {
        result.push({ type: "text", content: seg.content.slice(lastIndex, match.index) });
      }
      result.push({ type: "poi", content: matchedText, poi });
      lastIndex = match.index + matchedText.length;
    }
    if (lastIndex < seg.content.length) {
      result.push({ type: "text", content: seg.content.slice(lastIndex) });
    }
  }

  return result.length > 0 ? result : withExternals;
}

/** Case-insensitive POI lookup */
function findPOI(text: string, map: Map<string, POI>): POI | undefined {
  // Exact match first
  const exact = map.get(text);
  if (exact) return exact;

  // Case-insensitive fallback
  const entries = Array.from(map.entries());
  for (const [name, poi] of entries) {
    if (name.toLowerCase() === text.toLowerCase()) return poi;
  }
  return undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
