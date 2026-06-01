/**
 * Pure functions for audio-tour-manus-pipeline (Steg 8c.1).
 *
 * Holdes separat fra scripts/audio-manus-write.ts slik at de kan testes
 * uten Anthropic- eller Supabase-side-effekter.
 */

import type {
  ReportConfig,
  ReportThemeConfig,
  ReportThemeGrounding,
} from "../types";
import type { TrackKind } from "./manus-prompt";

export const MIN_WORDS = 35;
export const MAX_WORDS = 90;

/**
 * Ord/uttrykk Curator-voice unngår. Brukes som post-hoc-validator av
 * Claude-output før vi PATCH-er manus til DB.
 */
export const BANNED_WORDS_RX: RegExp[] = [
  /\bfantastisk\b/i,
  /\butrolig\b/i,
  /\bdu vil elske\b/i,
  /\bbest i byen\b/i,
  /\bhidden gem\b/i,
  /\bmust-visit\b/i,
  /\binstagram-worthy\b/i,
  /\bskjult perle\b/i,
  /\bsjarmerende\b/i,
  /\bkoselig\b/i,
  /\bhyggelig\b/i,
  /\bfin atmosfære\b/i,
  /\bduftende oase\b/i,
];

export interface BuildTrackInput {
  /** "home" eller theme.id. Brukes som DB-nøkkel + log-id. */
  key: string;
  kind: TrackKind;
  /** Vist navn (areaName for home, theme.name for category). */
  label: string;
  /** Områdets navn — passes til prompten for begge spor-typer. */
  areaName: string;
  /** Sammenflettet råinput Claude destillerer. */
  inputText: string;
  categoryName?: string;
  prevTrackSummary?: string;
  hasExistingManus: boolean;
}

/**
 * Bygger spor-rekkefølgen: Hjem først, så hver kategori i themes[]-rekkefølge.
 * Filtrerer ut spor som mangler tilstrekkelig input-tekst (omit-on-empty).
 */
export function buildTrackInputs(
  reportConfig: ReportConfig,
  areaName: string,
): BuildTrackInput[] {
  const inputs: BuildTrackInput[] = [];

  if (reportConfig.heroIntro && reportConfig.heroIntro.trim().length > 0) {
    inputs.push({
      key: "home",
      kind: "home",
      label: areaName,
      areaName,
      inputText: reportConfig.heroIntro,
      hasExistingManus: Boolean(reportConfig.heroAudio?.manus),
    });
  }

  const themes = reportConfig.themes ?? [];
  let prevLabel = areaName;
  for (const theme of themes) {
    const themeInput = buildThemeInputText(theme);
    if (!themeInput) continue;
    inputs.push({
      key: theme.id,
      kind: "category",
      label: theme.name,
      areaName,
      inputText: themeInput,
      categoryName: theme.name,
      prevTrackSummary: prevLabel,
      hasExistingManus: Boolean(theme.audio?.manus),
    });
    prevLabel = theme.name;
  }

  return inputs;
}

function buildThemeInputText(theme: ReportThemeConfig): string | null {
  const g = theme.grounding;
  const groundingText = pickCuratedNarrative(g) ?? g?.narrative ?? "";
  const parts = [
    theme.leadText?.trim(),
    theme.bridgeText?.trim(),
    groundingText.trim(),
  ].filter((s): s is string => Boolean(s && s.length > 0));
  if (parts.length === 0) return null;
  return parts.join("\n\n");
}

function pickCuratedNarrative(
  g: ReportThemeGrounding | undefined,
): string | undefined {
  if (!g) return undefined;
  if (g.curatedNarrative && g.curatedNarrative.trim().length > 0) {
    return g.curatedNarrative;
  }
  return undefined;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function findBannedWords(text: string): string[] {
  const hits: string[] = [];
  for (const rx of BANNED_WORDS_RX) {
    const m = text.match(rx);
    if (m) hits.push(m[0]);
  }
  return hits;
}

export interface ValidateManusResult {
  ok: boolean;
  reason?: string;
  wordCount: number;
  banned: string[];
}

export function validateManus(text: string): ValidateManusResult {
  const wordCount = countWords(text);
  const banned = findBannedWords(text);
  if (wordCount < MIN_WORDS) {
    return {
      ok: false,
      reason: `for kort (${wordCount} ord, min ${MIN_WORDS})`,
      wordCount,
      banned,
    };
  }
  if (wordCount > MAX_WORDS) {
    return {
      ok: false,
      reason: `for langt (${wordCount} ord, max ${MAX_WORDS})`,
      wordCount,
      banned,
    };
  }
  if (banned.length > 0) {
    return {
      ok: false,
      reason: `banned-words: ${banned.join(", ")}`,
      wordCount,
      banned,
    };
  }
  return { ok: true, wordCount, banned };
}

/** Fjerner ledende/etterfølgende anførselstegn fra Claude-output. */
export function stripWrappingQuotes(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1).trim();
  }
  return t;
}
