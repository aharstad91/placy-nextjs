#!/usr/bin/env npx tsx
/**
 * Per-POI grounding — populer v2.pois.grounding for et boards POI-utvalg.
 *
 * Usage:
 *   npx tsx scripts/ground-poi-content.ts <project_id>                    # dry-run
 *   npx tsx scripts/ground-poi-content.ts <project_id> --apply            # skriv
 *   npx tsx scripts/ground-poi-content.ts <project_id> --apply --force    # regenerer alt
 *   npx tsx scripts/ground-poi-content.ts <project_id> --limit 5          # kalibrering
 *   npx tsx scripts/ground-poi-content.ts <project_id> --area "Inderøy"   # overstyr anker
 *   npx tsx scripts/ground-poi-content.ts <project_id> --min-sources 3 --min-chars 400
 *
 * KJØR DRY-RUN FØRST. Dry-run rapporterer dekningsgrad, histogram og
 * terskel-sensitivitet — det er kalibreringsgrunnlaget for kvalitetsporten.
 * Lav dekning er et pilot-funn som skal omdirigere innsatsen, ikke oppdages
 * etter at UI-en er bygd.
 *
 * Flow (sikkerhetsnett kopiert fra scripts/gemini-grounding.ts):
 *   1. project_id-formvakt (cache-tag avhenger av formen)
 *   2. hent report-produktets POI-utvalg via product_pois
 *   3. avled søke-anker fra adressene (--area overstyrer)
 *   4. backup av POI-radene til backups/ — også på dry-run
 *   5. per-POI skip-beslutning (decidePoi) → p-limit-parallell groundPoi
 *   6. feilrate-abort før write
 *   7. dry-run: dekningsrapport + histogram + terskel-sensitivitet, ingen write
 *   8. --apply: per-POI PATCH med optimistic lock på pois.updated_at,
 *      curated-laget bevart
 *   9. post-write-verifisering
 *  10. revalidateTag
 *
 * Kostnad: ett Gemini grounding-kall per POI som ikke hoppes over. 78 POI-er
 * ligger innenfor gratiskvoten (1 500/dag). Faktisk antall kall logges.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import pLimit from "p-limit";
import {
  groundPoi,
  DEFAULT_POI_QUALITY_THRESHOLDS,
  type PoiQualityThresholds,
} from "../lib/gemini/poi-grounding";
import { PoiGroundingViewSchema, type PoiGrounding } from "../lib/types";
import { isValidProjectIdShape } from "../lib/pipeline/project-id";
import {
  decidePoi,
  mergeFailedAttempt,
  mergeGrounding,
  deriveAreaHint,
  thresholdSensitivity,
  histogram,
  type GateSample,
  type SkipReason,
} from "./ground-poi-content-lib";

config({ path: ".env.local" });

// ─── Arg parsing ────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const projectId = args.find((a) => !a.startsWith("--"));
const APPLY = args.includes("--apply");
const FORCE = args.includes("--force");
const DRY_RUN = !APPLY;

function numFlag(name: string): number | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = Number(args[i + 1]);
  return Number.isFinite(v) ? v : undefined;
}
function strFlag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

const LIMIT = numFlag("--limit");
const AREA_OVERRIDE = strFlag("--area");
const CONCURRENCY = numFlag("--concurrency") ?? 4;

const thresholds: PoiQualityThresholds = {
  minSourceCount: numFlag("--min-sources") ?? DEFAULT_POI_QUALITY_THRESHOLDS.minSourceCount,
  minCharCount: numFlag("--min-chars") ?? DEFAULT_POI_QUALITY_THRESHOLDS.minCharCount,
  maxCharCount: numFlag("--max-chars") ?? DEFAULT_POI_QUALITY_THRESHOLDS.maxCharCount,
};

if (!projectId) {
  console.error(
    "Usage: npx tsx scripts/ground-poi-content.ts <project_id> [--apply] [--force] [--limit N] [--area X]",
  );
  process.exit(1);
}

// Cache-tag = `product:${projectId}`, så en feilskrevet ID ville stille buste en
// ikke-eksisterende tag (revalidateTag no-op). Fang formen her.
if (!isValidProjectIdShape(projectId)) {
  console.error(
    `Ugyldig project_id: "${projectId}". Forventet container-form {customer}_{slug}, ` +
      `f.eks. "placy-demo_sundsoya". Cache-tag blir product:${projectId}.`,
  );
  process.exit(1);
}

// ─── Env ────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET;

/** Total-feilrate som aborterer før write. */
const FAILURE_RATE_ABORT = 0.5;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`ASSERT FAILED: ${message}`);
    process.exit(1);
  }
}

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Accept-Profile": "v2",
    ...extra,
  };
}

// ─── DB-lesing ──────────────────────────────────────────────────────────────

interface PoiRow {
  id: string;
  name: string | null;
  address: string | null;
  category_id: string | null;
  grounding: unknown;
  updated_at: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${url.split("?")[0]}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function fetchProductId(pid: string): Promise<string> {
  const rows = (await fetchJson(
    `${SUPABASE_URL}/rest/v1/products?project_id=eq.${pid}&product_type=eq.report&select=id`,
    { headers: sbHeaders() },
  )) as Array<{ id: string }>;
  assert(rows.length > 0, `Ingen report-produkt for project_id=${pid}`);
  return rows[0].id;
}

async function fetchBoardPois(productId: string): Promise<PoiRow[]> {
  const links = (await fetchJson(
    `${SUPABASE_URL}/rest/v1/product_pois?product_id=eq.${productId}&select=poi_id,sort_order&order=sort_order`,
    { headers: sbHeaders() },
  )) as Array<{ poi_id: string }>;
  assert(links.length > 0, `Ingen product_pois for product_id=${productId}`);

  const ids = links.map((l) => l.poi_id);
  const rows = (await fetchJson(
    `${SUPABASE_URL}/rest/v1/pois?select=id,name,address,category_id,grounding,updated_at&id=in.(${ids.map(encodeURIComponent).join(",")})`,
    { headers: sbHeaders() },
  )) as PoiRow[];

  // Behold boardets rekkefølge — gjør rapporten sammenlignbar mellom kjøringer.
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is PoiRow => Boolean(r));
}

async function fetchCategoryNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = (await fetchJson(
    `${SUPABASE_URL}/rest/v1/categories?select=id,name&id=in.(${ids.map(encodeURIComponent).join(",")})`,
    { headers: sbHeaders() },
  )) as Array<{ id: string; name: string }>;
  return new Map(rows.map((r) => [r.id, r.name]));
}

/**
 * Parse lagret grounding tolerant. Ugyldig shape behandles som «ingen
 * grounding» slik at scriptet kan reparere raden — men det logges, aldri stille.
 */
function parseExisting(raw: unknown, poiId: string): PoiGrounding | undefined {
  if (raw == null) return undefined;
  const parsed = PoiGroundingViewSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  console.warn(
    `  ! ${poiId}: lagret grounding har ugyldig shape (${parsed.error.issues[0]?.message ?? "ukjent"}) — behandles som ingen`,
  );
  return undefined;
}

// ─── Utfall per POI ─────────────────────────────────────────────────────────

interface Outcome {
  poiId: string;
  name: string;
  status: "generert" | "hoppet-over" | "feilet";
  skipReason?: SkipReason;
  detail?: string;
  grounding?: PoiGrounding;
  sample?: GateSample;
}

// ─── Revalidate ─────────────────────────────────────────────────────────────

async function revalidate(tag: string): Promise<void> {
  if (!REVALIDATE_SECRET) {
    console.warn("REVALIDATE_SECRET ikke satt — hopper over revalidateTag.");
    return;
  }
  const url = `${SITE_URL}/api/revalidate?tag=${encodeURIComponent(tag)}&secret=${encodeURIComponent(REVALIDATE_SECRET)}`;
  const redacted = url.replace(/([?&]secret=)[^&]*/, "$1***");
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`revalidateTag feilet (${res.status}). Manuelt: curl "${redacted}"`);
      return;
    }
    console.log(`revalidateTag OK: ${tag}`);
  } catch (err) {
    console.warn(`revalidateTag-fetch kastet: ${(err as Error).message}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  assert(GEMINI_API_KEY, "Mangler GEMINI_API_KEY i .env.local");
  assert(SUPABASE_URL, "Mangler NEXT_PUBLIC_SUPABASE_URL");
  assert(SUPABASE_KEY, "Mangler SUPABASE_SERVICE_ROLE_KEY");

  console.log("=== Per-POI grounding ===");
  console.log(`Prosjekt:  ${projectId}`);
  console.log(`Modus:     ${DRY_RUN ? "DRY RUN" : "APPLY"}${FORCE ? " (force)" : ""}`);
  console.log(
    `Port:      ≥${thresholds.minSourceCount} kilder, ${thresholds.minCharCount}–${thresholds.maxCharCount} tegn`,
  );

  const productId = await fetchProductId(projectId!);
  const allPois = await fetchBoardPois(productId);
  const categoryNames = await fetchCategoryNames(
    Array.from(new Set(allPois.map((p) => p.category_id).filter((c): c is string => Boolean(c)))),
  );

  const areaHint = AREA_OVERRIDE ?? deriveAreaHint(allPois);
  console.log(`Produkt:   ${productId}`);
  console.log(`POI-er:    ${allPois.length}`);
  console.log(
    `Anker:     ${areaHint ?? "(ingen — grounding-kvaliteten blir dårligere)"}${AREA_OVERRIDE ? " (--area)" : " (avledet fra adresser)"}`,
  );
  console.log();

  // Backup FØR alt — også på dry-run. Gratis forsikring.
  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = Date.now();
  const backupPath = path.join(backupDir, `pois-grounding-${projectId}-${stamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(allPois, null, 2));
  console.log(`Backup:    ${backupPath}`);

  const now = new Date();
  const candidates = LIMIT ? allPois.slice(0, LIMIT) : allPois;
  if (LIMIT) console.log(`Begrenset: første ${candidates.length} POI-er (--limit)`);

  // Skip-beslutninger først — da vet vi hvor mange kall som faktisk gjøres
  // FØR vi begynner å bruke kvote.
  const toGenerate: Array<{ row: PoiRow; existing: PoiGrounding | undefined }> = [];
  const outcomes: Outcome[] = [];

  for (const row of candidates) {
    const existing = parseExisting(row.grounding, row.id);
    const decision = decidePoi({ name: row.name, grounding: existing }, { force: FORCE, now });
    if (decision.action === "skip") {
      outcomes.push({
        poiId: row.id,
        name: row.name ?? "(uten navn)",
        status: "hoppet-over",
        skipReason: decision.reason,
        detail: decision.detail,
      });
      continue;
    }
    toGenerate.push({ row, existing });
  }

  console.log(`Genererer: ${toGenerate.length} POI-er (${outcomes.length} hoppet over)`);
  console.log();

  // ── Generering ────────────────────────────────────────────────────────────
  const limit = pLimit(CONCURRENCY);
  const started = Date.now();
  let apiCalls = 0;

  const settled = await Promise.allSettled(
    toGenerate.map(({ row, existing }) =>
      limit(async (): Promise<Outcome> => {
        apiCalls++;
        const res = await groundPoi(
          {
            id: row.id,
            name: row.name!,
            address: row.address ?? undefined,
            categoryName: row.category_id ? categoryNames.get(row.category_id) : undefined,
            areaHint,
          },
          { apiKey: GEMINI_API_KEY!, thresholds },
        );
        const base = { poiId: row.id, name: row.name ?? "(uten navn)" };
        if (!res.ok) {
          return {
            ...base,
            status: "feilet",
            detail: res.reason,
            // Lagre utfallet. Uten dette blir kolonnen stående null, og neste
            // kjøring kan ikke se forskjell på «aldri forsøkt» og «forsøkt,
            // ingenting der» — den brenner kvote på de samme tomme stedene om
            // og om igjen (målt: 12 av 78 på Sundsøya).
            grounding: mergeFailedAttempt(existing, {
              at: new Date().toISOString(),
              outcome: res.outcome,
              reason: res.reason,
            }),
          };
        }
        return {
          ...base,
          status: "generert",
          grounding: mergeGrounding(existing, res.generated),
          sample: {
            poiId: row.id,
            name: row.name ?? "",
            charCount: res.generated.qualityGate.charCount,
            sourceCount: res.generated.qualityGate.sourceCount,
            passed: res.generated.qualityGate.passed,
            reason: res.generated.qualityGate.reason,
          },
        };
      }),
    ),
  );

  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      outcomes.push(r.value);
      return;
    }
    outcomes.push({
      poiId: toGenerate[i].row.id,
      name: toGenerate[i].row.name ?? "(uten navn)",
      status: "feilet",
      detail: `uventet: ${(r.reason as Error)?.message ?? String(r.reason)}`,
    });
  });

  const durationMs = Date.now() - started;
  console.log(
    `Gemini:    ${apiCalls} kall på ${Math.round(durationMs / 1000)}s (concurrency ${CONCURRENCY})`,
  );

  // ── Rapport ───────────────────────────────────────────────────────────────
  const generated = outcomes.filter((o) => o.status === "generert");
  const failed = outcomes.filter((o) => o.status === "feilet");
  const skipped = outcomes.filter((o) => o.status === "hoppet-over");
  const samples = generated.map((o) => o.sample!).filter(Boolean);
  const passing = samples.filter((s) => s.passed);

  console.log();
  console.log("─── Dekningsgrad ──────────────────────────────────────────────");
  console.log(`  Bestått porten:  ${passing.length}`);
  console.log(`  Strøk porten:    ${samples.length - passing.length}`);
  console.log(`  Feilet/ingen data: ${failed.length}`);
  console.log(`  Hoppet over:     ${skipped.length}`);
  console.log(
    `  DEKNING:         ${passing.length}/${candidates.length} = ${Math.round((passing.length / candidates.length) * 100)}% av boardet`,
  );

  if (samples.length > 0) {
    console.log();
    console.log("─── Histogram: innholdslengde (tegn) ──────────────────────────");
    for (const row of histogram(samples.map((s) => s.charCount), [0, 200, 300, 400, 600, 800, 1200])) {
      console.log(`  ${row.label.padEnd(10)} ${"█".repeat(row.count)} ${row.count}`);
    }
    console.log();
    console.log("─── Histogram: antall kilder ──────────────────────────────────");
    for (const row of histogram(samples.map((s) => s.sourceCount), [0, 1, 2, 3, 5, 8])) {
      console.log(`  ${row.label.padEnd(10)} ${"█".repeat(row.count)} ${row.count}`);
    }
    console.log();
    console.log("─── Terskel-sensitivitet (på ALLEREDE hentede resultater) ─────");
    const grid: PoiQualityThresholds[] = [];
    for (const minSourceCount of [1, 2, 3, 4]) {
      for (const minCharCount of [200, 280, 400]) {
        grid.push({ minSourceCount, minCharCount, maxCharCount: thresholds.maxCharCount });
      }
    }
    for (const r of thresholdSensitivity(samples, grid)) {
      const pct = Math.round((r.passed / samples.length) * 100);
      console.log(
        `  ≥${r.thresholds.minSourceCount} kilder / ≥${String(r.thresholds.minCharCount).padStart(3)} tegn → ${String(r.passed).padStart(3)} bestått (${pct}%)`,
      );
    }
  }

  if (failed.length > 0) {
    console.log();
    console.log("─── Feilet / ingen data ───────────────────────────────────────");
    for (const o of failed) {
      console.log(`  ✗ ${o.name.slice(0, 38).padEnd(38)} ${o.detail}`);
    }
  }

  const strykere = samples.filter((s) => !s.passed);
  if (strykere.length > 0) {
    console.log();
    console.log("─── Strøk porten (lagres med passed=false) ────────────────────");
    for (const s of strykere) {
      console.log(`  ⊘ ${s.name.slice(0, 38).padEnd(38)} ${s.reason}`);
    }
  }

  if (skipped.length > 0) {
    console.log();
    console.log("─── Hoppet over ──────────────────────────────────────────────");
    const byReason = new Map<string, number>();
    for (const o of skipped) {
      byReason.set(o.skipReason ?? "?", (byReason.get(o.skipReason ?? "?") ?? 0) + 1);
    }
    for (const [reason, n] of byReason) console.log(`  ⊘ ${reason}: ${n}`);
  }

  // Rå resultater til fil — gjør det mulig å re-evaluere terskler offline uten
  // å bruke Gemini-kvote på nytt.
  const samplesPath = path.join(backupDir, `grounding-samples-${projectId}-${stamp}.json`);
  fs.writeFileSync(samplesPath, JSON.stringify(samples, null, 2));
  console.log();
  console.log(`Rådata:    ${samplesPath}`);

  // ── Feilrate-abort ────────────────────────────────────────────────────────
  const attempted = toGenerate.length;
  if (attempted > 0 && failed.length / attempted > FAILURE_RATE_ABORT) {
    console.error();
    console.error(
      `ABORT: ${failed.length}/${attempted} feilet (over ${FAILURE_RATE_ABORT * 100}%). Ingen write.`,
    );
    process.exit(2);
  }

  if (DRY_RUN) {
    console.log();
    console.log("─── Eksempel (første 3 beståtte) ──────────────────────────────");
    for (const o of generated.filter((g) => g.sample?.passed).slice(0, 3)) {
      console.log(`\n## ${o.name}`);
      console.log(o.grounding!.generated!.narrative);
      console.log(`   kilder: ${o.grounding!.generated!.sources.map((s) => s.domain).join(", ")}`);
    }
    console.log();
    console.log(`DRY RUN ferdig — ingenting skrevet. Re-kjør med --apply.`);
    return;
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  console.log();
  console.log("─── Skriver ───────────────────────────────────────────────────");
  let written = 0;
  const writeFailures: string[] = [];

  // Både innhold og tomme forsøk skrives. Feilrate-aborten over har alt stoppet
  // kjøringen hvis feilene er systemiske (kvote/nett), så det som havner her er
  // reelle utfall per sted — ikke en dårlig dag.
  const toWrite = outcomes.filter((o) => o.grounding);

  for (const o of toWrite) {
    const row = toGenerate.find((t) => t.row.id === o.poiId)!.row;
    const patchUrl = new URL(`${SUPABASE_URL}/rest/v1/pois`);
    patchUrl.searchParams.set("id", `eq.${row.id}`);
    // Optimistic lock: raden må være uendret siden vi leste den.
    patchUrl.searchParams.set("updated_at", `eq.${row.updated_at}`);

    const res = await fetch(patchUrl.toString(), {
      method: "PATCH",
      headers: sbHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
        "Content-Profile": "v2",
      }),
      // KUN grounding-kolonnen. Ingen andre kolonner røres, så det finnes ingen
      // jsonb-overwrite-risiko mot naboer i raden.
      body: JSON.stringify({ grounding: o.grounding }),
    });

    if (!res.ok) {
      writeFailures.push(`${row.id}: HTTP ${res.status}`);
      continue;
    }
    const patched = (await res.json()) as unknown[];
    if (!Array.isArray(patched) || patched.length === 0) {
      writeFailures.push(`${row.id}: 0 rader (optimistic lock — raden endret siden lesing)`);
      continue;
    }
    written++;
  }

  console.log(
    `  Skrevet: ${written}/${toWrite.length} (${generated.length} med innhold, ${toWrite.length - generated.length} tomme forsøk)`,
  );
  if (writeFailures.length > 0) {
    console.error(`  Feilet:  ${writeFailures.length}`);
    for (const f of writeFailures) console.error(`    ✗ ${f}`);
  }

  // ── Post-write-verifisering ───────────────────────────────────────────────
  const verifyPois = await fetchBoardPois(productId);
  let verifiedPassing = 0;
  let verifyInvalid = 0;
  for (const row of verifyPois) {
    const g = parseExisting(row.grounding, row.id);
    if (!g) {
      if (row.grounding != null) verifyInvalid++;
      continue;
    }
    if (g.generated?.qualityGate.passed) verifiedPassing++;
  }
  console.log();
  console.log(
    `Post-write: ${verifiedPassing} POI-er med bestått grounding i DB (forventet ≥ ${passing.length})`,
  );
  if (verifyInvalid > 0) {
    console.error(`ASSERT FAILED: ${verifyInvalid} rader har grounding som ikke validerer`);
    process.exit(1);
  }
  if (verifiedPassing < passing.length) {
    console.error(
      `ASSERT FAILED: forventet minst ${passing.length} beståtte i DB, fant ${verifiedPassing}. Backup: ${backupPath}`,
    );
    process.exit(1);
  }

  await revalidate(`product:${projectId}`);

  console.log();
  console.log("✓ Ferdig");
  console.log(`  Backup:  ${backupPath}`);
  console.log(`  Rådata:  ${samplesPath}`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
