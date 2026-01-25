/**
 * Import taxi stands from Trondheim kommune
 *
 * Data source: https://www.trondheim.kommune.no/parkering/innhold/parkere/taxi/
 * KMZ file: https://www.trondheim.kommune.no/globalassets/parkering/system/kart/Taxiholdeplasser.kmz
 * Last updated: 10.10.2024
 *
 * Usage:
 *   npm run import:taxi
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// Pre-extracted taxi stand data from Trondheim kommune KMZ file
const TAXI_STANDS = [
  { name: "Moholt Alle", lat: 63.411226, lng: 10.434267 },
  { name: "Nedre Møllenberg gate", lat: 63.432282, lng: 10.413138 },
  { name: "Prinsesse Kristinas gate", lat: 63.420485, lng: 10.386885 },
  { name: "Saupstadringen", lat: 63.366331, lng: 10.347446 },
  { name: "Selsbakkvegen", lat: 63.3970368, lng: 10.3598532 },
  { name: "Søndre gate", lat: 63.432638, lng: 10.400193 },
  { name: "Lademoen Kirke", lat: 63.437013, lng: 10.430897 },
  { name: "Rotvoll", lat: 63.438338, lng: 10.479212 },
  { name: "Solsiden", lat: 63.434641, lng: 10.41368 },
  { name: "Heimdal", lat: 63.351331, lng: 10.35727 },
  { name: "Breidablikkveien", lat: 63.417276, lng: 10.35489 },
  { name: "Trondheim Sentralstasjon", lat: 63.4359903, lng: 10.3995309 },
  { name: "Harald Hardrådes gate", lat: 63.419569, lng: 10.389857 },
  { name: "Studentersamfundet", lat: 63.4221761, lng: 10.3956212 },
  { name: "Ilevollen", lat: 63.4292302, lng: 10.3669323 },
  { name: "Ingvald Ystgaards veg", lat: 63.4215437, lng: 10.4716935 },
  { name: "Leüthenhaven", lat: 63.4298477, lng: 10.3888025 },
  { name: "Festningsgata", lat: 63.4292698, lng: 10.4149202 },
  { name: "Midtre Flatås veg", lat: 63.3735314, lng: 10.3460493 },
  { name: "Brattørkaia", lat: 63.4388954, lng: 10.4009291 },
  { name: "Havnegata", lat: 63.4406139, lng: 10.4024848 },
  { name: "Fossegrenda", lat: 63.3875252, lng: 10.4088351 },
  { name: "Skonnertvegen", lat: 63.4341858, lng: 10.5042562 },
  { name: "Øvre Sjetnhaugan", lat: 63.3693231, lng: 10.3944827 },
  { name: "Nardosenteret/Othilienborgvegen", lat: 63.4037044, lng: 10.4284712 },
  { name: "Sorgenfriveien", lat: 63.406543, lng: 10.4002651 },
  { name: "Thoning Owesens gate", lat: 63.4378954, lng: 10.4500311 },
  { name: "City Lade/Håkon Magnussons gate", lat: 63.4439862, lng: 10.4460492 },
  { name: "Jakobslivegen", lat: 63.4216882, lng: 10.4948121 },
  { name: "Sverre Svendsens veg", lat: 63.421489, lng: 10.5263127 },
  { name: "Dronningens gate", lat: 63.4318828, lng: 10.3969283 },
  { name: "Bispegata - Nidarosdomen", lat: 63.4276953, lng: 10.396752 },
  { name: "Munkegata", lat: 63.4309859, lng: 10.3946978 },
  { name: "Busstrase - Ytre Ringveg", lat: 63.3703544, lng: 10.3819732 },
  { name: "Trondheim Spektrum AS", lat: 63.4267629, lng: 10.3774409 },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Error: Missing Supabase environment variables");
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Importing taxi stands from Trondheim kommune...");
  console.log(`Found ${TAXI_STANDS.length} taxi stands\n`);

  // Ensure taxi category exists
  const { error: categoryError } = await supabase.from("categories").upsert(
    { id: "taxi", name: "Taxi", icon: "Car", color: "#fbbf24" },
    { onConflict: "id" }
  );

  if (categoryError) {
    console.error("Failed to create taxi category:", categoryError.message);
    process.exit(1);
  }
  console.log("✓ Taxi category ensured");

  // Prepare POIs for batch upsert
  const pois = TAXI_STANDS.map((stand) => ({
    id: `taxi-${slugify(stand.name)}`,
    name: stand.name,
    lat: stand.lat,
    lng: stand.lng,
    category_id: "taxi",
    address: stand.name,
  }));

  // Batch upsert all POIs at once
  const { error: poiError } = await supabase
    .from("pois")
    .upsert(pois, { onConflict: "id" });

  if (poiError) {
    console.error("Failed to import POIs:", poiError.message);
    process.exit(1);
  }

  console.log(`✓ Imported ${pois.length} taxi stands\n`);
  console.log("Done! View at: http://localhost:3000/admin/pois?categories=taxi");
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
