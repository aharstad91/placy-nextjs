#!/usr/bin/env npx tsx
/**
 * voiceover-reels-barn-oppvekst — Reels-versjon-manus for barn-oppvekst-kategorien.
 * Erik / turbo_v2_5. Beboer-perspektiv, fortellings-format, livsfase-akse
 * (småbarn → videregående) + parker som "et halvt dusin" (mengde framfor liste).
 */

import { config } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateAudio } from "../lib/audio-tour/elevenlabs-client";

config({ path: path.resolve(process.cwd(), ".env.local") });

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Mangler ELEVENLABS_API_KEY i .env.local");
  process.exit(1);
}

const MANUS = [
  "Nærmeste barnehage i Midtbyen er fem minutters gange, og det er mange private og offentlige barnehager spredt rundt i sentrum.",
  "Stasjonskvartalet sogner til Bispehaugen barneskole fra første til syvende trinn.",
  "For ungdomsskole med trinn åtte til tiende, er det Rosenborg skole som tar imot elevene.",
  "For videregående skole er det flere av dem som ligger i selve Midtbyen, som for eksempel Katedralskolen.",
  "Trondheim er kjent for å være en studentby, og det av god grunn.",
  "Tilgang på høyskoler og universitet er stor, og mange av disse er i nærheten, enten via gange eller med en kort sykkel eller busstur.",
].join(" ");

const OUTPUT_DIR = path.join(
  process.env.HOME || "",
  "Desktop/placy-test/barn-oppvekst/output",
);

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("voiceover-reels-barn-oppvekst");
  console.log(`  manus: ${MANUS.length} tegn, ~${MANUS.split(" ").length} ord`);
  console.log(`  output-dir: ${OUTPUT_DIR}\n`);

  console.log("Kaller ElevenLabs (Erik / turbo_v2_5 / no)…");
  const result = await generateAudio({
    apiKey: API_KEY!,
    text: MANUS,
  });

  const mp3Path = path.join(OUTPUT_DIR, "voiceover-barn-oppvekst-reels.mp3");
  const timingsPath = path.join(OUTPUT_DIR, "voiceover-barn-oppvekst-reels-timings.json");

  await fs.writeFile(mp3Path, result.bytes);
  await fs.writeFile(timingsPath, JSON.stringify(result.timings, null, 2));

  const lastEnd =
    result.timings.characterEndTimesSeconds[
      result.timings.characterEndTimesSeconds.length - 1
    ] ?? 0;

  console.log(`\n✓ MP3:     ${mp3Path} (${(result.bytes.length / 1024).toFixed(0)} KB)`);
  console.log(`✓ Timings: ${timingsPath} (${result.timings.characters.length} tegn)`);
  console.log(`  Total varighet: ${lastEnd.toFixed(2)}s`);
  console.log(`  Voice: ${result.voice} | Model: ${result.model}`);
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
