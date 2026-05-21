import type { BoardPOI } from "@/components/variants/report/board/board-data";

/** Antall featured POIs per kategori — speilet i chip-cloud (sidebar) og
 *  navne-labels (kart). Sentralisert så de to flatene aldri kan divergere. */
export const FEATURED_POI_COUNT = 5;

/**
 * Deterministisk utvalg av N POIs fra en kategori.
 *
 * Prototype-shim: tar tilfeldig utvalg seeded på category.id slik at samme
 * POI-er vises ved hver reload. Erstattes når curator-flyt eksisterer slik
 * at megler/kunde kan plukke top-N per kategori manuelt — da hentes utvalget
 * fra `BoardCategory.featuredPoiIds` (eller tilsvarende felt) istedenfor å
 * genereres her.
 *
 * Returnerer aldri flere enn `pois.length`. Muterer aldri input.
 */
export function pickFeaturedPOIs(
  pois: BoardPOI[],
  count: number,
  seed: string,
): BoardPOI[] {
  if (pois.length === 0 || count <= 0) return [];
  if (pois.length <= count) return [...pois];

  const rng = mulberry32(cyrb53(seed));
  const indices = Array.from({ length: pois.length }, (_, i) => i);
  // Fisher-Yates med seeded RNG — gir deterministisk shuffle uten å mutere input.
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).map((idx) => pois[idx]);
}

/** cyrb53 string-hash → 32-bit seed for mulberry32. */
function cyrb53(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0) ^ (h1 >>> 0);
}

/** Mulberry32 PRNG — liten, deterministisk, returnerer [0, 1). */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
