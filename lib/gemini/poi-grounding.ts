/**
 * Per-POI grounding: Google-grounded innhold for ETT sted, generert build-time.
 *
 * Brukes av scripts/ground-poi-content.ts — aldri runtime (Placy-regel: ingen
 * runtime-LLM). Resultatet lagres i v2.pois.grounding (migrasjon 084) og
 * rendres i Utforsk-modalen.
 *
 * Forholdet til tema-grounding: `callGemini()` sin egen `buildPrompt()` er
 * strøksskala («treningssentre i Midtbyen»). Denne modulen bygger stedsskala
 * («Muustrøparken») og sender prompten via `options.prompt`, slik at det
 * fortsatt er ÉN API-klient, ÉN nøkkelhåndtering og ÉN sanerings-/timeout-kjede.
 *
 * Kaster ALDRI. Per-POI-feil returneres som `{ ok: false, reason }` slik at en
 * batch på 78 POI-er ikke veltes av ett dårlig sted.
 */

import { callGemini, GEMINI_MODEL } from "./grounding";
import { resolveUrlsParallel } from "./url-resolver";
import {
  PoiGroundingGeneratedSchema,
  type PoiGroundingAttempt,
  type PoiGroundingGenerated,
  type PoiGroundingSource,
  type PoiQualityGate,
} from "../types";

/** Dagens eneste provider. Se PoiGroundingGeneratedSchema for swap-kontrakten. */
export const POI_GROUNDING_PROVIDER = "gemini-search-grounding" as const;

/**
 * Sentinel modellen skal svare med når den ikke finner noe om stedet.
 *
 * Bakgrunn (kalibrering 2026-08-12): uten dette svarer modellen med et
 * avslags-narrativ i førsteperson — «Jeg finner ingen informasjon om en park
 * ved navn X. Søkene indikerer at …» — som er adressert til oss, ikke til
 * boligkjøperen. Et kort slikt svar fanges av lengdeterskelen, men et langt
 * gjør det ikke. Sentinel gjør «ingen data» til et deterministisk utfall i
 * stedet for en lengde-heuristikk.
 */
export const NO_DATA_SENTINEL = "INGEN_DATA";

/**
 * Backstop for når modellen ignorerer sentinelen og svarer i eget navn likevel.
 * Fanger åpningsfraser, ikke enkeltord — «jeg» kan forekomme legitimt i et
 * sitat, mens «Jeg finner ingen» aldri er stedsinnhold.
 */
const REFUSAL_PATTERNS = [
  /\bjeg\s+(finner|fant|har\s+ikke\s+funnet|kan\s+ikke\s+finne)\b/i,
  /\bsøke(ne|t)\s+(indikerer|viser|tyder|gir)\b/i,
  /\bdet\s+finnes\s+ingen\s+(informasjon|opplysninger)\b/i,
  /\bfant\s+ingen\s+(informasjon|opplysninger|resultater)\b/i,
];

/** True hvis narrativet handler om søket i stedet for om stedet. */
export function looksLikeRefusal(narrative: string): boolean {
  const head = narrative.trim().slice(0, 400);
  return REFUSAL_PATTERNS.some((re) => re.test(head));
}

export interface PoiGroundingInput {
  id: string;
  name: string;
  address?: string;
  categoryName?: string;
  /**
   * Sted/område POI-et hører til (f.eks. "Inderøy" eller "Trondheim"). Uten
   * dette finner grounding-søket ofte et likelydende sted i et annet land —
   * navn alene er ikke unikt nok til å ankre søket.
   */
  areaHint?: string;
}

export type PoiGroundingResult =
  | { ok: true; generated: PoiGroundingGenerated }
  | { ok: false; outcome: PoiGroundingAttempt["outcome"]; reason: string };

export interface PoiQualityThresholds {
  minSourceCount: number;
  minCharCount: number;
  maxCharCount: number;
}

/**
 * STARTVERDIER — kalibreres empirisk i Unit 3 mot fordelingen på Sundsøyas 78
 * POI-er. Ikke behandle dem som endelige før dry-run-rapporten er sett.
 *
 * Begrunnelse for formen: to kilder er minimumsgrensen for «grounded» i noen
 * meningsfull forstand (én kilde er et referat), og 280 tegn er omtrent der en
 * intro + to punkter blir til noe annet enn en tom modal. Andreas' krav var
 * «ingen tynne modaler».
 */
export const DEFAULT_POI_QUALITY_THRESHOLDS: PoiQualityThresholds = {
  minSourceCount: 2,
  minCharCount: 280,
  maxCharCount: 1400,
};

/**
 * Ren funksjon — ingen API-kall. Ligger her nettopp for at tersklene kan
 * kalibreres og enhetstestes uten å brenne Gemini-kvote.
 */
export function evaluatePoiQualityGate(
  input: { narrative: string; sourceCount: number },
  thresholds: PoiQualityThresholds = DEFAULT_POI_QUALITY_THRESHOLDS,
): PoiQualityGate {
  const charCount = input.narrative.trim().length;
  const { sourceCount } = input;
  const reasons: string[] = [];

  if (sourceCount < thresholds.minSourceCount) {
    reasons.push(`for få kilder (${sourceCount} < ${thresholds.minSourceCount})`);
  }
  if (charCount < thresholds.minCharCount) {
    reasons.push(`for kort innhold (${charCount} < ${thresholds.minCharCount} tegn)`);
  }
  if (charCount > thresholds.maxCharCount) {
    reasons.push(`for langt innhold (${charCount} > ${thresholds.maxCharCount} tegn)`);
  }

  return {
    passed: reasons.length === 0,
    sourceCount,
    charCount,
    ...(reasons.length > 0 ? { reason: reasons.join("; ") } : {}),
  };
}

/**
 * Stedsskala-prompt. Redaksjonelle føringer er Andreas' etablerte preferanser:
 * beboer-perspektiv (målgruppa er boligkjøperen som blir beboer, ikke en
 * turist), faktaorientert framfor poetisk, presens framfor årstall og
 * historikk. Åpningstider og priser skal IKKE i narrativet — de kommer fra
 * DB-kolonnene (Places-fakta) og ville ellers råtne i teksten.
 */
export function buildPoiGroundingPrompt(poi: PoiGroundingInput): string {
  const identity = [poi.name, poi.address, poi.areaHint]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(", ");

  return [
    `Sted: ${identity}`,
    poi.categoryName ? `Kategori: ${poi.categoryName}` : "",
    "",
    "Oppgave: beskriv hva som faktisk finnes på dette stedet, for noen som vurderer å flytte til nabolaget rundt det.",
    "",
    "FORMAT:",
    "- Svar på norsk.",
    "- Først 2 setninger som sier hva stedet er og hva man bruker det til.",
    "- Deretter 3–5 punkter (markdown `- `) med konkrete ting som finnes der.",
    "- Totallengde 400–900 tegn. Aldri over 1100.",
    "- Skill intro og punktliste med tom linje.",
    "",
    "INNHOLD:",
    "- Skriv i presens om det som ER der nå. IKKE årstall, IKKE byggeår, IKKE historikk, IKKE «ble oppført i», IKKE «fra 1816», IKKE «stammer fra».",
    "  Nevn gjerne tingen, men uten datering: skriv «Muusbrua» — ikke «Muusbrua fra 1816».",
    "- Faktaorientert. IKKE poetisk stemningstekst («lukten av», «smaken av», «følger deg hjem»).",
    "- Beboer-perspektiv, ikke turist-perspektiv. IKKE «severdighet», «ting å gjøre», «lett tilgjengelig for besøkende».",
    "- IKKE åpningstider, priser, enkeltarrangementer eller sesongtilbud — de hentes separat og vil bli utdaterte.",
    "- IKKE generer URLer selv; siter kun fra Google-søk.",
    "- IKKE kjede- eller konseptomtale («konseptet fokuserer på lave priser», «kjeden er kjent for»). Skriv om DETTE stedet, ikke om merkevaren.",
    "- IKKE skriv om deg selv eller om søket ditt. Ingen «jeg finner», «søkene indikerer», «det ser ut til».",
    `- Finner du ikke konkrete opplysninger om nettopp dette stedet, svar med presis teksten ${NO_DATA_SENTINEL} og ingenting annet. Ikke forklar hvorfor, og ikke fyll ut med generiske setninger som kunne stått om hvilket som helst sted.`,
    "",
    "Eksempel på ønsket form:",
    '"""',
    "Muustrøparken er et åpent grøntområde langs Nidelva, midt mellom boligkvartalene på Bakklandet. Parken brukes til lufting, soling og uteopphold gjennom hele året.",
    "",
    "- Amfi i skrånende terreng, brukt til konserter og uteforestillinger",
    "- Flere skulpturer plassert langs gangveiene",
    "- Kvernhuset ved elvekanten",
    "- Grusbane og åpne plener",
    '"""',
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Genererer grounded innhold for ett POI.
 *
 * Kjeden: callGemini (som sanerer searchEntryPointHtml og kaster hvis den
 * mangler — ToS-krav) → resolveUrlsParallel (SSRF-guardet, gir reelle domener
 * bak Gemini-redirects) → kvalitetsport → Zod-validering mot lagringsskjemaet.
 *
 * Kvalitetsporten stopper IKKE returen: strykere returneres med
 * `qualityGate.passed = false` slik at de kan lagres. Uten lagrede strykere
 * ville hver kjøring re-generert de samme dårlige stedene med ny Gemini-kost,
 * og dekningsgraden ville bare eksistert i konsoll-output.
 */
export async function groundPoi(
  poi: PoiGroundingInput,
  options: {
    apiKey: string;
    timeoutMs?: number;
    signal?: AbortSignal;
    thresholds?: PoiQualityThresholds;
    now?: () => Date;
  },
): Promise<PoiGroundingResult> {
  const { apiKey, timeoutMs, signal, thresholds, now = () => new Date() } = options;

  if (!poi.name?.trim()) {
    return {
      ok: false,
      outcome: "error",
      reason: "POI mangler navn — kan ikke bygge prompt",
    };
  }

  let raw;
  try {
    raw = await callGemini(poi.name, {
      apiKey,
      timeoutMs,
      signal,
      prompt: buildPoiGroundingPrompt(poi),
    });
  } catch (err) {
    return {
      ok: false,
      outcome: "error",
      reason: err instanceof Error ? err.message : "ukjent Gemini-feil",
    };
  }

  // «Ingen data» er et eget utfall, ikke et kort narrativ. Sjekkes FØR
  // URL-resolving så vi ikke bruker nettverk på kilder vi forkaster.
  const narrativeHead = raw.narrative.trim();
  if (narrativeHead.startsWith(NO_DATA_SENTINEL) || narrativeHead === NO_DATA_SENTINEL) {
    return {
      ok: false,
      outcome: "no-data",
      reason: "Gemini fant ingen konkrete opplysninger om stedet",
    };
  }
  if (looksLikeRefusal(narrativeHead)) {
    return {
      ok: false,
      outcome: "refusal",
      reason: "Gemini svarte om søket i stedet for om stedet (avslags-narrativ)",
    };
  }

  // Resolve redirect-URLene til reelle domener. Feiler en resolve, beholder vi
  // redirect-URLen som url — kilden er fortsatt gyldig og klikkbar, vi mister
  // bare domene-pillen. Bedre enn å droppe kilden (ToS: kilder skal vises).
  const resolved = await resolveUrlsParallel(
    raw.rawSources.map((s) => s.redirectUrl),
  );
  const resolvedByInput = new Map(resolved.map((r) => [r.input, r.result]));

  const allSources: PoiGroundingSource[] = raw.rawSources.map((s) => {
    const result = resolvedByInput.get(s.redirectUrl);
    if (result && !(result instanceof Error)) {
      return {
        title: s.title,
        url: result.url,
        redirectUrl: s.redirectUrl,
        domain: result.domain,
      };
    }
    return {
      title: s.title,
      url: s.redirectUrl,
      redirectUrl: s.redirectUrl,
      domain: domainOf(s.redirectUrl),
    };
  });

  // Dedup på resolvet URL. Gemini siterer ofte samme side flere ganger (målt
  // 2026-08-12: visitinnherred.com tre ganger på ett POI). Uten dedup ville
  // kildelista i modalen se ut som gjentakelse, OG sourceCount ville blåst opp
  // kvalitetsporten — tre treff på én kilde er ikke tre kilder.
  const sources: PoiGroundingSource[] = [];
  const seenUrls = new Set<string>();
  for (const s of allSources) {
    if (seenUrls.has(s.url)) continue;
    seenUrls.add(s.url);
    sources.push(s);
  }

  const qualityGate = evaluatePoiQualityGate(
    { narrative: raw.narrative, sourceCount: sources.length },
    thresholds,
  );

  const candidate = {
    provider: POI_GROUNDING_PROVIDER,
    narrative: raw.narrative,
    sources,
    searchEntryPointHtml: raw.searchEntryPointHtml,
    searchQueries: raw.searchQueries,
    model: raw.model ?? GEMINI_MODEL,
    fetchedAt: now().toISOString(),
    qualityGate,
  };

  // Valider mot lagringsskjemaet FØR retur. Da kan scriptet aldri skrive noe
  // lesestien senere avviser — det ville vært et stille datatap.
  const parsed = PoiGroundingGeneratedSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      outcome: "error",
      reason: `generated-objektet validerte ikke: ${issue?.path.join(".") ?? ""} ${issue?.message ?? "ukjent"}`.trim(),
    };
  }

  return { ok: true, generated: parsed.data };
}
