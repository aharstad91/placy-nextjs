#!/usr/bin/env npx tsx
/**
 * Sett deklarert reportTier på eksisterende report-produkter.
 *
 * Brukes i strøk-kurateringsflyten: prosjekter provisjoneres på tier 1 FØR
 * kuratering (tier 2 ville feilet akseptansesjekken uten editorial), og
 * `--update` rører aldri config (anti-clobber) — så etter kuratering + re-arv
 * bumpes deklarasjonen her. Verifiser etterpå med `npm run validate:tier`.
 *
 * Usage:
 *   npx tsx scripts/set-report-tier.ts --tier 2 placy-demo_sleipnes-vei-12b placy-demo_ostmarkveien-26e
 *   npx tsx scripts/set-report-tier.ts --tier 2 --dry-run <projectId…>
 *
 * Respekterer jsonb-vs-streng-lagringsform og optimistisk lås på updated_at
 * (samme mønster som inherit-area-editorial).
 */

import "./load-env";

import {
  ReportTierSchema,
  type ReportTier,
} from "@/lib/validation/report-tier-schema";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface ProductRow {
  id: string;
  config: unknown;
  updated_at: string;
}

function parseArgs(): { tier: ReportTier; dryRun: boolean; projectIds: string[] } {
  const args = process.argv.slice(2);
  const tierIdx = args.indexOf("--tier");
  const tierParsed = ReportTierSchema.safeParse(
    tierIdx >= 0 ? Number(args[tierIdx + 1]) : NaN
  );
  if (!tierParsed.success) {
    console.error("Bruk: --tier 1|2|3 [--dry-run] <projectId…>");
    process.exit(1);
  }
  const dryRun = args.includes("--dry-run");
  const projectIds = args.filter(
    (a, i) => !a.startsWith("--") && i !== tierIdx + 1
  );
  if (projectIds.length === 0) {
    console.error("Minst én projectId kreves (f.eks. placy-demo_sleipnes-vei-12b)");
    process.exit(1);
  }
  return { tier: tierParsed.data, dryRun, projectIds };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mangler i .env.local");
    process.exit(1);
  }
  const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
  const { tier, dryRun, projectIds } = parseArgs();
  let failures = 0;

  for (const pid of projectIds) {
    const getUrl =
      `${SUPABASE_URL}/rest/v1/products?project_id=eq.${encodeURIComponent(pid)}` +
      `&product_type=eq.report&select=id,config,updated_at`;
    const rows = (await (await fetch(getUrl, { headers })).json()) as ProductRow[];
    if (!Array.isArray(rows) || rows.length === 0) {
      console.error(`✗ ${pid}: ingen report-produkt`);
      failures++;
      continue;
    }
    const { id, config, updated_at } = rows[0];

    // jsonb-vs-streng-gotcha: bevar lagringsformen (jsonb-merge-læringen)
    const wasString = typeof config === "string";
    let cfg: Record<string, unknown>;
    try {
      cfg = wasString
        ? (JSON.parse(config as string) as Record<string, unknown>)
        : ((config ?? {}) as Record<string, unknown>);
    } catch {
      console.error(`✗ ${pid}: config er korrupt JSON-streng — hoppet over`);
      failures++;
      continue;
    }
    const rc = (cfg.reportConfig ?? {}) as Record<string, unknown>;
    const current = rc.reportTier;
    if (current === tier) {
      console.log(`· ${pid}: allerede tier ${tier}`);
      continue;
    }
    if (dryRun) {
      console.log(`(dry-run) ${pid}: reportTier ${current ?? "?"} → ${tier}`);
      continue;
    }
    const nextConfig = { ...cfg, reportConfig: { ...rc, reportTier: tier } };

    const patchUrl =
      `${SUPABASE_URL}/rest/v1/products?id=eq.${id}` +
      `&updated_at=eq.${encodeURIComponent(updated_at)}`;
    const res = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        config: wasString ? JSON.stringify(nextConfig) : nextConfig,
      }),
    });
    if (!res.ok) {
      console.error(`✗ ${pid}: PATCH ${res.status} ${await res.text()}`);
      failures++;
      continue;
    }
    const patched = (await res.json()) as unknown[];
    if (!Array.isArray(patched) || patched.length === 0) {
      console.error(`✗ ${pid}: optimistisk lås traff 0 rader — re-kjør`);
      failures++;
      continue;
    }
    console.log(`✓ ${pid}: reportTier ${current ?? "?"} → ${tier}`);
  }

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nFeil:", err instanceof Error ? err.message : err);
  process.exit(1);
});
