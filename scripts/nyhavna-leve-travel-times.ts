/**
 * Henter målte reisetider for Nyhavna-demoens steder og skriver dem til
 * `lib/demo/nyhavna-leve/travel-times.ts`.
 *
 * Kjør etter at et koordinat i `content.ts` er endret:
 *   npx tsx scripts/nyhavna-leve-travel-times.ts
 *
 * Skriver INGENTING til Supabase — demoen har ingen rader der. Enhets-kontrakt:
 * MINUTTER (ceil, gulv 1), samme som `v2.project_pois.travel_times`.
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { LEVE_POIS } from "../lib/demo/nyhavna-leve/content";

config({ path: ".env.local" });

/** Nyhavna-boardets senter (v2.projects: nyhavna-utvikling_nyhavna). */
const CENTER = { lng: 10.41725655026434, lat: 63.43980508893858 };

const PROFILES = [
  ["walking", "walk"],
  ["cycling", "bike"],
  ["driving", "car"],
] as const;

async function main() {
  const token = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) throw new Error("Mangler NEXT_PUBLIC_MAPBOX_TOKEN i .env.local");

  const times: Record<string, Record<string, number>> = {};

  for (const [profile, mode] of PROFILES) {
    const coords = [
      `${CENTER.lng},${CENTER.lat}`,
      ...LEVE_POIS.map((p) => `${p.coordinates.lng},${p.coordinates.lat}`),
    ].join(";");
    const destinations = LEVE_POIS.map((_, i) => i + 1).join(";");
    const url =
      `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coords}` +
      `?access_token=${token}&sources=0&destinations=${destinations}&annotations=duration`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Matrix ${profile}: HTTP ${res.status}`);
    const body = (await res.json()) as { durations: (number | null)[][] };
    const row = body.durations?.[0] ?? [];

    LEVE_POIS.forEach((p, i) => {
      const seconds = row[i];
      if (typeof seconds !== "number") {
        console.warn(`[${mode}] ingen rute til ${p.name} — hopper over`);
        return;
      }
      (times[p.id] ??= {})[mode] = Math.max(1, Math.ceil(seconds / 60));
    });
    console.log(`${profile}: ${row.length} destinasjoner`);
  }

  const rows = LEVE_POIS.filter((p) => times[p.id])
    .map((p) => {
      const t = times[p.id];
      return `  "${p.id}": { walk: ${t.walk}, bike: ${t.bike}, car: ${t.car} },`;
    })
    .join("\n");

  const header = `/**
 * Målte reisetider fra Nyhavna-boardets senter til demoens steder.
 *
 * GENERERT av scripts/nyhavna-leve-travel-times.ts — ikke rediger for hånd.
 * Kilde: Mapbox Directions Matrix fra ${CENTER.lat} / ${CENTER.lng}.
 * Enhet: MINUTTER (ceil, gulv 1), samme kontrakt som v2.project_pois.travel_times.
 */

export const LEVE_TRAVEL_TIMES: Record<
  string,
  { walk: number; bike: number; car: number }
> = {
${rows}
};
`;

  const out = resolve(process.cwd(), "lib/demo/nyhavna-leve/travel-times.ts");
  writeFileSync(out, header, "utf8");
  console.log(`Skrev ${Object.keys(times).length} steder → ${out}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
