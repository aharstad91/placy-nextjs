#!/usr/bin/env npx tsx
/**
 * Kuratér POI-tekst (Lokalkunnskap / Moat 1) — arbeidsliste + skriving.
 *
 * Bruk:
 *   npx tsx scripts/curate-pois.ts --list <project_id>              # lag arbeidsliste
 *   npx tsx scripts/curate-pois.ts --file <staging.json>            # dry run (default)
 *   npx tsx scripts/curate-pois.ts --file <staging.json> --yes      # skriv
 *
 * Hvorfor scriptet finnes: grounding-scriptet hentet leverandør-tekst fra Google
 * for de POI-ene Google hadde noe om. Dette scriptet håndterer resten. Målt på
 * Sundsøya 2026-08-12: 59 av 78 POI-er fikk bestått leverandør-tekst — de siste
 * 19 er ikke et dekningsproblem, de er arbeidslista.
 *
 * Skillet mellom lagene er ikke kosmetisk:
 *   generated — lånt fra Google. Kilder må vises, 2-års lagringsgrense i
 *               Gemini-vilkårene, må hentes på nytt når den utdateres.
 *   curated   — vår. Ingen attribusjon, ingen utløpsdato, ingen som kan ta den
 *               fra oss. Det er den som er verdt noe.
 *
 * Rekkefølge: kjør grounding-scriptet FØRST, så --list. POI-er som står som
 * «ingen-forsøk» er sløsing å skrive for hånd — Google kan ha svaret.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { config } from "dotenv";
import {
  buildCandidate,
  buildStagingFile,
  classifyMissing,
  mergeCurated,
  parseGroundingLoose,
  parseStagingForWrite,
  sortCandidates,
  type CurationCandidate,
  type CurationCandidateInput,
  type MissingReason,
} from "./curate-pois-lib";
import { PoiGroundingViewSchema } from "../lib/types";
import { isValidProjectIdShape } from "../lib/pipeline/project-id";

config({ path: ".env.local" });

// ─── Argv ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function strFlag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const LIST_PROJECT = strFlag("--list");
const STAGING_FILE = strFlag("--file");
const APPLY = args.includes("--yes");
const OUT_OVERRIDE = strFlag("--out");

if (!LIST_PROJECT && !STAGING_FILE) {
  console.error(
    "Usage:\n" +
      "  npx tsx scripts/curate-pois.ts --list <project_id> [--out <fil>]\n" +
      "  npx tsx scripts/curate-pois.ts --file <staging.json> [--yes]",
  );
  process.exit(1);
}
if (LIST_PROJECT && STAGING_FILE) {
  console.error("--list og --file er to ulike operasjoner. Kjør én om gangen.");
  process.exit(1);
}
if (LIST_PROJECT && !isValidProjectIdShape(LIST_PROJECT)) {
  console.error(`Ugyldig project_id-form: ${LIST_PROJECT} (forventet <kunde>_<slug>)`);
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

function sbHeaders(extra: Record<string, string> = {}) {
  return {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Accept-Profile": "v2",
    ...extra,
  };
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${url.split("?")[0]}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

const POI_COLUMNS =
  "id,name,address,category_id,grounding,google_rating,google_review_count," +
  "google_phone,google_website,opening_hours_json,updated_at";

interface PoiRow extends CurationCandidateInput {
  updated_at: string;
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
    `${SUPABASE_URL}/rest/v1/pois?select=${POI_COLUMNS}&id=in.(${ids.map(encodeURIComponent).join(",")})`,
    { headers: sbHeaders() },
  )) as PoiRow[];

  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is PoiRow => Boolean(r));
}

async function fetchPoisByIds(ids: string[]): Promise<PoiRow[]> {
  if (ids.length === 0) return [];
  return (await fetchJson(
    `${SUPABASE_URL}/rest/v1/pois?select=${POI_COLUMNS}&id=in.(${ids.map(encodeURIComponent).join(",")})`,
    { headers: sbHeaders() },
  )) as PoiRow[];
}

async function fetchCategoryNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = (await fetchJson(
    `${SUPABASE_URL}/rest/v1/categories?select=id,name&id=in.(${ids.map(encodeURIComponent).join(",")})`,
    { headers: sbHeaders() },
  )) as Array<{ id: string; name: string }>;
  return new Map(rows.map((r) => [r.id, r.name]));
}

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

// ─── Modus: --list ──────────────────────────────────────────────────────────

async function runList(projectId: string): Promise<void> {
  console.log("=== Arbeidsliste: POI-er som mangler innhold ===");
  console.log(`Prosjekt: ${projectId}`);

  const productId = await fetchProductId(projectId);
  const rows = await fetchBoardPois(productId);
  const categoryNames = await fetchCategoryNames(
    Array.from(new Set(rows.map((r) => r.category_id).filter((c): c is string => Boolean(c)))),
  );

  const candidates: CurationCandidate[] = [];
  // `grounded` er borte som DEKNING etter policy-endringen 2026-08-15 —
  // leverandørtekst teller ikke lenger som dekket. Den telles nå i «Hvorfor»
  // under `har-leverandørtekst`, altså som arbeid, ikke som ferdig.
  const done = { curated: 0, unnamed: 0 };
  let invalidShape = 0;

  for (const row of rows) {
    const { grounding, invalid } = parseGroundingLoose(row.grounding);
    if (invalid) {
      // Aldri stille: en rad med ugyldig shape havner på lista, men vi sier fra
      // at grunnen er dataformen og ikke stedet.
      console.warn(`  ! ${row.id}: lagret grounding har ugyldig shape — behandles som ingen`);
      invalidShape++;
    }
    const c = classifyMissing({ name: row.name, grounding });
    if (!c.needsText) {
      if (c.reason === "har-kuratert-tekst") done.curated++;
      else done.unnamed++;
      continue;
    }
    candidates.push(
      buildCandidate(row, c, row.category_id ? categoryNames.get(row.category_id) : undefined),
    );
  }

  const sorted = sortCandidates(candidates);

  console.log(`POI-er:   ${rows.length}`);
  console.log();
  console.log("─── Dekning ───────────────────────────────────────────────────");
  console.log(`  Kuratert av oss (Moat 1):  ${done.curated}`);
  console.log(`  Uten navn (hoppes over):   ${done.unnamed}`);
  console.log(`  MANGLER VÅR TEKST:         ${sorted.length}`);
  if (invalidShape > 0) console.log(`  (${invalidShape} med ugyldig grounding-shape)`);

  const byWhy = new Map<MissingReason, number>();
  for (const c of sorted) byWhy.set(c.why, (byWhy.get(c.why) ?? 0) + 1);
  if (byWhy.size > 0) {
    console.log();
    console.log("─── Hvorfor ───────────────────────────────────────────────────");
    for (const [why, n] of byWhy) console.log(`  ${why.padEnd(20)} ${n}`);
  }

  const realtime = sorted.filter((c) => c.realtimeAnswersIt);
  if (realtime.length > 0) {
    console.log();
    console.log(
      `  ${realtime.length} av dem er kollektiv-holdeplasser — sanntid fra Entur er svaret der.`,
    );
    console.log("  De ligger sist i fila. Hopp over dem med mindre du har en grunn.");
  }

  console.log();
  console.log("─── Arbeidsliste (i rekkefølge) ───────────────────────────────");
  for (const c of sorted) {
    const marker = c.realtimeAnswersIt ? "~" : " ";
    console.log(
      `${marker} ${c.name.slice(0, 34).padEnd(34)} ${(c.categoryName ?? c.categoryId ?? "-").padEnd(16)} ${c.why}`,
    );
  }

  const outPath = OUT_OVERRIDE ?? path.join("data", "pois", `${projectId}.staging.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  // Ikke klobbe kurator-arbeid: finnes fila alt, bevar teksten som er skrevet.
  let preserved = 0;
  if (fs.existsSync(outPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(outPath, "utf8")) as {
        pois?: Array<{ id: string; narrative?: string }>;
      };
      const prevText = new Map(
        (prev.pois ?? [])
          .filter((p) => p.narrative?.trim())
          .map((p) => [p.id, p.narrative!.trim()]),
      );
      for (const c of sorted) {
        const existing = prevText.get(c.id);
        if (existing) {
          c.narrative = existing;
          preserved++;
        }
      }
    } catch {
      console.warn(`  ! kunne ikke lese eksisterende ${outPath} — skriver ny fil`);
    }
  }

  const file = buildStagingFile(projectId, sorted, new Date().toISOString());
  fs.writeFileSync(outPath, JSON.stringify(file, null, 2));

  console.log();
  console.log(`Skrevet:  ${outPath}`);
  if (preserved > 0) console.log(`          (${preserved} allerede skrevne tekster bevart)`);
  console.log();
  console.log("Neste: fyll «narrative» per POI, så");
  console.log(`  npx tsx scripts/curate-pois.ts --file ${outPath}        # dry run`);
  console.log(`  npx tsx scripts/curate-pois.ts --file ${outPath} --yes  # skriv`);
}

// ─── Modus: --file ──────────────────────────────────────────────────────────

async function runWrite(filePath: string): Promise<void> {
  console.log("=== Skriv kuratert POI-tekst ===");
  console.log(`Fil:    ${filePath}`);
  console.log(`Modus:  ${APPLY ? "APPLY" : "DRY RUN"}`);

  assert(fs.existsSync(filePath), `Fil finnes ikke: ${filePath}`);
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;

  const parsed = parseStagingForWrite(raw);
  if (!parsed.ok) {
    console.error();
    console.error("─── Validering feilet — ingenting skrevet ─────────────────────");
    for (const e of parsed.errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  console.log(`Prosjekt: ${parsed.projectId}`);
  console.log(`Å skrive: ${parsed.toWrite.length} (${parsed.skipped} uten tekst, hoppes over)`);

  if (parsed.toWrite.length === 0) {
    console.log();
    console.log("Ingen tekster fylt ut. Ingenting å gjøre.");
    return;
  }

  const rows = await fetchPoisByIds(parsed.toWrite.map((t) => t.id));
  const byId = new Map(rows.map((r) => [r.id, r]));

  const missing = parsed.toWrite.filter((t) => !byId.has(t.id));
  if (missing.length > 0) {
    console.error();
    console.error("─── POI-IDer finnes ikke i DB — ingenting skrevet ─────────────");
    for (const m of missing) console.error(`  ✗ ${m.id}`);
    process.exit(1);
  }

  // Backup FØR alt, også på dry run.
  const backupDir = path.resolve(".", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `pois-curated-${parsed.projectId}-${Date.now()}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(rows, null, 2));
  console.log(`Backup:   ${backupPath}`);

  const now = new Date().toISOString();
  const planned = parsed.toWrite.map((t) => {
    const row = byId.get(t.id)!;
    const { grounding } = parseGroundingLoose(row.grounding);
    const next = mergeCurated(grounding, t.narrative, now);
    return { row, next, narrative: t.narrative, replacing: Boolean(grounding?.curated) };
  });

  // Valider mot lesestiens skjema før write — aldri skriv noe render avviser.
  for (const p of planned) {
    const check = PoiGroundingViewSchema.safeParse(p.next);
    if (!check.success) {
      console.error(
        `ASSERT FAILED: ${p.row.id} ville skrevet ugyldig grounding: ${check.error.issues[0]?.message}`,
      );
      process.exit(1);
    }
  }

  console.log();
  console.log("─── Plan ──────────────────────────────────────────────────────");
  for (const p of planned) {
    const verb = p.replacing ? "ERSTATTER" : "ny";
    console.log(`\n  ${p.row.name} [${verb}]`);
    console.log(`  ${p.narrative}`);
    if (p.next.generated) {
      console.log(
        `  (leverandør-lag bevart: ${p.next.generated.qualityGate.passed ? "bestått" : "strøk"})`,
      );
    }
    if (p.next.lastAttempt) {
      console.log(`  (tomt forsøk bevart: ${p.next.lastAttempt.outcome})`);
    }
  }

  if (!APPLY) {
    console.log();
    console.log("DRY RUN — ingenting skrevet. Re-kjør med --yes.");
    return;
  }

  console.log();
  console.log("─── Skriver ───────────────────────────────────────────────────");
  let written = 0;
  const failures: string[] = [];

  for (const p of planned) {
    const url = new URL(`${SUPABASE_URL}/rest/v1/pois`);
    url.searchParams.set("id", `eq.${p.row.id}`);
    // Optimistisk lås: raden må være uendret siden vi leste den.
    url.searchParams.set("updated_at", `eq.${p.row.updated_at}`);

    const res = await fetch(url.toString(), {
      method: "PATCH",
      headers: sbHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
        "Content-Profile": "v2",
      }),
      // KUN grounding-kolonnen.
      body: JSON.stringify({ grounding: p.next }),
    });

    if (!res.ok) {
      failures.push(`${p.row.id}: HTTP ${res.status}`);
      continue;
    }
    const patched = (await res.json()) as unknown[];
    if (!Array.isArray(patched) || patched.length === 0) {
      failures.push(`${p.row.id}: 0 rader (optimistisk lås — raden endret siden lesing)`);
      continue;
    }
    written++;
  }

  console.log(`  Skrevet: ${written}/${planned.length}`);
  if (failures.length > 0) {
    console.error(`  Feilet:  ${failures.length}`);
    for (const f of failures) console.error(`    ✗ ${f}`);
  }

  // ── Post-write-verifisering ──────────────────────────────────────────────
  const verify = await fetchPoisByIds(planned.map((p) => p.row.id));
  let verified = 0;
  for (const row of verify) {
    const { grounding } = parseGroundingLoose(row.grounding);
    const expected = planned.find((p) => p.row.id === row.id)!.narrative;
    if (grounding?.curated?.narrative === expected) verified++;
  }
  console.log();
  console.log(`Post-write: ${verified}/${planned.length} bekreftet i DB`);
  if (verified < written) {
    console.error(`ASSERT FAILED: skrev ${written}, men bare ${verified} bekreftet. Backup: ${backupPath}`);
    process.exit(1);
  }

  await revalidate(`product:${parsed.projectId}`);

  console.log();
  console.log("✓ Ferdig");
  console.log(`  Backup: ${backupPath}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  assert(SUPABASE_URL, "Mangler NEXT_PUBLIC_SUPABASE_URL");
  assert(SUPABASE_KEY, "Mangler SUPABASE_SERVICE_ROLE_KEY");

  if (LIST_PROJECT) await runList(LIST_PROJECT);
  else await runWrite(STAGING_FILE!);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
