#!/usr/bin/env npx tsx
/**
 * Rull ut skolekrets-valget på boards som alt er provisjonert.
 *
 * Usage:
 *   npx tsx scripts/refresh-zoned-schools.ts                    # dry-run, alle bolig-boards
 *   npx tsx scripts/refresh-zoned-schools.ts --apply
 *   npx tsx scripts/refresh-zoned-schools.ts --project <id> --apply
 *
 * Kjører KUN skole-importen (`refreshZonedSchools`). Ingen Google-kall, ingen
 * re-stokking av natur-lenker — se modulens kommentar for hvorfor det er et
 * eget inngangspunkt.
 *
 * NÆRINGS-BOARDS HOPPES OVER: nærings-profilen importerer ikke offentlige
 * POI-er i det hele tatt (skoler er ikke relevant for et kontorbygg), så en
 * kjøring der ville lagt inn data profilen med vilje utelater.
 */

import "./load-env";
import { refreshZonedSchools } from "@/lib/pipeline/import-public-pois";
import { getKommunenummer } from "@/lib/pipeline/geocode";
import { getSchoolZone } from "@/lib/utils/school-zones";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
// `indexOf` gir -1 når flagget mangler, og args[-1 + 1] er args[0] — altså
// «--apply». Uten denne sjekken filtrerte kjøringen bort samtlige boards.
const projectFlagIndex = args.indexOf("--project");
const ONLY = projectFlagIndex >= 0 ? args[projectFlagIndex + 1] : undefined;

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Accept-Profile": "v2",
};

interface ProjectRow {
  id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  venue_type: string | null;
  discovery_circles: Array<{ radiusMeters?: number }> | null;
}

async function main() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/projects?select=id,name,center_lat,center_lng,venue_type,discovery_circles&order=id`,
    { headers },
  );
  if (!res.ok) throw new Error(`projects: HTTP ${res.status}`);
  const all = (await res.json()) as ProjectRow[];

  const projects = all
    .filter((p) => (ONLY ? p.id === ONLY : true))
    .filter((p) => {
      if (p.venue_type === "commercial") {
        console.log(`  ⊘ ${p.id} — nærings-board, offentlige POI-er importeres ikke`);
        return false;
      }
      return true;
    });

  console.log(`\n═══ Skolekrets-oppfriskning ═══`);
  console.log(`Modus: ${APPLY ? "APPLY" : "DRY-RUN"} · ${projects.length} boards\n`);

  for (const p of projects) {
    const zone = getSchoolZone(p.center_lat, p.center_lng);
    const kommune = await getKommunenummer(p.center_lat, p.center_lng);
    const radius = p.discovery_circles?.[0]?.radiusMeters ?? 2500;

    console.log(`${p.id}`);
    console.log(
      `   krets: ${zone.barneskole ?? "—"} / ${zone.ungdomsskole ?? "—"} · kommune ${kommune?.kommunenummer ?? "?"} · radius ${radius} m`,
    );

    if (!kommune?.kommunenummer) {
      console.log(`   ⚠ fant ikke kommunenummer — hoppet over\n`);
      continue;
    }
    if (!APPLY) {
      console.log(`   (dry-run — ingenting skrevet)\n`);
      continue;
    }

    const { linked, warnings } = await refreshZonedSchools({
      projectId: p.id,
      lat: p.center_lat,
      lng: p.center_lng,
      radiusMeters: radius,
      kommunenummer: kommune.kommunenummer,
    });
    console.log(`   skoler linket: ${linked}`);
    for (const w of warnings) console.log(`   ${w}`);
    console.log();
  }

  if (!APPLY) console.log(`DRY-RUN — kjør med --apply for å skrive.`);
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
