#!/usr/bin/env npx tsx
/**
 * animate-scene-veo — image-to-video via Google Veo (Gemini API)
 *
 * Usage:
 *   npx tsx scripts/animate-scene-veo.ts <input-image> <output-dir> \
 *     [--prompt "..."] [--negative-prompt "..."] [--duration 8] [--model veo-3.0-fast-generate-001]
 *
 * Eksempel:
 *   npx tsx scripts/animate-scene-veo.ts \
 *     ~/Desktop/placy-test/scene1.jpg \
 *     ~/Desktop/placy-test/output \
 *     --prompt "subtle water ripples, slow drifting clouds, no zoom, photorealistic" \
 *     --negative-prompt "timelapse, accelerated motion"
 *
 * MERK: Veo har sterk trenings-prior for å "timelapse" skyer og lys. For
 * å unngå dette, bruk eksplisitt slow-motion-språk i positiv prompt
 * ("real-time playback speed", "nearly stationary clouds") OG fyll
 * negative prompt med termer som "timelapse, hyperlapse, accelerated,
 * fast-forward, sped up". Default-negative dekker dette.
 *
 * Output: <output-dir>/<input-stem>.mp4
 */

import { config } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const API_KEY = process.env.GEMINI_API_KEY;
const DEFAULT_MODEL = "veo-3.0-fast-generate-001";
const FALLBACK_MODELS = ["veo-3.0-generate-001", "veo-2.0-generate-001"];

if (!API_KEY) {
  console.error("Mangler GEMINI_API_KEY i .env.local");
  process.exit(1);
}

const DEFAULT_NEGATIVE_PROMPT =
  "timelapse, time-lapse, hyperlapse, accelerated motion, fast-forward, sped up, " +
  "fast clouds, fast-moving clouds, dramatic motion, jittery motion, " +
  "camera zoom, camera pan, camera shake, motion blur, flickering, " +
  "cartoon, animation, illustration";

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(
      "Usage: animate-scene-veo.ts <input-image> <output-dir> " +
        "[--prompt \"...\"] [--negative-prompt \"...\"] [--duration 8] [--model <modelname>]",
    );
    process.exit(1);
  }
  const input = args[0].replace(/^~/, process.env.HOME || "");
  const outputDir = args[1].replace(/^~/, process.env.HOME || "");
  let prompt =
    "real-time playback speed, subtle naturalistic motion, slow cinematic pacing, " +
    "nearly stationary clouds with barely perceptible drift, " +
    "gentle ambient movement, photorealistic, preserve composition, no zoom, no camera movement";
  let negativePrompt = DEFAULT_NEGATIVE_PROMPT;
  let duration = 8;
  let model = DEFAULT_MODEL;

  for (let i = 2; i < args.length; i++) {
    if (args[i] === "--prompt" && args[i + 1]) prompt = args[++i];
    else if (args[i] === "--negative-prompt" && args[i + 1]) negativePrompt = args[++i];
    else if (args[i] === "--duration" && args[i + 1]) duration = Number(args[++i]);
    else if (args[i] === "--model" && args[i + 1]) model = args[++i];
  }

  return { input, outputDir, prompt, negativePrompt, duration, model };
}

async function imageToBase64(filepath: string): Promise<{ data: string; mime: string }> {
  const buf = await fs.readFile(filepath);
  const ext = path.extname(filepath).slice(1).toLowerCase();
  const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
  return { data: buf.toString("base64"), mime };
}

interface VeoOperation {
  name: string;
  done?: boolean;
  error?: { code: number; message: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string } }>;
    };
    // Older shape
    predictions?: Array<{ video?: { uri?: string }; videoUri?: string }>;
  };
}

async function startOperation(opts: {
  model: string;
  prompt: string;
  negativePrompt: string;
  imageB64: string;
  mimeType: string;
  duration: number;
}): Promise<VeoOperation> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:predictLongRunning?key=${API_KEY}`;
  const body = {
    instances: [{
      prompt: opts.prompt,
      image: {
        bytesBase64Encoded: opts.imageB64,
        mimeType: opts.mimeType,
      },
    }],
    parameters: {
      aspectRatio: "9:16",
      personGeneration: "allow_adult",
      durationSeconds: opts.duration,
      negativePrompt: opts.negativePrompt,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    throw new Error(`Veo start failed (${res.status}): ${txt}`);
  }
  return JSON.parse(txt);
}

async function pollOperation(operationName: string): Promise<VeoOperation> {
  const startTime = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${API_KEY}`;
  while (true) {
    const res = await fetch(url);
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Poll failed (${res.status}): ${txt}`);
    }
    const op: VeoOperation = await res.json();
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`\r  [${elapsed}s] done: ${op.done ?? false}     `);
    if (op.done) {
      process.stdout.write("\n");
      return op;
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}

function extractVideoUri(op: VeoOperation): string | null {
  const samples = op.response?.generateVideoResponse?.generatedSamples;
  if (samples && samples.length > 0 && samples[0].video?.uri) return samples[0].video.uri;
  const preds = op.response?.predictions;
  if (preds && preds.length > 0) {
    if (preds[0].video?.uri) return preds[0].video.uri;
    if (preds[0].videoUri) return preds[0].videoUri;
  }
  return null;
}

async function downloadVideo(uri: string, dest: string): Promise<void> {
  const url = uri.includes("?") ? `${uri}&key=${API_KEY}` : `${uri}?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Download failed (${res.status}): ${txt.slice(0, 500)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function tryWithModel(model: string, opts: {
  prompt: string;
  negativePrompt: string;
  imageB64: string;
  mimeType: string;
  duration: number;
}): Promise<VeoOperation> {
  console.log(`\nTrying model: ${model}`);
  const op = await startOperation({ model, ...opts });
  console.log(`  operation: ${op.name}`);
  if (op.done) return op;
  console.log("Polling for completion (Veo typically takes 1-6 min)…");
  return pollOperation(op.name);
}

async function main() {
  const { input, outputDir, prompt, negativePrompt, duration, model } = parseArgs();
  await fs.mkdir(outputDir, { recursive: true });

  const stem = path.basename(input, path.extname(input));
  const outputFile = path.join(outputDir, `${stem}.mp4`);

  console.log(`\nanimate-scene-veo`);
  console.log(`  input:           ${input}`);
  console.log(`  output:          ${outputFile}`);
  console.log(`  prompt:          ${prompt}`);
  console.log(`  negativePrompt:  ${negativePrompt}`);
  console.log(`  duration:        ${duration}s, aspect: 9:16, audio: off\n`);

  console.log("Encoding image…");
  const { data: imageB64, mime: mimeType } = await imageToBase64(input);
  console.log(`  base64 size: ${(imageB64.length / 1024).toFixed(0)} KB, mime: ${mimeType}`);

  const tryModels = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
  let op: VeoOperation | null = null;
  let lastError: Error | null = null;

  for (const m of tryModels) {
    try {
      op = await tryWithModel(m, { prompt, negativePrompt, imageB64, mimeType, duration });
      if (op.error) {
        console.error(`  ✗ ${m}: ${op.error.message}`);
        lastError = new Error(op.error.message);
        op = null;
        continue;
      }
      break;
    } catch (err) {
      lastError = err as Error;
      console.error(`  ✗ ${m}: ${(err as Error).message.slice(0, 200)}`);
      if (!(err as Error).message.match(/404|not found|model/i)) {
        // non-recoverable, don't try fallbacks
        throw err;
      }
    }
  }

  if (!op) {
    throw lastError ?? new Error("Alle modeller feilet");
  }

  const videoUri = extractVideoUri(op);
  if (!videoUri) {
    console.error("Ingen video-URI i respons:");
    console.error(JSON.stringify(op, null, 2));
    process.exit(1);
  }

  console.log(`Downloading: ${videoUri}`);
  await downloadVideo(videoUri, outputFile);
  console.log(`\n✓ Saved: ${outputFile}`);
}

main().catch(err => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
