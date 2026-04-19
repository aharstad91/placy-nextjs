/**
 * POI-inline-linker for curated narratives.
 *
 * Markdown-inn → markdown-ut. Validerer Claude-genererte [text](poi:uuid)-
 * lenker mot en whitelist fra prosjektets poi_set. Legger til POI-lenker
 * for navn som forekommer som ren tekst (second-pass).
 *
 * Mønster: `docs/solutions/best-practices/two-pass-text-linker-markdown-poi-20260410.md`
 *
 * Sikkerhet:
 * - UUID-format sjekkes via strict regex (cross-tenant-beskyttelse)
 * - UUID whitelist mot poi_set — format alene er ikke tilstrekkelig
 * - Ugyldige poi:-lenker strippes (behold tekst), logges ikke som feil
 *
 * Per-tema:
 * - Kun første forekomst per POI per tema (ingen chip-spam)
 * - Navn-kollisjoner løses ved å prioritere POI i temaets kategori
 * - Ambiguous matches dropes (ingen gjetting)
 */

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
 * Escape regex special chars for use in dynamic RegExp.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Bygg POI-lookup prioritert etter:
 * 1. POIs i temaets kategori først (kollisjons-resolusjon)
 * 2. Lengre navn før kortere (unngå "Byhaven" matcher inne i "Byhaven Senter")
 */
function buildPoiLookup(
  pois: PoiEntry[],
  themeCategory: string | undefined,
): Map<string, PoiEntry> {
  // Filtrer bort POIs med ugyldige UUIDs (sikkerhetsgarde)
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

  // Map lowercase navn → entry. Ambiguous (samme navn på tvers av kategorier) → den
  // prioriterte (kategori-match/lengst) vinner; duplikater droppes.
  const map = new Map<string, PoiEntry>();
  for (const poi of sorted) {
    const key = poi.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, poi);
    }
  }
  return map;
}

/**
 * Pass 1: Valider eksisterende [text](poi:uuid)-lenker. Strip ugyldige.
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
 * Splitt på lenker, link kun plaintext-segmenter.
 */
function linkBareNames(
  markdown: string,
  poiByName: Map<string, PoiEntry>,
  used: Set<string>,
): string {
  MARKDOWN_LINK_RE.lastIndex = 0;
  const parts: string[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = MARKDOWN_LINK_RE.exec(markdown)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        linkInPlaintext(markdown.slice(lastIndex, match.index), poiByName, used),
      );
    }
    parts.push(match[0]); // behold lenker uberørt
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    parts.push(linkInPlaintext(markdown.slice(lastIndex), poiByName, used));
  }
  return parts.join("");
}

/**
 * Match POI-navn i ren tekst (ikke inne i lenker). Bytter ut første forekomst
 * per POI med [navn](poi:uuid). Kun word-boundary-matches for å unngå delvise
 * matcher som "Sentrum" i "Sentrumsterminalen".
 */
function linkInPlaintext(
  text: string,
  poiByName: Map<string, PoiEntry>,
  used: Set<string>,
): string {
  if (!text || poiByName.size === 0) return text;

  // Iterer navn lengst-først (samme rekkefølge som buildPoiLookup garanterer)
  const names = Array.from(poiByName.keys());
  let result = text;

  for (const nameLower of names) {
    const poi = poiByName.get(nameLower);
    if (!poi) continue;
    if (used.has(poi.uuid.toLowerCase())) continue;

    // Case-insensitive word-boundary match på navn. Behold original casing fra input.
    const re = new RegExp(`\\b${escapeRegex(poi.name)}\\b`, "i");
    const hit = re.exec(result);
    if (!hit) continue;

    // Sørg for at vi ikke treffer inne i en allerede-eksisterende markdown-lenke.
    // (Defensivt — vi splittet på lenker tidligere, men re-sjekker ved overlap.)
    const before = result.slice(0, hit.index);
    const openBrackets = (before.match(/\[/g) || []).length;
    const closeBrackets = (before.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) continue; // inni [..] — skip

    const matched = hit[0];
    result =
      result.slice(0, hit.index) +
      `[${matched}](poi:${poi.uuid})` +
      result.slice(hit.index + matched.length);
    used.add(poi.uuid.toLowerCase());
  }

  return result;
}

/**
 * Hoved-API: to-pass POI-linker.
 *
 * Pass 1 validerer og strippers eksisterende poi:uuid-lenker (whitelist).
 * Pass 2 legger til POI-lenker for bare navn som forekommer som ren tekst.
 * Kun første forekomst per POI per kjøring.
 */
export function linkPoisInMarkdown(
  markdown: string,
  poiSet: PoiEntry[],
  opts: LinkPoisOptions = {},
): LinkPoisResult {
  if (!markdown || poiSet.length === 0) {
    return { linked: markdown, poiLinksUsed: [] };
  }

  // Bygg lookup-maps
  const poiByUuid = new Map<string, PoiEntry>();
  for (const poi of poiSet) {
    if (POI_UUID_RE.test(poi.uuid)) {
      poiByUuid.set(poi.uuid.toLowerCase(), poi);
    }
  }
  const poiByName = buildPoiLookup(poiSet, opts.themeCategory);

  // Sporer hvilke UUIDs som er brukt (pass 1 + pass 2)
  const used = new Set<string>();

  // Pass 1: valider Claude's eksisterende poi:-lenker
  let linked = validateExistingPoiLinks(markdown, poiByUuid, used);
  // Pass 2: backup-lenking av uomtalte POI-navn
  linked = linkBareNames(linked, poiByName, used);

  return {
    linked,
    poiLinksUsed: Array.from(used),
  };
}
