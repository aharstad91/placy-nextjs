import { realtimeModel } from "@/lib/realtime/session-config";
import { boligTools, BOLIG_INSTRUCTIONS } from "@/lib/prototype/bolig/knowledge";
import { TOPICS, type BoligFixture } from "@/lib/prototype/bolig/contract";

export const BOLIG_SCOPE = "bolig";

/** Kort, stabil kontekst om boligen; steder og fakta hentes via verktøy. */
export function boligInstructions(fixture: BoligFixture) {
  return `${BOLIG_INSTRUCTIONS}

Boligen (fiktiv eksempelbolig): ${fixture.house.title}, ${fixture.house.addressLabel}. ${fixture.house.intro}
Kategorier brukeren kan trykke på (data): ${JSON.stringify(TOPICS.map(t => ({ id: t.id, name: t.label })))}`;
}

export function boligSessionConfig(fixture: BoligFixture) {
  return {
    type: "realtime",
    model: realtimeModel(),
    instructions: boligInstructions(fixture),
    tools: boligTools,
    tool_choice: "auto",
    output_modalities: ["audio"],
    max_output_tokens: 600,
    truncation: { type: "retention_ratio", retention_ratio: 0.7, token_limits: { post_instructions: 2500 } },
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe", language: "no" },
        turn_detection: { type: "semantic_vad", eagerness: "medium", interrupt_response: true, create_response: true },
      },
      // Ash beholdes fra forrige løp; stemmevalg er ikke eksperimentet her.
      output: { voice: "ash" },
    },
  };
}

export const BOLIG_GREETING_INSTRUCTIONS = "Hils kort på norsk som Placy. Si at du kan hjelpe brukeren å bli kjent med området rundt boligen, og spør hva som er viktig i hverdagen, for eksempel dagligvare, barn og oppvekst eller turmuligheter. Ikke kall verktøy før brukeren har sagt hva hen vil vite.";
