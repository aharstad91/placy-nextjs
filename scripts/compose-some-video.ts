#!/usr/bin/env npx tsx
/**
 * compose-some-video — sy sammen 4 ambient-klipp + statisk end-card + voice over
 * til én vertikal SOME-video.
 *
 * SINGLE-PASS: all prosessering i én ffmpeg-invokasjon med filter_complex.
 * Eliminer audio-drift som oppstår mellom multiple ffmpeg-steg (concat-demuxer
 * + separat audio-mux gir drift selv med PCM-mellomlagring).
 *
 * Input (i samme mappe):
 *   scene1.mp4, scene2.mp4, scene3.mp4, scene4.mp4   — Veo-output (8s 9:16)
 *   scene5.jpg                                       — statisk end-card-bilde
 *   voiceover.mp3                                    — ElevenLabs Erik
 *
 * Output: composed-some-<variant>.mp4
 *
 * Usage: npx tsx scripts/compose-some-video.ts <dir> [--variant=dagsreise|persona]
 *
 * Default variant: dagsreise. Leser voiceover-<variant>.mp3 fra <dir>.
 * Fallback til voiceover.mp3 hvis variant-spesifikk fil mangler.
 */

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

// Per-variant scene/end-card-lengder. Kategori-versjonen er kort (~14s) for å
// matche stramt voice over og treffe SOME-completion-sweet-spot (11-18s).
// Dagsreise/persona er lengre (~25s) fra original spike-format.
const DURATIONS = {
  dagsreise: { scene: 4.8, endCard: 5.5 },
  persona:   { scene: 4.8, endCard: 5.5 },
  kategori:  { scene: 2.4, endCard: 4.5 },
} as const;

const W = 720;
const H = 1280;
const FPS = 24;
const FFMPEG = "/opt/homebrew/bin/ffmpeg";

async function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", d => { stderr += d.toString(); });
    p.on("close", code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} failed (${code}):\n${stderr.slice(-1500)}`));
    });
  });
}

async function main() {
  const positional = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const variantArg = process.argv.find(a => a.startsWith("--variant="));
  const variant = (variantArg?.split("=")[1] ?? "dagsreise") as keyof typeof DURATIONS;
  if (!(variant in DURATIONS)) {
    console.error(`Ugyldig variant: ${variant}. Bruk ${Object.keys(DURATIONS).join(", ")}.`);
    process.exit(1);
  }

  const SCENE_DURATION = DURATIONS[variant].scene;
  const END_CARD_DURATION = DURATIONS[variant].endCard;
  const TOTAL_DURATION = SCENE_DURATION * 4 + END_CARD_DURATION;

  const dir = (positional[0] || "~/Desktop/placy-test/output").replace(/^~/, process.env.HOME || "");

  const sceneVideos = [1, 2, 3, 4].map(n => path.join(dir, `scene${n}.mp4`));
  const parentDir = path.dirname(dir);
  let endCardImage = path.join(dir, "scene5.jpg");
  try { await fs.access(endCardImage); } catch { endCardImage = path.join(parentDir, "scene5.jpg"); }

  // Voiceover-fil: variant-spesifikk først, fallback til legacy voiceover.mp3
  let voiceover = path.join(dir, `voiceover-${variant}.mp3`);
  try { await fs.access(voiceover); }
  catch { voiceover = path.join(dir, "voiceover.mp3"); }

  const output = path.join(dir, `composed-some-${variant}.mp4`);

  console.log(`\ncompose-some-video (single-pass) [variant: ${variant}]`);
  console.log(`  scenes:    ${sceneVideos.length} ambient mp4 @ ${SCENE_DURATION}s each`);
  console.log(`  voiceover: ${path.basename(voiceover)}`);
  console.log(`  end-card:  ${path.basename(endCardImage)} @ ${END_CARD_DURATION}s`);
  console.log(`  voice over: ${path.basename(voiceover)} (lagt parallelt, padded med stillhet på slutt)`);
  console.log(`  canvas:    ${W}x${H} @ ${FPS}fps`);
  console.log(`  duration:  ${TOTAL_DURATION.toFixed(1)}s`);
  console.log(`  output:    ${output}\n`);

  // Bygg filter_complex:
  // - For hver video [0..3]: trim, scale, crop, setsar, drop audio
  // - For bilde [4]: loop, scale, crop, ken-burns via zoompan
  // - Concat 5 video-streams til [outv]
  // - Audio [5]: ta som-er, pad med stillhet til total varighet
  const vfChain = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS}`;
  const sceneFilters = sceneVideos.map((_, i) =>
    `[${i}:v]trim=duration=${SCENE_DURATION},setpts=PTS-STARTPTS,${vfChain}[v${i}]`
  ).join(";\n");

  // End-card: zoompan d=duration*fps (132 frames for 5.5s @ 24fps), subtle zoom 1.0 → 1.05
  const endCardFrames = Math.round(END_CARD_DURATION * FPS);
  const endCardFilter =
    `[4:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},` +
    `zoompan=z='min(zoom+0.0008\\,1.05)':d=${endCardFrames}:s=${W}x${H}:fps=${FPS},` +
    `trim=duration=${END_CARD_DURATION},setpts=PTS-STARTPTS,setsar=1[v4]`;

  const concatFilter = `[v0][v1][v2][v3][v4]concat=n=5:v=1:a=0[outv]`;

  // Audio: pad med stillhet til full lengde slik at video ikke kuttes av -shortest implisitt
  const audioFilter = `[5:a]apad=whole_dur=${TOTAL_DURATION}[outa]`;

  const filterComplex = [
    sceneFilters,
    endCardFilter,
    concatFilter,
    audioFilter,
  ].join(";\n");

  const args = [
    "-y", "-loglevel", "error", "-stats",
    // 4 video inputs
    ...sceneVideos.flatMap(v => ["-i", v]),
    // image input (loop til filter trim'er det)
    "-loop", "1", "-t", String(END_CARD_DURATION), "-i", endCardImage,
    // audio input
    "-i", voiceover,
    // filter pipeline
    "-filter_complex", filterComplex,
    // map outputs
    "-map", "[outv]",
    "-map", "[outa]",
    // encode
    "-c:v", "libx264", "-preset", "fast", "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-c:a", "aac", "-b:a", "192k",
    "-ar", "44100", "-ac", "2",
    "-movflags", "+faststart",
    // hard-stopp slik at apad ikke renner over
    "-t", String(TOTAL_DURATION),
    output,
  ];

  console.log("Running single-pass ffmpeg…");
  await run(FFMPEG, args);

  const stats = await fs.stat(output);
  console.log(`\n✓ Composed: ${output}`);
  console.log(`  size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(err => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
