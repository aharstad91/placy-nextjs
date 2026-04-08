/**
 * Story Text Linker
 *
 * Matches POI names in narrative text and splits into segments
 * that can be rendered with interactive POI mentions inline.
 */

import type { POI } from "@/lib/types";

export interface TextSegment {
  type: "text" | "poi";
  content: string;
  poi?: POI;
}

/**
 * Parse text and match POI names to create linked segments.
 *
 * Strategy: sort POI names by length (longest first) to avoid
 * partial matches. Only match whole-word boundaries.
 */
export function linkPOIsInText(text: string, pois: POI[]): TextSegment[] {
  if (!text || pois.length === 0) return [{ type: "text", content: text }];

  // Build lookup: name → POI (longest names first to avoid partial matches)
  const poiByName = new Map<string, POI>();
  const sortedNames = pois
    .filter((p) => p.name.length >= 3) // Skip very short names
    .sort((a, b) => b.name.length - a.name.length);

  for (const poi of sortedNames) {
    poiByName.set(poi.name, poi);
    // Also match without common suffixes
    const cleaned = poi.name
      .replace(/ AS$/i, "")
      .replace(/ SA$/i, "")
      .trim();
    if (cleaned !== poi.name && cleaned.length >= 3) {
      poiByName.set(cleaned, poi);
    }
  }

  // Build regex from all names (escaped, word-boundary)
  const names = Array.from(poiByName.keys()).sort((a, b) => b.length - a.length);
  if (names.length === 0) return [{ type: "text", content: text }];

  const escaped = names.map((n) => escapeRegex(n));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  const matched = new Set<string>(); // Avoid duplicate POI matches

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const matchedText = match[0];
    const poi = findPOI(matchedText, poiByName);
    if (!poi) continue;

    // Only link first occurrence of each POI
    if (matched.has(poi.id)) continue;
    matched.add(poi.id);

    // Add preceding text
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    // Add POI mention
    segments.push({ type: "poi", content: matchedText, poi });
    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", content: text }];
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
