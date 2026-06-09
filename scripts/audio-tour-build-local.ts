#!/usr/bin/env npx tsx
/**
 * Audio-tour TTS-bygg for LOKALE JSON-prosjekter (data/projects/<kunde>/<slug>.json).
 *
 * Lokal motpart til scripts/audio-tour-build.ts. Den offisielle bygger leser
 * manus fra Supabase og PATCH-er tilbake til prod-DB — dette er uegnet for
 * prototype-prosjekter som lever som lokal report-JSON (f.eks. grilstad-marina).
 * Denne varianten leser/skriver den samme reportConfig-en i en lokal fil og
 * gjenbruker den ekte ElevenLabs-klienten (Erik / turbo_v2_5 / language_code "no"),
 * så stemme, modell, pronunciation-aliaser og karaoke-timings blir identiske med
 * prod-pipelinen.
 *
 * Genererer KUN tour-spor (welcomeAudio + heroAudio + themes[].audio + outroAudio).
 * reelsAudio røres ikke — det er en egen override-akse for SOME-reels-videoer
 * (se memory reference_reels_audio_override).
 *
 * Usage:
 *   npx tsx scripts/audio-tour-build-local.ts data/projects/<kunde>/<slug>.json [--force]
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
  console.error("Usage: npx tsx scripts/audio-tour-build-local.ts <project.json> [--force]");
  process.exit(1);
}

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
if (!ELEVENLABS_API_KEY) {
  console.error("Missing ELEVENLABS_API_KEY in .env.local");
  process.exit(1);
}

interface Track {
  key: string; // "welcome" | "home" | theme.id | "outro"
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

  console.log("=== Audio-tour TTS-bygg (lokal) ===");
  console.log(`Fil:    ${jsonPath}`);
  console.log(`Slug:   ${slug}`);
  console.log(`Voice:  ${ELEVENLABS_VOICE} (${ELEVENLABS_VOICE_NAME})  Model: ${ELEVENLABS_MODEL}`);
  console.log(`Mode:   ${FORCE ? "FORCE" : "skip eksisterende url"}`);
  console.log();

  const tracks: Track[] = [];
  const push = (
    key: string,
    label: string,
    container: ReportThemeAudio | undefined,
    set: (a: ReportThemeAudio) => void,
  ) => {
    const manus = container?.manus?.trim();
    if (!manus) return;
    tracks.push({ key, label, manus, hasUrl: Boolean(container?.url), assign: set });
  };

  push("welcome", "Velkomst", rc.welcomeAudio, (a) => (rc.welcomeAudio = a));
  push("home", "Hjem", rc.heroAudio, (a) => (rc.heroAudio = a));
  for (const t of rc.themes ?? []) {
    push(t.id, t.name, t.audio, (a) => (t.audio = a));
  }
  push("outro", "Outro", rc.outroAudio, (a) => (rc.outroAudio = a));

  if (tracks.length === 0) {
    console.error("Ingen manus å bygge.");
    process.exit(1);
  }
  console.log(`Spor: ${tracks.length} (${tracks.map((t) => t.key).join(", ")})`);
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
          console.log(`  ⊘ ${track.key.padEnd(22)} eksisterende url`);
          return;
        }
        try {
          const { bytes, voice, model, timings } = await generateAudio({
            apiKey: ELEVENLABS_API_KEY!,
            text: track.manus,
          });
          if (bytes.length < MIN_BYTES) {
            failed++;
            console.log(`  ✗ ${track.key.padEnd(22)} for liten (${bytes.length}b)`);
            return;
          }
          fs.writeFileSync(audioAbsPath(slug, track.key), bytes);
          track.assign({
            url: audioRelPath(slug, track.key),
            voice,
            model,
            generatedAt,
            manus: track.manus,
            timings,
          });
          built++;
          console.log(`  ✓ ${track.key.padEnd(22)} ${(bytes.length / 1024).toFixed(0)} KB`);
        } catch (err) {
          failed++;
          console.log(`  ✗ ${track.key.padEnd(22)} ${(err as Error).message}`);
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
    rc.audioVersion = 5;
    fs.writeFileSync(jsonPath!, JSON.stringify(project, null, 2), "utf-8");
    console.log(`✓ ${built} spor bygd, ${skipped} hoppet over. JSON oppdatert.`);
    console.log(`  MP3: ${outDir}/`);
  } else {
    console.log(`Ingenting bygd (${skipped} hadde url). Bruk --force for regen.`);
  }
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
