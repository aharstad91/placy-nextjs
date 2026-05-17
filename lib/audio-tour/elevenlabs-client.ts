/**
 * ElevenLabs TTS-klient for audio-tour-pipeline (Steg 8c.2).
 *
 * Konstanter (Daniel-voice + multilingual_v2 + voice_settings) er
 * validert via scripts/elevenlabs-validation.ts. Endring her krever
 * `reportConfig.audioVersion`-bump for å trigge re-gen av alle spor.
 */

export const ELEVENLABS_VOICE_DANIEL = "onwK4e9ZLuTAKqWW03F9";
export const ELEVENLABS_MODEL = "eleven_multilingual_v2";
export const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";

export const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
} as const;

export interface GenerateAudioParams {
  apiKey: string;
  text: string;
  voiceId?: string;
  modelId?: string;
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
  const voice = params.voiceId ?? ELEVENLABS_VOICE_DANIEL;
  const model = params.modelId ?? ELEVENLABS_MODEL;
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
