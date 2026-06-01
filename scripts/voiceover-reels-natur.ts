#!/usr/bin/env npx tsx
/**
 * voiceover-reels-natur — Reels-versjon-manus for natur-friluftsliv-kategorien.
 * Erik / turbo_v2_5. Output til ~/Desktop/placy-test/natur/output/.
 * Manuset er kuratert 2026-05-26 (beboer-perspektiv, fortellings-format,
 * vann-aksen som dramaturgi: elv → fjord).
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
  "Uansett hva du liker av natur og friluftsliv, så kan denne beliggenheten gi deg det du ønsker.",
  "Like utenfor døren kommer du til Nidelva, som strekker seg gjennom byen.",
  "Går man langs havnepromenaden, kan en komme seg langs Skansen med gjestehavn og sandstrand den ene veien, og mot Ladestiens vakre rute med mange strender den andre veien.",
  "Begge veier tilbyr lange strekninger perfekt for en rolig gåtur eller en mer aktiv løpetur.",
  "Det er i nærheten mulighet for å ta seg en dukkert i stupetårn, badstu er like i nærheten, og mulighet for å leie seg kajakk for en tur på vannet.",
  "Tar du retning inn mot sentrum, er det mer enn nok av fine parker og rekreasjonsområder for både store og små.",
  "Det kan også nevnes Midtbyrunden, som strekker seg gjennom hele Midtbyen, og er en av de mest populære rutene i Trondheim sentrum.",
].join(" ");

const OUTPUT_DIR = path.join(
  process.env.HOME || "",
  "Desktop/placy-test/natur/output",
);

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("voiceover-reels-natur");
  console.log(`  manus: ${MANUS.length} tegn, ~${MANUS.split(" ").length} ord`);
  console.log(`  output-dir: ${OUTPUT_DIR}\n`);

  console.log("Kaller ElevenLabs (Erik / turbo_v2_5 / no)…");
  const result = await generateAudio({
    apiKey: API_KEY!,
    text: MANUS,
  });

  const mp3Path = path.join(OUTPUT_DIR, "voiceover-natur-reels.mp3");
  const timingsPath = path.join(OUTPUT_DIR, "voiceover-natur-reels-timings.json");

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
