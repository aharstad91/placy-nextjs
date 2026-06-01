#!/usr/bin/env npx tsx
/**
 * voiceover-some — generer voice over for SOME-video via ElevenLabs Erik turbo_v2_5
 *
 * Genererer én sammenhengende MP3 fra de 5 scene-replikkene, med break-tags
 * mellom for scene-rytme. Output: <output-dir>/voiceover-<variant>.mp3
 *
 * Usage:
 *   npx tsx scripts/voiceover-some.ts <output-dir> [--variant=dagsreise|persona]
 *
 * Default variant: dagsreise (original spike-manus).
 * Stasjonskvartalet-manus er hardkodet — endre i scriptet for andre prosjekter.
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

type Variant = "dagsreise" | "persona" | "kategori";

const MANUS: Record<Variant, string[]> = {
  // Original spike-manus: kronologisk dagsreise, sted-sentrisk fortelling
  dagsreise: [
    "Morgenen våkner over kanalen. Det er stille før byen kommer i gang.",
    "Kaffen er kort vei unna, toget enda kortere. Sentrum ligger noen minutter herfra.",
    "Solsiden ligger ned langs Lade. Lunsjen tas der, med havet rett utenfor.",
    "Bymarka ligger nær. Sjøen og marka, begge naboer.",
    "Stasjonskvartalet. Se hele nabolaget hos Placy.",
  ],
  // Persona-versjon per research 2026-05-24: navngitt karakter, identifikasjon-aktivert
  // for eiendoms-narrativ. Færre stedsnavn = TTS-vennligere.
  persona: [
    "Maria våkner til lyden av kanalen. Hun jobber i sentrum, toget tar syv minutter.",
    "Lunsj er kortvei. Solsiden, eller en kafé rundt hjørnet.",
    "Etter jobb går hun ned til vannet. Stillere her enn man skulle tro.",
    "I helga er det Bymarka. Sjø og skog i samme nabolag.",
    "Maria bor i Stasjonskvartalet. Se hele nabolaget hos Placy.",
  ],
  // Kategori-versjon: stram intro uten kategori-overlapping (tidligere "leve livet
  // midt i byen, der sjø/kultur/rekreasjon" dublerte selve kategori-rapsingen).
  // 3 kategorier + "med mer" antyder bredde. Generisk handlings-CTA fungerer
  // både organisk på SOME og som klikkbar ad.
  kategori: [
    "Velkommen til Stasjonskvartalet, Trondheims nyeste bykvartal hvor du vil få muligheten til å leve midt i en levende bydel.",
    "Se steder i nærheten innen mat, transport, hverdagsliv med mer.",
    "Trykk på linken for å utforske området på egenhånd.",
  ],
};

function parseVariant(): Variant {
  const arg = process.argv.find(a => a.startsWith("--variant="));
  const v = arg?.split("=")[1] ?? "dagsreise";
  if (v !== "dagsreise" && v !== "persona" && v !== "kategori") {
    console.error(`Ugyldig variant: ${v}. Bruk dagsreise, persona eller kategori.`);
    process.exit(1);
  }
  return v;
}

const VARIANT = parseVariant();
const SCENES = MANUS[VARIANT];

function buildText(): string {
  // ElevenLabs `<break time="..." />` SSML-tag holder rytmen rolig mellom scenene.
  // 0.4s er kort nok til ikke å virke død luft, lang nok til å føles som scene-skifte.
  return SCENES.join(' <break time="0.4s" /> ');
}

async function main() {
  const positional = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const outputDir = (positional[0] || "~/Desktop/placy-test/output").replace(/^~/, process.env.HOME || "");
  await fs.mkdir(outputDir, { recursive: true });

  const text = buildText();
  console.log(`\nvoiceover-some → ElevenLabs Erik turbo_v2_5 [variant: ${VARIANT}]`);
  console.log("  text:");
  console.log("    " + text.replace(/<break[^>]*>/g, "[pause]").replace(/\. /g, ".\n    "));
  console.log(`\n  word count: ${text.replace(/<[^>]+>/g, "").split(/\s+/).length}`);

  const result = await generateAudio({ apiKey: API_KEY!, text });

  const audioFile = path.join(outputDir, `voiceover-${VARIANT}.mp3`);
  await fs.writeFile(audioFile, result.bytes);

  const lastEnd = result.timings.characterEndTimesSeconds[result.timings.characterEndTimesSeconds.length - 1];
  console.log(`\n✓ Saved: ${audioFile}`);
  console.log(`  duration: ${lastEnd.toFixed(2)}s`);
  console.log(`  size: ${(result.bytes.length / 1024).toFixed(0)} KB`);

  // Timings — lagre for senere komposisjon
  const timingsFile = path.join(outputDir, `voiceover-${VARIANT}-timings.json`);
  await fs.writeFile(timingsFile, JSON.stringify({
    scenes: SCENES,
    totalDuration: lastEnd,
    characters: result.timings.characters,
    characterStartTimesSeconds: result.timings.characterStartTimesSeconds,
    characterEndTimesSeconds: result.timings.characterEndTimesSeconds,
  }, null, 2));
  console.log(`  timings: ${timingsFile}`);
}

main().catch(err => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
