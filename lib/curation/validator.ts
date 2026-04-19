/**
 * Post-curation validator for Claude-genererte narratives.
 *
 * Deterministisk fakta-sjekk: proper nouns i curated output må matche
 * tilgjengelig input (gemini_narrative ∪ poi_set.name). Ukjente → reject.
 *
 * Beskyttelser:
 * - Character-class filter: ingen zero-width chars, RTL overrides, smuggling-vektorer
 * - Hard length-cap: reject (ikke silent truncate) hvis over terskel
 * - NER-basert fakta-sjekk: proper nouns må matches mot referansesett
 */

// Samme sett som sanitize-input.ts, men UTEN /g — .test() med global regex har
// persistent lastIndex som gir sporadiske falske negativer.
const DANGEROUS_CHARS_RE =
  /[\u0000-\u0008\u000B-\u001F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/;

// Norske stoppord som ofte starter setninger — ignorer i proper-noun-ekstrakt
const LEADING_CAP_STOPWORDS = new Set([
  "I",
  "En",
  "Et",
  "Det",
  "Den",
  "De",
  "Dette",
  "Disse",
  "Vi",
  "Du",
  "Her",
  "Der",
  "Når",
  "Hvor",
  "Hva",
  "Hvem",
  "Og",
  "Men",
  "Eller",
  "For",
  "Til",
  "Fra",
  "Som",
  "Med",
  "Uten",
  "Mellom",
  "Etter",
  "Før",
  "Under",
  "Over",
  "På",
  "Av",
  "I",
  "Ved",
]);

export interface ValidateOptions {
  /** Hard lengde-tak. Default 1200 tegn. */
  maxLength?: number;
  /** Min lengde (min-verdi for curatedNarrative-skjema). Default 100. */
  minLength?: number;
  /** Edit-distance for fuzzy-match mot referansesett. Default 1. */
  fuzzyDistance?: number;
}

export type ValidateResult =
  | { ok: true; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

/**
 * Ekstrakt av proper nouns: ord som starter med stor bokstav og IKKE er
 * setningsstartere (hvor stor bokstav skyldes grammatikk, ikke egennavn-status).
 *
 * Heuristisk — fanger enkle steds-, persons- og organisasjonsnavn. Multi-word
 * navn (som "Solsiden senter") fanges av POI-linkeren gjennom exact match mot
 * poi_set; validator sjekker kun at enkelt-ord er kjente.
 *
 * Setningsstartere (ord som kommer rett etter . ! ? eller start-of-text) er
 * sentence-case-oppgradert, ikke egennavn. Disse droppes for å unngå false
 * positives på ord som "Tilbudet", "Bussnettet", "Øvrige".
 */
export function extractProperNouns(text: string): string[] {
  // Finn alle kapitaliserte ord + deres posisjon
  const nounRe = /[A-ZÆØÅ][a-zæøåA-ZÆØÅ]+/g;
  const nouns = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = nounRe.exec(text)) !== null) {
    const word = match[0];
    const pos = match.index;

    // Hopp over stopord
    if (LEADING_CAP_STOPWORDS.has(word)) continue;

    // Hopp over setningsstartere (ord rett etter . ! ? eller start-of-text)
    // Ser bakover: første ikke-whitespace-tegn må være . ! ? eller ingenting
    let i = pos - 1;
    while (i >= 0 && /\s/.test(text[i])) i--;
    if (i < 0 || /[.!?]/.test(text[i])) continue;

    nouns.add(word);
  }
  return Array.from(nouns);
}

/**
 * Levenshtein edit-distance (lite-implementasjon). Kapsler til `max` for
 * korte-sirkuit return når overskredet.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
      curr.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[n];
}

/**
 * Match en proper noun mot et referansesett (case-insensitive). Fuzzy
 * distance for bøyningsformer ("Nidarosdomen" vs "Nidarosdomens").
 */
function matchesReference(
  noun: string,
  referenceLower: Set<string>,
  fuzzyDistance: number,
): boolean {
  const nl = noun.toLowerCase();
  if (referenceLower.has(nl)) return true;
  // Sjekk om noun er substring av noen referanse (eller omvendt) —
  // "Byhaven" i "Byhaven senter"
  const refsArray = Array.from(referenceLower);
  for (const ref of refsArray) {
    if (ref.includes(nl) || nl.includes(ref)) return true;
  }
  // Fuzzy
  if (fuzzyDistance > 0) {
    for (const ref of refsArray) {
      if (editDistance(nl, ref, fuzzyDistance) <= fuzzyDistance) return true;
    }
  }
  return false;
}

/**
 * Valider curated narrative mot referansesett + sikkerhetsregler.
 */
export function validateCuratedNarrative(
  curated: string,
  reference: { geminiNarrative: string; poiNames: string[] },
  opts: ValidateOptions = {},
): ValidateResult {
  const { maxLength = 1200, minLength = 100, fuzzyDistance = 1 } = opts;
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Character-class filter
  if (DANGEROUS_CHARS_RE.test(curated)) {
    errors.push(
      "contains zero-width / RTL-override / control characters (prompt-injection smuggling vector)",
    );
  }

  // 2. Length-cap
  if (curated.length > maxLength) {
    errors.push(`length ${curated.length} > ${maxLength} (hard cap)`);
  }
  if (curated.length < minLength) {
    errors.push(`length ${curated.length} < ${minLength} (min)`);
  }

  // 3. NER-sjekk: proper nouns må matche referansesett
  const referenceLower = new Set<string>();
  for (const noun of extractProperNouns(reference.geminiNarrative)) {
    referenceLower.add(noun.toLowerCase());
  }
  for (const name of reference.poiNames) {
    referenceLower.add(name.toLowerCase());
  }

  const curatedNouns = extractProperNouns(curated);
  const unknowns: string[] = [];
  for (const noun of curatedNouns) {
    if (!matchesReference(noun, referenceLower, fuzzyDistance)) {
      unknowns.push(noun);
    }
  }

  if (unknowns.length > 0) {
    // Opp til 3 ukjente → warning. Mer → error (sannsynligvis hallusinering)
    if (unknowns.length <= 3) {
      warnings.push(
        `unknown proper nouns (may be OK): ${unknowns.join(", ")}`,
      );
    } else {
      errors.push(
        `${unknowns.length} unknown proper nouns (likely hallucination): ${unknowns.slice(0, 5).join(", ")}`,
      );
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors, warnings };
  }
  return { ok: true, warnings };
}
