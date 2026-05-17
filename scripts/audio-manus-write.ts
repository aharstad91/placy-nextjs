#!/usr/bin/env npx tsx
/**
 * Audio-tour manus-generering — Steg 8c.1 i /generate-rapport.
 *
 * Genererer pitch-manus (~70 ord per spor) for Hjem + hver aktiv kategori
 * og PATCH-er products.config.reportConfig:
 *   - themes[].audio.manus = "<70-ord pitch>"
 *   - heroAudio.manus      = "<70-ord pitch>" (Hjem-spor)
 *   - audioVersion: 1
 *
 * Audio-binærer + URL/voice/model genereres av Steg 8c.2 (audio-tour-build.ts).
 * Mellom 8c.1 og 8c.2 leser Andreas manusene som QA-checkpoint før
 * ElevenLabs-quota brennes.
 *
 * Usage:
 *   npx tsx scripts/audio-manus-write.ts <project_id>                 # dry-run
 *   npx tsx scripts/audio-manus-write.ts <project_id> --apply         # PATCH
 *   npx tsx scripts/audio-manus-write.ts <project_id> --apply --force # overskriv
 *
 * Mønster: følger scripts/gemini-grounding.ts (whitelist, optimistic lock,
 * Promise.allSettled, deep-merge PATCH, omit-on-failure, revalidateTag).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import {
  SYSTEM_PROMPT,
  buildManusPrompt,
} from "../lib/audio-tour/manus-prompt";
import {
  buildTrackInputs,
  stripWrappingQuotes,
  validateManus,
  type BuildTrackInput,
} from "../lib/audio-tour/manus";
import type {
  ReportConfig,
  ReportThemeConfig,
} from "../lib/types";

config({ path: ".env.local" });

// ─── Konfigurasjon ──────────────────────────────────────────────────────────

const CLAUDE_MODEL = "claude-sonnet-4-5";
const PARALLEL_LIMIT = 3;
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
  "heroAudio",
  "closingTitle",
  "closingText",
]);

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectId = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const DRY_RUN = !APPLY;

if (!projectId) {
  console.error(
    "Usage: npx tsx scripts/audio-manus-write.ts <project_id> [--apply] [--force]",
  );
  process.exit(1);
}

// ─── Env ────────────────────────────────────────────────────────────────────

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
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

// ─── Manus-generering per spor ──────────────────────────────────────────────

interface ManusOutcome {
  trackKey: string;
  trackKind: BuildTrackInput["kind"];
  trackLabel: string;
  status: "success" | "error" | "skipped";
  error?: string;
  manus?: string;
  wordCount?: number;
}

async function generateManusForTrack(
  client: Anthropic,
  input: BuildTrackInput,
): Promise<ManusOutcome> {
  const base: Pick<ManusOutcome, "trackKey" | "trackKind" | "trackLabel"> = {
    trackKey: input.key,
    trackKind: input.kind,
    trackLabel: input.label,
  };

  if (input.hasExistingManus && !FORCE) {
    return {
      ...base,
      status: "skipped",
      error: "eksisterende manus (bruk --force for å overskrive)",
    };
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

  let raw: string;
  try {
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
    const block = msg.content[0];
    if (!block || block.type !== "text") {
      return { ...base, status: "error", error: "Claude returnerte ikke-tekst-blokk" };
    }
    raw = block.text.trim();
  } catch (err) {
    return {
      ...base,
      status: "error",
      error: `claude: ${(err as Error).message}`,
    };
  }

  const cleaned = stripWrappingQuotes(raw);
  const validation = validateManus(cleaned);
  if (!validation.ok) {
    return {
      ...base,
      status: "error",
      error: `validering: ${validation.reason}`,
      manus: cleaned,
      wordCount: validation.wordCount,
    };
  }

  return {
    ...base,
    status: "success",
    manus: cleaned,
    wordCount: validation.wordCount,
  };
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
  assert(ANTHROPIC_API_KEY, "Missing ANTHROPIC_API_KEY in .env.local");
  assert(SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL");
  assert(SUPABASE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY");

  console.log("=== Audio-tour manus ===");
  console.log(`Project:   ${projectId}`);
  console.log(`Mode:      ${DRY_RUN ? "DRY RUN" : "APPLY"}${FORCE ? " (force)" : ""}`);
  console.log(`Model:     ${CLAUDE_MODEL}`);
  console.log();

  const [project, product] = await Promise.all([
    fetchProject(projectId!),
    fetchReportProduct(projectId!),
  ]);
  const existingConfig = (product.config ?? {}) as Record<string, unknown>;
  const existingRc =
    (existingConfig.reportConfig as ReportConfig | undefined) ?? {};

  console.log(`Project:   ${project.name} (${project.url_slug})`);
  console.log(`Product:   ${product.id}`);
  console.log(`Updated:   ${product.updated_at}`);

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
      "Ingen spor å generere (mangler heroIntro og themes med input). Exit 0.",
    );
    return;
  }
  console.log(`Spor:      ${inputs.length} (${inputs.map((i) => i.key).join(", ")})`);
  console.log();

  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `products-${product.id}-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(product, null, 2));
  console.log(`Backup:    ${backupPath}`);
  console.log();

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  const limit = pLimit(PARALLEL_LIMIT);
  const started = Date.now();
  const settled = await Promise.allSettled(
    inputs.map((i) => limit(() => generateManusForTrack(client, i))),
  );
  const durationMs = Date.now() - started;
  console.log(`Claude parallell: ${durationMs}ms (${inputs.length} spor)`);

  const outcomes: ManusOutcome[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      trackKey: inputs[i].key,
      trackKind: inputs[i].kind,
      trackLabel: inputs[i].label,
      status: "error",
      error: `unexpected: ${(r.reason as Error)?.message ?? String(r.reason)}`,
    };
  });

  console.log();
  console.log("--- Per spor ---");
  for (const o of outcomes) {
    const mark =
      o.status === "success" ? "✓" : o.status === "skipped" ? "⊘" : "✗";
    const suffix = o.status === "success" ? `${o.wordCount} ord` : o.error;
    console.log(`  ${mark} ${o.trackKey.padEnd(24)} ${suffix}`);
  }
  console.log();

  const errorCount = outcomes.filter((o) => o.status === "error").length;
  if (errorCount > 0) {
    console.error(
      `ABORT: ${errorCount}/${inputs.length} spor feilet. Ingen PATCH. Backup: ${backupPath}`,
    );
    process.exit(2);
  }

  const successCount = outcomes.filter((o) => o.status === "success").length;
  if (successCount === 0 && outcomes.every((o) => o.status === "skipped")) {
    console.log(
      "Alle spor allerede generert (bruk --force for å overskrive). Exit 0.",
    );
    return;
  }

  if (DRY_RUN) {
    console.log("--- DRY RUN — manus per spor ---");
    for (const o of outcomes) {
      if (o.status !== "success") continue;
      console.log(`\n## ${o.trackKey} (${o.trackLabel}) — ${o.wordCount} ord`);
      console.log(o.manus);
    }
    console.log();
    console.log(
      `DRY RUN ferdig. Re-kjør med --apply for å PATCH'e. Backup: ${backupPath}`,
    );
    return;
  }

  const manusByKey = new Map<string, string>();
  for (const o of outcomes) {
    if (o.status === "success" && o.manus) {
      manusByKey.set(o.trackKey, o.manus);
    }
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
    audioVersion: 1,
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
    `  Neste:    QA manusene (re-kjør i dry-run for å se), så kjør audio-tour-build.ts (Steg 8c.2).`,
  );
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
