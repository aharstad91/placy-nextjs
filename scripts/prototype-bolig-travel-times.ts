/**
 * Henter målte gangtider for bolig-prototypens steder og skriver dem til
 * `lib/prototype/bolig/travel-times.ts`.
 *
 * Kjør etter at et sted i `fixture.ts` er lagt til eller flyttet:
 *   npx tsx scripts/prototype-bolig-travel-times.ts
 *
 * Skriver INGENTING til Supabase. Enhets-kontrakt: MINUTTER (ceil, gulv 1),
 * samme som `v2.project_pois.travel_times`. Mapbox Matrix tar maks 25
 * koordinater per kall (1 senter + 24 mål), så stedene chunkes.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { RAW_PLACES } from "../lib/prototype/bolig/fixture";

config({ path: ".env.local" });

/** Eksempelboligens punkt (lib/prototype/bolig/fixture.ts: house.lat/lng). */
const CENTER = { lat: 63.4318, lng: 10.5165 };

/** Maks destinasjoner per Matrix-kall (25 koordinater totalt, minus senteret). */
const CHUNK_SIZE = 24;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("Mangler NEXT_PUBLIC_MAPBOX_TOKEN i .env.local");

  const minutes: Record<string, number> = {};
  const failed: string[] = [];
  const chunks = chunk(RAW_PLACES, CHUNK_SIZE);

  for (const group of chunks) {
    const coords = [
      `${CENTER.lng},${CENTER.lat}`,
      ...group.map(p => `${p.lng},${p.lat}`),
    ].join(";");
    const destinations = group.map((_, i) => i + 1).join(";");
    const url =
      `https://api.mapbox.com/directions-matrix/v1/mapbox/walking/${coords}` +
      `?access_token=${token}&sources=0&destinations=${destinations}&annotations=duration`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Matrix walking: HTTP ${res.status} (${await res.text()})`);
    const body = (await res.json()) as { durations: (number | null)[][] };
    const row = body.durations?.[0] ?? [];

    group.forEach((p, i) => {
      const seconds = row[i];
      if (typeof seconds !== "number") {
        failed.push(`${p.id} (${p.name})`);
        return;
      }
      minutes[p.id] = Math.max(1, Math.ceil(seconds / 60));
    });
    console.log(`walking: ${row.length} destinasjoner i denne gruppen`);
  }

  if (failed.length) {
    console.warn(`Ingen rute funnet for ${failed.length} sted(er):`);
    failed.forEach(f => console.warn(`  - ${f}`));
  }

  const rows = RAW_PLACES.filter(p => minutes[p.id] !== undefined)
    .map(p => `  "${p.id}": ${minutes[p.id]},`)
    .join("\n");

  const out = `/**
 * Målte gangtider fra eksempelboligens punkt (63.4318, 10.5165) til stedene i
 * bolig-fixturen.
 *
 * GENERERT av scripts/prototype-bolig-travel-times.ts — ikke rediger for hånd.
 * Kilde: Mapbox Directions Matrix (walking-profil).
 * Enhet: MINUTTER (ceil, gulv 1).
 */

export const BOLIG_WALK_MINUTES: Record<string, number> = {
${rows}
};
`;

  const outPath = resolve(process.cwd(), "lib/prototype/bolig/travel-times.ts");
  writeFileSync(outPath, out, "utf8");
  console.log(`Skrev ${Object.keys(minutes).length} av ${RAW_PLACES.length} gangtider → ${outPath}`);
  if (failed.length) {
    console.log(`${failed.length} sted(er) mangler gangtid (se advarsler over).`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
