/**
 * ElevenLabs norsk-stemme-validering for audio-tour-pilot.
 *
 * Genererer 3 prøver av samme Hjem-pitch på Spro Havn / Stasjonskvartalet
 * for å validere norsk uttale på stedsnavn ("StasjonsKvartalet",
 * "Brattørkaia", "TMV-kaia", "Solsiden", "Bispehaugen", "Nidelva", "Midtbyen").
 *
 * Brukes som blocker-resolve for docs/brainstorms/2026-05-16-megler-pitch-
 * audio-tour-brainstorm.md (Resolve-Before-Planning #1).
 *
 * Kjøres: npx tsx scripts/elevenlabs-validation.ts
 */

import "dotenv/config";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error(
    "[fail] ELEVENLABS_API_KEY mangler i .env.local. Legg til:\n" +
      '  ELEVENLABS_API_KEY="..."'
  );
  process.exit(1);
}

const PITCH_TEXT =
  "StasjonsKvartalet ligger på kaifronten mellom Brattørkaia og TMV-kaia, " +
  "midt i Trondheim sentrum. Togstasjonen er rett utenfor døren, og Midtbyen " +
  "— med Solsiden, Bispehaugen og Nidelva — nås på ti minutter til fots. " +
  "Et nabolag som forener urban puls med fjordnærhet.";

const MODEL_ID = "eleven_multilingual_v2";

const VOICES = [
  { name: "sarah", id: "EXAVITQu4vr4xnSDxMaL", description: "varm kvinnelig, voksen (premade)" },
  { name: "daniel", id: "onwK4e9ZLuTAKqWW03F9", description: "varm mannlig, voksen (premade)" },
  { name: "george", id: "JBFqnCBsd6RMkjVDRZzb", description: "eldre mannlig, autoritativ-varm (premade)" },
];

const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

async function generateVoice(voice: typeof VOICES[number], outDir: string) {
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
      voice_settings: VOICE_SETTINGS,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[${voice.name}] ElevenLabs ${res.status}: ${body.slice(0, 300)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = resolve(outDir, `${voice.name}.mp3`);
  writeFileSync(outPath, buf);
  return { path: outPath, bytes: buf.length };
}

async function main() {
  const outDir = resolve(process.cwd(), "tmp/elevenlabs-validation");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  console.log("[info] Pitch-tekst (~50 ord):");
  console.log(`  "${PITCH_TEXT}"`);
  console.log("");
  console.log(`[info] Model: ${MODEL_ID}`);
  console.log(`[info] Lagring: ${outDir}/`);
  console.log("");

  for (const voice of VOICES) {
    process.stdout.write(`[gen] ${voice.name.padEnd(10)} (${voice.description}) ... `);
    try {
      const { path, bytes } = await generateVoice(voice, outDir);
      console.log(`✓ ${(bytes / 1024).toFixed(0)} KB → ${path}`);
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
    }
  }

  console.log("");
  console.log("[done] Åpne hver fil i Finder/Music for å lytte:");
  console.log(`  open ${outDir}`);
  console.log("");
  console.log("Vurder per stemme:");
  console.log("  - Uttale på 'StasjonsKvartalet', 'Brattørkaia', 'TMV-kaia',");
  console.log("    'Solsiden', 'Bispehaugen', 'Nidelva', 'Midtbyen'");
  console.log("  - Tonale aksenter (Trondheim-flate vs Oslo-aksent vs robotic)");
  console.log("  - Tempo og naturlige pauser");
  console.log("  - Total 'audio-guide'-feeling vs 'tts-roboter'-feeling");
}

main().catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
