#!/usr/bin/env npx tsx
/**
 * Kuratér nabolags-område: last staging-JSON (håndtegnet polygon + kuratert
 * report_editorial) opp til eksisterende `areas`-rad, eller list POI-kandidater
 * per bolig-tema som kurateringsmeny.
 *
 * Usage:
 *   npx tsx scripts/curate-area.ts --dry-run
 *   npx tsx scripts/curate-area.ts --file data/areas/ranheim.staging.json
 *   npx tsx scripts/curate-area.ts --yes
 *   npx tsx scripts/curate-area.ts --list-pois <projectId>[,<projectId>…] [--theme mat-drikke]
 *
 * Flags:
 *   --file <path>        Staging-fil (default: data/areas/ranheim.staging.json)
 *   --dry-run            Valider + print plan (diff mot DB-raden), ingen writes
 *   --yes                Hopp over interaktiv bekreftelse før write
 *   --list-pois <id,…>   Hjelpe-modus (read-only): kandidat-meny — POIer fra ett
 *                        eller flere provisjonerte prosjekter (UNION, dedup på
 *                        poi-id), filtrert per temaets kategorier, sortert på
 *                        avstand fra områdets senter
 *   --theme <temaId>     Avgrens --list-pois til ett tema (default: alle 6)
 *   --area <areaId>      Områderad for --list-pois-avstander (default: ranheim)
 *
 * Skrivemønster (dokumentert valg): `areas` har INGEN `updated_at`-kolonne, så
 * optimistisk lås à la apply-curation-staging.ts er ikke mulig her. Dette er en
 * én-operatør-PoC — vi bruker enkel GET → klient-side spread-merge → PATCH på
 * id. Merge-semantikk: staging overskriver `boundary` og de
 * `report_editorial`-temaene den har; eksisterende temaer som ikke er i
 * staging BEHOLDES.
 */

import { config } from "dotenv";
import * as fs from "node:fs";
import * as readline from "readline";
config({ path: ".env.local" });

import { parseAreaStaging } from "@/lib/pipeline/area-staging";
import { REPORT_THEME_DEFAULTS } from "@/lib/pipeline/report-defaults";
import { calculateDistance } from "@/lib/utils/geo";
import { createServerClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Antall POI-ider per .in()-spørring — holder request-URLene trygt korte. */
const POI_CHUNK_SIZE = 100;

// ── Arg-parsing ───────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const has = (flag: string) => args.includes(flag);

  return {
    file: get("--file") ?? "data/areas/ranheim.staging.json",
    dryRun: has("--dry-run"),
    yes: has("--yes"),
    listPois: get("--list-pois"),
    theme: get("--theme"),
    area: get("--area") ?? "ranheim",
  };
}

// ── Supabase REST (areas er ikke i typed Database — rå REST som
//    apply-curation-staging.ts) ──────────────────────────────────────────

function restHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_KEY!,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };
}

interface AreaRow {
  id: string;
  name_no: string | null;
  level: string | null;
  center_lat: number | null;
  center_lng: number | null;
  boundary: unknown | null;
  report_editorial: Record<string, unknown> | null;
}

async function fetchAreaRow(areaId: string): Promise<AreaRow | null> {
  const url =
    `${SUPABASE_URL}/rest/v1/areas?id=eq.${encodeURIComponent(areaId)}` +
    `&select=id,name_no,level,center_lat,center_lng,boundary,report_editorial`;
  const res = await fetch(url, { headers: restHeaders() });
  if (!res.ok) {
    throw new Error(`GET areas feilet: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as AreaRow[];
  return rows[0] ?? null;
}

// ── Interaktiv bekreftelse ────────────────────────────────────────────────

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const svar = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  const s = svar.trim().toLowerCase();
  return !(s === "n" || s === "nei");
}

// ── Default-modus: staging → areas-raden ──────────────────────────────────

async function applyStaging(opts: { file: string; dryRun: boolean; yes: boolean }) {
  console.log(`Leser staging-fil: ${opts.file}`);
  if (!fs.existsSync(opts.file)) {
    console.error(`Feil: staging-fil mangler: ${opts.file}`);
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(opts.file, "utf-8"));
  } catch (e) {
    console.error(
      `Feil: ugyldig JSON i ${opts.file}: ${e instanceof Error ? e.message : e}`
    );
    process.exit(1);
  }

  const parsed = parseAreaStaging(raw);
  if (!parsed.success) {
    console.error(`\nStaging-validering feilet (${parsed.errors.length} feil):`);
    for (const err of parsed.errors) console.error(`  ✗ ${err}`);
    process.exit(1);
  }
  const staging = parsed.data;
  const stagingThemeIds = Object.keys(staging.report_editorial);
  console.log(
    `✓ Staging validert: areaId='${staging.areaId}', ${stagingThemeIds.length} temaer`
  );

  const row = await fetchAreaRow(staging.areaId);
  if (!row) {
    console.error(
      `Feil: ingen areas-rad med id='${staging.areaId}' — slice 1 forventer eksisterende rad (migrasjon 050)`
    );
    process.exit(1);
  }

  // Klient-side merge (se header: areas mangler updated_at → ingen optimistisk lås)
  const existingEditorial = row.report_editorial ?? {};
  const nextEditorial = { ...existingEditorial, ...staging.report_editorial };

  // ── Plan ──
  console.log(
    `\n── Plan for areas.id='${row.id}' (${row.name_no ?? "uten navn"}, level=${row.level ?? "?"}) ──`
  );
  const outerRingPoints =
    staging.boundary.type === "Polygon"
      ? staging.boundary.coordinates[0].length
      : staging.boundary.coordinates.reduce((sum, poly) => sum + poly[0].length, 0);
  console.log(
    `boundary: settes (${staging.boundary.type}, ${outerRingPoints} punkter i ytre ring) — ` +
      (row.boundary ? "ERSTATTER eksisterende boundary" : "raden har ingen boundary i dag")
  );

  console.log("report_editorial:");
  const emptyThemes: string[] = [];
  for (const theme of REPORT_THEME_DEFAULTS) {
    const incoming = staging.report_editorial[theme.id];
    if (!incoming) {
      if (theme.id in existingEditorial) {
        console.log(`  · ${theme.id}: BEHOLDES (ikke i staging)`);
      }
      continue;
    }
    const status = theme.id in existingEditorial ? "OPPDATERES" : "NY";
    const bodyDesc = incoming.body.trim() ? `${incoming.body.length} tegn` : "tom";
    console.log(
      `  · ${theme.id}: ${status} — body: ${bodyDesc}, ${incoming.highlightCandidates.length} highlight-kandidater` +
        (incoming.image ? ", image" : "")
    );
    if (!incoming.body.trim() && incoming.highlightCandidates.length === 0) {
      emptyThemes.push(theme.id);
    }
  }
  // Eksisterende nøkler utenfor dagens tema-defaults beholdes også av mergen
  for (const key of Object.keys(existingEditorial)) {
    if (
      !(key in staging.report_editorial) &&
      !REPORT_THEME_DEFAULTS.some((t) => t.id === key)
    ) {
      console.log(`  · ${key}: BEHOLDES (eksisterende nøkkel utenfor tema-defaults)`);
    }
  }

  if (emptyThemes.length > 0) {
    console.warn(
      `\n⚠️  ${emptyThemes.length} temaer er tomme (${emptyThemes.join(", ")}) — ser ut som mal-innhold. De skrives som tomme objekter og gir ingen drill-in (gating: body ELLER ≥1 highlight).`
    );
  }

  if (opts.dryRun) {
    console.log("\nIngen writes (--dry-run)");
    return;
  }

  if (!opts.yes) {
    const ok = await confirm(
      `\nSkriv boundary + ${stagingThemeIds.length} temaer til areas.id='${staging.areaId}'? [J/n]: `
    );
    if (!ok) {
      console.log("Avbrutt — ingen writes");
      return;
    }
  }

  const patchUrl = `${SUPABASE_URL}/rest/v1/areas?id=eq.${encodeURIComponent(staging.areaId)}`;
  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      ...restHeaders(),
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      boundary: staging.boundary,
      report_editorial: nextEditorial,
    }),
  });
  if (!res.ok) {
    console.error(`PATCH feilet: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const patched = (await res.json()) as AreaRow[];
  if (!Array.isArray(patched) || patched.length === 0) {
    console.error("PATCH traff 0 rader — sjekk at areas-raden fortsatt finnes");
    process.exit(1);
  }
  console.log(
    `\n✓ areas.id='${staging.areaId}' oppdatert (boundary + ${Object.keys(nextEditorial).length} temaer i report_editorial)`
  );
  console.log(
    `Verifiser (REST): ${SUPABASE_URL}/rest/v1/areas?id=eq.${staging.areaId}&select=id,boundary,report_editorial`
  );
}

// ── Hjelpe-modus: kandidat-meny per tema ──────────────────────────────────

interface PoiRow {
  id: string;
  name: string;
  category_id: string | null;
  lat: number;
  lng: number;
  trust_score: number | null;
}

async function listPoiCandidates(opts: {
  projectIds: string[];
  themeId?: string;
  areaId: string;
}) {
  let themes = REPORT_THEME_DEFAULTS;
  if (opts.themeId) {
    const match = REPORT_THEME_DEFAULTS.find((t) => t.id === opts.themeId);
    if (!match) {
      console.error(
        `Feil: ukjent tema-id "${opts.themeId}" — gyldige: ${REPORT_THEME_DEFAULTS.map((t) => t.id).join(", ")}`
      );
      process.exit(1);
    }
    themes = [match];
  }

  const supabase = createServerClient();
  if (!supabase) {
    console.error("Feil: Supabase ikke konfigurert");
    process.exit(1);
  }

  // Områdesenter for avstandsberegning
  const area = await fetchAreaRow(opts.areaId);
  if (!area || area.center_lat == null || area.center_lng == null) {
    console.error(`Feil: fant ikke areas-rad med senter for id='${opts.areaId}'`);
    process.exit(1);
  }
  const centerLat = Number(area.center_lat);
  const centerLng = Number(area.center_lng);
  console.log(
    `Kandidat-meny for ${area.name_no ?? opts.areaId} (senter ${centerLat}, ${centerLng})\n`
  );

  // UNION av POI-ider på tvers av prosjektene (dedup på poi-id)
  const poiIdSet = new Set<string>();
  for (const projectId of opts.projectIds) {
    const { data, error } = await supabase
      .from("project_pois")
      .select("poi_id")
      .eq("project_id", projectId);
    if (error) {
      console.error(
        `Feil: henting av project_pois for ${projectId} feilet: ${error.message}`
      );
      process.exit(1);
    }
    if (!data || data.length === 0) {
      console.warn(`⚠️  Ingen POI-er for prosjekt ${projectId} — er prosjektet provisjonert?`);
      continue;
    }
    console.log(`  ${projectId}: ${data.length} POI-koblinger`);
    for (const link of data) poiIdSet.add(link.poi_id);
  }

  const poiIds = Array.from(poiIdSet);
  if (poiIds.length === 0) {
    console.error("\nIngen POI-er funnet for de oppgitte prosjektene — ingenting å liste");
    process.exit(1);
  }
  console.log(`UNION: ${poiIds.length} unike POI-er fra ${opts.projectIds.length} prosjekt(er)\n`);

  // Hent POI-data i chunks (heterogene ID-strenger i URL — hold dem korte)
  const pois: PoiRow[] = [];
  for (let i = 0; i < poiIds.length; i += POI_CHUNK_SIZE) {
    const chunk = poiIds.slice(i, i + POI_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("pois")
      .select("id, name, category_id, lat, lng, trust_score")
      .in("id", chunk);
    if (error) {
      console.error(`Feil: henting av POI-data feilet: ${error.message}`);
      process.exit(1);
    }
    pois.push(...((data ?? []) as PoiRow[]));
  }

  // Per tema: filtrér på temaets kategorier, sortér på avstand fra senteret
  for (const theme of themes) {
    const catSet = new Set(theme.categories);
    const candidates = pois
      .filter((p) => p.category_id != null && catSet.has(p.category_id))
      .map((p) => ({
        ...p,
        distance: Math.round(calculateDistance(centerLat, centerLng, p.lat, p.lng)),
      }))
      .sort((a, b) => a.distance - b.distance);

    console.log(`── ${theme.name} (${theme.id}) — ${candidates.length} kandidater ──`);
    if (candidates.length === 0) {
      console.log("  (ingen)\n");
      continue;
    }
    for (const c of candidates) {
      const trust = c.trust_score != null ? c.trust_score.toFixed(2) : " –  ";
      console.log(
        `  ${String(c.distance).padStart(5)} m  trust ${trust}  ${c.name.padEnd(42)}  ${c.id}`
      );
    }
    console.log("");
  }

  console.log(
    "Kopier POI-IDer inn i highlightCandidates i staging-fila — kurator-prioritert rekkefølge, 4-6 per tema."
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs();

  // Env-sjekk FØR noe annet — begge moduser leser DB (også --dry-run, for diff)
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Feil: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY mangler i .env.local"
    );
    process.exit(1);
  }

  if (args.listPois) {
    const projectIds = args.listPois
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (projectIds.length === 0) {
      console.error("Feil: --list-pois krever minst én prosjekt-id (kommaseparert for flere)");
      process.exit(1);
    }
    await listPoiCandidates({ projectIds, themeId: args.theme, areaId: args.area });
    return;
  }

  await applyStaging({ file: args.file, dryRun: args.dryRun, yes: args.yes });
}

main().catch((err) => {
  console.error("\nFeil:", err instanceof Error ? err.message : err);
  process.exit(1);
});
