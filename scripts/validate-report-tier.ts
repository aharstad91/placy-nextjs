#!/usr/bin/env npx tsx
/**
 * validate:tier — nivå-vakthund for rapport-boardet.
 *
 * Validerer at deklarert `reportConfig.reportTier` (1/2) er fullt dekket av
 * faktisk innhold i Supabase (v2): products-rader med product_type=report.
 * (Den lokale JSON-kilden døde med data/projects/ i legacy-oppryddingen
 * 2026-07-06 — alt provisjoneres via pipelinen.)
 *
 * Kjernen er lib/validation/report-tier.ts (ren funksjon, fullt testet) —
 * dette scriptet er en tynn driver: I/O + tabell + exit-koder.
 *
 * Usage:
 *   npm run validate:tier
 *
 * Exit 1 ved errors (under-levert nivå), 0 ved kun warnings/grønt.
 * Utveier ved avvik: fullfør manglene, eller re-deklarer ned (oppdater
 * reportTier via read-modify-write — ingen waiver-liste).
 */

import { config } from "dotenv";
import type { ReportConfig } from "../lib/types";
import {
  validateReportTier,
  summarizeTierFindings,
  type ReportTierFinding,
} from "../lib/validation/report-tier";

config({ path: ".env.local" });

interface Row {
  slug: string;
  declared: string;
  findings: ReportTierFinding[];
  summary: string;
}

const rows: Row[] = [];

function runProject(
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
    slug,
    declared: declared === undefined ? "1 (default)" : String(declared),
    findings,
    summary: summarizeTierFindings(declared, findings),
  });
}

async function runSupabase(): Promise<void> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "✗ NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY mangler i .env.local — ingen datakilde å validere.",
    );
    process.exit(1);
  }
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Accept-Profile": "v2",
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
      `✗ Supabase-feil: projects ${projectsRes.status}, products ${productsRes.status} — boardene er IKKE validert.`,
    );
    process.exit(1);
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
    // poiIds utelates: driveren henter ikke POI-poolen, så highlight-
    // resolusjonssjekken hoppes over her (dekkes i render).
    runProject(slug, cfg.reportConfig as ReportConfig | undefined, undefined);
  }
}

// ─── Rapport ────────────────────────────────────────────────────────────────

function printReport(): void {
  const pad = (s: string, n: number) => s.padEnd(n);
  console.log("");
  console.log(pad("SLUG", 28) + pad("NIVÅ", 13) + "STATUS");
  console.log("─".repeat(80));
  for (const row of rows) {
    const errs = row.findings.filter((f) => f.level === "error");
    const warns = row.findings.filter((f) => f.level === "warning");
    const status =
      errs.length > 0 ? `✗ ${row.summary}` : warns.length > 0 ? `✓ OK (${warns.length} warnings)` : "✓ OK";
    console.log(pad(row.slug, 28) + pad(row.declared, 13) + status);
    for (const f of errs) console.log(`           · [${f.check}] ${f.detail}`);
    for (const f of warns) console.log(`           ⚠ [${f.check}] ${f.detail}`);
  }
  console.log("─".repeat(80));

  const failed = rows.filter((r) => r.findings.some((f) => f.level === "error"));
  console.log(
    `${rows.length} boards validert. ${failed.length} under-levert.`,
  );
  if (failed.length > 0) {
    console.log(
      "\nUtveier: fullfør manglene, eller re-deklarer ned (oppdater reportTier " +
        "via read-modify-write i datakilden).",
    );
  }
}

async function main(): Promise<void> {
  await runSupabase();
  printReport();
  const hasErrors = rows.some((r) =>
    r.findings.some((f) => f.level === "error"),
  );
  process.exit(hasErrors ? 1 : 0);
}

main().catch((e) => {
  console.error("validate:tier feilet:", e);
  process.exit(1);
});
