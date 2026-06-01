#!/usr/bin/env npx tsx
/**
 * Lytt-test for staged manus i .curation-staging/.
 *
 * Tar alle .md-filer i .curation-staging/<prosjekt>/, ekstraherer body
 * (etter frontmatter), kaller ElevenLabs og skriver MP3 til
 * .curation-staging/<prosjekt>/audio-preview/<spor>.mp3.
 *
 * Hensikt: La bruker høre på manus før vi committer til DB / public/audio.
 *
 * Usage:
 *   npx tsx scripts/lytt-test-curation-staging.ts stasjonskvartalet
 *   npx tsx scripts/lytt-test-curation-staging.ts stasjonskvartalet --only=mat-drikke
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import { generateAudio } from "../lib/audio-tour/elevenlabs-client";

config({ path: ".env.local" });

const projectSlug = process.argv[2];
if (!projectSlug) {
  console.error("Usage: lytt-test-curation-staging.ts <project-slug> [--only=<spor>]");
  process.exit(1);
}

const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlySpor = onlyArg?.split("=")[1];

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error("ELEVENLABS_API_KEY mangler i .env.local");
  process.exit(1);
}

const stagingDir = path.join(".curation-staging", projectSlug);
const previewDir = path.join(stagingDir, "audio-preview");

if (!fs.existsSync(stagingDir)) {
  console.error(`Fant ikke ${stagingDir}`);
  process.exit(1);
}

fs.mkdirSync(previewDir, { recursive: true });

const mdFiles = fs
  .readdirSync(stagingDir)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => (onlySpor ? f === `${onlySpor}.md` : true));

if (mdFiles.length === 0) {
  console.error("Ingen .md-filer matchet.");
  process.exit(1);
}

function extractBody(md: string): string {
  const fmMatch = md.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const afterFrontmatter = fmMatch ? fmMatch[1] : md;
  // Drop heading line (# Sporet) og whitespace, behold rest som én streng
  return afterFrontmatter
    .replace(/^#\s+.*$/m, "")
    .replace(/\n+/g, " ")
    .trim();
}

async function processOne(filename: string): Promise<void> {
  const spor = filename.replace(/\.md$/, "");
  const mdPath = path.join(stagingDir, filename);
  const mp3Path = path.join(previewDir, `${spor}.mp3`);
  const md = fs.readFileSync(mdPath, "utf-8");
  const text = extractBody(md);

  if (!text) {
    console.warn(`[${spor}] tom body — hoppet over`);
    return;
  }

  console.log(`[${spor}] genererer (${text.length} tegn)...`);
  const start = Date.now();
  const result = await generateAudio({ apiKey: apiKey!, text });
  const ms = Date.now() - start;
  fs.writeFileSync(mp3Path, result.bytes);
  const duration =
    result.timings.characterEndTimesSeconds[
      result.timings.characterEndTimesSeconds.length - 1
    ] ?? 0;
  console.log(
    `[${spor}] ferdig på ${(ms / 1000).toFixed(1)}s, lyd ${duration.toFixed(1)}s → ${mp3Path}`,
  );
}

(async () => {
  console.log(`Genererer ${mdFiles.length} spor til ${previewDir}\n`);
  for (const f of mdFiles) {
    try {
      await processOne(f);
    } catch (err) {
      console.error(`[${f}] FEIL:`, err);
    }
  }
  console.log("\nFerdig. Spill med:");
  console.log(`  open ${previewDir}/`);
})();
