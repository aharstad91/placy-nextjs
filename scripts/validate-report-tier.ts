#!/usr/bin/env npx tsx
/**
 * validate:tier — nivå-vakthund for rapport-boardet.
 *
 * Validerer at deklarert `reportConfig.reportTier` (1/2) er fullt dekket av
 * faktisk innhold, over BEGGE datakilder:
 *   - lokal JSON: data/projects/*\/*.json (prototype-prosjekter)
 *   - Supabase:   products-rader med product_type=report (kunde-boards)
 *
 * Kjernen er lib/validation/report-tier.ts (ren funksjon, fullt testet) —
 * dette scriptet er en tynn driver: I/O + tabell + exit-koder.
 *
 * Usage:
 *   npm run validate:tier                  # begge kilder
 *   npm run validate:tier -- --local-only  # offline (skipper Supabase)
 *
 * Exit 1 ved errors (under-levert nivå), 0 ved kun warnings/grønt.
 * Utveier ved avvik: fullfør manglene, eller re-deklarer ned (oppdater
 * reportTier via read-modify-write — ingen waiver-liste).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import type { ReportConfig } from "../lib/types";
import {
  validateReportTier,
  summarizeTierFindings,
  type ReportTierFinding,
} from "../lib/validation/report-tier";

config({ path: ".env.local" });

const LOCAL_ONLY = process.argv.includes("--local-only");

interface Row {
  source: "lokal" | "supabase";
  slug: string;
  declared: string;
  findings: ReportTierFinding[];
  summary: string;
}

const rows: Row[] = [];

function runProject(
  source: Row["source"],
  slug: string,
  reportConfig: ReportConfig | undefined,
  poiIds: string[] | undefined,
): void {
  const findings = validateReportTier({
    slug,
    reportConfig,
    poiIds,
  });
  const declared = reportConfig?.reportTier;
  rows.push({
    source,
    slug,
    declared: declared === undefined ? "1 (default)" : String(declared),
    findings,
    summary: summarizeTierFindings(declared, findings),
  });
}

// ─── Kilde 1: lokal JSON ────────────────────────────────────────────────────

function runLocal(): void {
  const root = path.join(process.cwd(), "data", "projects");
  const files = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      fs
        .readdirSync(path.join(root, d.name))
        .filter((f) => f.endsWith(".json") && !f.endsWith(".input.json"))
        .map((f) => path.join(root, d.name, f)),
    );

  for (const file of files) {
    let project: {
      urlSlug?: string;
      productType?: string;
      reportConfig?: ReportConfig;
      pois?: { id: string }[];
    };
    try {
      project = JSON.parse(fs.readFileSync(file, "utf-8"));
    } catch (e) {
      console.error(`⚠ Kunne ikke parse ${file}: ${(e as Error).message}`);
      continue;
    }
    // Rapport-relevant = report-produkt ELLER prosjekt med reportConfig
    // (explorer-prosjekter kan ha reportConfig, jf. wesselslokka).
    if (project.productType !== "report" && !project.reportConfig) continue;
    runProject(
      "lokal",
      project.urlSlug ?? path.basename(file, ".json"),
      project.reportConfig,
      project.pois?.map((p) => p.id),
    );
  }
}

// ─── Kilde 2: Supabase ──────────────────────────────────────────────────────

async function runSupabase(): Promise<boolean> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "⚠ NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY mangler i .env.local — " +
        "Supabase-kilden hoppes over (kjørte i praksis --local-only). " +
        "Kunde-boardene er IKKE validert.",
    );
    return false;
  }
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };

  const [projectsRes, productsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/projects?select=id,url_slug`, {
      headers,
    }),
    fetch(
      `${SUPABASE_URL}/rest/v1/products?product_type=eq.report&select=id,project_id,config`,
      { headers },
    ),
  ]);
  if (!projectsRes.ok || !productsRes.ok) {
    console.error(
      `⚠ Supabase-feil: projects ${projectsRes.status}, products ${productsRes.status} — kunde-boardene er IKKE validert.`,
    );
    return false;
  }

  const projects = (await projectsRes.json()) as {
    id: string;
    url_slug: string;
  }[];
  const products = (await productsRes.json()) as {
    id: string;
    project_id: string;
    config: unknown;
  }[];
  const projectById = new Map(projects.map((p) => [p.id, p]));

  for (const product of products) {
    const project = projectById.get(product.project_id);
    const slug = project?.url_slug ?? `product:${product.id}`;
    // config kan være lagret som jsonb ELLER json-string (jsonb-merge-learning)
    let cfg: Record<string, unknown> = {};
    try {
      cfg =
        typeof product.config === "string"
          ? JSON.parse(product.config)
          : ((product.config ?? {}) as Record<string, unknown>);
    } catch {
      console.error(`⚠ ${slug}: config er korrupt json-string — hopper over.`);
      continue;
    }
    // poiIds utelates: Supabase-driveren henter ikke POI-poolen, så
    // highlight-resolusjonssjekken hoppes over her (dekkes lokalt + i render).
    runProject(
      "supabase",
      slug,
      cfg.reportConfig as ReportConfig | undefined,
      undefined,
    );
  }
  return true;
}

// ─── Rapport ────────────────────────────────────────────────────────────────

function printReport(supabaseCovered: boolean): void {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log("");
  console.log(
    pad("KILDE", 10) + pad("SLUG", 28) + pad("NIVÅ", 13) + "STATUS",
  );
  console.log("─".repeat(90));
  for (const row of rows) {
    const errs = row.findings.filter((f) => f.level === "error");
    const warns = row.findings.filter((f) => f.level === "warning");
    const status =
      errs.length > 0 ? `✗ ${row.summary}` : warns.length > 0 ? `✓ OK (${warns.length} warnings)` : "✓ OK";
    console.log(pad(row.source, 10) + pad(row.slug, 28) + pad(row.declared, 13) + status);
    for (const f of errs) console.log(`           · [${f.check}] ${f.detail}`);
    for (const f of warns) console.log(`           ⚠ [${f.check}] ${f.detail}`);
  }
  console.log("─".repeat(90));

  const failed = rows.filter((r) => r.findings.some((f) => f.level === "error"));
  console.log(
    `${rows.length} prosjekter validert (${rows.filter((r) => r.source === "lokal").length} lokale, ` +
      `${rows.filter((r) => r.source === "supabase").length} supabase)` +
      (supabaseCovered ? "" : " — Supabase IKKE dekket") +
      `. ${failed.length} under-levert.`,
  );
  if (failed.length > 0) {
    console.log(
      "\nUtveier: fullfør manglene, eller re-deklarer ned (oppdater reportTier " +
        "via read-modify-write i datakilden).",
    );
  }
}

async function main(): Promise<void> {
  runLocal();
  const supabaseCovered = LOCAL_ONLY ? false : await runSupabase();
  if (LOCAL_ONLY) console.error("ℹ --local-only: Supabase-kilden hoppes over.");
  printReport(supabaseCovered);
  const hasErrors = rows.some((r) =>
    r.findings.some((f) => f.level === "error"),
  );
  process.exit(hasErrors ? 1 : 0);
}

main().catch((e) => {
  console.error("validate:tier feilet:", e);
  process.exit(1);
});
