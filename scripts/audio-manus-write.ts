#!/usr/bin/env npx tsx
/**
 * Audio-tour manus-pipeline — Steg 8c.1 i /generate-rapport.
 *
 * Splittes i `prepare` + `apply` med skill-utført mellomsteg (samme mønster
 * som scripts/curate-narrative.ts). Ingen Anthropic-API-key nødvendig —
 * Claude Code-skill driver genereringen.
 *
 * Flyt:
 *   1. `prepare <pid> [--force]`
 *      → leser DB, bygger track-inputs (Hjem + aktive temaer)
 *      → skriver .audio-staging/<pid>/<trackKey>.context.json per spor
 *      → sletter evt. eksisterende .audio-staging/<pid>/<trackKey>.manus.md
 *   2. (Skill leser hver context.json, skriver .manus.md per spor)
 *   3. `apply <pid>`
 *      → leser hver .manus.md, validerer (35-90 ord, banned-words)
 *      → deep-merge PATCH til reportConfig.themes[].audio.manus +
 *        reportConfig.heroAudio.manus + reportConfig.audioVersion = 1
 *      → optimistic lock via updated_at + revalidateTag
 *
 * Steg 8c.2 (audio-tour-build.ts) henter manusene fra DB og kaller
 * ElevenLabs — kjøres ETTER manuell QA av manusene.
 *
 * Usage:
 *   npx tsx scripts/audio-manus-write.ts prepare <project_id> [--force]
 *   npx tsx scripts/audio-manus-write.ts apply <project_id>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import {
  SYSTEM_PROMPT,
  buildManusPrompt,
} from "../lib/audio-tour/manus-prompt";
import {
  buildTrackInputs,
  validateManus,
  type BuildTrackInput,
} from "../lib/audio-tour/manus";
import type {
  ReportConfig,
  ReportThemeConfig,
} from "../lib/types";

config({ path: ".env.local" });

// ─── Konfigurasjon ──────────────────────────────────────────────────────────

const TARGET_WORDS = 70;

const ALLOWED_REPORTCONFIG_KEYS = new Set([
  "label",
  "heroIntro",
  "heroImage",
  "themes",
  "summary",
  "brokers",
  "cta",
  "mapStyle",
  "trails",
  "motiver",
  "personas",
  "audio",
  "audioVersion",
  "audioTourEnabled",
  "welcomeAudio",
  "heroAudio",
  "outroAudio",
  // Produktiserings-felt (Plan A)
  "district",
  "city",
  "assets",
  "closingTitle",
  "closingText",
]);

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const subcommand = args[0];
const projectId = args[1];
const FORCE = args.includes("--force");

if (!["prepare", "apply"].includes(subcommand) || !projectId) {
  console.error(
    "Usage:\n" +
      "  npx tsx scripts/audio-manus-write.ts prepare <project_id> [--force]\n" +
      "  npx tsx scripts/audio-manus-write.ts apply <project_id>",
  );
  process.exit(1);
}

// ─── Env ────────────────────────────────────────────────────────────────────

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

// ─── Staging-paths ──────────────────────────────────────────────────────────

function stagingDir(pid: string): string {
  return path.resolve(".audio-staging", pid);
}

function contextPath(pid: string, trackKey: string): string {
  return path.join(stagingDir(pid), `${trackKey}.context.json`);
}

function manusPath(pid: string, trackKey: string): string {
  return path.join(stagingDir(pid), `${trackKey}.manus.md`);
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

// ─── Prepare ────────────────────────────────────────────────────────────────

interface AudioContextFile {
  project_id: string;
  track_key: string;
  track_kind: BuildTrackInput["kind"];
  track_label: string;
  area_name: string;
  category_name?: string;
  prev_track_summary?: string;
  target_words: number;
  system_prompt: string;
  user_prompt: string;
  input_text: string;
}

async function prepare(): Promise<void> {
  console.log("=== audio-manus-write: PREPARE ===");
  console.log(`Project: ${projectId}`);
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

  const unknownKeys = Object.keys(existingRc).filter(
    (k) => !ALLOWED_REPORTCONFIG_KEYS.has(k),
  );
  if (unknownKeys.length > 0) {
    console.error(
      `ABORT: ukjent reportConfig-nøkkel: ${unknownKeys.join(", ")} — utvid whitelist først`,
    );
    process.exit(1);
  }

  const inputs = buildTrackInputs(existingRc, project.name);
  if (inputs.length === 0) {
    console.log(
      "Ingen spor å klargjøre (mangler heroIntro og themes med input). Exit 0.",
    );
    return;
  }

  const dir = stagingDir(projectId!);
  fs.mkdirSync(dir, { recursive: true });

  let prepared = 0;
  let skipped = 0;

  for (const input of inputs) {
    if (input.hasExistingManus && !FORCE) {
      console.log(
        `⊘ ${input.key.padEnd(24)} eksisterende manus (--force for overwrite)`,
      );
      skipped += 1;
      continue;
    }

    const userPrompt = buildManusPrompt({
      trackKind: input.kind,
      areaName: input.areaName,
      inputText: input.inputText,
      categoryName: input.categoryName,
      prevTrackSummary: input.prevTrackSummary,
      targetWords: TARGET_WORDS,
      lang: "no",
    });

    const ctx: AudioContextFile = {
      project_id: projectId!,
      track_key: input.key,
      track_kind: input.kind,
      track_label: input.label,
      area_name: input.areaName,
      category_name: input.categoryName,
      prev_track_summary: input.prevTrackSummary,
      target_words: TARGET_WORDS,
      system_prompt: SYSTEM_PROMPT,
      user_prompt: userPrompt,
      input_text: input.inputText,
    };

    fs.writeFileSync(
      contextPath(projectId!, input.key),
      JSON.stringify(ctx, null, 2),
    );

    const mp = manusPath(projectId!, input.key);
    if (fs.existsSync(mp)) fs.unlinkSync(mp);

    console.log(
      `✓ ${input.key.padEnd(24)} context klar — ${input.kind === "home" ? "Hjem" : input.label}`,
    );
    prepared += 1;
  }

  console.log();
  console.log(`Klargjort: ${prepared}, hoppet over: ${skipped}`);
  console.log();
  console.log("--- Neste steg ---");
  console.log(`  Staging-katalog: ${dir}`);
  console.log("  For hvert spor, les .context.json og skriv .manus.md");
  console.log("    - system_prompt + user_prompt er inkludert i context.json");
  console.log("    - manus.md skal kun inneholde selve pitchen (35-90 ord)");
  console.log("    - ingen overskrifter, ingen anførselstegn, ren prosa");
  console.log();
  console.log(
    `  npx tsx scripts/audio-manus-write.ts apply ${projectId}  # når alle manusene er skrevet`,
  );
}

// ─── Apply ──────────────────────────────────────────────────────────────────

interface ApplyOutcome {
  trackKey: string;
  status: "ok" | "missing" | "invalid";
  manus?: string;
  reason?: string;
  wordCount?: number;
}

async function apply(): Promise<void> {
  console.log("=== audio-manus-write: APPLY ===");
  console.log(`Project: ${projectId}`);
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

  const unknownKeys = Object.keys(existingRc).filter(
    (k) => !ALLOWED_REPORTCONFIG_KEYS.has(k),
  );
  if (unknownKeys.length > 0) {
    console.error(
      `ABORT: ukjent reportConfig-nøkkel: ${unknownKeys.join(", ")} — utvid whitelist først`,
    );
    process.exit(1);
  }

  const inputs = buildTrackInputs(existingRc, project.name);
  if (inputs.length === 0) {
    console.log("Ingen spor å applisere. Exit 0.");
    return;
  }

  const dir = stagingDir(projectId!);
  if (!fs.existsSync(dir)) {
    console.error(
      `ABORT: staging-katalog mangler (${dir}). Kjør prepare først.`,
    );
    process.exit(1);
  }

  const outcomes: ApplyOutcome[] = [];
  for (const input of inputs) {
    const mp = manusPath(projectId!, input.key);
    if (!fs.existsSync(mp)) {
      outcomes.push({
        trackKey: input.key,
        status: input.hasExistingManus ? "ok" : "missing",
        reason: input.hasExistingManus
          ? "manus.md mangler, men DB har eksisterende — behold"
          : "manus.md mangler",
      });
      continue;
    }
    const raw = fs.readFileSync(mp, "utf8").trim();
    const validation = validateManus(raw);
    if (!validation.ok) {
      outcomes.push({
        trackKey: input.key,
        status: "invalid",
        reason: validation.reason,
        wordCount: validation.wordCount,
      });
      continue;
    }
    outcomes.push({
      trackKey: input.key,
      status: "ok",
      manus: raw,
      wordCount: validation.wordCount,
    });
  }

  // Print sammendrag
  console.log();
  console.log("--- Per spor ---");
  for (const o of outcomes) {
    const mark =
      o.status === "ok" && o.manus
        ? "✓"
        : o.status === "ok"
          ? "⊘"
          : o.status === "missing"
            ? "✗"
            : "✗";
    const suffix =
      o.status === "ok" && o.wordCount
        ? `${o.wordCount} ord`
        : o.reason ?? "";
    console.log(`  ${mark} ${o.trackKey.padEnd(24)} ${suffix}`);
  }
  console.log();

  const failed = outcomes.filter(
    (o) => o.status === "invalid" || o.status === "missing",
  );
  if (failed.length > 0) {
    console.error(
      `ABORT: ${failed.length}/${outcomes.length} spor mangler eller er ugyldige. Fiks .manus.md og kjør apply på nytt.`,
    );
    process.exit(2);
  }

  const written = outcomes.filter((o) => o.manus);
  if (written.length === 0) {
    console.log("Ingen nye manus å skrive (alt er kun behold-eksisterende). Exit 0.");
    return;
  }

  // Backup
  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `products-${product.id}-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(product, null, 2));
  console.log(`Backup:    ${backupPath}`);

  const manusByKey = new Map<string, string>();
  for (const o of outcomes) {
    if (o.manus) manusByKey.set(o.trackKey, o.manus);
  }

  const existingThemes = existingRc.themes ?? [];
  const nextThemes: ReportThemeConfig[] = existingThemes.map((t) => {
    const m = manusByKey.get(t.id);
    if (!m) return t;
    const existingAudio = t.audio ?? { manus: "" };
    return { ...t, audio: { ...existingAudio, manus: m } };
  });

  const homeManus = manusByKey.get("home");
  const nextHeroAudio = homeManus
    ? { ...(existingRc.heroAudio ?? { manus: "" }), manus: homeManus }
    : existingRc.heroAudio;

  const nextReportConfig: ReportConfig = {
    ...existingRc,
    themes: nextThemes,
    ...(nextHeroAudio ? { heroAudio: nextHeroAudio } : {}),
    audioVersion: 5,
  };
  const nextConfig = { ...existingConfig, reportConfig: nextReportConfig };

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
    console.error(`Backup: ${backupPath}`);
    process.exit(1);
  }

  const patched = (await patchRes.json()) as ReportProduct[];
  if (!Array.isArray(patched) || patched.length === 0) {
    console.error(
      "PATCH påvirket 0 rader — concurrent write. config er endret siden vi leste.",
    );
    console.error(`Kjør scriptet på nytt. Backup: ${backupPath}`);
    process.exit(1);
  }
  console.log(`PATCH OK. ${patched.length} rad oppdatert.`);

  await revalidate(`product:${projectId}`);

  console.log();
  console.log("✓ Ferdig");
  console.log(`  Backup:   ${backupPath}`);
  console.log(
    `  Neste:    Steg 8c.2 — npx tsx scripts/audio-tour-build.ts (TTS via ElevenLabs).`,
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (subcommand === "prepare") await prepare();
  else if (subcommand === "apply") await apply();
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
