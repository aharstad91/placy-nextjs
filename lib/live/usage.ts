/** Published USD tariff; calculations are estimates, never invoice amounts. */
export const LIVE_VOICE_USD_PER_MINUTE = 0.05;
export const VOICE_RATE_VERSION = 'openai-2026-09-16-v1';
export const VOICE_RATE_SNAPSHOT = {
  version: VOICE_RATE_VERSION,
  voiceUsdPerMinute: LIVE_VOICE_USD_PER_MINUTE,
  backendUsdPerMillion: {
    'gpt-5.6-terra': [2, 0.2, 12],
    'gpt-5.6-luna': [0.2, 0.02, 1.2],
    'gpt-5.6-sol': [4, 0.4, 20],
  },
  terraMaxVerifiedInputTokens: 272_000,
} as const;

export interface BackendTokenUsage {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number };
}

/** Return only allowlisted numeric evidence. Never pass provider response bodies on. */
export function normalizeBackendUsage(value: unknown): BackendTokenUsage | null {
  if (!value || typeof value !== 'object') return null;
  const u = value as Record<string, unknown>;
  const details = u.input_tokens_details;
  if (details !== undefined && (!details || typeof details !== 'object' || Array.isArray(details))) return null;
  const rawCached = (details as Record<string, unknown> | undefined)?.cached_tokens;
  const cached = rawCached === undefined ? 0 : rawCached;
  if (![u.input_tokens, u.output_tokens, cached].every(v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0)) return null;
  if ((cached as number) > (u.input_tokens as number)) return null;
  return { input_tokens: u.input_tokens as number, output_tokens: u.output_tokens as number,
    input_tokens_details: { cached_tokens: cached as number } };
}

export function liveVoiceCostUsd(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid voice duration');
  return seconds / 60 * LIVE_VOICE_USD_PER_MINUTE;
}

/** null means unknown/malformed evidence; callers must mark totals incomplete. */
export function backendCostUsd(model: string, value: BackendTokenUsage): number | null {
  const match = /^(gpt-5\.6-(?:terra|luna|sol))(?:-(\d{4}-\d{2}-\d{2}))?$/.exec(model);
  if (!match) return null;
  if (match[2]) {
    const date = new Date(`${match[2]}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== match[2]) return null;
  }
  const usage = normalizeBackendUsage(value);
  if (!usage || (match[1] === 'gpt-5.6-terra' && usage.input_tokens > 272_000)) return null;
  const rates = VOICE_RATE_SNAPSHOT.backendUsdPerMillion[match[1] as keyof typeof VOICE_RATE_SNAPSHOT.backendUsdPerMillion];
  const cached = usage.input_tokens_details?.cached_tokens ?? 0;
  return ((usage.input_tokens - cached) * rates[0] + cached * rates[1] + usage.output_tokens * rates[2]) / 1_000_000;
}
