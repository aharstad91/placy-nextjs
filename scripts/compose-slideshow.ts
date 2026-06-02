#!/usr/bin/env npx tsx
/**
 * compose-slideshow — frittstående kryss-fade-rotasjon mellom stills.
 *
 * Tar N bilder med VILKÅRLIG aspect ratio og lager én mp4 der de roterer
 * med myk kryss-fade (xfade) og subtil Ken Burns (zoompan). Alle bilder
 * normaliseres til SAMME mål-format — så blandede ratioer (3:2, 1:1, 4:3 …)
 * spiller pent sammen.
 *
 * Forskjell fra compose-reels-bg.ts: den er VO-synket med HARD-CUT mellom
 * beats (krever timings.json). Dette scriptet er VO-fritt, bruker KRYSS-FADE,
 * og er ment for hero-/loop-bakgrunner der man vil bytte bilde uten Veos
 * morphing/reset-artefakter.
 *
 * Usage:
 *   npx tsx scripts/compose-slideshow.ts \
 *     --images "a.jpg,b.png,c.png" [--dir <base-dir>] \
 *     --output <out.mp4> \
 *     [--aspect 16:9|9:16|1:1] [--seconds 4] [--xfade 1] [--fit cover|blur]
 *
 * Eksempel:
 *   npx tsx scripts/compose-slideshow.ts \
 *     --images "3.jpeg,4.png,5.png" --dir ~/bilder \
 *     --output ~/Desktop/rotasjon.mp4 --aspect 16:9 --seconds 4 --xfade 1
 *
 * fit=cover (default): skalér så bildet fyller rammen, senter-crop overflødig.
 * fit=blur: behold hele bildet, fyll sidekantene med uskarp versjon av seg selv
 *           (ingen crop — bra når komposisjonen ikke tåler beskjæring).
 */

import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

interface Args {
  images: string[];
  dir: string;
  output: string;
  aspect: string;
  seconds: number;
  xfade: number;
  fit: "cover" | "blur";
}

const ASPECTS: Record<string, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : undefined;
  };
  const expand = (p: string) => p.replace(/^~/, process.env.HOME || "");

  const images = get("--images")?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
  const dir = expand(get("--dir") ?? "");
  const output = get("--output");
  const aspect = get("--aspect") ?? "16:9";
  const seconds = Number(get("--seconds") ?? "4");
  const xfade = Number(get("--xfade") ?? "1");
  const fit = (get("--fit") ?? "cover") as "cover" | "blur";

  if (images.length < 2 || !output) {
    console.error(
      'Usage: compose-slideshow.ts --images "a,b,c" [--dir <base>] --output <out.mp4> ' +
        "[--aspect 16:9|9:16|1:1] [--seconds 4] [--xfade 1] [--fit cover|blur]",
    );
    process.exit(1);
  }
  if (!ASPECTS[aspect]) {
    console.error(`Ukjent --aspect "${aspect}". Gyldige: ${Object.keys(ASPECTS).join(", ")}`);
    process.exit(1);
  }
  if (xfade >= seconds) {
    console.error(`--xfade (${xfade}) må være mindre enn --seconds (${seconds}).`);
    process.exit(1);
  }
  return { images, dir, output: expand(output), aspect, seconds, xfade, fit };
}

/** Bygg -vf-streng for ett Ken Burns-klipp i ønsket fit-modus. */
function buildClipFilter(
  fit: "cover" | "blur",
  W: number,
  H: number,
  frames: number,
  zoomExpr: string,
): string {
  // Render på 2x for smooth zoompan, så ned til mål-res i zoompan (s=WxH).
  const W2 = W * 2;
  const H2 = H * 2;
  const kb = `zoompan=z='${zoomExpr}':d=${frames}:s=${W}x${H}:fps=30,setsar=1`;
  if (fit === "blur") {
    return (
      `split=2[a][b];` +
      `[a]scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},gblur=sigma=40[bg];` +
      `[b]scale=${W2}:${H2}:force_original_aspect_ratio=decrease[fg];` +
      `[bg][fg]overlay=(${W2}-w)/2:(${H2}-h)/2,${kb}`
    );
  }
  // cover
  return `scale=${W2}:${H2}:force_original_aspect_ratio=increase,crop=${W2}:${H2},${kb}`;
}

async function main() {
  const args = parseArgs();
  const [W, H] = ASPECTS[args.aspect];
  const frames = Math.round(args.seconds * 30);

  const outDir = path.dirname(args.output);
  await fs.mkdir(outDir, { recursive: true });
  const workDir = path.join(outDir, ".slideshow-tmp");
  await fs.mkdir(workDir, { recursive: true });

  console.log(`\ncompose-slideshow`);
  console.log(`  bilder:   ${args.images.length} (${args.fit}, ${args.aspect} = ${W}x${H})`);
  console.log(`  pr.bilde: ${args.seconds}s, kryss-fade ${args.xfade}s`);
  console.log(`  output:   ${args.output}\n`);

  // 1. Render hvert bilde som et Ken Burns-klipp (alternerende zoom-retning).
  console.log("Rendrer Ken Burns-klipp…");
  const clipPaths: string[] = [];
  for (let i = 0; i < args.images.length; i++) {
    const imagePath = path.isAbsolute(args.images[i])
      ? args.images[i]
      : path.join(args.dir, args.images[i]);
    const clipPath = path.join(workDir, `clip-${String(i).padStart(2, "0")}.mp4`);
    const zoomExpr =
      i % 2 === 0 ? `min(1+0.0005*on,1.06)` : `max(1.06-0.0005*on,1)`;
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-loop", "1",
        "-i", imagePath,
        "-vf", buildClipFilter(args.fit, W, H, frames, zoomExpr),
        "-t", String(args.seconds),
        "-c:v", "libx264",
        "-crf", "20",
        "-preset", "medium",
        "-pix_fmt", "yuv420p",
        "-an",
        clipPath,
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    clipPaths.push(clipPath);
    process.stdout.write(`  ${i + 1}/${args.images.length}\r`);
  }
  process.stdout.write("\n");

  // 2. Kjede klippene sammen med xfade. Offset for xfade #i = i*(seconds-xfade).
  console.log("Kryss-fade → final mp4…");
  const inputs: string[] = [];
  clipPaths.forEach((p) => inputs.push("-i", p));

  const filter: string[] = [];
  let prev = "0:v";
  for (let i = 1; i < clipPaths.length; i++) {
    const out = i === clipPaths.length - 1 ? "v" : `vx${i}`;
    const offset = (i * (args.seconds - args.xfade)).toFixed(3);
    filter.push(
      `[${prev}][${i}:v]xfade=transition=fade:duration=${args.xfade}:offset=${offset}[${out}]`,
    );
    prev = out;
  }

  execFileSync(
    "ffmpeg",
    [
      "-y",
      ...inputs,
      "-filter_complex", filter.join(";"),
      "-map", "[v]",
      "-c:v", "libx264",
      "-crf", "20",
      "-preset", "medium",
      "-pix_fmt", "yuv420p",
      "-an",
      args.output,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );

  const stat = await fs.stat(args.output);
  const total = args.images.length * args.seconds - (args.images.length - 1) * args.xfade;
  console.log(`\n✓ ${args.output}`);
  console.log(`  Størrelse: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Varighet:  ${total.toFixed(1)}s`);
  console.log(`\n  Work-dir (clips): ${workDir} (kan slettes manuelt)`);
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
