/**
 * ElevenLabs native-norsk-stemme-validering (Creator-tier).
 *
 * Tester 4 toppkandidater fra Voice Library (norsk-talende) på faktisk
 * Hjem-manus for StasjonsKvartalet. Brukeren lytter og velger; valgt
 * voice_id settes deretter som ELEVENLABS_VOICE i
 * lib/audio-tour/elevenlabs-client.ts og audioVersion bumpes.
 *
 * Erstatter scripts/elevenlabs-validation.ts (testet engelsktrente
 * premade-stemmer på multilingual_v2; Daniel ble valgt som baseline).
 *
 * Kjøres: npx tsx scripts/elevenlabs-norsk-validation.ts
 */

import { config } from "dotenv";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("[fail] ELEVENLABS_API_KEY mangler i .env.local");
  process.exit(1);
}

const MANUS_PATH = resolve(
  process.cwd(),
  ".audio-staging/banenor-eiendom_stasjonskvartalet/home.manus.md",
);
const PITCH_TEXT = readFileSync(MANUS_PATH, "utf8").trim();

// eleven_turbo_v2_5 + language_code:"no" er oppskriften UI-spilleren bruker
// for "Norwegian preview". multilingual_v2 og eleven_v3 ga svensk/dansk-fallback.
const MODEL_ID = "eleven_turbo_v2_5";

const VOICES = [
  {
    name: "emma",
    id: "b3jcIbyC3BSnaRu8avEk",
    description: "Bergen female, shy and friendly (10k cloned)",
  },
  {
    name: "olaf",
    id: "xF681s0UeE04gsf0mVsJ",
    description: "Oslo middle-aged male, long-form content (15k cloned)",
  },
  {
    name: "oyvind",
    id: "nhvaqgRyAq6BmFs3WcdX",
    description: "Deep, calm, trustworthy (5k cloned) — megler-tillit",
  },
  {
    name: "sebastian",
    id: "4kCDY3HJwvO7Zp3con83",
    description: "Warm & professional, narration/podcast (6k cloned)",
  },
  {
    name: "mia-starset",
    id: "uNsWM1StCcpydKYOjKyu",
    description: "Oslo female, clear and bright (23k cloned)",
  },
];

// ElevenLabs sin "Norwegian"-dialekt i UI-et trigges via language_code-param.
// Uten denne faller modellen tilbake til svensk/dansk-fonetikk uansett stemme.
const LANGUAGE_CODE = "no";

const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

async function generateVoice(
  voice: (typeof VOICES)[number],
  outDir: string,
) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice.id}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: PITCH_TEXT,
      model_id: MODEL_ID,
      language_code: LANGUAGE_CODE,
      voice_settings: VOICE_SETTINGS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[${voice.name}] ElevenLabs ${res.status}: ${body.slice(0, 300)}`,
    );
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = resolve(outDir, `${voice.name}-turbo.mp3`);
  writeFileSync(outPath, buf);
  return { path: outPath, bytes: buf.length };
}

async function main() {
  const outDir = resolve(process.cwd(), "tmp/elevenlabs-norsk-validation");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log("[info] Faktisk Hjem-manus for StasjonsKvartalet:");
  console.log(`  "${PITCH_TEXT.slice(0, 140)}..."`);
  console.log();
  console.log(`[info] Model: ${MODEL_ID}`);
  console.log(`[info] Lagring: ${outDir}/`);
  console.log();

  for (const voice of VOICES) {
    process.stdout.write(`[gen] ${voice.name.padEnd(14)} ... `);
    try {
      const { bytes } = await generateVoice(voice, outDir);
      console.log(`✓ ${(bytes / 1024).toFixed(0)} KB`);
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
    }
  }

  console.log();
  console.log("[done] Lytt og velg:");
  console.log(`  open ${outDir}`);
  console.log();
  console.log("Vurder per stemme:");
  console.log("  - Uttale: 'StasjonsKvartalet', 'Brattørkaia', 'TMV-kaia',");
  console.log("    'Midtbyen', 'Munkegata', 'Trondheim'");
  console.log("  - Megler-energi: trygg, varm, troverdig — ikke audiobook-flat");
  console.log("  - Tempo og naturlige pauser");
  console.log("  - 'Audio-guide'-feeling vs robot");
  console.log();
  console.log("Si fra hvilken jeg skal sette som default + bump audioVersion.");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
