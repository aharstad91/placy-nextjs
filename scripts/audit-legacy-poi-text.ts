#!/usr/bin/env npx tsx
/**
 * Finn (og rydd) POI-tekst som er forankret i ett bestemt prosjekt.
 *
 * Usage:
 *   npx tsx scripts/audit-legacy-poi-text.ts              # audit, read-only
 *   npx tsx scripts/audit-legacy-poi-text.ts --clear      # dry-run av opprydding
 *   npx tsx scripts/audit-legacy-poi-text.ts --clear --apply
 *   npx tsx scripts/audit-legacy-poi-text.ts --clear --apply --kun-med-erstatning
 *
 * `pois` er ÉN rad delt av alle boards, så «gangavstand fra Overvik» rendres
 * også på Ranheim-boardet. Se lib/pipeline/legacy-poi-text.ts for hvorfor
 * hele feltet tømmes framfor å redigere setningen.
 *
 * `--kun-med-erstatning` rører bare POI-er som har grounded/kuratert tekst som
 * overtar — den trygge halvparten når man ikke vil tømme et live demo-board.
 */

import "./load-env";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  byggProsjektnavnListe,
  finnLegacyTekst,
  planTekstopprydding,
  type LegacyTextPoi,
} from "@/lib/pipeline/legacy-poi-text";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const CLEAR = args.includes("--clear");
const APPLY = args.includes("--apply");
const KUN_MED_ERSTATNING = args.includes("--kun-med-erstatning");

const readHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Accept-Profile": "v2",
};

async function fetchAll<T>(pathAndQuery: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
      headers: { ...readHeaders, Range: `${from}-${from + 999}` },
    });
    if (!res.ok) throw new Error(`${pathAndQuery}: HTTP ${res.status}`);
    const page = (await res.json()) as T[];
    rows.push(...page);
    if (page.length < 1000) break;
    from += 1000;
  }
  return rows;
}

async function main() {
  const [pois, projects, links] = await Promise.all([
    fetchAll<LegacyTextPoi>(
      "pois?select=id,name,editorial_hook,local_insight,description,grounding",
    ),
    fetchAll<{ name: string }>("projects?select=name"),
    fetchAll<{ poi_id: string; project_id: string }>("project_pois?select=poi_id,project_id"),
  ]);

  const prosjektnavn = byggProsjektnavnListe(projects.map((p) => p.name));
  const treff = finnLegacyTekst(pois, prosjektnavn);

  const boardsPerPoi = new Map<string, string[]>();
  for (const l of links) {
    const a = boardsPerPoi.get(l.poi_id) ?? [];
    a.push(l.project_id);
    boardsPerPoi.set(l.poi_id, a);
  }

  const synlige = treff.filter((t) => boardsPerPoi.has(t.poi.id));
  const medErstatning = treff.filter((t) => t.harErstatning);

  console.log(`\n═══ Prosjekt-forankret POI-tekst ═══`);
  console.log(`  ${pois.length} POI-er gjennomgått · ${prosjektnavn.length} prosjektnavn i mønsteret`);
  console.log(`  treff: ${treff.length}  ·  lenket til minst ett board: ${synlige.length}`);
  console.log(`  har grounding som erstatning: ${medErstatning.length}  ·  uten: ${treff.length - medErstatning.length}`);

  const perProsjekt: Record<string, number> = {};
  for (const t of treff) {
    for (const f of t.felter) perProsjekt[f.prosjekt] = (perProsjekt[f.prosjekt] ?? 0) + 1;
  }
  console.log(`\n  Per prosjektnavn:`);
  for (const [navn, n] of Object.entries(perProsjekt).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${navn.padEnd(24)} ${n}`);
  }

  const perBoard: Record<string, number> = {};
  for (const t of synlige) {
    for (const b of boardsPerPoi.get(t.poi.id) ?? []) perBoard[b] = (perBoard[b] ?? 0) + 1;
  }
  console.log(`\n  Synlig per board:`);
  for (const [b, n] of Object.entries(perBoard).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${b.padEnd(38)} ${n}`);
  }

  if (!CLEAR) {
    console.log(`\n  (read-only — kjør med --clear for oppryddingsplan)`);
    return;
  }

  const kandidater = KUN_MED_ERSTATNING ? medErstatning : treff;
  const planer = kandidater.map((t) => ({ treff: t, ...planTekstopprydding(t) }));
  const mister = planer.filter((p) => p.mister_all_tekst);

  console.log(`\n── Oppryddingsplan ──`);
  console.log(`  POI-er som ryddes: ${planer.length}`);
  console.log(`  …som mister ALL tekst (ingen grounding, ingen andre felt): ${mister.length}`);
  if (mister.length && !KUN_MED_ERSTATNING) {
    console.log(`     kjør med --kun-med-erstatning for å hoppe over disse`);
  }

  if (!APPLY) {
    console.log(`\n  DRY-RUN — ingenting skrevet.`);
    return;
  }

  fs.mkdirSync(path.join(process.cwd(), "backups"), { recursive: true });
  const backupFile = path.join(process.cwd(), "backups", `legacy-poi-text-${Date.now()}.json`);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(planer.map((p) => ({ poi: p.treff.poi, patch: p.patch })), null, 2),
  );
  console.log(`\n  Rollback-dump: ${backupFile}`);

  let skrevet = 0;
  for (const plan of planer) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/pois?id=eq.${encodeURIComponent(plan.treff.poi.id)}`,
      {
        method: "PATCH",
        headers: {
          ...readHeaders,
          "Content-Type": "application/json",
          "Content-Profile": "v2",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(plan.patch),
      },
    );
    if (!res.ok) throw new Error(`PATCH ${plan.treff.poi.id}: HTTP ${res.status} ${await res.text()}`);
    skrevet++;
  }
  console.log(`  Ryddet ${skrevet} POI-er.`);

  const etter = await fetchAll<LegacyTextPoi>(
    "pois?select=id,name,editorial_hook,local_insight,description,grounding",
  );
  const rest = finnLegacyTekst(etter, prosjektnavn);
  console.log(`  Etterverifisering: ${rest.length} treff igjen (forventet ${KUN_MED_ERSTATNING ? treff.length - planer.length : 0}).`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
