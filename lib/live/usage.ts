/**
 * Kostnadsestimat for Live-banen. To regnskap som IKKE kan slås sammen før til
 * slutt: stemmen betales per sekund samtale, backenden per token.
 *
 * Priser lest fra OpenAIs modellsider 2026-09-13. Realtime-mini-prisene gjelder
 * ikke her.
 */
export const LIVE_VOICE_USD_PER_MINUTE = 0.05;

/** USD per million tokens: [inn, bufret inn, ut]. Nøkkelen matcher modellnavnets prefiks. */
const BACKEND_RATES: Array<[string, [number, number, number]]> = [
  ['gpt-5.6-terra', [2, 0.2, 12]],
  ['gpt-5.6-luna', [0.2, 0.02, 1.2]],
  ['gpt-5.6-sol', [4, 0.4, 20]],
];

export interface BackendTokenUsage {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number };
}

export function liveVoiceCostUsd(seconds: number): number {
  return Math.max(0, seconds) / 60 * LIVE_VOICE_USD_PER_MINUTE;
}

/** null = ukjent modell; da er totalen ufullstendig og skal merkes slik. */
export function backendCostUsd(model: string, usage: BackendTokenUsage): number | null {
  // Datostemplede modellnavn (…-2026-09-01) deler prisliste med grunnmodellen.
  const rates = BACKEND_RATES.find(([name]) => model.startsWith(name))?.[1];
  if (!rates) return null;
  const cached = Math.min(usage.input_tokens_details?.cached_tokens ?? 0, usage.input_tokens);
  return ((usage.input_tokens - cached) * rates[0] + cached * rates[1] + usage.output_tokens * rates[2]) / 1_000_000;
}
