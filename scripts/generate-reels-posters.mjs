#!/usr/bin/env node
/**
 * Genererer poster-bilder (videoens FØRSTE frame) for reels-kategori-videoer.
 *
 * Hvorfor: I desktop-sidebaren (DesktopStorySidebar) vises hver kategori som
 * et preview-kort når den ikke er aktiv. Preview-en skal være første frame av
 * video-bakgrunnen som spilles når kortet blir aktivt — slik at man kjenner
 * igjen hva videoen viser (f.eks. togstasjonen for Transport), i stedet for et
 * separat illustrasjonsbilde som ikke matcher.
 *
 * Konvensjon (standard støtte for nye prosjekter):
 *   <sti>/<navn>.mp4  →  <sti>/<navn>.jpg   (samme basename, .jpg)
 * `posterForVideo()` i reels-data.ts avleder poster-stien fra videoBgSrc etter
 * akkurat denne regelen. Legg en ny kategori-video i public/reels/categories/
 * og kjør dette scriptet — posteren havner ved siden av og plukkes opp
 * automatisk.
 *
 * Idempotent: hopper over videoer der posteren allerede finnes og er nyere
 * enn videoen. Bruk --force for å regenerere alt.
 *
 * Kjør:  npm run generate:reels-posters   (eller: node scripts/generate-reels-posters.mjs)
 */

import { execFileSync } from "node:child_process";
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO_DIR = join(ROOT, "public", "reels", "categories");
const FORCE = process.argv.includes("--force");
const POSTER_WIDTH = 720; // 2x for ~370px-brede preview/aktiv-kort

function findVideos(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findVideos(full));
    else if (extname(entry.name).toLowerCase() === ".mp4") out.push(full);
  }
  return out;
}

function posterPath(videoPath) {
  return join(dirname(videoPath), basename(videoPath, extname(videoPath)) + ".jpg");
}

function isUpToDate(videoPath, poster) {
  if (FORCE || !existsSync(poster)) return false;
  return statSync(poster).mtimeMs >= statSync(videoPath).mtimeMs;
}

const videos = findVideos(VIDEO_DIR);
if (videos.length === 0) {
  console.log(`Ingen .mp4 funnet i ${VIDEO_DIR}`);
  process.exit(0);
}

let generated = 0;
let skipped = 0;
for (const video of videos) {
  const poster = posterPath(video);
  const rel = poster.replace(ROOT + "/", "");
  if (isUpToDate(video, poster)) {
    skipped++;
    console.log(`↷ hopper over (oppdatert): ${rel}`);
    continue;
  }
  // Aller første frame (-ss 0 -frames:v 1), skalert til POSTER_WIDTH bredde
  // (-2 = behold aspect, partall-høyde). -q:v 3 = høy JPEG-kvalitet.
  execFileSync("ffmpeg", [
    "-y",
    "-i", video,
    "-ss", "0",
    "-frames:v", "1",
    "-vf", `scale=${POSTER_WIDTH}:-2`,
    "-q:v", "3",
    poster,
  ], { stdio: ["ignore", "ignore", "pipe"] });
  generated++;
  console.log(`✓ generert: ${rel}`);
}

console.log(`\nFerdig: ${generated} generert, ${skipped} uendret (${videos.length} videoer totalt).`);
