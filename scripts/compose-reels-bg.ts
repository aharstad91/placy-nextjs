#!/usr/bin/env npx tsx
/**
 * compose-reels-bg — bygg per-kategori video-bakgrunn for Rapport-Reels.
 *
 * Tar:
 *   - Bildepakke (5-8 stills per kategori, .jpg)
 *   - Timings JSON fra ElevenLabs (alignment per tegn)
 *   - Liste over hvilket bilde som eier hvilken "beat" (setning eller
 *     komma-split midt i setning)
 *
 * Produserer:
 *   - 720x1280 9:16 mp4, samme varighet som VO, hard-cut mellom beats
 *   - Hver still får Ken Burns zoompan (subtil 1.0 → 1.08 zoom)
 *   - Cut-punktene aligneres med setningsenden i timings (Level B)
 *   - Valgfri extra-splits flytter et cut til midt-i-setning (Level C lite)
 *
 * Forskjell fra Veo-pipeline: ingen API-kall, ingen rate-limits, ingen RAI-
 * filter. Bare ffmpeg + Ken Burns. Brukes når Veo-budget/-tid ikke kan brukes,
 * eller når motion-fidelity ikke er kritisk (statiske miljø-bilder, ikke
 * scene med vann/skyer der Veo gir ekte motion-verdi).
 *
 * Usage:
 *   npx tsx scripts/compose-reels-bg.ts \
 *     --timings <path-to-timings.json> \
 *     --image-dir <path-to-images-dir> \
 *     --images "img1.jpg,img2.jpg,img3.jpg" \
 *     [--extra-splits "bysykkel,,elsparkesykler,"] \
 *     --output <path-to-output.mp4>
 *
 * Antall bilder må matche antall beats. Beats = setninger i timings +
 * eventuelle extra-splits.
 *
 * Eksempel for transport-kategorien (9 beats, 2 splits — stasjon/tog/flybuss/
 * buss/båt/bysykkel/elsparkesykkel/delebil/taxi):
 *   npx tsx scripts/compose-reels-bg.ts \
 *     --timings ~/Desktop/placy-test/transport/output/voiceover-transport-reels-timings.json \
 *     --image-dir ~/Desktop/placy-test/transport \
 *     --images "transport-en.jpg,transport-tog.png,transport-flyplass.png,transport-2.jpg,transport-2-3.jpg,transport-bysykkel.jpg,transport-sparkesykkel.jpg,transport-delebil-app.png,transport-taxi.png" \
 *     --extra-splits "byregionen,bysykler" \
 *     --output ~/Desktop/placy-test/transport/output/transport.mp4
 */

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

interface Timings {
  characters: string[];
  characterStartTimesSeconds: number[];
  characterEndTimesSeconds: number[];
}

interface Beat {
  image: string;
  endTime: number;
  duration: number;
  label: string;
}

interface Args {
  timings: string;
  imageDir: string;
  images: string[];
  extraSplits: string[];
  output: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : undefined;
  };
  const timings = get("--timings");
  const imageDir = get("--image-dir");
  const images = get("--images")?.split(",").map((s) => s.trim()) ?? [];
  const extraSplits =
    get("--extra-splits")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean) ?? [];
  const output = get("--output");

  if (!timings || !imageDir || images.length === 0 || !output) {
    console.error(
      "Usage: compose-reels-bg.ts --timings <path> --image-dir <path> --images \"a,b,c\" [--extra-splits \"x,y\"] --output <path>",
    );
    process.exit(1);
  }
  return {
    timings: timings.replace(/^~/, process.env.HOME || ""),
    imageDir: imageDir.replace(/^~/, process.env.HOME || ""),
    images,
    extraSplits,
    output: output.replace(/^~/, process.env.HOME || ""),
  };
}

/** Finn alle setningsende-tidspunkter (. ! ?) i timings. */
function findSentenceEnds(timings: Timings): number[] {
  const ends: number[] = [];
  timings.characters.forEach((c, i) => {
    if (c === "." || c === "!" || c === "?") {
      ends.push(timings.characterEndTimesSeconds[i]);
    }
  });
  return ends;
}

/** Finn tidspunkt for slutten av en spesifikk delstreng (første treff). */
function findMarkerEnd(timings: Timings, marker: string): number | null {
  const text = timings.characters.join("");
  const idx = text.indexOf(marker);
  if (idx < 0) return null;
  const lastCharIdx = idx + marker.length - 1;
  return timings.characterEndTimesSeconds[lastCharIdx];
}

async function main() {
  const args = parseArgs();

  // 1. Les timings
  const timingsRaw = await fs.readFile(args.timings, "utf-8");
  const timings = JSON.parse(timingsRaw) as Timings;

  // 2. Beregn beats — setningsende + extra-splits, sortert kronologisk
  const sentenceEnds = findSentenceEnds(timings);
  const extraEnds: { t: number; label: string }[] = [];
  for (const marker of args.extraSplits) {
    const t = findMarkerEnd(timings, marker);
    if (t === null) {
      console.error(`✗ Fant ikke extra-split "${marker}" i timings`);
      process.exit(1);
    }
    extraEnds.push({ t, label: `marker:${marker}` });
  }
  const allEnds = [
    ...sentenceEnds.map((t, i) => ({ t, label: `setning ${i + 1}` })),
    ...extraEnds,
  ].sort((a, b) => a.t - b.t);

  // 3. Verifiser bilde-tall = beat-tall
  if (args.images.length !== allEnds.length) {
    console.error(
      `✗ Antall bilder (${args.images.length}) matcher ikke antall beats (${allEnds.length}).`,
    );
    console.error(`  Beats funnet: ${allEnds.length}`);
    allEnds.forEach((b, i) =>
      console.error(`    ${i + 1}. ${b.t.toFixed(2)}s — ${b.label}`),
    );
    process.exit(1);
  }

  // 4. Konstruér beat-objekter med varighet
  const beats: Beat[] = [];
  let prevEnd = 0;
  for (let i = 0; i < args.images.length; i++) {
    const end = allEnds[i].t;
    beats.push({
      image: args.images[i],
      endTime: end,
      duration: Number((end - prevEnd).toFixed(3)),
      label: allEnds[i].label,
    });
    prevEnd = end;
  }

  console.log(`\ncompose-reels-bg`);
  console.log(`  timings:   ${args.timings}`);
  console.log(`  image-dir: ${args.imageDir}`);
  console.log(`  output:    ${args.output}\n`);
  console.log(`Beats (${beats.length}):`);
  beats.forEach((b, i) => {
    console.log(
      `  ${i + 1}. ${b.image.padEnd(35)} ${b.duration.toFixed(2)}s (${b.label})`,
    );
  });
  console.log("");

  // 5. Render hver beat som Ken Burns mp4 til arbeids-katalog
  const outDir = path.dirname(args.output);
  await fs.mkdir(outDir, { recursive: true });
  const workDir = path.join(outDir, ".compose-tmp");
  await fs.mkdir(workDir, { recursive: true });

  console.log("Rendrer Ken Burns-klipp…");
  const clipPaths: string[] = [];
  for (let i = 0; i < beats.length; i++) {
    const b = beats[i];
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, "0")}.mp4`);
    const frames = Math.round(b.duration * 30);
    const imagePath = path.join(args.imageDir, b.image);
    // Alternér zoom-retning for variasjon: even idx zoomer inn, odd zoomer ut
    const zoomExpr =
      i % 2 === 0
        ? `min(1+0.0006*on,1.08)`
        : `max(1.08-0.0006*on,1)`;
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loop",
        "1",
        "-i",
        imagePath,
        "-vf",
        `scale=1440:2560:force_original_aspect_ratio=increase,crop=1440:2560,zoompan=z='${zoomExpr}':d=${frames}:s=720x1280:fps=30`,
        "-t",
        String(b.duration),
        "-c:v",
        "libx264",
        "-crf",
        "20",
        "-preset",
        "medium",
        "-pix_fmt",
        "yuv420p",
        "-an",
        clipPath,
      ],
      { stdio: ["ignore", "ignore", "ignore"] },
    );
    clipPaths.push(clipPath);
    process.stdout.write(`  ${i + 1}/${beats.length}\r`);
  }
  process.stdout.write(`\n`);

  // 6. Skriv concat.txt og concat med demuxer (mer pålitelig enn filter-graph
  //    når vi har variabel-lengde clips med zoompan — jf. transport.mp4 v1
  //    der filter_complex med 5 zoompan-inputs ga "samme bilde i alle slots")
  const concatPath = path.join(workDir, "concat.txt");
  await fs.writeFile(
    concatPath,
    clipPaths.map((p) => `file '${path.basename(p)}'`).join("\n") + "\n",
  );

  console.log("Concat → final mp4…");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c",
      "copy",
      args.output,
    ],
    { stdio: ["ignore", "ignore", "ignore"] },
  );

  // 7. Rapport
  const stat = await fs.stat(args.output);
  console.log(`\n✓ ${args.output}`);
  console.log(`  Størrelse: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Varighet:  ${prevEnd.toFixed(2)}s`);
  console.log(`  Beats:     ${beats.length}`);
  console.log(`\n  Work-dir (clips): ${workDir} (kan slettes manuelt)`);
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
