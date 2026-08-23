#!/usr/bin/env npx tsx
/**
 * Sjekk at hver `category_id` i malverket faktisk finnes i basen.
 *
 * HVORFOR: en feil kategori-id er en STILL feil. Malen finnes, den ser riktig ut
 * i oversikten, og den treffer aldri et eneste POI. Vi gikk i den 2026-08-16:
 * køen var skrevet med de norske navnene omgjort til slugs, og seks av åtte
 * bommet — Dagligvare heter `supermarket`, ikke `dagligvare`.
 *
 * Egnet som planlagt kjøring sammen med resten av datahygienen.
 *
 *   npx tsx scripts/verify-category-ids.ts
 *
 * Exit 0 = alt stemmer. Exit 1 = minst én id finnes ikke, eller treffer 0 POI-er.
 */

import { config } from "dotenv";
import { CATEGORY_SPECS, PLANLAGTE_KATEGORIER } from "../lib/editorial/category-specs";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Accept-Profile": "v2",
};

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${url.split("?")[0]}: ${await res.text()}`);
  return res.json();
}

async function main(): Promise<void> {
  const kategorier = (await getJson(
    `${SUPABASE_URL}/rest/v1/categories?select=id,name&limit=1000`,
  )) as Array<{ id: string; name: string }>;
  const kjente = new Map(kategorier.map((c) => [c.id, c.name]));

  // Tell POI-er per kategori. Sideveis paginering — PostgREST gir maks 1000.
  const antall = new Map<string, number>();
  for (let off = 0; ; off += 1000) {
    const side = (await getJson(
      `${SUPABASE_URL}/rest/v1/pois?select=category_id&limit=1000&offset=${off}&order=id`,
    )) as Array<{ category_id: string | null }>;
    for (const p of side) {
      if (p.category_id) antall.set(p.category_id, (antall.get(p.category_id) ?? 0) + 1);
    }
    if (side.length < 1000) break;
  }

  const rader: Array<{ mal: string; status: string; id: string; navn: string; n: number }> = [];
  let feil = 0;

  const sjekk = (mal: string, status: string, ids: readonly string[]) => {
    for (const id of ids) {
      const navn = kjente.get(id);
      const n = antall.get(id) ?? 0;
      if (!navn) {
        feil++;
        rader.push({ mal, status, id, navn: "✗ FINNES IKKE", n });
      } else if (n === 0) {
        feil++;
        rader.push({ mal, status, id, navn: `⚠ ${navn} (0 POI-er)`, n });
      } else {
        rader.push({ mal, status, id, navn, n });
      }
    }
  };

  for (const s of CATEGORY_SPECS) sjekk(s.navn, "skrevet", s.kategorier);
  for (const p of PLANLAGTE_KATEGORIER) sjekk(p.navn, "i kø", p.kategorier);

  console.log("mal".padEnd(32) + "status".padEnd(10) + "category_id".padEnd(16) + "POI-er  navn");
  for (const r of rader) {
    console.log(
      r.mal.slice(0, 31).padEnd(32) +
        r.status.padEnd(10) +
        r.id.padEnd(16) +
        String(r.n).padStart(6) +
        "  " +
        r.navn,
    );
  }

  // Summér oppgitt antall mot faktisk, per mal — et avvik betyr at tallene i
  // malverket har blitt gamle, ikke at id-en er feil.
  console.log();
  for (const s of CATEGORY_SPECS) {
    const faktisk = s.kategorier.reduce((sum, k) => sum + (antall.get(k) ?? 0), 0);
    if (faktisk !== s.antall) {
      console.log(`  ! ${s.navn}: malen oppgir ${s.antall} steder, basen har ${faktisk}`);
    }
  }
  for (const p of PLANLAGTE_KATEGORIER) {
    const faktisk = p.kategorier.reduce((sum, k) => sum + (antall.get(k) ?? 0), 0);
    if (faktisk !== p.antall) {
      console.log(`  ! ${p.navn}: køen oppgir ${p.antall} steder, basen har ${faktisk}`);
    }
  }

  console.log();
  if (feil > 0) {
    console.error(`${feil} kategori-id-er stemmer ikke.`);
    process.exit(1);
  }
  console.log(`Alle ${rader.length} kategori-id-er finnes og treffer POI-er.`);
}

main().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(1);
});
