#!/usr/bin/env npx tsx
/**
 * Bytt avledet områdegeometri mot Trondheim kommunes skolekretspolygoner.
 *
 * Bakgrunn: 25 områder fikk `boundary` avledet fra `postal_codes`, men de
 * postnumrene ble håndskrevet i migrasjon 050. Formen arvet gjetningen.
 * Skolekretsene er kommunens egne polygoner (NLOD) og er den eneste
 * autoritative strøk-inndelingen som finnes for Trondheim.
 *
 * Bruk:
 *   npx tsx scripts/apply-krets-boundaries.ts            # dry-run
 *   npx tsx scripts/apply-krets-boundaries.ts --apply    # skriv
 *
 * Krever data/geo/trondheim/kretser-wgs84.json. Den regenereres med
 * `python3 scripts/extract-skolekrets-boundary.py --dump-all` og er committet
 * nettopp for at denne stien ikke skal avhenge av pyproj.
 *
 * Ren logikk (mapping, union, overlapp-deteksjon) ligger i
 * `lib/pipeline/krets-boundaries.ts` og har testene. Denne fila er lesing,
 * skriving og rapport.
 *
 * KOST: 0. Datasettet ligger i repoet.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  planKretsBoundaries,
  type AreaForKrets,
  type KretsFeature,
  type KretsWrite,
} from "../lib/pipeline/krets-boundaries";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const KRETS_FILE = "data/geo/trondheim/kretser-wgs84.json";

/**
 * PostgREST returnerer maks 1000 rader uten eksplisitt grense. `areas` er ~46
 * rader i dag, men et stille tak ville fått scriptet til å hoppe over områder
 * uten å si fra. Vi kaster heller.
 */
const ROW_LIMIT = 1000;

function loadKretser(): KretsFeature[] {
  const path = resolve(process.cwd(), KRETS_FILE);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(
      `Fant ikke ${KRETS_FILE} — regenerer med:\n` +
        `  python3 scripts/extract-skolekrets-boundary.py --dump-all`
    );
  }
  const parsed = JSON.parse(raw) as { kretser?: KretsFeature[] };
  const kretser = parsed.kretser ?? [];
  if (kretser.length === 0) throw new Error(`${KRETS_FILE} inneholder ingen kretser`);
  return kretser;
}

async function readAreas(): Promise<AreaForKrets[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/areas?select=id,name_no,boundary,boundary_source&order=id&limit=${ROW_LIMIT}`,
    {
      headers: {
        apikey: SUPABASE_KEY!,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Accept-Profile": "v2",
      },
    }
  );
  if (!res.ok) throw new Error(`GET areas feilet: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as AreaForKrets[];
  if (rows.length >= ROW_LIMIT) {
    throw new Error(`GET areas returnerte ${rows.length} rader = grensen — legg til paginering`);
  }
  return rows;
}

/**
 * Skriver KUN `boundary` og `boundary_source`. `areas` har ingen `updated_at`,
 * så det finnes ingen optimistisk lås — et smalt PATCH-felt er den eneste
 * beskyttelsen mot å klobbe `report_editorial` med en utdatert lesning.
 */
async function writeBoundary(w: KretsWrite): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/areas?id=eq.${encodeURIComponent(w.id)}`, {
    method: "PATCH",
    headers: {
      apikey: SUPABASE_KEY!,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Content-Profile": "v2",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ boundary: w.boundary, boundary_source: "krets" }),
  });
  if (!res.ok) throw new Error(`PATCH ${w.id} feilet: ${res.status} ${await res.text()}`);

  const rows = (await res.json()) as unknown[];
  if (rows.length === 0) {
    throw new Error(`PATCH ${w.id} traff 0 rader — raden finnes ikke lenger?`);
  }
}

function ringpunkter(boundary: KretsWrite["boundary"]): number {
  return boundary.coordinates.reduce((sum, flate) => sum + (flate[0]?.length ?? 0), 0);
}

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY må være satt");
  }
  const apply = process.argv.includes("--apply");

  const kretser = loadKretser();
  const areas = await readAreas();
  const plan = planKretsBoundaries(areas, kretser);

  console.log(`\nKretsgeometri på områder — ${apply ? "SKRIVER" : "dry-run"}\n`);
  console.log(`  ${areas.length} områder lest, ${kretser.length} skolekretser i datasettet\n`);

  for (const w of plan.write) {
    const fra = w.forrigeSource ?? "ingen form";
    console.log(
      `  SETTER   ${w.id.padEnd(16)} ${w.kretser.join("+").padEnd(14)} ` +
        `${ringpunkter(w.boundary)} punkter   (fra: ${fra})`
    );
  }

  const kuratert = plan.skipped.filter((s) => s.reason === "kuratert-polygon");
  const umappet = plan.skipped.filter((s) => s.reason === "ingen-kretsmapping");
  const opptatt = plan.skipped.filter((s) => s.reason === "krets-tatt-av-kuratert");
  const mangler = plan.skipped.filter((s) => s.reason === "krets-mangler-i-datasettet");

  console.log("");
  if (kuratert.length > 0) {
    console.log(`  urørt, håndjustert (${kuratert.length}): ${kuratert.map((s) => s.id).join(", ")}`);
  }
  if (opptatt.length > 0) {
    console.log(`  ⚠️  krets eid av et kuratert område (${opptatt.length}) — kurator må avgjøre:`);
    for (const s of opptatt) console.log(`    ${s.id}: ${s.detalj}`);
  }
  if (umappet.length > 0) {
    console.log(`  ingen krets med samme navn (${umappet.length}):`);
    console.log(`    ${umappet.map((s) => s.id).join(", ")}`);
  }
  if (mangler.length > 0) {
    // Skrivefeil i AREA_KRETS_MAP eller nytt kretsdatasett — begge er feil vi vil se.
    console.log(`  ⚠️  krets mangler i datasettet (${mangler.length}):`);
    for (const s of mangler) console.log(`    ${s.id} → ${s.detalj}`);
  }

  if (plan.ubrukteKretser.length > 0) {
    console.log(`\n  ${plan.ubrukteKretser.length} kretser uten område i basen:`);
    console.log(`    ${plan.ubrukteKretser.join(", ")}`);
  }

  // Geofencen returnerer matches[0] ved flere treff, så overlapp betyr at
  // raderekkefølgen avgjør hvilket strøk en bolig havner i. Skillet er viktig:
  // kollisjon mot en `derived`-form er støy fra gjetningen vi holder på å
  // erstatte, mens kollisjon mot `curated` eller `krets` er to autoritative
  // former som hevder samme grunn — det må et menneske avgjøre.
  const autoritative = plan.overlapp.filter(
    (o) => o.kildeSource !== "derived" && o.motSource !== "derived"
  );
  const gjettet = plan.overlapp.filter(
    (o) => o.kildeSource === "derived" || o.motSource === "derived"
  );

  // Vis hvert par én gang: a↔b og b↔a er samme konflikt.
  const sett = new Set<string>();
  const par = autoritative.filter((o) => {
    const nokkel = [o.id, o.motId].sort().join("|");
    if (sett.has(nokkel)) return false;
    sett.add(nokkel);
    return true;
  });

  if (par.length > 0) {
    console.log(`\n  ⚠️  ${par.length} overlapp mellom autoritative former:`);
    for (const o of par) {
      const merke = o.nyForm ? "ny" : "sto fra før";
      console.log(
        `    ${o.id.padEnd(16)} ↔ ${o.motId.padEnd(16)} ${String(o.treffpunkter).padStart(4)} punkter   (${merke})`
      );
    }
    console.log(
      `    Geofencen tar den første treffende raden, så disse avgjøres i dag av raderekkefølge.`
    );
  }
  if (gjettet.length > 0) {
    const berort = [
      ...new Set(
        gjettet.flatMap((o) => [
          o.kildeSource === "derived" ? o.id : null,
          o.motSource === "derived" ? o.motId : null,
        ])
      ),
    ]
      .filter((x): x is string => x !== null)
      .sort();
    console.log(
      `\n  ${gjettet.length} overlapp der minst én side bare er gjettet (venter på ekte form):\n` +
        `    ${berort.join(", ")}`
    );
  }

  if (!apply) {
    console.log(`\n  Dry-run. Kjør med --apply for å skrive ${plan.write.length} rader.\n`);
    return;
  }

  let skrevet = 0;
  for (const w of plan.write) {
    await writeBoundary(w);
    skrevet++;
  }
  console.log(`\n  ✓ Skrev ${skrevet} av ${plan.write.length} planlagte rader.`);
  console.log(`  Neste: npx tsx scripts/import-postal-areas.ts --suggest-postal-codes\n`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
