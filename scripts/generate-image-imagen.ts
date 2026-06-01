#!/usr/bin/env npx tsx
/**
 * generate-image-imagen — text-to-image via Google Imagen 3 (Gemini API).
 *
 * Brukes når vi trenger fotorealistiske bilder for Reels-bg som vi ikke
 * har lisensiert kildemateriale for. Imagen 3 støtter 9:16 native og er
 * trent på fotorealistisk innhold. Output: PNG.
 *
 * Per CLAUDE.md "ALDRI runtime LLM-kall" — dette er build-time, output
 * lagres som statisk asset.
 *
 * Usage:
 *   npx tsx scripts/generate-image-imagen.ts \
 *     --prompt "..." \
 *     --output <path> \
 *     [--aspect 9:16] \
 *     [--samples 1]
 *
 * Aspect-ratio: 1:1, 3:4, 4:3, 9:16, 16:9
 */

import { config } from "dotenv";
import { promises as fs } from "node:fs";
import path from "node:path";

config({ path: path.resolve(process.cwd(), ".env.local") });

const API_KEY = process.env.GEMINI_API_KEY;
// Imagen 4 (standard kvalitet). Bytt til "imagen-4.0-fast-generate-001"
// for billigere/raskere genereing eller "imagen-4.0-ultra-generate-001"
// for høyere kvalitet.
const DEFAULT_MODEL = "imagen-4.0-generate-001";

if (!API_KEY) {
  console.error("Mangler GEMINI_API_KEY i .env.local");
  process.exit(1);
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] ? argv[idx + 1] : undefined;
  };
  const prompt = get("--prompt");
  const output = get("--output");
  const aspect = get("--aspect") ?? "9:16";
  const samples = Number(get("--samples") ?? "1");
  const model = get("--model") ?? DEFAULT_MODEL;

  if (!prompt || !output) {
    console.error(
      "Usage: generate-image-imagen.ts --prompt \"...\" --output <path> [--aspect 9:16] [--samples 1] [--model <model-id>]",
    );
    process.exit(1);
  }
  return {
    prompt,
    output: output.replace(/^~/, process.env.HOME || ""),
    aspect,
    samples,
    model,
  };
}

interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string;
    mimeType?: string;
    raiFilteredReason?: string;
  }>;
  error?: { code: number; message: string };
}

async function main() {
  const { prompt, output, aspect, samples, model } = parseArgs();

  console.log(`\ngenerate-image-imagen`);
  console.log(`  model:   ${model}`);
  console.log(`  aspect:  ${aspect}`);
  console.log(`  samples: ${samples}`);
  console.log(`  output:  ${output}`);
  console.log(`  prompt:  ${prompt}\n`);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${API_KEY}`;
  const body = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: samples,
      aspectRatio: aspect,
      personGeneration: "allow_adult",
    },
  };

  console.log("Kaller Imagen 3…");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) {
    console.error(`✗ Imagen failed (${res.status}): ${txt.slice(0, 500)}`);
    process.exit(1);
  }
  const json = JSON.parse(txt) as ImagenResponse;
  const preds = json.predictions ?? [];
  if (preds.length === 0) {
    console.error("Ingen predictions i respons:");
    console.error(JSON.stringify(json, null, 2));
    process.exit(1);
  }

  await fs.mkdir(path.dirname(output), { recursive: true });

  for (let i = 0; i < preds.length; i++) {
    const pred = preds[i];
    if (pred.raiFilteredReason) {
      console.error(`✗ Sample ${i}: RAI-blokkert — ${pred.raiFilteredReason}`);
      continue;
    }
    if (!pred.bytesBase64Encoded) {
      console.error(`✗ Sample ${i}: ingen bytes`);
      continue;
    }
    const ext = pred.mimeType?.includes("png") ? ".png" : ".jpg";
    const stem = output.replace(/\.(png|jpg|jpeg)$/i, "");
    const outPath =
      samples > 1 ? `${stem}-${i + 1}${ext}` : `${stem}${ext}`;
    const buf = Buffer.from(pred.bytesBase64Encoded, "base64");
    await fs.writeFile(outPath, buf);
    console.log(`✓ ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
}

main().catch((err) => {
  console.error("\nFailed:", err.message);
  process.exit(1);
});
