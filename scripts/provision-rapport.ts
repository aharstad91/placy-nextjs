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
import { DEFAULT_CUSTOMER } from "@/lib/pipeline/create-report-project";
import {
  getDiscoveryRadius,
  type ReportProfile,
} from "@/lib/pipeline/report-defaults";
import {
  ReportTierSchema,
  type ReportTier,
} from "@/lib/validation/report-tier-schema";
import { provisionReportBoard } from "@/lib/pipeline/provision";

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

// ── Hoved-pipeline (tynn CLI-wrapper rundt lib/pipeline/provision-kjernen) ──

async function main() {
  const { name, address, customer, dryRun, allowUpdate, has3dAddon, confirmCoords, profile, reportTier: tierFlag } =
    parseArgs();

  // Sjekk env-variabler FØR noen writes
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !dryRun) {
    console.error("Feil: SUPABASE_SERVICE_ROLE_KEY mangler i .env.local");
    process.exit(1);
  }

  const reporter = { log, warn, section };

  // ── Koordinat-resolusjon (interaktiv del — holdes i CLI, IKKE i kjernen) ──
  // CLI geocoder KUN når den trenger preview: interaktiv TTY-bekreftelse eller
  // dry-run-plan. Ellers (non-TTY self-serve) geocoder kjernen selv. --confirm-
  // coords hopper over geocoding helt.
  let resolved: { lat: number; lng: number } | undefined = confirmCoords;
  let placeName = address;
  let city: string | undefined;

  if (!resolved && (dryRun || process.stdin.isTTY)) {
    section("Geocoding (adressebekreftelse)");
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
    placeName = best.placeName;
    city = best.city;
    resolved = { lat: best.lat, lng: best.lng };
    log(`Plassering: ${placeName} (${best.lat}, ${best.lng}, confidence ${best.confidence})`);
    log(`Kart: https://www.google.com/maps?q=${best.lat},${best.lng}`);

    // Interaktiv bekreftelse (kun TTY + ikke dry-run)
    if (!dryRun && process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const svar = await new Promise<string>((r) => rl.question("\nEr koordinatene korrekte? [J/n]: ", r));
      rl.close();
      if (svar.trim().toLowerCase() === "n" || svar.trim().toLowerCase() === "nei") {
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        const nye = await new Promise<string>((r) => rl2.question("Oppgi korrekte koordinater (lat,lng): ", r));
        rl2.close();
        const [nyLat, nyLng] = nye.split(",").map((s) => parseFloat(s.trim()));
        if (isNaN(nyLat) || isNaN(nyLng)) {
          console.error("Ugyldig format — bruk f.eks. 63.4305,10.5312");
          process.exit(1);
        }
        resolved = { lat: nyLat, lng: nyLng };
        log(`Bruker oppgitte koordinater: ${nyLat}, ${nyLng}`);
      }
    }
  }

  // Dry-run: geocode + kommune + plan, ingen writes (kjernen kalles aldri)
  if (dryRun) {
    const komInfo = resolved ? await getKommunenummer(resolved.lat, resolved.lng) : null;
    log("\n── Dry-run: plan ──");
    log(`Prosjektnavn: ${name}`);
    log(`Kunde: ${customer}`);
    log(`Profil: ${profile}`);
    log(`Nivå: ${tierFlag ?? "1 (default — bruk --tier for å overstyre)"}`);
    log(`Adresse: ${placeName}`);
    log(`Koordinater: ${resolved?.lat ?? "?"}, ${resolved?.lng ?? "?"}`);
    log(`Kommune: ${komInfo?.kommunenavn ?? "ukjent"} (${komInfo?.kommunenummer ?? "ukjent"})`);
    log(`Discovery radius: ${getDiscoveryRadius(city, profile)} m`);
    log("\nIngen Supabase-writes (--dry-run)");
    process.exit(0);
  }

  // Nivå-deklarasjon (R3b): flagg, ellers interaktiv prompt (non-TTY → 1)
  const reportTier = tierFlag ?? (await askReportTier());
  log(`Nivå: ${reportTier}`);

  // ── Kjør de 9 stegene via den TTY-løse kjernen ─────────────────────────
  const result = await provisionReportBoard(
    {
      name,
      address,
      customer,
      profile,
      reportTier,
      has3dAddon,
      allowUpdate,
      confirmCoords: resolved,
      placeName,
      city,
    },
    reporter
  );

  if (result.aborted) {
    warn(`\nProsjekt ${result.projectId} eksisterer allerede.`);
    warn("Bruk --update for å re-kjøre pipelinen mot eksisterende prosjekt.");
    warn(`URL: ${result.aborted.url}`);
    process.exit(0);
  }

  // Akseptansesjekk-funn
  const acceptance = result.acceptance!;
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
