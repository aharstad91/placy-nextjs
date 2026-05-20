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

export interface AudioTimings {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

export interface GenerateAudioResult {
  bytes: Buffer;
  voice: string;
  model: string;
  timings: AudioTimings;
}

/**
 * Kaller ElevenLabs text-to-speech /with-timestamps og returnerer MP3-buffer
 * + character-level alignment. Kaster Error med HTTP-status + body-snippet
 * ved feil — callere skal fange og kontekstualisere i sin Promise.allSettled-
 * handler. turbo_v2_5 returnerer alignment verifisert empirisk 2026-05-20.
 */
export async function generateAudio(
  params: GenerateAudioParams,
): Promise<GenerateAudioResult> {
  const voice = params.voiceId ?? ELEVENLABS_VOICE;
  const model = params.modelId ?? ELEVENLABS_MODEL;
  const languageCode = params.languageCode ?? ELEVENLABS_LANGUAGE_CODE;
  const outputFormat = params.outputFormat ?? ELEVENLABS_OUTPUT_FORMAT;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=${outputFormat}`;
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

  const json = (await res.json()) as {
    audio_base64?: string;
    alignment?: {
      characters?: string[];
      character_start_times_seconds?: number[];
      character_end_times_seconds?: number[];
    } | null;
  };

  if (!json.audio_base64) {
    throw new Error("ElevenLabs /with-timestamps: missing audio_base64");
  }
  if (
    !json.alignment ||
    !json.alignment.characters ||
    !json.alignment.character_start_times_seconds ||
    !json.alignment.character_end_times_seconds
  ) {
    throw new Error(
      "ElevenLabs /with-timestamps: missing alignment fields — model may not support timestamps",
    );
  }

  const bytes = Buffer.from(json.audio_base64, "base64");
  const timings: AudioTimings = {
    characters: json.alignment.characters,
    characterStartTimesSeconds: json.alignment.character_start_times_seconds,
    characterEndTimesSeconds: json.alignment.character_end_times_seconds,
  };
  return { bytes, voice, model, timings };
}
