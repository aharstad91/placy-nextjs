/**
 * Rapport-board provisjon — REN, TTY-løs orkestrator-kjerne (PRD 3 / r03.1).
 *
 * Kjører de 9 ratifiserte stegene SERIELT i load-bearing rekkefølge:
 *   1. Geocode (+ confidence-gate)   →  2. Opprett prosjekt
 *   3. Offentlige POI (NSR/bhg/idrett, skippes for næring)
 *   4. Google-discovery (+ Entur/Bysykkel)   →  5. Trust-scoring (to-fase)
 *   6. Hydrering (product_pois + featured + categories)
 *   7. Nabolags-editorial (arv)   →  8. Revalidering   →  9. Akseptansesjekk
 *
 * Rekkefølgen er load-bearing: trust (5) MÅ kjøre etter discovery (3–4) og før
 * hydrering (6); editorial (7) etter at config-en finnes. Endres den, brytes
 * enten dedup, trust-filteret eller editorial-arven.
 *
 * Kjernen er kallbar fra BÅDE CLI og server-action (self-serve, Unit 8) uten
 * TTY: interaktivitet (koordinat-bekreftelse, nivå-prompt) ligger i kalleren.
 * Uten `confirmCoords` geocoder kjernen ikke-interaktivt; logging går via en
 * injisert `reporter` (CLI = console, self-serve = no-op/innsamler).
 *
 * Fail-soft/throw-kontrakt per steg: discovery/trust/editorial-WARNINGS er
 * fail-soft (samles, aborterer ikke), MEN editorial-skrive-/optimistisk-lås-feil
 * KASTER (aldri delvis editorial), og geocode-miss/lav-confidence KASTER.
 */

import {
  geocodeAddress,
  getKommunenummer,
  meetsGeocodeConfidence,
} from "@/lib/pipeline/geocode";
import { createReportProject } from "@/lib/pipeline/create-report-project";
import { importPublicPois } from "@/lib/pipeline/import-public-pois";
import {
  enrichReportPois,
  NAERING_GOOGLE_CATEGORIES,
} from "@/lib/pipeline/enrich-report-pois";
import { validateReportTrust } from "@/lib/pipeline/validate-report-trust";
import { hydrateReport } from "@/lib/pipeline/hydrate-report";
import { inheritAreaEditorial } from "@/lib/pipeline/inherit-area-editorial";
import { getDiscoveryRadius, type ReportProfile } from "@/lib/pipeline/report-defaults";
import {
  runAcceptanceCheck,
  type AcceptanceResult,
} from "@/lib/pipeline/provision-acceptance";
import type { ReportTier } from "@/lib/validation/report-tier-schema";

/** I/O-injeksjon: CLI sender console-basert reporter, self-serve no-op/innsamler. */
export interface ProvisionReporter {
  log(msg: string): void;
  warn(msg: string): void;
  section(title: string): void;
}

const NOOP_REPORTER: ProvisionReporter = {
  log() {},
  warn() {},
  section() {},
};

export interface ProvisionInput {
  name: string;
  address: string;
  customer: string;
  profile: ReportProfile;
  /** Deklarert leveransenivå. Utelatt → nivå 1-default (feltet utelates i config). */
  reportTier?: ReportTier;
  has3dAddon: boolean;
  /** Tillat re-kjøring mot eksisterende prosjekt (oppdaterer koordinater). */
  allowUpdate: boolean;
  /** Forhåndsbekreftede koordinater (CLI interaktiv / --confirm-coords).
   *  Utelatt → kjernen geocoder ikke-interaktivt (self-serve-stien). */
  confirmCoords?: { lat: number; lng: number };
  /** placeName når confirmCoords er gitt (ellers settes den fra geocode). */
  placeName?: string;
  /** By for radius-kalibrering (CLI kan ha fra geocode; ellers fra geocode her). */
  city?: string;
}

export interface ProvisionResult {
  projectId: string;
  productId: string;
  customerSlug: string;
  slug: string;
  existed: boolean;
  /** Satt når existed && !allowUpdate — kjernen stoppet FØR discovery/writes. */
  aborted?: { reason: "exists"; url: string };
  /** Akseptansesjekk-funn (kun når ikke aborted). ok=false ⇒ non-zero exit. */
  acceptance?: AcceptanceResult;
}

export async function provisionReportBoard(
  input: ProvisionInput,
  reporter: ProvisionReporter = NOOP_REPORTER
): Promise<ProvisionResult> {
  const { log, warn, section } = reporter;
  const { name, address, customer, profile, reportTier, has3dAddon, allowUpdate } = input;

  // ── Steg 1: Geocode (+ kommune) ────────────────────────────────────────
  section("Steg 1: Geocoding");
  let lat: number;
  let lng: number;
  let placeName: string;
  let city = input.city;

  if (input.confirmCoords) {
    lat = input.confirmCoords.lat;
    lng = input.confirmCoords.lng;
    placeName = input.placeName ?? address;
    log(`Bruker bekreftet posisjon: ${lat}, ${lng}`);
  } else {
    const results = await geocodeAddress(address);
    if (results.length === 0) {
      throw new Error(`Finner ikke adresse: "${address}"`);
    }
    const best = results[0];
    if (!meetsGeocodeConfidence(best)) {
      throw new Error(`Geocode-confidence for lav (${best.confidence}) — sjekk adresse`);
    }
    lat = best.lat;
    lng = best.lng;
    placeName = best.placeName;
    city = best.city;
    log(`Plassering: ${placeName} (${lat}, ${lng}, confidence ${best.confidence})`);
  }

  const komInfo = await getKommunenummer(lat, lng);
  const kommunenummer = komInfo?.kommunenummer;
  if (komInfo) {
    log(`Kommune: ${komInfo.kommunenavn} (${kommunenummer})`);
  } else {
    warn("⚠️  Kartverket-oppslag feilet — NSR-skoler kan mangle");
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
    profile,
    reportTier,
    has3dAddon,
  });
  for (const w of projectResult.warnings) log(w);

  if (projectResult.existed && !allowUpdate) {
    const url = `https://www.placy.no/eiendom/${projectResult.customerSlug}/${projectResult.slug}/rapport-board`;
    return {
      projectId: projectResult.projectId,
      productId: projectResult.productId,
      customerSlug: projectResult.customerSlug,
      slug: projectResult.slug,
      existed: true,
      aborted: { reason: "exists", url },
    };
  }

  log(`Prosjekt-ID: ${projectResult.projectId} · Produkt-ID: ${projectResult.productId}`);
  const radiusMeters = getDiscoveryRadius(city, profile);
  log(`Discovery radius: ${radiusMeters} m`);

  // ── Steg 3: Offentlige POI-er ──────────────────────────────────────────
  section("Steg 3: Offentlige POI-er");
  if (profile === "naering") {
    log("Hopper over skoler/barnehager/idrett (nærings-profil — ikke relevant for kontorbygg)");
  } else if (kommunenummer) {
    const pubResult = await importPublicPois({
      projectId: projectResult.projectId,
      lat,
      lng,
      radiusMeters,
      kommunenummer,
    });
    log(
      `NSR skoler: ${pubResult.counts.nsr} · Barnehagefakta: ${pubResult.counts.barnehagefakta} · Overpass idrett: ${pubResult.counts.overpass}`
    );
    for (const w of pubResult.warnings) warn(w);
  } else {
    warn("⚠️  Hopper over NSR/Barnehagefakta — kommunenummer ukjent");
  }

  // ── Steg 4: Google Places (foto DEFERRED → PRD 4 Unit 4) ──────────────
  section("Steg 4: Google Places");
  const enrichResult = await enrichReportPois({
    projectId: projectResult.projectId,
    lat,
    lng,
    radiusMeters,
    categories: profile === "naering" ? NAERING_GOOGLE_CATEGORIES : undefined,
  });
  log(
    `Google Places: ${enrichResult.google.total} POI-er (${enrichResult.google.new} nye, ${enrichResult.google.updated} oppdaterte)`
  );
  for (const w of enrichResult.warnings) warn(w);

  // ── Steg 5: Trust-validering (to-fase) ─────────────────────────────────
  section("Steg 5: Trust-validering");
  const trustResult = await validateReportTrust({ projectId: projectResult.projectId });
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
  // Fail-soft (warnings) — UNNTATT skrive-/optimistisk-lås-feil som KASTER
  // (aldri delvis editorial i config; håndteres inni inheritAreaEditorial).
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
      log(`Highlights droppet: ${inheritResult.highlights.dropped.length}`);
      for (const d of inheritResult.highlights.dropped) {
        log(`   · [${d.themeId}] ${d.id} — ${d.reason}`);
      }
    }
  }

  // ── Steg 8: Revalidering ───────────────────────────────────────────────
  section("Steg 8: Revalidering");
  await revalidateProject(projectResult.customerSlug, projectResult.slug, reporter);

  // ── Steg 9: Akseptansesjekk ────────────────────────────────────────────
  section("Steg 9: Akseptansesjekk");
  const acceptance = await runAcceptanceCheck({
    productId: projectResult.productId,
    customer: projectResult.customerSlug,
    slug: projectResult.slug,
  });

  return {
    projectId: projectResult.projectId,
    productId: projectResult.productId,
    customerSlug: projectResult.customerSlug,
    slug: projectResult.slug,
    existed: projectResult.existed,
    acceptance,
  };
}

/**
 * Revalider board-cachen via admin-API (best-effort; nytt prosjekt rendrer
 * ferskt ved første request uansett). Fail-soft.
 */
export async function revalidateProject(
  customer: string,
  slug: string,
  reporter: ProvisionReporter = NOOP_REPORTER
): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return;

  const tag = `product:${customer}_${slug}`;
  const path = `/eiendom/${customer}/${slug}/rapport-board`;
  const prodUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.placy.no";
  try {
    const res = await fetch(`${prodUrl}/api/admin/revalidate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag, path }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      reporter.log(`✓ Revalidert: ${tag} + ${path}`);
      return;
    }
  } catch {
    // Faller gjennom til advarsel
  }
  reporter.warn(
    `ℹ️  Revalidering ikke tilgjengelig — nytt prosjekt rendrer ferskt ved første request (tag: ${tag})`
  );
}
