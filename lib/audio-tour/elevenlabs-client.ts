/**
 * ElevenLabs TTS-klient for audio-tour-pipeline.
 *
 * Voice: Erik (native norsk, mannlig 40-tallet, conversational). Modell:
 * eleven_turbo_v2_5 + language_code "no" — oppskriften UI-spilleren bruker
 * for "Norwegian preview". multilingual_v2 og eleven_v3 ga svensk/dansk-
 * fallback uansett voice clone. Validert via scripts/elevenlabs-norsk-
 * validation.ts. Endring her krever `reportConfig.audioVersion`-bump for
 * å trigge re-gen av alle spor.
 */

export const ELEVENLABS_VOICE = "EpYEY8MWJrUGskHBoNMA";
export const ELEVENLABS_VOICE_NAME = "Erik";
export const ELEVENLABS_MODEL = "eleven_turbo_v2_5";
export const ELEVENLABS_LANGUAGE_CODE = "no";
export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

export const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.75,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
} as const;

export interface GenerateAudioParams {
  apiKey: string;
  text: string;
  voiceId?: string;
  modelId?: string;
  languageCode?: string;
  outputFormat?: string;
}

export interface GenerateAudioResult {
  bytes: Buffer;
  voice: string;
  model: string;
}

/**
 * Kaller ElevenLabs text-to-speech og returnerer MP3-buffer. Kaster
 * Error med HTTP-status + body-snippet ved feil — callere skal fange
 * og kontekstualisere i sin Promise.allSettled-handler.
 */
export async function generateAudio(
  params: GenerateAudioParams,
): Promise<GenerateAudioResult> {
  const voice = params.voiceId ?? ELEVENLABS_VOICE;
  const model = params.modelId ?? ELEVENLABS_MODEL;
  const languageCode = params.languageCode ?? ELEVENLABS_LANGUAGE_CODE;
  const outputFormat = params.outputFormat ?? ELEVENLABS_OUTPUT_FORMAT;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=${outputFormat}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": params.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      model_id: model,
      language_code: languageCode,
      voice_settings: ELEVENLABS_VOICE_SETTINGS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, voice, model };
}
