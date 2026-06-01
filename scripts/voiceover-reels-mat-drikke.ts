#!/usr/bin/env npx tsx
/**
 * voiceover-reels-mat-drikke — Reels-versjon-manus for mat-drikke-kategorien.
 * Erik / turbo_v2_5. Output til ~/Desktop/placy-test/mat-drikke/output/.
 * Manuset er kuratert 2026-05-26 (beboer-perspektiv, fakta-orientert,
 * ett tema per setning).
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
  "Med denne beliggenheten får man adgang til over 200 spisesteder innen kort gangavstand, med restaurant, kafé eller pub spredt utover bydelene.",
  "Solsiden og sentrum-kjernen er gode eksempler på steder hvor det er spisesteder på rekke og rad.",
  "Uansett hva en ønsker seg av mat og drikke, kan du få det i nærheten.",
  "Du kan også få det levert på døra, da det finnes flere budleverandører for take-away.",
  "For dagligvarer og forbruksartikler er det flere butikker innen fem minutters gange, samt vil det på sikt bli bygd en ny dagligvarebutikk i kvartalet.",
].join(" ");

const OUTPUT_DIR = path.join(
  process.env.HOME || "",
  "Desktop/placy-test/mat-drikke/output",
);

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("voiceover-reels-mat-drikke");
  console.log(`  manus: ${MANUS.length} tegn, ~${MANUS.split(" ").length} ord`);
  console.log(`  output-dir: ${OUTPUT_DIR}\n`);

  console.log("Kaller ElevenLabs (Erik / turbo_v2_5 / no)…");
  const result = await generateAudio({
    apiKey: API_KEY!,
    text: MANUS,
  });

  const mp3Path = path.join(OUTPUT_DIR, "voiceover-mat-drikke-reels.mp3");
  const timingsPath = path.join(OUTPUT_DIR, "voiceover-mat-drikke-reels-timings.json");

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
