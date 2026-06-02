#!/usr/bin/env npx tsx
/**
 * compose-video-crossfade — kjed N ferdige videoer med myk kryss-fade.
 *
 * Tar flere mp4-er (f.eks. Veo image-to-video-klipp), normaliserer dem til
 * samme oppløsning/fps og krysstoner mellom dem til én sammenhengende reel.
 * Lager også en web-komprimert variant + et fallback-poster (første frame).
 *
 * Forskjell fra compose-slideshow.ts: den krysstoner STILLS (med Ken Burns).
 * Dette krysstoner ferdige VIDEOER (bevarer bevegelsen i hvert klipp).
 *
 * Usage:
 *   npx tsx scripts/compose-video-crossfade.ts \
 *     --videos "a.mp4,b.mp4,c.mp4" \
 *     --output <reel.mp4> \
 *     [--xfade 1] [--width 1920] [--height 1080] [--no-compress]
 *
 * Produserer ved --output <dir>/reel.mp4:
 *   - reel.mp4            full kvalitet
 *   - reel-web.mp4        web-komprimert (mindre fil, samme lengde)  [med mindre --no-compress]
 *   - reel-poster.jpg     første frame (fallback-bilde)
 */

import { execFileSync, spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

interface Args {
  videos: string[];
  output: string;
  xfade: number;
  width: number;
  height: number;
  compress: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : undefined;
  };
  const expand = (p: string) => p.replace(/^~/, process.env.HOME || "");
  const videos =
    get("--videos")?.split(",").map((s) => expand(s.trim())).filter(Boolean) ?? [];
  const output = get("--output");
  const xfade = Number(get("--xfade") ?? "1");
  const width = Number(get("--width") ?? "1920");
  const height = Number(get("--height") ?? "1080");
  const compress = !argv.includes("--no-compress");

  if (videos.length < 2 || !output) {
    console.error(
      'Usage: compose-video-crossfade.ts --videos "a.mp4,b.mp4,c.mp4" --output <reel.mp4> ' +
        "[--xfade 1] [--width 1920] [--height 1080] [--no-compress]",
    );
    process.exit(1);
  }
  return { videos, output: expand(output), xfade, width, height, compress };
}

/** Lengde i sekunder via ffprobe. */
function probeDuration(file: string): number {
  const out = execFileSync(
    "ffprobe",
    [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      file,
    ],
    { encoding: "utf-8" },
  );
  return Number(out.trim());
}

/**
 * Finn innholds-rektangelet (uten pillarbox/letterbox-felt) via cropdetect.
 * Veo letterboxer alle ikke-16:9-input med svarte felt; dette finner det
 * faktiske bildet så vi kan cover-fylle i stedet. Returnerer "w:h:x:y" eller
 * null hvis ingen felt (full ramme).
 */
function detectContentCrop(file: string): string | null {
  // cropdetect skriver til stderr → spawnSync for å fange den.
  const res = spawnSync(
    "ffmpeg",
    [
      "-i", file,
      "-vf", "cropdetect=limit=24:round=2:reset=0",
      "-frames:v", "60",
      "-f", "null", "-",
    ],
    { encoding: "utf-8" },
  );
  const log = `${res.stderr ?? ""}${res.stdout ?? ""}`;
  const matches = Array.from(log.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g));
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return `${last[1]}:${last[2]}:${last[3]}:${last[4]}`;
}

async function main() {
  const args = parseArgs();
  const { width: W, height: H, xfade: X } = args;

  for (const v of args.videos) {
    await fs.access(v).catch(() => {
      console.error(`✗ Finner ikke video: ${v}`);
      process.exit(1);
    });
  }

  const durations = args.videos.map(probeDuration);
  const outDir = path.dirname(args.output);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`\ncompose-video-crossfade`);
  args.videos.forEach((v, i) =>
    console.log(`  ${i + 1}. ${path.basename(v).padEnd(30)} ${durations[i].toFixed(1)}s`),
  );
  console.log(`  kryss-fade: ${X}s, mål: ${W}x${H}`);
  console.log(`  output:     ${args.output}\n`);

  // Normalisér hver input + kjed med xfade.
  // offset for xfade #i = sum(dur[0..i-1]) - i*xfade.
  const inputs: string[] = [];
  args.videos.forEach((v) => inputs.push("-i", v));

  // Per video: fjern Veos pillarbox-felt (cropdetect), så cover-fyll til WxH.
  const norm: string[] = [];
  args.videos.forEach((v, i) => {
    const content = detectContentCrop(v);
    const strip = content ? `crop=${content},` : "";
    if (content) console.log(`  ${i + 1}. fjerner felt → innhold ${content}`);
    norm.push(
      `[${i}:v]${strip}scale=${W}:${H}:force_original_aspect_ratio=increase,` +
        `crop=${W}:${H},setsar=1,fps=30,format=yuv420p[n${i}]`,
    );
  });

  const chain: string[] = [];
  let prev = "n0";
  let accum = 0;
  for (let i = 1; i < args.videos.length; i++) {
    accum += durations[i - 1];
    const offset = (accum - i * X).toFixed(3);
    const out = i === args.videos.length - 1 ? "v" : `x${i}`;
    chain.push(
      `[${prev}][n${i}]xfade=transition=fade:duration=${X}:offset=${offset}[${out}]`,
    );
    prev = out;
  }

  const filter = [...norm, ...chain].join(";");

  console.log("Kryss-fade → reel.mp4…");
  execFileSync(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex", filter,
      "-map", "[v]",
      "-c:v", "libx264",
      "-crf", "18",
      "-preset", "slow",
      "-pix_fmt", "yuv420p",
      "-an",
      args.output,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  // Poster: første frame som fallback-bilde.
  const poster = args.output.replace(/\.mp4$/i, "-poster.jpg");
  console.log("Poster (første frame)…");
  execFileSync(
    "ffmpeg",
    ["-y", "-i", args.output, "-frames:v", "1", "-update", "1", "-q:v", "2", poster],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  // Web-komprimert variant.
  let webPath: string | null = null;
  if (args.compress) {
    webPath = args.output.replace(/\.mp4$/i, "-web.mp4");
    console.log("Web-komprimert variant…");
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i", args.output,
        "-c:v", "libx264",
        "-crf", "26",
        "-preset", "slow",
        "-movflags", "+faststart",
        "-pix_fmt", "yuv420p",
        "-an",
        webPath,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
  }

  const totalDur = durations.reduce((a, b) => a + b, 0) - (args.videos.length - 1) * X;
  const sizeMb = async (p: string) => ((await fs.stat(p)).size / 1024 / 1024).toFixed(2);
  console.log(`\n✓ reel:   ${args.output}  (${await sizeMb(args.output)} MB, ${totalDur.toFixed(1)}s)`);
  console.log(`✓ poster: ${poster}  (${await sizeMb(poster)} MB)`);
  if (webPath) console.log(`✓ web:    ${webPath}  (${await sizeMb(webPath)} MB)`);
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
