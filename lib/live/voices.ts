/** Built-in GPT-Live voices, verified against OpenAI API reference 2026-09-14.
 * https://developers.openai.com/api/reference/typescript/resources/live
 */
export const LIVE_VOICES = [
  "alloy", "ash", "ballad", "beacon", "bossa", "cedar", "cinder", "coral",
  "delta", "echo", "gleam", "marin", "meridian", "quartz", "ripple", "sage",
  "shimmer", "stone", "tempo", "verse", "vesper", "willow",
] as const;
export type LiveVoice = typeof LIVE_VOICES[number];
