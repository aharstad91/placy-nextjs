#!/usr/bin/env npx tsx
/**
 * voiceover-reels-transport — Reels-versjon-manus for transport-kategorien,
 * generert via ElevenLabs Erik turbo_v2_5. Output: MP3 + timings JSON til
 * ~/Desktop/placy-test/transport/output/.
 *
 * Reels-manus er kortere + bilde-aligned vs. audio-tour-manus. Se worklog
 * 2026-05-25 for kontekst (manus-pivot).
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
  "Nye Trondheim Sentralstasjon er nærmeste nabo, og det gir muligheten til å gå rett ut til alle former for transport.",
  "Skal du langt, tar toget deg direkte sørover til Oslo, og nordover til Bodø.",
  "Toget stopper ved Trondheim lufthavn, Værnes, og flybuss kjører med jevne mellomrom fra holdeplasser et par minutter unna.",
  "Bussholdeplasser rundt kvartalet dekker hele byregionen, og du når hurtigbåtterminalen på fem minutters gange.",
  "Det er enkelt å komme seg på farten, da det står bysykler og elsparkesykler klare for bruk i umiddelbar nærhet.",
  "Og er det behov for bil, finner du dedikerte delebiler med både person- og varebiler i nærheten.",
  "Til slutt er det også verdt å nevne at det er en dedikert taxi-holdeplass to minutter unna døra.",
].join(" ");

const OUTPUT_DIR = path.join(
  process.env.HOME || "",
  "Desktop/placy-test/transport/output",
);

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("voiceover-reels-transport");
  console.log(`  manus: ${MANUS.length} tegn, ~${MANUS.split(" ").length} ord`);
  console.log(`  output-dir: ${OUTPUT_DIR}\n`);

  console.log("Kaller ElevenLabs (Erik / turbo_v2_5 / no)…");
  const result = await generateAudio({
    apiKey: API_KEY!,
    text: MANUS,
  });

  const mp3Path = path.join(OUTPUT_DIR, "voiceover-transport-reels.mp3");
  const timingsPath = path.join(OUTPUT_DIR, "voiceover-transport-reels-timings.json");

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
