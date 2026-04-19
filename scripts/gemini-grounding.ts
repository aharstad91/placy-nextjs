#!/usr/bin/env npx tsx
/**
 * Gemini grounding — populate products.config.reportConfig.themes[].grounding
 *
 * Usage:
 *   npx tsx scripts/gemini-grounding.ts <project_id>                # dry-run
 *   npx tsx scripts/gemini-grounding.ts <project_id> --apply        # write
 *   npx tsx scripts/gemini-grounding.ts <project_id> --apply --force  # overwrite existing
 *
 * Flow (følger scripts/seed-wesselslokka-summary.ts mønster):
 *   1. fetch project → report-product (med updated_at for optimistic lock)
 *   2. whitelist-guard på eksisterende reportConfig-nøkler
 *   3. backup full row til backups/
 *   4. parallell Gemini-kall (Promise.allSettled)
 *   5. parallell URL-resolve per kategori (p-limit=5, SSRF-safe)
 *   6. totalfeil-sjekk: ≥5/7 feilet → exit 2 (ingen write)
 *   7. deep-merge PATCH: match themes på id, omit grounding ved fail
 *   8. PATCH med updated_at=eq.{read_value} (optimistic lock)
 *   9. post-write deep-equal for preserved keys
 *  10. revalidateTag via /api/revalidate
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import {
  callGemini,
  GEMINI_MODEL,
  resolveUrlsParallel,
  type CallGeminiResult,
  type ResolvedUrl,
} from "../lib/gemini";
import type {
  ReportThemeConfig,
  ReportThemeGrounding,
  ReportThemeGroundingSource,
} from "../lib/types";

config({ path: ".env.local" });

// ─── Configuration ──────────────────────────────────────────────────────────

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
  // Skill-kontekst-felt (ikke typet men lagret i DB — brukes av /generate-rapport)
  "motiver",
  "personas",
  // Deprecated but tolerated — old rows may still carry these
  "closingTitle",
  "closingText",
]);

const PRESERVED_REPORTCONFIG_KEYS = [
  "label",
  "heroIntro",
  "heroImage",
  "summary",
  "brokers",
  "cta",
  "mapStyle",
  "trails",
  "motiver",
  "personas",
];

const TOTAL_FAILURE_THRESHOLD = 5; // ≥5 av 7 feilet → abort

// ─── Arg parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectId = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const DRY_RUN = !APPLY;

if (!projectId) {
  console.error(
    "Usage: npx tsx scripts/gemini-grounding.ts <project_id> [--apply] [--force]",
  );
  process.exit(1);
}

// ─── Env ────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
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

// ─── Supabase types ─────────────────────────────────────────────────────────

interface ReportProduct {
  id: string;
  config: Record<string, unknown> | null;
  updated_at: string;
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

// ─── Grounding assembly per theme ───────────────────────────────────────────

interface GroundingOutcome {
  themeId: string;
  themeName: string;
  query: string;
  status: "success" | "error" | "skipped";
  error?: string;
  grounding?: ReportThemeGrounding;
}

async function processTheme(
  theme: ReportThemeConfig,
  existingHasGrounding: boolean,
): Promise<GroundingOutcome> {
  const base = { themeId: theme.id, themeName: theme.name, query: theme.readMoreQuery ?? "" };

  if (!theme.readMoreQuery) {
    return { ...base, status: "skipped", error: "no readMoreQuery" };
  }
  if (existingHasGrounding && !FORCE) {
    return { ...base, status: "skipped", error: "existing grounding (use --force to overwrite)" };
  }

  let geminiResult: CallGeminiResult;
  try {
    geminiResult = await callGemini(theme.readMoreQuery, {
      apiKey: GEMINI_API_KEY!,
      timeoutMs: 30_000,
    });
  } catch (err) {
    return {
      ...base,
      status: "error",
      error: `gemini: ${(err as Error).message}`,
    };
  }

  // Resolve redirect-URLer — parallell, SSRF-safe. Per-URL-feil → behold redirect.
  const resolved = await resolveUrlsParallel(
    geminiResult.rawSources.map((s) => s.redirectUrl),
    { concurrency: 5 },
  );

  const byRedirect = new Map<string, ResolvedUrl | Error>();
  for (const { input, result } of resolved) byRedirect.set(input, result);

  const sources: ReportThemeGroundingSource[] = geminiResult.rawSources.map((src) => {
    const r = byRedirect.get(src.redirectUrl);
    if (r && !(r instanceof Error)) {
      return {
        title: src.title,
        url: r.url,
        redirectUrl: r.redirectUrl,
        domain: r.domain,
      };
    }
    // URL-resolve feilet — behold redirect som url, utled domene best vi kan
    let domain = "";
    try {
      domain = new URL(src.redirectUrl).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    return {
      title: src.title,
      url: src.redirectUrl,
      redirectUrl: src.redirectUrl,
      domain,
    };
  });

  const grounding: ReportThemeGrounding = {
    narrative: geminiResult.narrative,
    sources,
    searchEntryPointHtml: geminiResult.searchEntryPointHtml,
    fetchedAt: new Date().toISOString(),
    groundingVersion: 1,
    meta: {
      model: GEMINI_MODEL,
      searchQueries: geminiResult.searchQueries,
    },
  };

  return { ...base, status: "success", grounding };
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
  assert(GEMINI_API_KEY, "Missing GEMINI_API_KEY in .env.local");
  assert(SUPABASE_URL, "Missing NEXT_PUBLIC_SUPABASE_URL");
  assert(SUPABASE_KEY, "Missing SUPABASE_SERVICE_ROLE_KEY");

  console.log("=== Gemini grounding ===");
  console.log(`Project:   ${projectId}`);
  console.log(`Mode:      ${DRY_RUN ? "DRY RUN" : "APPLY"}${FORCE ? " (force)" : ""}`);
  console.log(`Model:     ${GEMINI_MODEL}`);
  console.log();

  // 1. Fetch
  const product = await fetchReportProduct(projectId!);
  const existingConfig = (product.config ?? {}) as Record<string, unknown>;
  const existingRc =
    (existingConfig.reportConfig as Record<string, unknown> | undefined) ?? {};

  console.log(`Product:   ${product.id}`);
  console.log(`Updated:   ${product.updated_at}`);

  // 2. Whitelist-guard — hard fail ved ukjent nøkkel
  const unknownKeys = Object.keys(existingRc).filter(
    (k) => !ALLOWED_REPORTCONFIG_KEYS.has(k),
  );
  if (unknownKeys.length > 0) {
    console.error(
      `ABORT: ukjent reportConfig-nøkkel: ${unknownKeys.join(", ")} — utvid whitelist først`,
    );
    process.exit(1);
  }

  const themes = (existingRc.themes as ReportThemeConfig[] | undefined) ?? [];
  assert(themes.length > 0, "No themes in reportConfig");
  console.log(`Themes:    ${themes.length}`);
  console.log();

  // 3. Backup (alltid — også på dry-run, gratis forsikring)
  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `products-${product.id}-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(product, null, 2));
  console.log(`Backup:    ${backupPath}`);
  console.log();

  // 4. Parallell Gemini + URL-resolve per tema
  const started = Date.now();
  const settled = await Promise.allSettled(
    themes.map((t) => processTheme(t, Boolean(t.grounding))),
  );
  const durationMs = Date.now() - started;
  console.log(`Gemini parallell: ${durationMs}ms (${themes.length} kategorier)`);

  const outcomes: GroundingOutcome[] = settled.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      themeId: themes[i].id,
      themeName: themes[i].name,
      query: themes[i].readMoreQuery ?? "",
      status: "error",
      error: `unexpected: ${(r.reason as Error)?.message ?? String(r.reason)}`,
    };
  });

  // 5. Print summary
  console.log();
  console.log("--- Outcome per theme ---");
  for (const o of outcomes) {
    const mark =
      o.status === "success" ? "✓" : o.status === "skipped" ? "⊘" : "✗";
    const suffix =
      o.status === "success"
        ? `${o.grounding!.sources.length} kilder, ${o.grounding!.narrative.length} tegn`
        : o.error;
    console.log(`  ${mark} ${o.themeId.padEnd(24)} ${suffix}`);
  }
  console.log();

  // 6. Totalfeil-abort — kun reell "error" teller (skipped ≠ feilet)
  const errorCount = outcomes.filter((o) => o.status === "error").length;
  if (errorCount >= TOTAL_FAILURE_THRESHOLD) {
    console.error(
      `ABORT: ${errorCount}/${themes.length} kategorier feilet (terskel ${TOTAL_FAILURE_THRESHOLD}). Ingen write.`,
    );
    process.exit(2);
  }

  const successCount = outcomes.filter((o) => o.status === "success").length;
  if (successCount === 0) {
    console.error("ABORT: 0 vellykkede kategorier. Ingen write.");
    process.exit(2);
  }

  // 7. Build groundingByThemeId
  const groundingByThemeId = new Map<string, ReportThemeGrounding>();
  for (const o of outcomes) {
    if (o.status === "success" && o.grounding) {
      groundingByThemeId.set(o.themeId, o.grounding);
    }
  }

  if (DRY_RUN) {
    console.log("--- DRY RUN sample (første 300 tegn per vellykket tema) ---");
    for (const o of outcomes) {
      if (o.status !== "success") continue;
      console.log(`\n## ${o.themeId}`);
      console.log(o.grounding!.narrative.slice(0, 300) + "...");
    }
    console.log();
    console.log(
      `DRY RUN ferdig. Re-kjør med --apply for å PATCH'e. Backup: ${backupPath}`,
    );
    return;
  }

  // 8. Deep-merge — preservér alle eksisterende tema-felt, sett kun grounding
  const existingThemes = themes;
  const nextThemes = existingThemes.map((t) => {
    const g = groundingByThemeId.get(t.id);
    if (!g) return t; // omit — behold eksisterende grounding (hvis finnes)
    return { ...t, grounding: g };
  });

  const nextReportConfig = { ...existingRc, themes: nextThemes };
  const nextConfig = { ...existingConfig, reportConfig: nextReportConfig };

  // 9. PATCH med optimistic lock
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

  // 10. Post-write deep-equal for preserved keys
  const verified = await fetchReportProduct(projectId!);
  const verifiedRc =
    ((verified.config as Record<string, unknown>)?.reportConfig as
      | Record<string, unknown>
      | undefined) ?? {};

  for (const key of PRESERVED_REPORTCONFIG_KEYS) {
    if (key === "themes") continue;
    const before = JSON.stringify(existingRc[key] ?? null);
    const after = JSON.stringify(verifiedRc[key] ?? null);
    if (before !== after) {
      console.error(
        `ASSERT FAILED: preserved-key '${key}' ble endret! Rollback: npx tsx scripts/restore-product-config.ts ${backupPath}`,
      );
      process.exit(1);
    }
  }
  console.log("Post-write: preserved keys uendret");

  // Themes: alle ikke-grounding-felter per tema skal være uendret
  const verifiedThemes = (verifiedRc.themes as ReportThemeConfig[]) ?? [];
  for (const before of existingThemes) {
    const after = verifiedThemes.find((t) => t.id === before.id);
    if (!after) {
      console.error(`ASSERT FAILED: tema '${before.id}' mangler etter PATCH`);
      process.exit(1);
    }
    const strip = (t: ReportThemeConfig) => {
      const { grounding: _g, ...rest } = t;
      return rest;
    };
    if (JSON.stringify(strip(before)) !== JSON.stringify(strip(after))) {
      console.error(
        `ASSERT FAILED: tema '${before.id}' har endrede ikke-grounding-felt`,
      );
      process.exit(1);
    }
  }
  console.log("Post-write: tema-felter (ex grounding) uendret");

  // 11. Revalidate — tag matcher page-side wrapper (lib/data-server.ts getReportProductCached)
  await revalidate(`product:${projectId}`);

  console.log();
  console.log("✓ Ferdig");
  console.log(`  Backup:   ${backupPath}`);
  console.log(
    `  Rollback: npx tsx scripts/restore-product-config.ts ${backupPath}`,
  );
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
