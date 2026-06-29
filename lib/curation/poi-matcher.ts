/**
 * Delt POI-navn-matcher — den felles kjernen for de to POI-linker-adapterne.
 *
 * ÉN matchefunksjon med kjerne-kontrakten (PRD 07, Unit 5 AC1):
 *  - **lengste-navn-først**  — kjernen sorterer kandidatene; lengste navn vinner
 *    ved overlapp (alternasjons-rekkefølge i den genererte regexen).
 *  - **første-forekomst-per-POI** — dedup via `key` (uuid / poi.id), delt på tvers
 *    av flere kall via et valgfritt eksternt `used`-sett.
 *  - **case-insensitive**.
 *
 * Det ENESTE divergerende aspektet som lever på kjerne-nivå er `boundary`:
 *  - `"none"` → kombinert alternasjon `(navn1|navn2|…)/gi`      (segment-adapter)
 *  - `"word"` → ordgrense        `\b(navn1|navn2|…)\b/gi`       (markdown-adapter)
 *
 * De øvrige §5.3-divergensene vedtas EKSPLISITT av ADAPTEREN når den bygger
 * kandidat-listen — IKKE her:
 *  - `AS`/`SA`-stripping       → segment-adapteren legger til strippede alias-
 *    kandidater (samme `key`); markdown-adapteren gjør det ikke.
 *  - kategori-prioritet ved    → markdown-adapteren dedup-er navne-kollisjoner til
 *    navne-kollisjon              ÉN kandidat per navn FØR matching; segment-
 *                                 adapteren har ingen kategori-akse.
 *
 * Mønster: `docs/solutions/best-practices/two-pass-text-linker-markdown-poi-20260410.md`
 */

/** Escape regex-spesialtegn for trygg bruk i dynamisk RegExp. */
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** En navne-kandidat matcheren kan lenke, med ugjennomsiktig `ref` + dedup-`key`. */
export interface MatchCandidate<TRef> {
  /** Navnet som søkes i teksten (case-insensitive). */
  name: string;
  /** Stabil identitet for første-forekomst-per-POI-dedup (uuid / poi.id). */
  key: string;
  /** Ugjennomsiktig nyttelast som adapteren rendrer (POI / PoiEntry). */
  ref: TRef;
}

/** Ordgrense-modus — den eneste kjerne-nivå-divergensen mellom adapterne. */
export type MatchBoundary = "word" | "none";

export interface MatchOptions {
  boundary: MatchBoundary;
}

/** Ett ikke-overlappende treff, i tekst-posisjons-rekkefølge. */
export interface PoiMatch<TRef> {
  /** Start-indeks i teksten (inklusiv). */
  start: number;
  /** Slutt-indeks i teksten (eksklusiv). */
  end: number;
  /** Treffstrengen verbatim — original casing bevart. */
  text: string;
  ref: TRef;
  key: string;
}

/**
 * Den delte kjerne-matcheren.
 *
 * Ett venstre-til-høyre-skann over `text`. Returnerer ikke-overlappende treff i
 * stigende posisjons-rekkefølge: lengste navn vinner ved en gitt posisjon
 * (kandidatene sorteres lengst-først internt), og kun FØRSTE forekomst per `key`
 * tas — senere forekomster av et allerede-lenket POI hoppes over.
 *
 * `used` kan deles på tvers av flere kall (f.eks. markdown-adapterens pass-1 +
 * per-segment-pass-2, eller segment-adapterens dedup på tvers av tekst-segmenter)
 * for å bevare første-forekomst-per-POI over hele dokumentet. Settet muteres.
 */
export function findPoiMatches<TRef>(
  text: string,
  candidates: MatchCandidate<TRef>[],
  options: MatchOptions,
  used: Set<string> = new Set<string>(),
): PoiMatch<TRef>[] {
  if (!text || candidates.length === 0) return [];

  // Lengste-navn-først (kjerne-garanti): lengste alternativ vinner ved overlapp.
  const sorted = [...candidates].sort((a, b) => b.name.length - a.name.length);

  // Slå opp treff-streng (lowercased) → kandidat. Først-vinner ved navne-dublett;
  // adapterne har allerede løst kollisjoner som betyr noe (kategori-prioritet).
  const byNameLower = new Map<string, MatchCandidate<TRef>>();
  for (const c of sorted) {
    const k = c.name.toLowerCase();
    if (!byNameLower.has(k)) byNameLower.set(k, c);
  }

  const body = `(${sorted.map((c) => escapeRegex(c.name)).join("|")})`;
  const pattern =
    options.boundary === "word"
      ? new RegExp(`\\b${body}\\b`, "gi")
      : new RegExp(body, "gi");

  const matches: PoiMatch<TRef>[] = [];
  let m: RegExpExecArray | null;
  pattern.lastIndex = 0;
  while ((m = pattern.exec(text)) !== null) {
    const matchedText = m[1] ?? m[0];
    // Null-lengde-vakt: bevarer fremdrift hvis et tomt alternativ sniker seg inn.
    if (matchedText.length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    const cand = byNameLower.get(matchedText.toLowerCase());
    if (!cand || used.has(cand.key)) continue;
    used.add(cand.key);
    matches.push({
      start: m.index,
      end: m.index + matchedText.length,
      text: matchedText,
      ref: cand.ref,
      key: cand.key,
    });
  }
  return matches;
}
