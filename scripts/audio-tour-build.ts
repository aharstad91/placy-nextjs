#!/usr/bin/env npx tsx
/**
 * Audio-tour TTS-bygg — Steg 8c.2 i /generate-rapport.
 *
 * Leser manusene som Steg 8c.1 (audio-manus-write.ts) skrev til
 * products.config.reportConfig:
 *   - reportConfig.heroAudio.manus
 *   - reportConfig.themes[].audio.manus
 *
 * Genererer MP3 per spor via ElevenLabs (Erik / norsk + turbo_v2_5),
 * skriver dem til `public/audio/{projectSlug}/{filename}.mp3` og PATCH-er
 * audio-metadata tilbake til DB:
 *   - audio.url, audio.voice, audio.model, audio.generatedAt
 *   - heroAudio.url, heroAudio.voice, heroAudio.model, heroAudio.generatedAt
 *
 * To-fase per Adversarial F3 (origin-doc review):
 *   1. TTS for alle spor parallelt, buffer i minne, valider min-bytes
 *      → hvis NOEN feiler: exit non-zero, ingen disk-write, ingen PATCH
 *   2. write alle MP3 + single batch PATCH til DB
 *
 * Usage:
 *   npx tsx scripts/audio-tour-build.ts <project_id>          # skipper spor med eksisterende audio.url
 *   npx tsx scripts/audio-tour-build.ts <project_id> --force  # re-generér alle
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
  type AudioTimings,
} from "../lib/audio-tour/elevenlabs-client";
import {
  audioAbsPath,
  audioRelPath,
} from "../lib/audio-tour/storage-paths";
import type {
  ReportConfig,
  ReportThemeAudio,
  ReportThemeConfig,
} from "../lib/types";

config({ path: ".env.local" });

// ─── Konfigurasjon ──────────────────────────────────────────────────────────

// ElevenLabs free plan = max 2 concurrent requests. Creator-plan tåler mer
// (10+); når Propr-skala er reelt og vi oppgraderer, kan dette økes.
const PARALLEL_LIMIT = 2;
const MIN_BYTES = 5000; // 5 KB = ~3 sek av MP3 ved 128kbps. Under det er det rate-limit/empty.

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectId = args.find((a) => !a.startsWith("--"));
const FORCE = args.includes("--force");

if (!projectId) {
  console.error(
    "Usage: npx tsx scripts/audio-tour-build.ts <project_id> [--force]",
  );
  process.exit(1);
}

// ─── Env ────────────────────────────────────────────────────────────────────

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERT FAILED: ${message}`);
    process.exit(1);
  }
}

assert(ELEVENLABS_API_KEY, "Missing ELEVENLABS_API_KEY in .env.local");
assert(SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL");
assert(SUPABASE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY");

// ─── Supabase ───────────────────────────────────────────────────────────────

interface ReportProduct {
  id: string;
  config: Record<string, unknown> | null;
  updated_at: string;
}

interface ProjectRow {
  id: string;
  name: string;
  url_slug: string;
}

async function fetchReportProduct(pid: string): Promise<ReportProduct> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?project_id=eq.${pid}&product_type=eq.report&select=id,config,updated_at`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );
  const body = await res.json();
  assert(
    Array.isArray(body),
    `Unexpected products response: ${JSON.stringify(body).slice(0, 300)}`,
  );
  const rows = body as ReportProduct[];
  assert(rows.length > 0, `No report product for project_id=${pid}`);
  return rows[0];
}

async function fetchProject(pid: string): Promise<ProjectRow> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?id=eq.${pid}&select=id,name,url_slug`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );
  const body = await res.json();
  assert(Array.isArray(body) && body.length > 0, `No project for id=${pid}`);
  return (body as ProjectRow[])[0];
}

// ─── Track collection ───────────────────────────────────────────────────────

interface TrackToBuild {
  key: string; // "home" eller theme.id
  label: string;
  manus: string;
  hasExistingUrl: boolean;
}

function collectTracks(reportConfig: ReportConfig): TrackToBuild[] {
  const tracks: TrackToBuild[] = [];

  const welcomeManus = reportConfig.welcomeAudio?.manus;
  if (welcomeManus && welcomeManus.trim().length > 0) {
    tracks.push({
      key: "welcome",
      label: "Velkomst",
      manus: welcomeManus,
      hasExistingUrl: Boolean(reportConfig.welcomeAudio?.url),
    });
  }

  const heroManus = reportConfig.heroAudio?.manus;
  if (heroManus && heroManus.trim().length > 0) {
    tracks.push({
      key: "home",
      label: "Hjem",
      manus: heroManus,
      hasExistingUrl: Boolean(reportConfig.heroAudio?.url),
    });
  }

  for (const t of reportConfig.themes ?? []) {
    const manus = t.audio?.manus;
    if (!manus || manus.trim().length === 0) continue;
    tracks.push({
      key: t.id,
      label: t.name,
      manus,
      hasExistingUrl: Boolean(t.audio?.url),
    });
  }

  const outroManus = reportConfig.outroAudio?.manus;
  if (outroManus && outroManus.trim().length > 0) {
    tracks.push({
      key: "outro",
      label: "Outro",
      manus: outroManus,
      hasExistingUrl: Boolean(reportConfig.outroAudio?.url),
    });
  }

  return tracks;
}

// ─── Phase 1: TTS in memory ─────────────────────────────────────────────────

interface TtsOutcome {
  trackKey: string;
  trackLabel: string;
  status: "success" | "error" | "skipped";
  error?: string;
  bytes?: Buffer;
  bytesLen?: number;
  voice?: string;
  model?: string;
  timings?: AudioTimings;
}

async function ttsTrack(track: TrackToBuild): Promise<TtsOutcome> {
  const base: Pick<TtsOutcome, "trackKey" | "trackLabel"> = {
    trackKey: track.key,
    trackLabel: track.label,
  };
  if (track.hasExistingUrl && !FORCE) {
    return {
      ...base,
      status: "skipped",
      error: "eksisterende audio.url (--force for å re-generere)",
    };
  }
  try {
    const { bytes, voice, model, timings } = await generateAudio({
      apiKey: ELEVENLABS_API_KEY!,
      text: track.manus,
    });
    if (bytes.length < MIN_BYTES) {
      return {
        ...base,
        status: "error",
        error: `MP3 for liten (${bytes.length} bytes < ${MIN_BYTES}) — sannsynlig empty-response/rate-limit`,
        bytesLen: bytes.length,
      };
    }
    return {
      ...base,
      status: "success",
      bytes,
      bytesLen: bytes.length,
      voice,
      model,
      timings,
    };
  } catch (err) {
    return {
      ...base,
      status: "error",
      error: (err as Error).message,
    };
  }
}

// ─── Revalidation ───────────────────────────────────────────────────────────

async function revalidate(tag: string): Promise<void> {
  if (!REVALIDATE_SECRET) {
    console.warn(
      "REVALIDATE_SECRET ikke satt — hopper over revalidateTag. Set i .env.local.",
    );
    return;
  }
  const url = `${SITE_URL}/api/revalidate?tag=${encodeURIComponent(tag)}&secret=${encodeURIComponent(REVALIDATE_SECRET)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(
        `revalidateTag feilet (${res.status}). Dev-server kanskje ikke oppe. Manuelt: curl "${url}"`,
      );
      return;
    }
    console.log(`revalidateTag OK: ${tag}`);
  } catch (err) {
    console.warn(
      `revalidateTag-fetch kastet: ${(err as Error).message}. Sjekk dev-server.`,
    );
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Audio-tour TTS-bygg ===");
  console.log(`Project: ${projectId}`);
  console.log(`Mode:    ${FORCE ? "FORCE (regenererer alle)" : "skip eksisterende"}`);
  console.log(`Voice:   ${ELEVENLABS_VOICE} (${ELEVENLABS_VOICE_NAME})`);
  console.log(`Model:   ${ELEVENLABS_MODEL}`);
  console.log();

  const [project, product] = await Promise.all([
    fetchProject(projectId!),
    fetchReportProduct(projectId!),
  ]);
  const existingConfig = (product.config ?? {}) as Record<string, unknown>;
  const existingRc =
    (existingConfig.reportConfig as ReportConfig | undefined) ?? {};

  console.log(`Project: ${project.name} (${project.url_slug})`);
  console.log(`Product: ${product.id}`);
  console.log(`Updated: ${product.updated_at}`);

  const tracks = collectTracks(existingRc);
  if (tracks.length === 0) {
    console.error(
      "ABORT: ingen manus i DB (heroAudio.manus + themes[].audio.manus mangler). Kjør audio-manus-write apply først.",
    );
    process.exit(1);
  }
  console.log(`Spor:    ${tracks.length} (${tracks.map((t) => t.key).join(", ")})`);
  console.log();

  // Backup
  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `products-${product.id}-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(product, null, 2));
  console.log(`Backup:  ${backupPath}`);
  console.log();

  // Phase 1: parallel TTS in memory
  console.log("--- Phase 1: TTS (parallell, in-memory) ---");
  const limit = pLimit(PARALLEL_LIMIT);
  const started = Date.now();
  const settled = await Promise.allSettled(
    tracks.map((t) => limit(() => ttsTrack(t))),
  );
  const durationMs = Date.now() - started;
  console.log(`Ferdig: ${durationMs}ms`);
  console.log();

  const outcomes: TtsOutcome[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      trackKey: tracks[i].key,
      trackLabel: tracks[i].label,
      status: "error",
      error: `unexpected: ${(r.reason as Error)?.message ?? String(r.reason)}`,
    };
  });

  for (const o of outcomes) {
    const mark =
      o.status === "success" ? "✓" : o.status === "skipped" ? "⊘" : "✗";
    const suffix =
      o.status === "success"
        ? `${((o.bytesLen ?? 0) / 1024).toFixed(0)} KB`
        : o.error;
    console.log(`  ${mark} ${o.trackKey.padEnd(24)} ${suffix}`);
  }
  console.log();

  const errorCount = outcomes.filter((o) => o.status === "error").length;
  if (errorCount > 0) {
    console.error(
      `ABORT: ${errorCount}/${outcomes.length} spor feilet i Phase 1. Ingen disk-write, ingen PATCH. Backup: ${backupPath}`,
    );
    process.exit(2);
  }

  const successOutcomes = outcomes.filter((o) => o.status === "success");
  if (successOutcomes.length === 0) {
    console.log("Alle spor allerede generert (bruk --force for å regenerere). Exit 0.");
    return;
  }

  // Phase 2: batch disk-write + batch PATCH
  console.log("--- Phase 2: disk-write + PATCH ---");
  const outDir = path.resolve(process.cwd(), "public", "audio", project.url_slug);
  fs.mkdirSync(outDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const audioByKey = new Map<
    string,
    {
      url: string;
      voice: string;
      model: string;
      generatedAt: string;
      timings: AudioTimings;
    }
  >();
  for (const o of successOutcomes) {
    if (!o.bytes || !o.voice || !o.model || !o.timings) continue;
    const dest = audioAbsPath(project.url_slug, o.trackKey);
    fs.writeFileSync(dest, o.bytes);
    console.log(`  ✓ wrote ${dest} (${((o.bytesLen ?? 0) / 1024).toFixed(0)} KB)`);
    audioByKey.set(o.trackKey, {
      url: audioRelPath(project.url_slug, o.trackKey),
      voice: o.voice,
      model: o.model,
      generatedAt,
      timings: o.timings,
    });
  }
  console.log();

  // Build next reportConfig — keep manus, add url/voice/model/generatedAt/timings
  const existingThemes = existingRc.themes ?? [];
  const nextThemes: ReportThemeConfig[] = existingThemes.map((t) => {
    const a = audioByKey.get(t.id);
    if (!a) return t;
    const existingAudio = t.audio ?? { manus: "" };
    const nextAudio: ReportThemeAudio = {
      ...existingAudio,
      url: a.url,
      voice: a.voice,
      model: a.model,
      generatedAt: a.generatedAt,
      timings: a.timings,
    };
    return { ...t, audio: nextAudio };
  });

  const welcomeAudio = audioByKey.get("welcome");
  const nextWelcomeAudio: ReportThemeAudio | undefined = welcomeAudio
    ? {
        ...(existingRc.welcomeAudio ?? { manus: "" }),
        url: welcomeAudio.url,
        voice: welcomeAudio.voice,
        model: welcomeAudio.model,
        generatedAt: welcomeAudio.generatedAt,
        timings: welcomeAudio.timings,
      }
    : existingRc.welcomeAudio;

  const homeAudio = audioByKey.get("home");
  const nextHeroAudio: ReportThemeAudio | undefined = homeAudio
    ? {
        ...(existingRc.heroAudio ?? { manus: "" }),
        url: homeAudio.url,
        voice: homeAudio.voice,
        model: homeAudio.model,
        generatedAt: homeAudio.generatedAt,
        timings: homeAudio.timings,
      }
    : existingRc.heroAudio;

  const outroAudio = audioByKey.get("outro");
  const nextOutroAudio: ReportThemeAudio | undefined = outroAudio
    ? {
        ...(existingRc.outroAudio ?? { manus: "" }),
        url: outroAudio.url,
        voice: outroAudio.voice,
        model: outroAudio.model,
        generatedAt: outroAudio.generatedAt,
        timings: outroAudio.timings,
      }
    : existingRc.outroAudio;

  const nextReportConfig: ReportConfig = {
    ...existingRc,
    themes: nextThemes,
    ...(nextWelcomeAudio ? { welcomeAudio: nextWelcomeAudio } : {}),
    ...(nextHeroAudio ? { heroAudio: nextHeroAudio } : {}),
    ...(nextOutroAudio ? { outroAudio: nextOutroAudio } : {}),
    audioVersion: 5,
  };
  const nextConfig = { ...existingConfig, reportConfig: nextReportConfig };

  // PATCH med optimistic lock
  const patchUrl = new URL(`${SUPABASE_URL}/rest/v1/products`);
  patchUrl.searchParams.set("id", `eq.${product.id}`);
  patchUrl.searchParams.set("updated_at", `eq.${product.updated_at}`);

  const patchRes = await fetch(patchUrl.toString(), {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ config: nextConfig }),
  });

  if (!patchRes.ok) {
    const text = await patchRes.text();
    console.error(`PATCH feilet: ${patchRes.status} ${text}`);
    console.error(
      `MP3-filene ligger på disk, men DB ble ikke oppdatert. Backup: ${backupPath}`,
    );
    process.exit(1);
  }

  const patched = (await patchRes.json()) as ReportProduct[];
  if (!Array.isArray(patched) || patched.length === 0) {
    console.error(
      "PATCH påvirket 0 rader — concurrent write. config er endret siden vi leste.",
    );
    console.error(
      `MP3-filer er skrevet, men DB ikke oppdatert. Kjør scriptet på nytt. Backup: ${backupPath}`,
    );
    process.exit(1);
  }
  console.log(`PATCH OK. ${patched.length} rad oppdatert.`);

  await revalidate(`product:${projectId}`);

  console.log();
  console.log("✓ Ferdig");
  console.log(`  MP3 i:    ${outDir}/`);
  console.log(`  Backup:   ${backupPath}`);
  console.log(`  Neste:    Lytt til ${outDir}/hjem.mp3 og signer kvalitet.`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
