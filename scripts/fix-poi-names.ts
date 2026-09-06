#!/usr/bin/env npx tsx
/**
 * Retter POI-er som står med Googles ENGELSKE etikett i stedet for et navn, og
 * fjerner oppføringer som er i feil kategori, fra alle boards de ligger på.
 *
 * Hvorfor scriptet finnes: nærhetssøket sendte ingen `languageCode` fram til
 * 2026-09-06, så alt Google ikke hadde et lagret egennavn for kom tilbake på
 * engelsk. Pipelinen spør nå på norsk (`SEARCH_LANGUAGE` i poi-discovery.ts),
 * men rader som ALT er skrevet blir ikke rørt av det — de må hentes én gang.
 *
 * Tre steg per rad:
 *   1. Har raden en google_place_id, spørres Places på nytt med languageCode
 *      «no». Google har ofte det riktige navnet og ga oss bare feil språk:
 *      «Church» → «Vår Frue kirke», «Sports Field» → «Rosenborgbanen 11er».
 *   2. Står navnet fortsatt på engelsk, brukes `norskStedsnavn` — den bytter
 *      bare rene etiketter, og bare i kategorien etiketten gjelder for.
 *   3. Er navnet i konflikt med kategorien (`isNameCategoryMismatch`), fjernes
 *      stedet fra boardene. Pool-raden beholdes: stedet er ekte, det er
 *      klassifiseringen som er feil, og en sletting er ikke reverserbar.
 *
 * Kostnad: masken er `displayName` alene = Essentials-SKU ($0). Antall kall =
 * antall rader som treffes.
 *
 * Bruk:
 *   npx tsx scripts/fix-poi-names.ts                  # tørrkjøring, alle boards
 *   npx tsx scripts/fix-poi-names.ts --apply
 *   npx tsx scripts/fix-poi-names.ts --project broset-utvikling-as_wesselslokka --apply
 */

import "./load-env";

import { createServerClient } from "@/lib/supabase/client";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import { fetchPlaceDetails } from "@/lib/google-places/fetch-place-details";
import { norskStedsnavn } from "@/lib/pipeline/poi-discovery";
import { isNameCategoryMismatch } from "@/lib/pipeline/poi-quality";

/**
 * Navn som er en ren engelsk etikett. Bevisst en BREDERE liste enn
 * `GENERISKE_NAVN` i poi-discovery: her skal vi bare finne kandidatene som er
 * verdt å spørre Google om på nytt, og en falsk positiv koster ett gratis kall.
 * Selve navnebyttet gjøres av `norskStedsnavn`, som har kategoriporten.
 */
const ENGELSKE_ETIKETTER = [
  "Sports Field", "Athletic Field", "Sports Complex", "Stadium", "Playground",
  "Park", "Dog Park", "Hiking Area", "Swimming Pool", "Golf Course",
  "Ice Skating Rink", "Skate Park", "Cycling Park", "Basketball Court",
  "Tennis Court", "Church", "Cemetery", "Library", "Pharmacy", "Bakery",
  "Cafe", "Restaurant", "Supermarket", "Gym", "Barber Shop", "Hair Salon",
  "Dentist", "Doctor", "Hospital", "School", "Kindergarten", "Museum",
  "Hotel", "Bar", "Bank", "Post Office", "Gas Station", "Convenience Store",
  "Grocery Store", "Parking", "Parking Lot", "Bus Stop", "Beach",
];

interface PoiRad {
  id: string;
  name: string;
  category_id: string | null;
  google_place_id: string | null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--project");
  return {
    apply: args.includes("--apply"),
    project: idx >= 0 ? args[idx + 1] : undefined,
  };
}

async function main() {
  const { apply, project } = parseArgs();
  const apiKey = process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_PLACES_API_KEY mangler i .env.local");
  const db = createServerClient();

  // Avgrens til ett prosjekt hvis bedt om det.
  let poiFilter: Set<string> | null = null;
  if (project) {
    const lenker = await fetchAllRows<{ poi_id: string }>((from, to) =>
      db.schema("v2").from("project_pois").select("poi_id")
        .eq("project_id", project).order("poi_id").range(from, to)
    );
    if (lenker.error) throw new Error(`Ufullstendig lesing av project_pois: ${lenker.error}`);
    poiFilter = new Set(lenker.rows.map((l) => l.poi_id));
    console.log(`Avgrenset til ${poiFilter.size} POI-er på ${project}`);
  }

  const alle = await fetchAllRows<PoiRad>((from, to) =>
    db.schema("v2").from("pois")
      .select("id, name, category_id, google_place_id")
      .order("id").range(from, to)
  );
  if (alle.error) throw new Error(`Ufullstendig lesing av pois: ${alle.error}`);
  const pois = poiFilter ? alle.rows.filter((p) => poiFilter!.has(p.id)) : alle.rows;
  console.log(`Leste ${pois.length} POI-er fra poolen`);

  const etiketter = new Set(ENGELSKE_ETIKETTER.map((e) => e.toLowerCase()));
  const navneKandidater = pois.filter((p) => etiketter.has(p.name.trim().toLowerCase()));
  const feilkategori = pois.filter(
    (p) => p.category_id && isNameCategoryMismatch(p.name, p.category_id)
  );

  console.log(
    `\n${navneKandidater.length} rader står med en engelsk etikett, ` +
      `${feilkategori.length} står i en kategori navnet motsier.\n`
  );

  // ── Navn ────────────────────────────────────────────────────────────────
  let byttet = 0;
  for (const poi of navneKandidater) {
    let nytt = poi.name;
    let kilde = "regel";

    if (poi.google_place_id) {
      const details = await fetchPlaceDetails(poi.google_place_id, apiKey, ["displayName"], {
        languageCode: "no",
      });
      const fraGoogle = details?.displayName?.trim();
      if (fraGoogle && fraGoogle !== poi.name) {
        nytt = fraGoogle;
        kilde = "Google (no)";
      }
    }
    if (nytt === poi.name && poi.category_id) {
      nytt = norskStedsnavn(poi.name, poi.category_id);
    }
    if (nytt === poi.name) {
      console.log(`  – ${poi.name} (${poi.category_id}) — ingen bedre form finnes`);
      continue;
    }

    console.log(`  ✎ ${poi.name} → ${nytt}  [${kilde}, ${poi.category_id}]`);
    byttet++;
    if (apply) {
      const { error } = await db.schema("v2").from("pois")
        .update({ name: nytt }).eq("id", poi.id);
      if (error) throw new Error(`Skrivefeil på ${poi.id}: ${error.message}`);
    }
  }

  // ── Feilkategori ────────────────────────────────────────────────────────
  for (const poi of feilkategori) {
    console.log(`  ✂ ${poi.name} (${poi.category_id}) — fjernes fra boardene, pool-raden beholdes`);
    if (apply) {
      for (const tabell of ["product_pois", "project_pois"] as const) {
        const { error } = await db.schema("v2").from(tabell).delete().eq("poi_id", poi.id);
        if (error) throw new Error(`Kunne ikke fjerne ${poi.id} fra ${tabell}: ${error.message}`);
      }
    }
  }

  console.log(
    `\n${apply ? "SKREV" : "TØRRKJØRING"}: ${byttet} navn byttet, ` +
      `${feilkategori.length} fjernet fra boardene.`
  );
  if (!apply) console.log("Kjør på nytt med --apply for å skrive.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
