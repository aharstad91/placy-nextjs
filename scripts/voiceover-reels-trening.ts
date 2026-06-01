#!/usr/bin/env npx tsx
/**
 * voiceover-reels-trening — Reels-versjon-manus for trening-aktivitet-kategorien.
 * Erik / turbo_v2_5. Beboer-perspektiv, fortellings-format, vann/badekultur-akse.
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
  "Som tidligere nevnt ligger det godt til rette for å komme rett til noen av de mest populære joggerutene i Trondheim.",
  "Promenaden mot Skansen vestover, Ladestien mot øst, og Midtbyrunden mot sør.",
  "Alle med sin unike sjarm og fasong.",
  "Med en så maritim beliggenhet er det kort vei til å ta seg en dukkert, fulgt på med en runde i badstu.",
  "Pirbadet og treningssenter er like rundt hjørnet, og tilbyr alt en trenger av treningsfasiliteter.",
  "Ellers er det mange treningssentre fra ulike kjeder i området, med selvinnsjekk og åpent døgnet rundt.",
  "Det finnes også mer spesialiserte sentre som tilbyr mer spesifikke aktiviteter som for eksempel boksing, yoga og turn.",
].join(" ");

const OUTPUT_DIR = path.join(
  process.env.HOME || "",
  "Desktop/placy-test/trening/output",
);

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  console.log("voiceover-reels-trening");
  console.log(`  manus: ${MANUS.length} tegn, ~${MANUS.split(" ").length} ord`);
  console.log(`  output-dir: ${OUTPUT_DIR}\n`);

  console.log("Kaller ElevenLabs (Erik / turbo_v2_5 / no)…");
  const result = await generateAudio({
    apiKey: API_KEY!,
    text: MANUS,
  });

  const mp3Path = path.join(OUTPUT_DIR, "voiceover-trening-reels.mp3");
  const timingsPath = path.join(OUTPUT_DIR, "voiceover-trening-reels-timings.json");

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
