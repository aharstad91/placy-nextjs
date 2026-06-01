#!/usr/bin/env npx tsx
/**
 * voiceover-reels-hverdagsliv — Reels-versjon-manus for hverdagsliv-kategorien.
 * Erik / turbo_v2_5. Beboer-perspektiv, fortellings-format, selektiv
 * navngivning (Solsiden + Byhaven som ankere).
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
  "Det er ingen tvil om at beliggenheten her gir et enkelt hverdagsliv.",
  "Alt en kan forvente av fasiliteter er i naturlig nærhet ettersom man er så tett i sentrum av Trondheim.",
  "Skal en få løst flere ting i en strekk, er det flere kjøpesenter innen fem minutters gange.",
].join(" ");

const OUTPUT_DIR = path.join(
  process.env.HOME || "",
  "Desktop/placy-test/hverdagsliv/output",
);

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("voiceover-reels-hverdagsliv");
  console.log(`  manus: ${MANUS.length} tegn, ~${MANUS.split(" ").length} ord`);
  console.log(`  output-dir: ${OUTPUT_DIR}\n`);

  console.log("Kaller ElevenLabs (Erik / turbo_v2_5 / no)…");
  const result = await generateAudio({
    apiKey: API_KEY!,
    text: MANUS,
  });

  const mp3Path = path.join(OUTPUT_DIR, "voiceover-hverdagsliv-reels.mp3");
  const timingsPath = path.join(OUTPUT_DIR, "voiceover-hverdagsliv-reels-timings.json");

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
