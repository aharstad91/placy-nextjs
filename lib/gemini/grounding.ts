/**
 * Core Gemini API-kall med google_search-grounding. Brukes build-time av
 * scripts/gemini-grounding.ts — aldri runtime. Placy-regel: ingen runtime LLM.
 *
 * Returnerer "raw" resultat med uløste redirect-URLer — CLI-scriptet kjører
 * resolveUrlsParallel for å få faktiske domener.
 */

import {
  GeminiResponseSchema,
  type GroundingMetadata,
} from "./types";
import { sanitizeSearchEntryPointHtml } from "./sanitize";

export const GEMINI_MODEL = "gemini-2.5-flash" as const;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface CallGeminiOptions {
  apiKey: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /**
   * Ferdigbygd prompt som erstatter den tema-skala `buildPrompt()` helt. Satt av
   * per-POI-grounding (lib/gemini/poi-grounding.ts), som trenger stedsskala i
   * stedet for strøksskala. Når den er satt, brukes `userQuery` kun i
   * feilmeldinger. Finnes for at det skal være ÉN API-klient, ÉN
   * nøkkelhåndtering og ÉN sanerings-/timeout-kjede — ikke to.
   */
  prompt?: string;
}

export interface RawGeminiSource {
  title: string;
  redirectUrl: string;
}

export interface CallGeminiResult {
  narrative: string;
  rawSources: RawGeminiSource[];
  searchEntryPointHtml: string;
  searchQueries: string[];
  model: typeof GEMINI_MODEL;
}

function buildPrompt(userQuery: string): string {
  return [
    `Tema: ${userQuery}`,
    "",
    "FORMAT (VIKTIGST):",
    "- Svar på norsk i KORT, kompakt form. TOTALLENGDE: ca. 600–850 tegn (inkl. mellomrom). Aldri over 950.",
    "- 2–3 korte avsnitt, maks 3 setninger per avsnitt. Luftig og skannbar.",
    "- Skill avsnitt med dobbel newline (tom linje mellom avsnitt).",
    "- Prioriter informasjonstetthet — hvert ord skal telle. Kutt fyllord og gjentakelser.",
    "- Bruk punktlister (markdown `- `) når det passer bedre enn prosa (oppramsing av navn/alternativer).",
    "",
    "Innhold:",
    "- Fokuser på varige fakta som vil være gyldige 2+ år fremover.",
    "- IKKE inkluder priser, åpningstider, spesifikke events, eller sesongbaserte tilbud.",
    "- IKKE generer URLer selv; siter kun fra Google-søk.",
    "- IKKE skriv intro-setninger som \"Midtbyen tilbyr et variert utvalg av X\" — gå rett på innholdet.",
    "",
    "Eksempel på ØNSKET format (merk kortheten):",
    "\"\"\"",
    "Midtbyen har flere store treningssentre. 3T Midtbyen tilbyr gruppetrening, squash og basseng, mens Fresh Fitness er kjent for nyoppussede lokaler og friveksts-områder.",
    "",
    "For mer spesialisert trening: Trondheim Performance Center (HYROX, HIIT) og Impulse Midtbyen. På velværefronten utmerker Britannia Spa seg med luksuriøs avdeling ved Britannia Hotell.",
    "\"\"\"",
  ].join("\n");
}

/**
 * Normaliser punktmarkører til markdown `- `.
 *
 * Gemini bruker ofte en-dash («–»), em-dash eller «•» som punktmarkør selv når
 * prompten eksplisitt ber om `- `. Uten normalisering faller listen gjennom
 * markdown-sjekken i splitLongParagraphs, blir setningssplittet i stedet, og
 * flere punkter havner på samme linje. Målt på reell output 2026-08-12
 * (Muustrøparken: fem punkter kollapset til to linjer).
 *
 * Treffer kun linjestart etterfulgt av whitespace, så tankestrek brukt midt i
 * en setning røres ikke.
 */
function normalizeBulletMarkers(text: string): string {
  return text.replace(/^[ \t]*[–—•·]\s+/gm, "- ");
}

/**
 * Fallback: splitt avsnitt som er >3 setninger. Gemini ignorerer ofte eksplisitt
 * "MAKS 3 setninger"-instruksjon og returnerer én lang blokk. Denne garanterer
 * lesbart resultat uavhengig av modellens output.
 */
export function splitLongParagraphs(narrative: string): string {
  const paragraphs = normalizeBulletMarkers(narrative).split(/\n\n+/);
  const result: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Hopp over markdown-lister — de er allerede strukturert
    if (/^\s*[-*+]\s/m.test(trimmed) || /^\s*\d+\./m.test(trimmed)) {
      result.push(trimmed);
      continue;
    }

    const sentences = splitSentences(trimmed);
    if (sentences.length <= 3) {
      result.push(trimmed);
      continue;
    }
    // 4–6 setninger → 2 chunks. 7+ → 3 chunks. MAX 3 setninger per chunk.
    const chunkCount = sentences.length <= 6 ? 2 : 3;
    const perChunk = Math.ceil(sentences.length / chunkCount);
    for (let i = 0; i < sentences.length; i += perChunk) {
      const chunk = sentences.slice(i, i + perChunk).join(" ").trim();
      if (chunk) result.push(chunk);
    }
  }

  return result.join("\n\n");
}

/**
 * Splitt tekst på setningsgrense. Beskytter vanlige norske forkortelser fra
 * å bli splittet på punktum inne i forkortelsen (f.eks. "f.eks." → ikke splitt).
 */
function splitSentences(text: string): string[] {
  const abbreviations = [
    "f.eks",
    "bl.a",
    "dvs",
    "mv",
    "osv",
    "ca",
    "nr",
    "jf",
    "kr",
    "hhv",
    "ca",
    "pga",
  ];
  const placeholder = "\u0001";
  let protectedText = text;
  for (const abbr of abbreviations) {
    const re = new RegExp(
      `\\b${abbr.replace(/\./g, "\\.")}\\.`,
      "gi",
    );
    protectedText = protectedText.replace(re, (m) =>
      m.replace(/\./g, placeholder),
    );
  }
  const parts = protectedText.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  if (!parts) return [text];
  return parts
    .map((s) => s.replace(new RegExp(placeholder, "g"), ".").trim())
    .filter(Boolean);
}

/**
 * Kast ved uventet/tomt svar. Aldri returnér delvis resultat — CLI håndterer
 * per-kategori-feil via Promise.allSettled.
 */
export async function callGemini(
  userQuery: string,
  options: CallGeminiOptions,
): Promise<CallGeminiResult> {
  const { apiKey, timeoutMs = 30_000, signal, prompt } = options;
  if (!apiKey) throw new Error("Gemini API key missing");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Pipe external signal → internal controller (for orchestrator cancels)
  const externalAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", externalAbort);
  }

  const body = {
    contents: [{ parts: [{ text: prompt ?? buildPrompt(userQuery) }] }],
    tools: [{ google_search: {} }],
  };

  let res: Response;
  try {
    res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", externalAbort);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${text.slice(0, 500)}`);
  }

  const json = (await res.json()) as unknown;
  const parsed = GeminiResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `Gemini response shape invalid: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    );
  }

  const candidate = parsed.data.candidates[0];
  const rawNarrative = candidate.content.parts
    .map((p) => p.text ?? "")
    .join("")
    .trim();

  if (!rawNarrative) {
    throw new Error("Gemini returned empty narrative");
  }

  // Splitt lange avsnitt — Gemini respekterer ikke alltid "MAKS 3 setninger"
  const narrative = splitLongParagraphs(rawNarrative);

  const grounding: GroundingMetadata | undefined = candidate.groundingMetadata;
  if (!grounding) {
    throw new Error("Gemini response missing groundingMetadata — grounding disabled?");
  }

  // searchEntryPoint.renderedContent er Google ToS-påkrevd — uten den må vi
  // avvise hele kategorien (CLI konverterer til omit).
  const searchEntryPointHtml = sanitizeSearchEntryPointHtml(
    grounding.searchEntryPoint.renderedContent,
  );
  if (!searchEntryPointHtml) {
    throw new Error("Gemini searchEntryPoint rendered empty after sanitize");
  }

  const rawSources: RawGeminiSource[] = grounding.groundingChunks
    .filter((c): c is { web: { uri: string; title?: string } } => Boolean(c.web))
    .map((c) => ({
      title: c.web.title ?? c.web.uri,
      redirectUrl: c.web.uri,
    }));

  return {
    narrative,
    rawSources,
    searchEntryPointHtml,
    searchQueries: grounding.webSearchQueries,
    model: GEMINI_MODEL,
  };
}
