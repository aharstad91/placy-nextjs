/**
 * POI-inline-linker for kuraterte narrativer — markdown-adapter over den delte
 * POI-matcheren (`@/lib/curation/poi-matcher`).
 *
 * Markdown-inn → markdown-ut. Validerer Claude-genererte [text](poi:uuid)-
 * lenker mot en whitelist fra prosjektets poi_set (pass 1). Legger til POI-lenker
 * for navn som forekommer som ren tekst (pass 2).
 *
 * Mønster: `docs/solutions/best-practices/two-pass-text-linker-markdown-poi-20260410.md`
 *
 * Per-adapter-vedtak (§5.3 / PRD 07 Unit 5):
 *  - ordgrense: `"word"` — `\b…\b`, ingen delvise treff ("Byhaven" ikke i
 *    "Byhavenesque"). Bevart fra dagens atferd.
 *  - `AS`/`SA`-stripping: NEI — kun eksakt navn matches.
 *  - kategori-prioritet: JA — navne-kollisjon løses ved å prioritere POI i
 *    temaets kategori (`buildCandidates`), dedup til ÉN kandidat per navn.
 *
 * Sikkerhet:
 * - Pass 1: UUID-format sjekkes via strict regex (cross-tenant-beskyttelse) +
 *   whitelist mot poi_set — format alene er ikke tilstrekkelig. Ugyldige
 *   poi:-lenker strippes (behold tekst).
 * - Per kjøring: kun første forekomst per POI (ingen chip-spam), delt på tvers av
 *   pass 1 og pass 2.
 */

import {
  findPoiMatches,
  type MatchCandidate,
} from "@/lib/curation/poi-matcher";

export interface PoiEntry {
  uuid: string;
  name: string;
  /** Kategori-tag brukt for å løse ambiguity ved navn-kollisjon. */
  category: string;
}

export interface LinkPoisOptions {
  /** Tema-ens kategori — brukes for å prioritere ved POI-navn-kollisjon. */
  themeCategory?: string;
}

export interface LinkPoisResult {
  /** Markdown med validerte + lagt-til poi:uuid-lenker. */
  linked: string;
  /** UUIDs for POIs som faktisk ble inline-lenket (for `poiLinksUsed`-feltet). */
  poiLinksUsed: string[];
}

const POI_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Match markdown-link: [text](url). Non-greedy on text; url slutter på ) eller whitespace.
const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Bygg matcher-kandidater (pass 2) prioritert etter:
 * 1. POIs i temaets kategori først (kollisjons-resolusjon)
 * 2. Lengre navn før kortere (unngå "Byhaven" matcher inne i "Byhaven Senter")
 *
 * Filtrerer bort POIs med ugyldige UUIDs (sikkerhetsgarde) og dedup-er
 * navne-kollisjoner til ÉN kandidat per (lowercased) navn — den prioriterte
 * (kategori-match/lengst) vinner.
 */
function buildCandidates(
  pois: PoiEntry[],
  themeCategory: string | undefined,
): MatchCandidate<PoiEntry>[] {
  const sorted = [...pois]
    .filter((p) => POI_UUID_RE.test(p.uuid))
    .sort((a, b) => {
      // Prioriter kategori-match
      const aMatch = themeCategory && a.category === themeCategory ? 1 : 0;
      const bMatch = themeCategory && b.category === themeCategory ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      // Deretter lengre navn først
      return b.name.length - a.name.length;
    });

  // Ambiguous (samme navn på tvers av kategorier) → prioritert vinner; dupl. droppes.
  const seen = new Set<string>();
  const candidates: MatchCandidate<PoiEntry>[] = [];
  for (const poi of sorted) {
    const key = poi.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ name: poi.name, key: poi.uuid.toLowerCase(), ref: poi });
  }
  return candidates;
}

/**
 * Pass 1: Valider eksisterende [text](poi:uuid)-lenker. Strip ugyldige.
 * Markerer gyldige UUIDs i `used` slik at pass 2 ikke dobbelt-lenker.
 */
function validateExistingPoiLinks(
  markdown: string,
  poiByUuid: Map<string, PoiEntry>,
  used: Set<string>,
): string {
  MARKDOWN_LINK_RE.lastIndex = 0;
  return markdown.replace(MARKDOWN_LINK_RE, (match, text, url) => {
    // Ikke-poi-lenker passerer uberørt
    if (!url.startsWith("poi:")) return match;

    const uuid = url.slice(4);
    // Format-sjekk
    if (!POI_UUID_RE.test(uuid)) return text;
    // Whitelist-sjekk — format alene er ikke nok (cross-tenant)
    const poi = poiByUuid.get(uuid.toLowerCase());
    if (!poi) return text;

    // Duplikat per tema → strip til plain tekst
    if (used.has(uuid.toLowerCase())) return text;

    used.add(uuid.toLowerCase());
    return match;
  });
}

/**
 * Pass 2: Finn bare POI-navn i segmenter som ikke ligger inne i markdown-lenker.
 * Splitt på lenker, kjør den delte kjerne-matcheren på hvert plaintext-segment,
 * og sett inn [navn](poi:uuid) på treff-posisjonene.
 */
function linkBareNames(
  markdown: string,
  candidates: MatchCandidate<PoiEntry>[],
  used: Set<string>,
): string {
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  MARKDOWN_LINK_RE.lastIndex = 0;

  const renderPlaintext = (text: string): string => {
    const matches = findPoiMatches(text, candidates, { boundary: "word" }, used);
    if (matches.length === 0) return text;
    let result = "";
    let cursor = 0;
    for (const mt of matches) {
      result += text.slice(cursor, mt.start);
      result += `[${mt.text}](poi:${mt.ref.uuid})`;
      cursor = mt.end;
    }
    result += text.slice(cursor);
    return result;
  };

  while ((match = MARKDOWN_LINK_RE.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push(renderPlaintext(markdown.slice(lastIndex, match.index)));
    }
    parts.push(match[0]); // behold lenker uberørt
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    parts.push(renderPlaintext(markdown.slice(lastIndex)));
  }
  return parts.join("");
}

/**
 * Hoved-API: to-pass POI-linker.
 *
 * Pass 1 validerer og stripper eksisterende poi:uuid-lenker (whitelist).
 * Pass 2 legger til POI-lenker for bare navn som forekommer som ren tekst.
 * Kun første forekomst per POI per kjøring (delt `used` over begge pass).
 */
export function linkPoisInMarkdown(
  markdown: string,
  poiSet: PoiEntry[],
  opts: LinkPoisOptions = {},
): LinkPoisResult {
  if (!markdown || poiSet.length === 0) {
    return { linked: markdown, poiLinksUsed: [] };
  }

  // Bygg lookup for pass 1 (whitelist) + kandidater for pass 2 (matching)
  const poiByUuid = new Map<string, PoiEntry>();
  for (const poi of poiSet) {
    if (POI_UUID_RE.test(poi.uuid)) {
      poiByUuid.set(poi.uuid.toLowerCase(), poi);
    }
  }
  const candidates = buildCandidates(poiSet, opts.themeCategory);

  // Sporer hvilke UUIDs som er brukt (pass 1 + pass 2)
  const used = new Set<string>();

  // Pass 1: valider Claude's eksisterende poi:-lenker
  let linked = validateExistingPoiLinks(markdown, poiByUuid, used);
  // Pass 2: backup-lenking av uomtalte POI-navn
  linked = linkBareNames(linked, candidates, used);

  return {
    linked,
    poiLinksUsed: Array.from(used),
  };
}
