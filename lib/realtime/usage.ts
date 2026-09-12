// USD per million tokens, OpenAI model pages checked 2026-09-12.
// This estimate covers Realtime responses only; input transcription is separate.
export interface RealtimeTokenUsage {
  input_tokens: number;
  output_tokens: number;
  input_token_details?: { text_tokens?: number; audio_tokens?: number; cached_tokens?: number; cached_tokens_details?: { text_tokens?: number; audio_tokens?: number } };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
}
export function realtimeCost(model: string, usage: RealtimeTokenUsage): number | null {
  const rates = model === "gpt-realtime-2.1-mini" ? [0.6, 0.06, 10, 0.3, 2.4, 20]
    : model === "gpt-realtime-2.1" ? [4, 0.4, 32, 0.4, 24, 64] : null;
  const input = usage.input_token_details;
  const output = usage.output_token_details;
  if (!rates || !input || !output || ((input.cached_tokens ?? 0) > 0 && !input.cached_tokens_details)) return null;
  const audio = input.audio_tokens ?? 0;
  const text = input.text_tokens ?? Math.max(0, usage.input_tokens - audio);
  const cachedText = input.cached_tokens_details?.text_tokens ?? 0;
  const cachedAudio = input.cached_tokens_details?.audio_tokens ?? 0;
  const outputAudio = output.audio_tokens ?? 0;
  // Output total also includes reasoning tokens; these are billed as text.
  const outputText = Math.max(output.text_tokens ?? 0, usage.output_tokens - outputAudio);
  return (Math.max(0, text - cachedText) * rates[0] + cachedText * rates[1]
    + Math.max(0, audio - cachedAudio) * rates[2] + cachedAudio * rates[3]
    + outputText * rates[4] + outputAudio * rates[5]) / 1_000_000;
}
