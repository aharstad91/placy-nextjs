/**
 * Ren logikk for scripts/curate-pois.ts — ingen I/O, ingen argv.
 *
 * Arbeidslista for Lokalkunnskap (Moat 1) på POI-nivå. Grounding-scriptet
 * (scripts/ground-poi-content.ts) henter fakta og kilder fra Google; dette
 * scriptet er der vi skriver teksten selv. Skillet er ikke kosmetisk:
 * generated-teksten er lånt (kildehenvisninger må vises, 2-års lagringsgrense i
 * Gemini-vilkårene, må hentes på nytt når den utdateres), mens curated-teksten
 * er vår, uten attribusjon og uten utløpsdato. Det er den som er verdt noe.
 *
 * POLICY-ENDRING 2026-08-15 (eier-beslutning, Andreas): leverandørtekst er
 * ALDRI ferdigvare. Tidligere regnet lista et POI som dekket så snart Geminis
 * narrativ besto kvalitetsporten — på Ranheim ga det 155 av 199 steder som
 * shippet lånt tekst og aldri kom på kuratorlista. Nå havner hvert sted uten
 * curated-tekst på lista, med leverandørutkastet og kildene VEDLAGT som
 * råstoff. Begrunnelsen er Moat 1: innhold vi ikke eier, er ikke en moat.
 * Grounding-kjøringen er uendret — vi gjenbruker det vi alt har betalt for.
 *
 * Ligger separat fra CLI-en fordi den parser argv på modulnivå (samme mønster
 * som scripts/ground-poi-content-lib.ts).
 */

import { PoiGroundingViewSchema, type PoiGrounding } from "../lib/types";
import { specForCategory, type CategorySpec } from "../lib/editorial/category-specs";

/**
 * Hvorfor et POI mangler brukbart innhold. Styrer både sortering og hva kurator
 * skal gjøre med raden:
 *
 *   ingen-forsøk       — grounding-scriptet har ikke kjørt på POI-et ennå. Kjør
 *                        det FØRST; håndskrevet tekst her er sløsing hvis
 *                        Google har noe.
 *   no-data            — ingenting publisert om stedet. Den ekte
 *                        Moat-1-kandidaten.
 *   refusal            — modellen svarte om søket sitt. Prompt-problem, men
 *                        teksten må skrives av oss uansett så lenge prompten
 *                        står.
 *   strøk-porten       — innhold funnet, men for tynt (typisk 1 kilde). Utkastet
 *                        følger med som råstoff — ofte er én setning der riktig,
 *                        og resten fyll.
 *   har-leverandørtekst— Gemini fant nok og skrev et brukbart narrativ. Stedet
 *                        er IKKE dekket: teksten er lånt. Rikeste råstoffet på
 *                        lista, og den raskeste raden å skrive — men også den
 *                        med lavest hastegrad, siden boardet viser noe i dag.
 *   error              — timeout/kvote/nett. IKKE en kurator-oppgave; kjør på
 *                        nytt.
 */
export type MissingReason =
  | "ingen-forsøk"
  | "no-data"
  | "refusal"
  | "strøk-porten"
  | "har-leverandørtekst"
  | "error";

/**
 * Kollektiv-holdeplasser. Navnet er en holdeplass, ikke et sted — «Straumen
 * bussholdeplass» har ingen redaksjonell tekst å skrive, og sanntidsavgangene
 * fra Entur er hele svaret. Markeres og sorteres sist, men droppes ALDRI stille
 * fra lista (CLAUDE.md: ingen usynlige avkortinger).
 */
const REALTIME_ANSWERS_IT = new Set(["bus", "tram", "train", "ferry", "subway"]);

export interface CurationCandidateInput {
  id: string;
  name: string | null;
  address: string | null;
  category_id: string | null;
  grounding: unknown;
  google_rating: number | null;
  google_review_count: number | null;
  google_phone: string | null;
  google_website: string | null;
  opening_hours_json: unknown;
}

/** Faktaene vi alt eier. Råstoff for kurator — og det modalen viser uansett. */
export interface CandidateFacts {
  hasOpeningHours: boolean;
  hasPhone: boolean;
  website?: string;
  rating?: number;
  reviewCount?: number;
}

export interface CurationCandidate {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  address?: string;
  why: MissingReason;
  detail: string;
  facts: CandidateFacts;
  /**
   * Leverandørens narrativ, når det finnes — bestått eller strøket. RÅSTOFF,
   * ALDRI FASIT: den er lånt tekst, og skal omskrives, ikke kopieres.
   * Het `rejectedNarrative` fram til 2026-08-15, da også beståtte utkast
   * begynte å følge med og navnet ble direkte misvisende.
   */
  providerDraft?: string;
  /**
   * Kildene leverandøren siterte. Fulgte ikke med før policy-endringen, og
   * uten dem kan kurator verken verifisere en påstand eller vite hvor tynt
   * grunnlaget er. `domain` er den oppløste verten, ikke Gemini-redirecten.
   */
  sources?: Array<{ title: string; url: string; domain: string }>;
  /** Sant for holdeplasser o.l. der sanntidsdata er svaret. Sorteres sist. */
  realtimeAnswersIt?: boolean;
  /** Kurator fyller denne. Tom streng = ikke skrevet ennå. */
  narrative: string;
}

export type Classification =
  | { needsText: false; reason: "har-kuratert-tekst" | "mangler-navn" }
  | {
      needsText: true;
      why: MissingReason;
      detail: string;
      providerDraft?: string;
      sources?: Array<{ title: string; url: string; domain: string }>;
    };

/**
 * Parse lagret grounding tolerant. Ugyldig shape behandles som «ingen» slik at
 * POI-en havner på arbeidslista i stedet for å forsvinne stille — men kalleren
 * får vite det, aldri en stille drop.
 */
export function parseGroundingLoose(
  raw: unknown,
): { grounding?: PoiGrounding; invalid: boolean } {
  if (raw == null) return { invalid: false };
  const parsed = PoiGroundingViewSchema.safeParse(raw);
  if (parsed.success) return { grounding: parsed.data, invalid: false };
  return { invalid: true };
}

/**
 * Avgjør om et POI trenger håndskrevet tekst.
 *
 * Stigen har ETT trinn etter policy-endringen 2026-08-15: har stedet
 * curated-tekst, er det dekket. Alt annet er en åpning — også steder der
 * leverandørens narrativ besto kvalitetsporten, siden den teksten er lånt og
 * dermed ikke er Moat 1. Et POI kan ha BÅDE lastAttempt og curated — det er
 * normaltilstanden for et servicested vi har skrevet selv, og det skal da ikke
 * tilbake på lista.
 */
export function classifyMissing(poi: {
  name: string | null;
  grounding: PoiGrounding | undefined;
}): Classification {
  if (!poi.name?.trim()) return { needsText: false, reason: "mangler-navn" };

  if (poi.grounding?.curated) {
    return { needsText: false, reason: "har-kuratert-tekst" };
  }

  const generated = poi.grounding?.generated;

  if (generated) {
    const gate = generated.qualityGate;
    // Kildene er de samme uansett utfall — det er porten, ikke kildelista, som
    // skiller de to grenene.
    const sources = generated.sources?.map((s) => ({
      title: s.title,
      url: s.url,
      domain: s.domain,
    }));
    const kilder = `${gate.sourceCount} kilde${gate.sourceCount === 1 ? "" : "r"}, ${gate.charCount} tegn`;

    return {
      needsText: true,
      why: gate.passed ? "har-leverandørtekst" : "strøk-porten",
      detail: gate.passed
        ? `${kilder} — leverandørtekst består porten, men er lånt`
        : `${kilder} — ${gate.reason ?? "strøk porten"}`,
      providerDraft: generated.narrative,
      ...(sources && sources.length > 0 ? { sources } : {}),
    };
  }

  const attempt = poi.grounding?.lastAttempt;
  if (attempt) {
    return { needsText: true, why: attempt.outcome, detail: attempt.reason };
  }

  return {
    needsText: true,
    why: "ingen-forsøk",
    detail: "grounding-scriptet har ikke kjørt på dette POI-et",
  };
}

export function extractFacts(row: CurationCandidateInput): CandidateFacts {
  return {
    hasOpeningHours: row.opening_hours_json != null,
    hasPhone: Boolean(row.google_phone),
    ...(row.google_website ? { website: row.google_website } : {}),
    ...(row.google_rating != null ? { rating: Number(row.google_rating) } : {}),
    ...(row.google_review_count != null
      ? { reviewCount: row.google_review_count }
      : {}),
  };
}

/**
 * Sorteringsrekkefølge. Hensikten er at kurator skal kunne jobbe ovenfra og ned
 * og treffe det som betyr mest først:
 *
 *   1. strøk-porten        — det finnes råstoff, så teksten er raskest å skrive
 *   2. no-data             — ekte Lokalkunnskap-arbeid, høyest verdi
 *   3. refusal             — samme, men prompten er også verdt å se på
 *   4. har-leverandørtekst — rikeste råstoffet, men lavest hastegrad: boardet
 *                            viser noe i dag, så dette er en eierskaps-jobb og
 *                            ikke et hull. Etter policy-endringen er dette den
 *                            desidert største gruppa (155 av 199 på Ranheim),
 *                            og den ville begravd de fire over seg om den lå
 *                            først.
 *   5. ingen-forsøk        — kjør grounding-scriptet først
 *   6. error               — teknisk, ikke kurator-arbeid
 *
 * Holdeplasser sorteres alltid sist uansett årsak, og innenfor hver gruppe
 * sorteres POI-er med Google-fakta først: de har mest råstoff å skrive fra.
 */
const WHY_RANK: Record<MissingReason, number> = {
  "strøk-porten": 0,
  "no-data": 1,
  refusal: 2,
  "har-leverandørtekst": 3,
  "ingen-forsøk": 4,
  error: 5,
};

export function sortCandidates(candidates: CurationCandidate[]): CurationCandidate[] {
  return [...candidates].sort((a, b) => {
    const realtime = Number(a.realtimeAnswersIt ?? false) - Number(b.realtimeAnswersIt ?? false);
    if (realtime !== 0) return realtime;
    const why = WHY_RANK[a.why] - WHY_RANK[b.why];
    if (why !== 0) return why;
    const facts = factScore(b.facts) - factScore(a.facts);
    if (facts !== 0) return facts;
    return a.name.localeCompare(b.name, "no");
  });
}

function factScore(f: CandidateFacts): number {
  return (
    (f.hasOpeningHours ? 1 : 0) +
    (f.hasPhone ? 1 : 0) +
    (f.website ? 1 : 0) +
    (f.rating != null ? 1 : 0)
  );
}

export function buildCandidate(
  row: CurationCandidateInput,
  classification: Extract<Classification, { needsText: true }>,
  categoryName?: string,
): CurationCandidate {
  return {
    id: row.id,
    name: row.name!.trim(),
    ...(row.category_id ? { categoryId: row.category_id } : {}),
    ...(categoryName ? { categoryName } : {}),
    ...(row.address ? { address: row.address } : {}),
    why: classification.why,
    detail: classification.detail,
    facts: extractFacts(row),
    ...(classification.providerDraft
      ? { providerDraft: classification.providerDraft }
      : {}),
    ...(classification.sources ? { sources: classification.sources } : {}),
    ...(row.category_id && REALTIME_ANSWERS_IT.has(row.category_id)
      ? { realtimeAnswersIt: true }
      : {}),
    narrative: "",
  };
}

// ─── Skriving ───────────────────────────────────────────────────────────────

/**
 * Tekst-reglene fra /curate-area, håndhevet mekanisk der de kan være det.
 * Årstall er den regelen som brytes oftest (curator-skillens historisk-form er
 * default i modellen), så den får et eget mønster i stedet for bare en
 * kommentar noen skal huske å lese.
 */
/**
 * 40, ikke 80: kalibreringsbatchen 2026-08-15 viste at 80-gulvet TVANG fram
 * fyllstoff — «Tannlegepraksis i Jakobslivegen på Jakobsli» er 42 tegn og
 * komplett, så gulvet på 80 la en generisk nytteklausul på halen av nettopp de
 * stedene vi vet minst om. Fem av sytten tekster fikk samme hale, og mønsteret
 * ville pekt ut kunnskapshullene våre for leseren. Kort og sant slår langt og
 * fylt.
 */
export const MIN_NARRATIVE_CHARS = 40;
export const MAX_NARRATIVE_CHARS = 600;
const YEAR_PATTERN = /\b(1[6-9]\d\d|20\d\d)\b/;

export interface NarrativeIssue {
  poiId: string;
  problem: string;
}

export function validateNarrative(poiId: string, text: string): NarrativeIssue[] {
  const issues: NarrativeIssue[] = [];
  const trimmed = text.trim();

  if (trimmed.length < MIN_NARRATIVE_CHARS) {
    issues.push({
      poiId,
      problem: `for kort (${trimmed.length} tegn, minst ${MIN_NARRATIVE_CHARS})`,
    });
  }
  if (trimmed.length > MAX_NARRATIVE_CHARS) {
    issues.push({
      poiId,
      problem: `for lang (${trimmed.length} tegn, maks ${MAX_NARRATIVE_CHARS})`,
    });
  }
  const year = trimmed.match(YEAR_PATTERN);
  if (year) {
    issues.push({
      poiId,
      problem: `inneholder årstall «${year[0]}» — tekst-regel 1 er presens, ikke historikk`,
    });
  }
  return issues;
}

/**
 * Flett kuratert tekst inn i eksisterende grounding.
 *
 * Bevarer BÅDE generated og lastAttempt. En kuratert tekst er et tillegg, ikke
 * en erstatning: leverandør-laget kan fortsatt bli relevant hvis vi en dag
 * bytter til Googles egen generativeSummary, og lastAttempt er dokumentasjonen
 * på hvorfor noen måtte skrive teksten for hånd.
 */
export function mergeCurated(
  existing: PoiGrounding | undefined,
  narrative: string,
  curatedAt: string,
): PoiGrounding {
  return {
    poiGroundingVersion: 1,
    ...(existing?.generated ? { generated: existing.generated } : {}),
    ...(existing?.lastAttempt ? { lastAttempt: existing.lastAttempt } : {}),
    curated: { narrative: narrative.trim(), curatedAt },
  };
}

// ─── Staging-fila ───────────────────────────────────────────────────────────

export interface StagingFile {
  projectId: string;
  generatedAt: string;
  /** Kort huskeliste i selve fila — kurator leser den her, ikke i et skill. */
  tekstregler: string[];
  /**
   * Kategorimalene for de kategoriene som faktisk finnes i denne lista, kildet
   * på `category_id`. Ligger på toppnivå og ikke per POI: malen er lang, og
   * gjentatt 158 ganger ville den druknet arbeidslista.
   *
   * Tom hvis ingen av POI-ene tilhører en kategori vi har skrevet mal for
   * ennå — da gjelder bare `tekstregler`, som før.
   */
  kategorimaler: Record<string, CategorySpec>;
  pois: CurationCandidate[];
}

export const TEKSTREGLER = [
  "Presens — hva som ER der. Aldri årstall, byggehistorikk eller «har lange tradisjoner».",
  "Beboer-perspektiv: målgruppen er boligkjøperen som blir beboer, ikke en turist.",
  "Fakta, ikke poesi. Ingen «lukten av», «smaken av».",
  "IKKE åpningstider, telefon eller priser — de hentes fra Places API og vises alt i modalen.",
  "Navngi, aldri generaliser: «Apotek 1 Nardo» slår «flere apotek».",
  "Funksjon ER lov: hva stedet gjør for deg som bor der. Det er hele poenget med denne lista.",
  "providerDraft er RÅSTOFF, ikke fasit. Fakta derfra er frie og skal brukes — men UTVALG og VINKLING skal være våre: velg de 2–3 opplysningene som betyr mest for en beboer og led med den viktigste, i stedet for å følge utkastets disposisjon. En tekst som er utkastets punktliste med færre adjektiv, eier vi ikke.",
  "Stoler du ikke på en påstand i utkastet, sjekk sources — og lar den seg ikke bekrefte, utelat den heller enn å gjenta den. Sjekk OGSÅ at kilden handler om riktig sted: kalibreringen fant en frisør hvis eneste kilde var en annen salongs nettside.",
  "no-data-steder får én kort, ærlig funksjonslinje bygd på navn, kategori og adresse — ALDRI kjede-/typekunnskap kledd som stedsfakta («bredt utvalg av…»), aldri størrelse eller brukergruppe vi ikke vet.",
  "ALDRI fyll ut for å virke informert. Generiske nytteklausuler («— nyttig når…», «— slipper å dra til byen for») bærer ingen stedsinformasjon, og som mønster over mange tekster peker de ut nøyaktig hvilke steder vi ikke vet noe om.",
  `Lengde ${MIN_NARRATIVE_CHARS}–${MAX_NARRATIVE_CHARS} tegn. La narrative stå tom for å hoppe over et POI.`,
];

/**
 * Malene for kategoriene som forekommer i lista. Bare de som faktisk er i bruk
 * — en kurator som jobber med et board uten skoler skal ikke lese skolemalen.
 */
export function relevanteKategorimaler(
  candidates: readonly CurationCandidate[],
): Record<string, CategorySpec> {
  const ut: Record<string, CategorySpec> = {};
  for (const c of candidates) {
    if (!c.categoryId || ut[c.categoryId]) continue;
    const spec = specForCategory(c.categoryId);
    if (spec) ut[c.categoryId] = spec;
  }
  return ut;
}

export function buildStagingFile(
  projectId: string,
  candidates: CurationCandidate[],
  generatedAt: string,
): StagingFile {
  const sorted = sortCandidates(candidates);
  return {
    projectId,
    generatedAt,
    tekstregler: TEKSTREGLER,
    kategorimaler: relevanteKategorimaler(sorted),
    pois: sorted,
  };
}

export type StagingParse =
  | { ok: true; projectId: string; toWrite: Array<{ id: string; narrative: string }>; skipped: number }
  | { ok: false; errors: string[] };

/**
 * Les og validér en staging-fil. Alt valideres FØR noe skrives — en fil med én
 * ulovlig tekst skal ikke skrive de andre halvveis.
 */
export function parseStagingForWrite(raw: unknown): StagingParse {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["staging-fila er ikke et objekt"] };
  }
  const file = raw as Partial<StagingFile>;
  if (!file.projectId?.trim()) errors.push("mangler projectId");
  if (!Array.isArray(file.pois)) errors.push("mangler pois-array");
  if (errors.length > 0) return { ok: false, errors };

  const toWrite: Array<{ id: string; narrative: string }> = [];
  let skipped = 0;
  const seen = new Set<string>();

  for (const entry of file.pois!) {
    if (!entry?.id) {
      errors.push("en rad mangler id");
      continue;
    }
    if (seen.has(entry.id)) {
      errors.push(`${entry.id}: duplikat i fila — hvilken tekst skulle vunnet?`);
      continue;
    }
    seen.add(entry.id);

    const narrative = (entry.narrative ?? "").trim();
    if (!narrative) {
      skipped++;
      continue;
    }
    for (const issue of validateNarrative(entry.id, narrative)) {
      errors.push(`${issue.poiId}: ${issue.problem}`);
    }
    toWrite.push({ id: entry.id, narrative });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, projectId: file.projectId!, toWrite, skipped };
}
