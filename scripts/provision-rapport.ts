#!/usr/bin/env npx tsx
/**
 * Provision basic Placy rapport-board.
 *
 * Usage:
 *   npx tsx scripts/provision-rapport.ts --name "Vikhammer Strand" --address "Vikhammer Strand, Malvik"
 *   npx tsx scripts/provision-rapport.ts --name "X" --address "Y" --customer "min-kunde" --dry-run
 *   npx tsx scripts/provision-rapport.ts --name "X" --address "Y" --confirm-coords 63.41,10.77
 *   npx tsx scripts/provision-rapport.ts --name "X" --address "Y" --update   (re-kjøring mot eksisterende)
 *
 * Flags:
 *   --name          Prosjektnavn, f.eks. "Vikhammer Strand"
 *   --address       Full adresse, f.eks. "Vikhammer Strand, Malvik"
 *   --customer      Kunde-slug (default: placy-demo)
 *   --dry-run       Geocode + plan uten Supabase-writes
 *   --confirm-coords lat,lng  Hopp over interaktiv bekreftelse
 *   --update        Tillat re-kjøring mot eksisterende prosjekt
 */

import { config } from "dotenv";
import * as readline from "readline";
config({ path: ".env.local" });

import {
  geocodeAddress,
  getKommunenummer,
} from "@/lib/pipeline/geocode";
import {
  createReportProject,
  DEFAULT_CUSTOMER,
} from "@/lib/pipeline/create-report-project";
import { importPublicPois } from "@/lib/pipeline/import-public-pois";
import { enrichReportPois } from "@/lib/pipeline/enrich-report-pois";
import { hydrateReport } from "@/lib/pipeline/hydrate-report";
import { getDiscoveryRadius } from "@/lib/pipeline/report-defaults";
import { createServerClient } from "@/lib/supabase/client";

// ── Arg-parsing ───────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };
  const has = (flag: string) => args.includes(flag);

  const name = get("--name");
  const address = get("--address");
  const customer = get("--customer") ?? DEFAULT_CUSTOMER;
  const dryRun = has("--dry-run");
  const allowUpdate = has("--update");
  const confirmCoordsStr = get("--confirm-coords");

  if (!name || !address) {
    console.error("Bruk: --name <prosjektnavn> --address <adresse>");
    process.exit(1);
  }

  let confirmCoords: { lat: number; lng: number } | undefined;
  if (confirmCoordsStr) {
    const [lat, lng] = confirmCoordsStr.split(",").map(Number);
    if (isNaN(lat) || isNaN(lng)) {
      console.error("--confirm-coords må være lat,lng (f.eks. 63.41,10.77)");
      process.exit(1);
    }
    confirmCoords = { lat, lng };
  }

  return { name, address, customer, dryRun, allowUpdate, confirmCoords };
}

// ── Logging ───────────────────────────────────────────────────────────────

function log(msg: string) { console.log(msg); }
function warn(msg: string) { console.warn(msg); }
function section(title: string) { log(`\n── ${title} ──`); }

// ── Revalidering ─────────────────────────────────────────────────────────

async function revalidateProject(customer: string, slug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  const tag = `product:${customer}_${slug}`;
  const path = `/eiendom/${customer}/${slug}/rapport-board`;

  // Prøv /api/admin/revalidate (krever ADMIN_ENABLED på prod)
  const prodUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://placy.app";
  try {
    const res = await fetch(`${prodUrl}/api/admin/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, path }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      log(`✓ Revalidert: ${tag} + ${path}`);
      return;
    }
  } catch {
    // Faller gjennom til advarsel
  }
  warn(`ℹ️  Revalidering ikke tilgjengelig — nytt prosjekt rendrer ferskt ved første request`);
  log(`   Tag: ${tag}`);
  log(`   Path: ${path}`);
}

// ── Akseptansesjekk ───────────────────────────────────────────────────────

async function acceptanceCheck(
  productId: string,
  customer: string,
  slug: string
): Promise<boolean> {
  const supabase = createServerClient();
  if (!supabase) {
    warn("⚠️  Kan ikke verifisere — Supabase ikke konfigurert");
    return false;
  }

  let ok = true;

  // 1. product_categories ikke tom
  const { data: cats } = await supabase
    .from("product_categories")
    .select("category_id")
    .eq("product_id", productId);
  const catCount = cats?.length ?? 0;
  if (catCount === 0) {
    warn("✗ product_categories er tom — board viser 0 av 0 steder");
    ok = false;
  } else {
    log(`✓ product_categories: ${catCount} kategorier`);
  }

  // 2. Config har 6 temaer med leadText
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: product } = await (supabase.from("products") as any)
    .select("config")
    .eq("id", productId)
    .single();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const themes = (product?.config as any)?.reportConfig?.themes ?? [];
  const themesWithLead = themes.filter((t: { leadText?: string }) => t.leadText?.trim());
  if (themesWithLead.length < 6) {
    warn(`⚠️  Kun ${themesWithLead.length}/6 temaer har leadText`);
  } else {
    log(`✓ Alle 6 temaer har leadText`);
  }

  // 3. ≥1 POI i minst 4 av 6 temaer (advarsel, ikke feil)
  const { data: pois } = await supabase
    .from("product_pois")
    .select("poi_id")
    .eq("product_id", productId);
  const poiCount = pois?.length ?? 0;
  log(`✓ product_pois: ${poiCount} POI-er`);
  if (poiCount < 10) {
    warn("⚠️  Færre enn 10 POI-er — boardet kan bli tynt");
  }

  // 4. Vis URL-er
  section("Leveranse");
  const localUrl = `http://localhost:3000/eiendom/${customer}/${slug}/rapport-board`;
  const prodUrl = `https://placy.app/eiendom/${customer}/${slug}/rapport-board`;
  log(`Lokal: ${localUrl}`);
  log(`Prod:  ${prodUrl}`);

  return ok;
}

// ── Hoved-pipeline ────────────────────────────────────────────────────────

async function main() {
  const { name, address, customer, dryRun, allowUpdate, confirmCoords } =
    parseArgs();

  // Sjekk env-variabler FØR noen writes
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !dryRun) {
    console.error("Feil: SUPABASE_SERVICE_ROLE_KEY mangler i .env.local");
    process.exit(1);
  }

  // ── Steg 1: Geocode ────────────────────────────────────────────────────
  section("Steg 1: Geocoding");

  let lat: number;
  let lng: number;
  let placeName: string;
  let city: string | undefined;
  let kommunenummer: string | undefined;

  if (confirmCoords) {
    lat = confirmCoords.lat;
    lng = confirmCoords.lng;
    placeName = address;
    log(`Bruker bekreftet posisjon: ${lat}, ${lng}`);
  } else {
    const results = await geocodeAddress(address);
    if (results.length === 0) {
      console.error(`Finner ikke adresse: "${address}"`);
      process.exit(1);
    }
    const best = results[0];
    if (best.relevance < 0.5) {
      console.error(`Geocode-relevance for lav (${best.relevance}) — sjekk adresse`);
      process.exit(1);
    }
    lat = best.lat;
    lng = best.lng;
    placeName = best.placeName;
    city = best.city;
    log(`Plassering: ${placeName}`);
    log(`Koordinater: ${lat}, ${lng}`);
    log(`Relevance: ${best.relevance}`);
    log(`Kart:       https://www.google.com/maps?q=${lat},${lng}`);

    // Interaktiv bekreftelse
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const svar = await new Promise<string>((resolve) => {
      rl.question("\nEr koordinatene korrekte? [J/n]: ", resolve);
    });
    rl.close();

    if (svar.trim().toLowerCase() === "n" || svar.trim().toLowerCase() === "nei") {
      const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
      const nyeCoords = await new Promise<string>((resolve) => {
        rl2.question("Oppgi korrekte koordinater (lat,lng): ", resolve);
      });
      rl2.close();

      const [nyLat, nyLng] = nyeCoords.split(",").map((s) => parseFloat(s.trim()));
      if (isNaN(nyLat) || isNaN(nyLng)) {
        console.error("Ugyldig format — bruk f.eks. 63.4305,10.5312");
        process.exit(1);
      }
      lat = nyLat;
      lng = nyLng;
      log(`Bruker oppgitte koordinater: ${lat}, ${lng}`);
    }
  }

  // Kartverket kommune-oppslag
  const komInfo = await getKommunenummer(lat, lng);
  if (komInfo) {
    kommunenummer = komInfo.kommunenummer;
    log(`Kommune: ${komInfo.kommunenavn} (${kommunenummer})`);
  } else {
    warn("⚠️  Kartverket-oppslag feilet — NSR-skoler kan mangle");
  }

  if (dryRun) {
    log("\n── Dry-run: plan ──");
    log(`Prosjektnavn: ${name}`);
    log(`Kunde: ${customer}`);
    log(`Adresse: ${placeName}`);
    log(`Koordinater: ${lat}, ${lng}`);
    log(`Kommune: ${komInfo?.kommunenavn ?? "ukjent"} (${kommunenummer ?? "ukjent"})`);
    log(`Discovery radius: ${getDiscoveryRadius(city)} m`);
    log("\nIngen Supabase-writes (--dry-run)");
    process.exit(0);
  }

  // ── Steg 2: Opprett prosjekt ───────────────────────────────────────────
  section("Steg 2: Opprett prosjekt");

  const projectResult = await createReportProject({
    name,
    address: placeName,
    lat,
    lng,
    customerSlug: customer,
    city,
    kommunenavn: komInfo?.kommunenavn,
    updateCoords: allowUpdate,
  });

  for (const w of projectResult.warnings) log(w);

  if (projectResult.existed && !allowUpdate) {
    warn(
      `\nProsjekt ${projectResult.projectId} eksisterer allerede.`
    );
    warn("Bruk --update for å re-kjøre pipelinen mot eksisterende prosjekt.");
    warn(`URL: https://placy.app/eiendom/${projectResult.customerSlug}/${projectResult.slug}/rapport-board`);
    process.exit(0);
  }

  log(`Prosjekt-ID: ${projectResult.projectId}`);
  log(`Produkt-ID:  ${projectResult.productId}`);

  const radiusMeters = getDiscoveryRadius(city);
  log(`Discovery radius: ${radiusMeters} m`);

  // ── Steg 3: Offentlige POI-er (NSR, Barnehagefakta, Overpass) ──────────
  section("Steg 3: Offentlige POI-er");

  if (kommunenummer) {
    const pubResult = await importPublicPois({
      projectId: projectResult.projectId,
      lat,
      lng,
      radiusMeters,
      kommunenummer,
    });
    log(`NSR skoler: ${pubResult.counts.nsr}`);
    log(`Barnehagefakta: ${pubResult.counts.barnehagefakta}`);
    log(`Overpass idrett: ${pubResult.counts.overpass}`);
    for (const w of pubResult.warnings) warn(w);
  } else {
    warn("⚠️  Hopper over NSR/Barnehagefakta — kommunenummer ukjent");
  }

  // ── Steg 4: Google Places, foto ────────────────────────────────────────
  section("Steg 4: Google Places + foto");

  const enrichResult = await enrichReportPois({
    projectId: projectResult.projectId,
    lat,
    lng,
    radiusMeters,
  });
  log(`Google Places: ${enrichResult.google.total} POI-er (${enrichResult.google.new} nye, ${enrichResult.google.updated} oppdaterte)`);
  log(`Foto: ${enrichResult.photos.updated} oppdatert, ${enrichResult.photos.skipped} hoppet over`);
  for (const w of enrichResult.warnings) warn(w);

  // ── Steg 5: Hydrering ──────────────────────────────────────────────────
  section("Steg 5: Hydrering");

  const hydrateResult = await hydrateReport({
    projectId: projectResult.projectId,
    productId: projectResult.productId,
    centerLat: lat,
    centerLng: lng,
  });
  log(`product_pois linket: ${hydrateResult.productPoisLinked}`);
  log(`Featured markert: ${hydrateResult.featuredMarked}`);
  log(`product_categories: ${hydrateResult.categoriesPopulated} kategorier`);
  for (const w of hydrateResult.warnings) warn(w);

  // ── Steg 6: Revalidering ───────────────────────────────────────────────
  section("Steg 6: Revalidering");
  await revalidateProject(projectResult.customerSlug, projectResult.slug);

  // ── Steg 7: Akseptansesjekk ───────────────────────────────────────────
  section("Steg 7: Akseptansesjekk");
  const passed = await acceptanceCheck(
    projectResult.productId,
    projectResult.customerSlug,
    projectResult.slug
  );

  if (!passed) {
    warn("\n⚠️  En eller flere akseptansesjekker feilet — se advarslene over");
    process.exit(1);
  }

  log("\n✓ Provisjonering fullført!");
}

main().catch((err) => {
  console.error("\nFeil:", err instanceof Error ? err.message : err);
  process.exit(1);
});
