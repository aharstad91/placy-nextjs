#!/usr/bin/env npx tsx
/**
 * Reels-VO TTS-bygg for LOKALE JSON-prosjekter (data/projects/<kunde>/<slug>.json).
 *
 * Søsterscript til scripts/audio-tour-build-local.ts. Der bygger tour-sporene
 * (welcomeAudio/heroAudio/themes[].audio/outroAudio); HER bygges KUN
 * `themes[].reelsAudio` — de kortere, bilde-alignede reels-manusene som
 * overstyrer tour-sporet i reels-feeden (se memory reference_reels_audio_override).
 *
 * KRITISK: reels-mp3 skrives til egen filnøkkel `{theme-id}-reels.mp3` slik at
 * den ALDRI overskriver tour-sporet `{theme-id}.mp3`. Kollisjon ville ødelagt
 * karaoke i rapport-board (tour-karaoke leser tour-timings). audioFilename
 * special-caser kun "home" og returnerer ellers `${trackKey}.mp3`, så
 * `${themeId}-reels` gir riktig fil uten endring i storage-paths.ts.
 *
 * Gjenbruker den ekte ElevenLabs-klienten (Erik / turbo_v2_5 / language_code "no",
 * pronunciation-aliaser, karaoke-timings) → identisk kvalitet med tour-sporene.
 *
 * Usage:
 *   npx tsx scripts/reels-voiceover-build-local.ts data/projects/<kunde>/<slug>.json [--force]
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import pLimit from "p-limit";
import {
  generateAudio,
  ELEVENLABS_MODEL,
  ELEVENLABS_VOICE,
  ELEVENLABS_VOICE_NAME,
} from "../lib/audio-tour/elevenlabs-client";
import { audioAbsPath, audioRelPath } from "../lib/audio-tour/storage-paths";
import type { Project, ReportThemeAudio } from "../lib/types";

config({ path: ".env.local" });

const PARALLEL_LIMIT = 2; // ElevenLabs free plan = max 2 concurrent
const MIN_BYTES = 5000;

const args = process.argv.slice(2);
const jsonPath = args.find((a) => !a.startsWith("--"));
const FORCE = args.includes("--force");

if (!jsonPath) {
  console.error("Usage: npx tsx scripts/reels-voiceover-build-local.ts <project.json> [--force]");
  process.exit(1);
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY in .env.local");
  process.exit(1);
}

interface Track {
  /** Filnøkkel — `{theme-id}-reels` (egen fil, kolliderer ikke med tour). */
  trackKey: string;
  label: string;
  manus: string;
  hasUrl: boolean;
  assign: (audio: ReportThemeAudio) => void;
}

async function main() {
  const project = JSON.parse(fs.readFileSync(jsonPath!, "utf-8")) as Project;
  const rc = project.reportConfig;
  if (!rc) {
    console.error("Ingen reportConfig i prosjektet.");
    process.exit(1);
  }
  const slug = project.urlSlug;

  console.log("=== Reels-VO TTS-bygg (lokal) ===");
  console.log(`Fil:    ${jsonPath}`);
  console.log(`Slug:   ${slug}`);
  console.log(`Voice:  ${ELEVENLABS_VOICE} (${ELEVENLABS_VOICE_NAME})  Model: ${ELEVENLABS_MODEL}`);
  console.log(`Mode:   ${FORCE ? "FORCE" : "skip eksisterende url"}`);
  console.log();

  const tracks: Track[] = [];
  for (const t of rc.themes ?? []) {
    const manus = t.reelsAudio?.manus?.trim();
    if (!manus) continue;
    tracks.push({
      trackKey: `${t.id}-reels`,
      label: t.name,
      manus,
      hasUrl: Boolean(t.reelsAudio?.url),
      assign: (a) => (t.reelsAudio = a),
    });
  }

  if (tracks.length === 0) {
    console.error("Ingen reels-manus å bygge.");
    process.exit(1);
  }
  console.log(`Spor: ${tracks.length} (${tracks.map((t) => t.trackKey).join(", ")})`);
  console.log();

  const outDir = path.resolve(process.cwd(), "public", "audio", slug);
  fs.mkdirSync(outDir, { recursive: true });

  const limit = pLimit(PARALLEL_LIMIT);
  const generatedAt = new Date().toISOString();
  let built = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    tracks.map((track) =>
      limit(async () => {
        if (track.hasUrl && !FORCE) {
          skipped++;
          console.log(`  ⊘ ${track.trackKey.padEnd(28)} eksisterende url`);
          return;
        }
        try {
          const { bytes, voice, model, timings } = await generateAudio({
            apiKey: ELEVENLABS_API_KEY!,
            text: track.manus,
          });
          if (bytes.length < MIN_BYTES) {
            failed++;
            console.log(`  ✗ ${track.trackKey.padEnd(28)} for liten (${bytes.length}b)`);
            return;
          }
          // Defensiv: skriv ALDRI over et tour-spor. trackKey skal slutte på
          // "-reels"; hvis ikke, abort hele bygget (kontrakt-brudd).
          if (!track.trackKey.endsWith("-reels")) {
            throw new Error(`trackKey "${track.trackKey}" mangler -reels-suffiks`);
          }
          fs.writeFileSync(audioAbsPath(slug, track.trackKey), bytes);
          track.assign({
            url: audioRelPath(slug, track.trackKey),
            voice,
            model,
            generatedAt,
            manus: track.manus,
            timings,
          });
          built++;
          console.log(`  ✓ ${track.trackKey.padEnd(28)} ${(bytes.length / 1024).toFixed(0)} KB`);
        } catch (err) {
          failed++;
          console.log(`  ✗ ${track.trackKey.padEnd(28)} ${(err as Error).message}`);
        }
      }),
    ),
  );

  console.log();
  if (failed > 0) {
    console.error(`${failed} spor feilet — JSON IKKE skrevet. Kjør på nytt.`);
    process.exit(2);
  }

  if (built > 0) {
    fs.writeFileSync(jsonPath!, JSON.stringify(project, null, 2), "utf-8");
    console.log(`✓ ${built} reels-spor bygd, ${skipped} hoppet over. JSON oppdatert.`);
    console.log(`  MP3: ${outDir}/{theme-id}-reels.mp3`);
  } else {
    console.log(`Ingenting bygd (${skipped} hadde url). Bruk --force for regen.`);
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
