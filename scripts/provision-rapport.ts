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
 *   --tier 1|2      Deklarert leveransenivå (hopp over interaktiv prompt).
 *                   1=Basic, 2=+Editorial. Uten flagg spørres det
 *                   interaktivt; non-TTY defaulter til 1.
 */

// MÅ stå først: tsx hoister statiske imports, så env må lastes via en
// side-effect-modul FØR lib/supabase/client.ts evalueres — ellers blir den
// modul-nivå anon-klienten (som queries.ts/editorial-arven bygger på)
// permanent null. Se scripts/load-env.ts.
import "./load-env";
import * as readline from "readline";

import {
  geocodeAddress,
  getKommunenummer,
  meetsGeocodeConfidence,
} from "@/lib/pipeline/geocode";
import {
  createReportProject,
  DEFAULT_CUSTOMER,
} from "@/lib/pipeline/create-report-project";
import { importPublicPois } from "@/lib/pipeline/import-public-pois";
import {
  enrichReportPois,
  NAERING_GOOGLE_CATEGORIES,
} from "@/lib/pipeline/enrich-report-pois";
import { validateReportTrust } from "@/lib/pipeline/validate-report-trust";
import { hydrateReport } from "@/lib/pipeline/hydrate-report";
import { inheritAreaEditorial } from "@/lib/pipeline/inherit-area-editorial";
import {
  getDiscoveryRadius,
  type ReportProfile,
} from "@/lib/pipeline/report-defaults";
import {
  ReportTierSchema,
  type ReportTier,
} from "@/lib/validation/report-tier-schema";
import { runAcceptanceCheck } from "@/lib/pipeline/provision-acceptance";

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
  const has3dAddon = has("--addon-3d");
  const confirmCoordsStr = get("--confirm-coords");
  const profileStr = get("--profile") ?? "bolig";

  if (!name || !address) {
    console.error("Bruk: --name <prosjektnavn> --address <adresse>");
    process.exit(1);
  }

  if (profileStr !== "bolig" && profileStr !== "naering") {
    console.error('--profile må være "bolig" eller "naering"');
    process.exit(1);
  }
  const profile = profileStr as ReportProfile;

  let confirmCoords: { lat: number; lng: number } | undefined;
  if (confirmCoordsStr) {
    const [lat, lng] = confirmCoordsStr.split(",").map(Number);
    if (isNaN(lat) || isNaN(lng)) {
      console.error("--confirm-coords må være lat,lng (f.eks. 63.41,10.77)");
      process.exit(1);
    }
    confirmCoords = { lat, lng };
  }

  let reportTier: ReportTier | undefined;
  const tierStr = get("--tier");
  if (tierStr !== undefined) {
    const parsed = ReportTierSchema.safeParse(Number(tierStr));
    if (!parsed.success) {
      console.error("--tier må være 1 eller 2");
      process.exit(1);
    }
    reportTier = parsed.data;
  }

  return { name, address, customer, dryRun, allowUpdate, has3dAddon, confirmCoords, profile, reportTier };
}

// ── Nivå-deklarasjon ──────────────────────────────────────────────────────

/** Interaktiv nivå-prompt (R3b) — speiler koordinat-bekreftelsens mønster.
 *  Non-TTY (CI/pipe) defaulter til 1 uten å henge på stdin. */
async function askReportTier(): Promise<ReportTier> {
  if (!process.stdin.isTTY) {
    log("Nivå: 1 (Basic) — non-interaktiv kjøring, bruk --tier for å overstyre");
    return 1;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const svar = await new Promise<string>((resolve) => {
    rl.question(
      "\nHvilket nivå skal boardet leveres på? 1=Basic, 2=+Editorial [1]: ",
      resolve
    );
  });
  rl.close();
  const trimmed = svar.trim();
  if (trimmed === "") return 1;
  const parsed = ReportTierSchema.safeParse(Number(trimmed));
  if (!parsed.success) {
    console.error("Ugyldig nivå — må være 1 eller 2");
    process.exit(1);
  }
  return parsed.data;
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
  const prodUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.placy.no";
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

// ── Hoved-pipeline ────────────────────────────────────────────────────────

async function main() {
  const { name, address, customer, dryRun, allowUpdate, has3dAddon, confirmCoords, profile, reportTier: tierFlag } =
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
    if (!meetsGeocodeConfidence(best)) {
      console.error(`Geocode-confidence for lav (${best.confidence}) — sjekk adresse`);
      process.exit(1);
    }
    lat = best.lat;
    lng = best.lng;
    placeName = best.placeName;
    city = best.city;
    log(`Plassering: ${placeName}`);
    log(`Koordinater: ${lat}, ${lng}`);
    log(`Confidence: ${best.confidence}`);
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
    log(`Profil: ${profile}`);
    log(`Nivå: ${tierFlag ?? "1 (default — bruk --tier for å overstyre)"}`);
    log(`Adresse: ${placeName}`);
    log(`Koordinater: ${lat}, ${lng}`);
    log(`Kommune: ${komInfo?.kommunenavn ?? "ukjent"} (${kommunenummer ?? "ukjent"})`);
    log(`Discovery radius: ${getDiscoveryRadius(city, profile)} m`);
    log("\nIngen Supabase-writes (--dry-run)");
    process.exit(0);
  }

  // Nivå-deklarasjon (R3b): flagg, ellers interaktiv prompt
  const reportTier = tierFlag ?? (await askReportTier());
  log(`Nivå: ${reportTier}`);

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
    profile,
    reportTier,
    has3dAddon,
  });

  for (const w of projectResult.warnings) log(w);

  if (projectResult.existed && !allowUpdate) {
    warn(
      `\nProsjekt ${projectResult.projectId} eksisterer allerede.`
    );
    warn("Bruk --update for å re-kjøre pipelinen mot eksisterende prosjekt.");
    warn(`URL: https://www.placy.no/eiendom/${projectResult.customerSlug}/${projectResult.slug}/rapport-board`);
    process.exit(0);
  }

  log(`Prosjekt-ID: ${projectResult.projectId}`);
  log(`Produkt-ID:  ${projectResult.productId}`);

  const radiusMeters = getDiscoveryRadius(city, profile);
  log(`Discovery radius: ${radiusMeters} m`);

  // ── Steg 3: Offentlige POI-er (NSR, Barnehagefakta, Overpass) ──────────
  section("Steg 3: Offentlige POI-er");

  if (profile === "naering") {
    log(
      "Hopper over skoler/barnehager/idrett (nærings-profil — ikke relevant for kontorbygg)",
    );
  } else if (kommunenummer) {
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

  // ── Steg 4: Google Places ──────────────────────────────────────────────
  // Foto-fasen er DEFERRED → PRD 4 Unit 4 (egen foto-task). POI-er rendres med
  // kategorifarge inntil foto-tasken lander og enrichReportPois får photos-ledd.
  section("Steg 4: Google Places");

  const enrichResult = await enrichReportPois({
    projectId: projectResult.projectId,
    lat,
    lng,
    radiusMeters,
    categories: profile === "naering" ? NAERING_GOOGLE_CATEGORIES : undefined,
  });
  log(`Google Places: ${enrichResult.google.total} POI-er (${enrichResult.google.new} nye, ${enrichResult.google.updated} oppdaterte)`);
  for (const w of enrichResult.warnings) warn(w);

  // ── Steg 5: Trust-validering ───────────────────────────────────────────
  section("Steg 5: Trust-validering");

  const trustResult = await validateReportTrust({
    projectId: projectResult.projectId,
  });
  log(`Trust-scoret: ${trustResult.scored} Google-POI-er`);
  log(
    `Hoppet over: ${trustResult.skipped} (manual_override/allerede scoret), ${trustResult.skippedPublic} offentlige kilde-POI-er (beholder null = vis)`
  );
  for (const w of trustResult.warnings) warn(w);
  if (trustResult.stillNull.length > 0) {
    warn(
      `\n⚠️  ${trustResult.stillNull.length} Google-POI-er mangler fortsatt trust-score (vises ufiltrert på boardet):`
    );
    for (const poiName of trustResult.stillNull) warn(`   · ${poiName}`);
    warn(
      "   Listen MÅ QA-klareres (hver POI manuelt verifisert levende) før boardet telles som evaluert."
    );
  }

  // ── Steg 6: Hydrering ──────────────────────────────────────────────────
  section("Steg 6: Hydrering");

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

  // ── Steg 7: Nabolags-editorial ─────────────────────────────────────────
  // Fail-soft (warnings) — UNNTATT skrive-/optimistisk-lås-feil som kaster
  // og avbryter provisjoneringen (aldri delvis editorial i config).
  section("Steg 7: Nabolags-editorial");

  const inheritResult = await inheritAreaEditorial({
    projectId: projectResult.projectId,
    customerSlug: projectResult.customerSlug,
    projectSlug: projectResult.slug,
    lat,
    lng,
  });
  for (const w of inheritResult.warnings) warn(w);
  if (inheritResult.skipped) {
    log("nivå 1 — ingen kuratert område for punktet (ingen editorial arvet)");
  } else {
    log(`Område: ${inheritResult.areaName}`);
    log(
      inheritResult.themesInherited.length > 0
        ? `Temaer arvet: ${inheritResult.themesInherited.join(", ")} (${inheritResult.themesInherited.length})`
        : "Temaer arvet: ingen (se advarsler over)"
    );
    log(`Highlights beholdt: ${inheritResult.highlights.kept}`);
    if (inheritResult.highlights.dropped.length > 0) {
      // R9-loggen er et suksesskriterium (Unit 7-evalueringen leser denne)
      log(`Highlights droppet: ${inheritResult.highlights.dropped.length}`);
      for (const d of inheritResult.highlights.dropped) {
        log(`   · [${d.themeId}] ${d.id} — ${d.reason}`);
      }
    }
  }

  // ── Steg 8: Revalidering ───────────────────────────────────────────────
  section("Steg 8: Revalidering");
  await revalidateProject(projectResult.customerSlug, projectResult.slug);

  // ── Steg 9: Akseptansesjekk ───────────────────────────────────────────
  section("Steg 9: Akseptansesjekk");
  const acceptance = await runAcceptanceCheck({
    productId: projectResult.productId,
    customer: projectResult.customerSlug,
    slug: projectResult.slug,
  });
  for (const f of acceptance.findings) {
    const line = f.level === "pass" ? `✓ ${f.message}` : `${f.level === "error" ? "✗" : "⚠️ "} ${f.message}`;
    if (f.level === "pass") log(line);
    else warn(line);
    for (const d of f.details ?? []) warn(`   · ${d}`);
  }
  section("Leveranse");
  log(`Lokal: ${acceptance.urls.local}`);
  log(`Prod:  ${acceptance.urls.prod}`);

  if (!acceptance.ok) {
    warn("\n⚠️  En eller flere akseptansesjekker feilet — se advarslene over");
    process.exit(1);
  }

  log("\n✓ Provisjonering fullført!");
}

main().catch((err) => {
  console.error("\nFeil:", err instanceof Error ? err.message : err);
  process.exit(1);
});
