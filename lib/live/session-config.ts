/**
 * Sesjonsoppsettet for GPT-Live-1 (2026-09-13).
 *
 * To modeller, to instrukser: STEMMEN (`gpt-live-1`) eier lyd og samtaleflyt og
 * får en kort instruks; BACKENDEN (Responses) eier fakta, verktøyvalg og
 * resonnering og får den lange. Ingen Realtime-felt hører hjemme her – Live
 * avviser ukjente felt, og WebRTC forhandler lydformatet selv.
 */
import type { LiveFunctionTool } from "@/lib/live/types";

const EFFORTS = new Set(["none", "minimal", "low", "medium", "high", "xhigh"]);

export const liveModel = () => process.env.OPENAI_BOARD_LIVE_MODEL || "gpt-live-1";
export const backendModel = () => process.env.OPENAI_BOARD_BACKEND_MODEL || "gpt-5.6-terra";
/**
 * Stemmevalget leses fra env så en lyttetest kan bytte stemme med omstart, ikke
 * nytt bygg. Standard `vesper` (Andreas, 2026-09-13): Realtime-stemmene er lagt
 * bort sammen med Realtime-API-et; lyttetesten avgjør om vesper holder norsk.
 */
export const liveVoice = () => process.env.OPENAI_BOARD_LIVE_VOICE || "vesper";

export function backendEffort(): string {
  const effort = process.env.OPENAI_BOARD_BACKEND_EFFORT || "low";
  // Skrivefeil i env skal stoppe oppstarten, ikke gi en stille annen kostnad.
  if (!EFFORTS.has(effort)) throw new Error(`Ukjent OPENAI_BOARD_BACKEND_EFFORT: ${effort}`);
  return effort;
}

export function liveSessionConfig(voiceInstructions: string, backendInstructions: string, tools: LiveFunctionTool[]) {
  const model = liveModel();
  // Ingen stille fallback til Realtime: en annen modell her ville byttet protokoll
  // uten at noe annet i koden visste det.
  if (!model.startsWith("gpt-live")) throw new Error(`OPENAI_BOARD_LIVE_MODEL må være en Live-modell, ikke ${model}.`);
  return {
    model,
    instructions: voiceInstructions,
    audio: { output: { voice: liveVoice() } },
    delegation: {
      type: "responses",
      responses: {
        model: backendModel(),
        instructions: backendInstructions,
        tools,
        tool_choice: "auto",
        parallel_tool_calls: true,
        reasoning: { effort: backendEffort() },
        max_output_tokens: 700,
      },
    },
  };
}
