#!/usr/bin/env npx tsx
/**
 * Curate narrative — Steg 2.7 i /generate-rapport.
 *
 * Orkestrerer Claude-kuratering av grounding.narrative → curatedNarrative
 * med POI-inline-lenker. Claude kan ikke kalles som API (ingen key), så
 * scriptet splittes i `prepare` + `apply` med skill-utført mellomsteg.
 *
 * Flow:
 *   1. `prepare <pid>` → skriver .curation-staging/<pid>/<theme>.context.json
 *      per tema (sanitized gemini_narrative + poi_set + target_length)
 *   2. (Skill/Claude leser context, skriver .curated.md per tema)
 *   3. `apply <pid>` → leser .curated.md, validerer + POI-linker + PATCH
 *
 * Sikkerhet:
 *   - gemini_narrative sanitized: strip markdown-lenker, kontroll-chars
 *   - NER-basert fakta-sjekk mot gemini ∪ poi_set.name
 *   - POI-UUID whitelist (ikke bare format)
 *   - Hard length-cap 1200 tegn
 *   - Character-class filter (zero-width, RTL-override)
 *
 * Atomicity:
 *   - Single PATCH for alle temaer etter in-memory validering
 *   - Per-tema version-bump (v1 og v2 coexisting OK)
 *   - Backup FØR final PATCH
 *   - Optimistic lock via updated_at
 *   - Idempotens: skip hvis curatedAt > fetchedAt (med mindre --force)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import {
  linkPoisInMarkdown,
  type PoiEntry,
} from "../lib/curation/poi-linker";
import { sanitizeGeminiInput } from "../lib/curation/sanitize-input";
import { validateCuratedNarrative } from "../lib/curation/validator";
import type {
  ReportThemeConfig,
  ReportThemeGrounding,
} from "../lib/types";

config({ path: ".env.local" });

// ─── CLI ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const subcommand = args[0];
const projectId = args[1];
const FORCE = args.includes("--force");
const themeFilter = (() => {
  const idx = args.indexOf("--theme");
  return idx >= 0 ? args[idx + 1] : undefined;
})();

if (
  !["prepare", "apply"].includes(subcommand) ||
  !projectId
) {
  console.error(
    "Usage:\n" +
      "  npx tsx scripts/curate-narrative.ts prepare <project_id> [--theme <id>] [--force]\n" +
      "  npx tsx scripts/curate-narrative.ts apply <project_id> [--theme <id>]",
  );
  process.exit(1);
}

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

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportProductRow {
  id: string;
  config: Record<string, unknown> | null;
  updated_at: string;
}

interface PoiRow {
  id: string;
  name: string;
  category_id: string;
}

interface ProjectPoiRow {
  poi_id: string;
}

interface ContextFile {
  project_id: string;
  theme_id: string;
  theme_name: string;
  theme_categories: string[];
  gemini_narrative_sanitized: string;
  gemini_source_domains: string[];
  poi_set: PoiEntry[];
  target_length_min: number;
  target_length_max: number;
  fetchedAt: string;
}

// ─── Supabase helpers ───────────────────────────────────────────────────────

async function fetchReportProduct(pid: string): Promise<ReportProductRow> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?project_id=eq.${pid}&product_type=eq.report&select=id,config,updated_at`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );
  const body = (await res.json()) as ReportProductRow[];
  assert(
    Array.isArray(body) && body.length > 0,
    `No report product for project_id=${pid}`,
  );
  return body[0];
}

async function fetchProjectPois(pid: string): Promise<PoiRow[]> {
  const linksRes = await fetch(
    `${SUPABASE_URL}/rest/v1/project_pois?project_id=eq.${pid}&select=poi_id`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );
  const links = (await linksRes.json()) as ProjectPoiRow[];
  if (!Array.isArray(links) || links.length === 0) return [];

  const poiIds = links.map((l) => l.poi_id);
  const pois: PoiRow[] = [];
  // Chunk queries (Postgrest har limit på in-filter)
  const CHUNK = 200;
  for (let i = 0; i < poiIds.length; i += CHUNK) {
    const chunk = poiIds.slice(i, i + CHUNK);
    const inList = chunk.map((id) => `"${id}"`).join(",");
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/pois?id=in.(${inList})&select=id,name,category_id`,
      {
        headers: {
          apikey: SUPABASE_KEY!,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      },
    );
    const rows = (await res.json()) as PoiRow[];
    if (Array.isArray(rows)) pois.push(...rows);
  }
  return pois;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stagingDir(pid: string): string {
  return path.resolve(".curation-staging", pid);
}

function contextPath(pid: string, themeId: string): string {
  return path.join(stagingDir(pid), `${themeId}.context.json`);
}

function curatedPath(pid: string, themeId: string): string {
  return path.join(stagingDir(pid), `${themeId}.curated.md`);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Prepare ────────────────────────────────────────────────────────────────

async function prepare(): Promise<void> {
  console.log("=== curate-narrative: PREPARE ===");
  console.log(`Project: ${projectId}`);
  if (themeFilter) console.log(`Theme filter: ${themeFilter}`);
  console.log();

  const product = await fetchReportProduct(projectId!);
  const existingConfig = (product.config ?? {}) as Record<string, unknown>;
  const existingRc =
    (existingConfig.reportConfig as Record<string, unknown> | undefined) ?? {};
  const themes = (existingRc.themes as ReportThemeConfig[] | undefined) ?? [];

  assert(themes.length > 0, "No themes in reportConfig");

  const pois = await fetchProjectPois(projectId!);
  console.log(`Hentet ${pois.length} POIs for prosjektet`);

  // Filter POIs med gyldige UUIDs
  const validPois = pois.filter((p) => UUID_RE.test(p.id));
  const invalidPois = pois.length - validPois.length;
  if (invalidPois > 0) {
    console.warn(`⚠  ${invalidPois} POIs med ugyldig UUID ble hoppet over`);
  }

  const dir = stagingDir(projectId!);
  fs.mkdirSync(dir, { recursive: true });

  let prepared = 0;
  let skipped = 0;

  for (const theme of themes) {
    if (themeFilter && theme.id !== themeFilter) continue;
    const grounding = theme.grounding;
    if (!grounding) {
      console.log(`⊘ ${theme.id.padEnd(24)} ingen grounding`);
      skipped += 1;
      continue;
    }

    // Idempotens-sjekk
    if (
      !FORCE &&
      grounding.groundingVersion === 2 &&
      grounding.curatedAt &&
      grounding.fetchedAt &&
      new Date(grounding.curatedAt) >= new Date(grounding.fetchedAt)
    ) {
      console.log(
        `⊘ ${theme.id.padEnd(24)} allerede kuratert (--force for overwrite)`,
      );
      skipped += 1;
      continue;
    }

    // Filtrer POIs på tema-kategorier
    const themePois: PoiEntry[] = validPois
      .filter((p) => theme.categories.includes(p.category_id))
      .map((p) => ({
        uuid: p.id,
        name: p.name,
        category: p.category_id,
      }));

    // Sanitize gemini-narrative
    const san = sanitizeGeminiInput(grounding.narrative);

    const sourceDomains = Array.from(
      new Set(grounding.sources.map((s) => s.domain)),
    );

    const ctx: ContextFile = {
      project_id: projectId!,
      theme_id: theme.id,
      theme_name: theme.name,
      theme_categories: theme.categories,
      gemini_narrative_sanitized: san.sanitized,
      gemini_source_domains: sourceDomains,
      poi_set: themePois,
      target_length_min: 600,
      target_length_max: 800,
      fetchedAt: grounding.fetchedAt,
    };

    fs.writeFileSync(contextPath(projectId!, theme.id), JSON.stringify(ctx, null, 2));

    // Slett evt. gammel .curated.md for dette temaet så skill ser fresh state
    const cp = curatedPath(projectId!, theme.id);
    if (fs.existsSync(cp)) fs.unlinkSync(cp);

    console.log(
      `✓ ${theme.id.padEnd(24)} context klar — ${themePois.length} POIs, ` +
        `${san.sanitized.length} tegn sanitized` +
        (san.strippedLinks > 0 ? ` (strippet ${san.strippedLinks} lenker)` : ""),
    );
    prepared += 1;
  }

  console.log();
  console.log(`Klargjort: ${prepared}, hoppet over: ${skipped}`);
  console.log(`Staging: ${dir}`);
  console.log();
  console.log("NESTE STEG:");
  console.log("  For hvert tema, les .context.json og skriv .curated.md");
  console.log(
    `  npx tsx scripts/curate-narrative.ts apply ${projectId}  # når alle er skrevet`,
  );
}

// ─── Apply ──────────────────────────────────────────────────────────────────

interface CurationOutcome {
  themeId: string;
  themeName: string;
  status: "success" | "error" | "skipped";
  error?: string;
  curatedNarrative?: string;
  poiLinksUsed?: string[];
}

async function apply(): Promise<void> {
  console.log("=== curate-narrative: APPLY ===");
  console.log(`Project: ${projectId}`);
  console.log();

  const product = await fetchReportProduct(projectId!);
  const existingConfig = (product.config ?? {}) as Record<string, unknown>;
  const existingRc =
    (existingConfig.reportConfig as Record<string, unknown> | undefined) ?? {};
  const themes = (existingRc.themes as ReportThemeConfig[] | undefined) ?? [];
  assert(themes.length > 0, "No themes in reportConfig");

  const pois = await fetchProjectPois(projectId!);
  const validPois = pois.filter((p) => UUID_RE.test(p.id));

  // Backup FØR noen mutations
  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `products-curate-${product.id}-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(product, null, 2));
  console.log(`Backup: ${backupPath}`);
  console.log();

  const outcomes: CurationOutcome[] = [];

  for (const theme of themes) {
    if (themeFilter && theme.id !== themeFilter) continue;
    const base = { themeId: theme.id, themeName: theme.name };

    const cPath = contextPath(projectId!, theme.id);
    const mdPath = curatedPath(projectId!, theme.id);

    if (!fs.existsSync(cPath)) {
      outcomes.push({ ...base, status: "skipped", error: "no context file" });
      continue;
    }
    if (!fs.existsSync(mdPath)) {
      outcomes.push({
        ...base,
        status: "skipped",
        error: "no curated.md (not filled in yet)",
      });
      continue;
    }

    const ctx = JSON.parse(fs.readFileSync(cPath, "utf8")) as ContextFile;
    const curatedRaw = fs.readFileSync(mdPath, "utf8").trim();

    // Validator
    const validation = validateCuratedNarrative(curatedRaw, {
      geminiNarrative: ctx.gemini_narrative_sanitized,
      poiNames: ctx.poi_set.map((p) => p.name),
    });

    if (!validation.ok) {
      outcomes.push({
        ...base,
        status: "error",
        error: `validation: ${validation.errors.join("; ")}`,
      });
      continue;
    }

    if (validation.warnings.length > 0) {
      console.warn(
        `⚠ ${theme.id}: ${validation.warnings.join("; ")}`,
      );
    }

    // POI-linker
    const themePois: PoiEntry[] = validPois
      .filter((p) => theme.categories.includes(p.category_id))
      .map((p) => ({ uuid: p.id, name: p.name, category: p.category_id }));

    const linkResult = linkPoisInMarkdown(curatedRaw, themePois, {
      themeCategory: theme.categories[0],
    });

    // Audit-log: lagre Claude's raw output selv på success
    const auditPath = path.join(
      backupDir,
      `curation-audit-${product.id}-${theme.id}-${Date.now()}.jsonl`,
    );
    fs.writeFileSync(
      auditPath,
      JSON.stringify({
        themeId: theme.id,
        rawCurated: curatedRaw,
        linked: linkResult.linked,
        poiLinksUsed: linkResult.poiLinksUsed,
        warnings: validation.warnings,
        timestamp: new Date().toISOString(),
      }) + "\n",
    );

    outcomes.push({
      ...base,
      status: "success",
      curatedNarrative: linkResult.linked,
      poiLinksUsed: linkResult.poiLinksUsed,
    });
  }

  // Summary
  console.log("--- Outcome per theme ---");
  for (const o of outcomes) {
    const mark =
      o.status === "success" ? "✓" : o.status === "skipped" ? "⊘" : "✗";
    const suffix =
      o.status === "success"
        ? `${o.curatedNarrative!.length} tegn, ${o.poiLinksUsed!.length} POI-lenker`
        : o.error;
    console.log(`  ${mark} ${o.themeId.padEnd(24)} ${suffix}`);
  }

  const successCount = outcomes.filter((o) => o.status === "success").length;
  const errorCount = outcomes.filter((o) => o.status === "error").length;

  if (successCount === 0) {
    console.error("\nABORT: 0 vellykkede temaer. Ingen write.");
    process.exit(2);
  }

  if (errorCount > 0) {
    console.log();
    console.warn(
      `⚠ ${errorCount} tema(er) feilet validering — disse beholder v1-grounding.`,
    );
  }

  // Build theme-patches
  const successByThemeId = new Map<string, CurationOutcome>();
  for (const o of outcomes) {
    if (o.status === "success") successByThemeId.set(o.themeId, o);
  }

  const now = new Date().toISOString();
  const nextThemes = themes.map((t) => {
    const outcome = successByThemeId.get(t.id);
    if (!outcome || !t.grounding) return t;

    const v2Grounding: ReportThemeGrounding = {
      ...t.grounding,
      curatedNarrative: outcome.curatedNarrative!,
      curatedAt: now,
      poiLinksUsed: outcome.poiLinksUsed!,
      groundingVersion: 2,
    };
    return { ...t, grounding: v2Grounding };
  });

  const nextReportConfig = { ...existingRc, themes: nextThemes };
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
    console.error(`\nPATCH feilet: ${patchRes.status} ${text}`);
    console.error(`Backup: ${backupPath}`);
    process.exit(1);
  }
  const patched = (await patchRes.json()) as ReportProductRow[];
  if (!Array.isArray(patched) || patched.length === 0) {
    console.error(
      "\nPATCH påvirket 0 rader — concurrent write. Kjør scriptet på nytt.",
    );
    console.error(`Backup: ${backupPath}`);
    process.exit(1);
  }
  console.log(`\nPATCH OK. ${patched.length} rad oppdatert.`);

  // Revalidate
  if (REVALIDATE_SECRET) {
    // Build project-tag fra project_id (samme mønster som Steg 2.5)
    const tag = `product:${projectId}`;
    const revUrl = `${SITE_URL}/api/revalidate?tag=${encodeURIComponent(tag)}&secret=${encodeURIComponent(REVALIDATE_SECRET)}`;
    try {
      const r = await fetch(revUrl);
      if (r.ok) console.log(`revalidateTag OK: ${tag}`);
      else console.warn(`revalidateTag feilet: ${r.status}`);
    } catch (err) {
      console.warn(`revalidateTag-fetch kastet: ${(err as Error).message}`);
    }
  } else {
    console.warn("REVALIDATE_SECRET ikke satt — hopper over revalidateTag.");
  }

  console.log(`\n✓ Ferdig. ${successCount}/${outcomes.length} kuratert til v2.`);
  console.log(`  Backup: ${backupPath}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

(async () => {
  if (subcommand === "prepare") await prepare();
  else if (subcommand === "apply") await apply();
})().catch((err) => {
  console.error(`Fatal: ${(err as Error).message}`);
  console.error((err as Error).stack);
  process.exit(1);
});
