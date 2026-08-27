/**
 * Rapport-board provisjon — REN, TTY-løs orkestrator-kjerne (PRD 3 / r03.1).
 *
 * Kjører de ratifiserte stegene SERIELT i load-bearing rekkefølge
 * (9 opprinnelige + reisetid-precompute, Andreas-godkjent 2026-07-06/bead 2nj,
 * + board-fakta 2026-08-22):
 *   1. Geocode (+ confidence-gate)   →  2. Opprett prosjekt
 *   3. Offentlige POI (NSR/bhg/idrett, skippes for næring)
 *   4. Google-discovery (+ Entur/Bysykkel; inkl. anker-søk utenfor sirkelen)
 *                                            →  5. Trust-scoring (to-fase)
 *   5b. Anker-oppløsning (kjøpesenter → parent_poi_id, fail-soft)
 *   6. Hydrering (product_pois + featured + categories)
 *   7. Reisetider (Mapbox Matrix → project_pois.travel_times, fail-soft)
 *   7b. Board-fakta (skolekrets fra NSR + transitt fra Entur, fail-soft)
 *   8. Nabolags-editorial (arv)   →  9. Revalidering   →  10. Akseptansesjekk
 *
 * Rekkefølgen er load-bearing: trust (5) MÅ kjøre etter discovery (3–4) og før
 * hydrering (6); anker-oppløsning (5b) etter at hele poolen finnes (3–4) og før
 * hydrering (6), som ellers ville sett 60 løse butikker der det ligger ett senter; reisetider (7) etter at POI-poolen er komplett (3–4); board-
 * fakta (7b) og editorial (8) etter at config-en finnes, og 7b før 8 fordi
 * begge gjør read-modify-write mot samme config-rad. Endres den, brytes enten
 * dedup, trust-filteret eller editorial-arven.
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
import { resolveProjectAnchors } from "@/lib/pipeline/resolve-anchors-step";
import { hydrateReport } from "@/lib/pipeline/hydrate-report";
import { computeProjectTravelTimes } from "@/lib/pipeline/travel-times";
import { runBoardFactsStep } from "@/lib/pipeline/board-facts-step";
import { inheritAreaEditorialViaRoute } from "@/lib/pipeline/inherit-area-editorial-via-route";
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
      `NSR skoler: ${pubResult.counts.nsr} · Barnehagefakta: ${pubResult.counts.barnehagefakta} · Overpass idrett: ${pubResult.counts.overpass} · Taxiholdeplasser: ${pubResult.counts.taxi}`
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
  if (enrichResult.anchors) {
    const { candidatesFound, imported, beyondCircle } = enrichResult.anchors;
    log(
      `Anker-søk: ${imported.length} av ${candidatesFound} kjøpesenter tatt med (${beyondCircle} utenfor sirkelen)`
    );
    for (const a of imported) {
      log(
        `   · ${a.name} — ${(a.distanceMeters / 1000).toFixed(1)} km${a.beyondCircle ? " (utenfor sirkelen)" : ""}`
      );
    }
  }
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

  // ── Steg 5b: Anker-oppløsning (kjøpesenter) ────────────────────────────
  // Etter trust (5) og FØR hydrering (6): hydreringen skal se det ferdige
  // hierarkiet, ikke 60 løse butikker der det ligger ett kjøpesenter.
  // Fail-soft: kaster aldri — et board uten anker er dagens board.
  section("Steg 5b: Anker-oppløsning");
  const anchorResult = await resolveProjectAnchors({
    projectId: projectResult.projectId,
  });
  for (const w of anchorResult.warnings) warn(w);
  if (anchorResult.anchors.length === 0) {
    log("Ingen kjøpesenter-anker i radiusen");
  } else {
    log(
      `Ankre: ${anchorResult.anchors.length} · medlemmer lenket: ${anchorResult.membersLinked}` +
        (anchorResult.membersUnlinked > 0
          ? ` · lenker ryddet: ${anchorResult.membersUnlinked}`
          : "")
    );
    for (const a of anchorResult.anchors) {
      log(
        `   · ${a.name}: ${a.memberCount} steder (containment ${a.via.containment} / adresse ${a.via.address} / nærhet ${a.via.proximity})`
      );
    }
  }
  // Kandidater som bar `shopping` uten å samle nok medlemmer. Ikke en feil —
  // det er realitets-gaten som gjør jobben sin — men den skal være synlig,
  // fordi et ekte senter som faller ut her ser nøyaktig likedan ut.
  for (const r of anchorResult.rejected) {
    log(`   · avvist: ${r.name} (${r.memberCount} medlemmer, under terskelen)`);
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

  // ── Steg 7: Reisetider (precompute, bead 2nj) ──────────────────────────
  // Fail-soft: kaster aldri — board degraderer til haversine-estimat.
  section("Steg 7: Reisetider");
  const travelResult = await computeProjectTravelTimes({
    projectId: projectResult.projectId,
    centerLat: lat,
    centerLng: lng,
  });
  log(`Reisetider beregnet: ${travelResult.computed} av ${travelResult.total} POI-er`);
  // Dekning per profil, ikke bare totalen: en profil som feilet helt ville
  // ellers vært usynlig her og bare ligget som en warning lenger ned.
  log(
    `Dekning: gå ${travelResult.coverage.walk} · sykkel ${travelResult.coverage.bike} · bil ${travelResult.coverage.car} (av ${travelResult.total})`
  );
  for (const w of travelResult.warnings) warn(w);

  // ── Steg 7b: Board-fakta (skolekrets + transitt) ───────────────────────
  // Kilden FAQ-svarene monteres fra ved render. Fail-soft: kaster aldri —
  // uten fakta utelates de FAQ-spørsmålene som mangler svar, resten består.
  // Står FØR editorial-arven fordi begge gjør read-modify-write mot samme
  // config-rad, og rekkefølgen da er én å resonnere om i stedet for to.
  section("Steg 7b: Board-fakta");
  const factsResult = await runBoardFactsStep({
    productId: projectResult.productId,
    lat,
    lng,
    kommunenavn: komInfo?.kommunenavn,
    city,
    kommunenummer,
  });
  for (const w of factsResult.warnings) warn(w);
  if (factsResult.facts && !factsResult.skipped) {
    const f = factsResult.facts;
    log(
      `Holdeplasser: ${f.stops.length} · sentrum: ${
        f.cityCentre ? `${f.cityCentre.patterns[0]?.minutes ?? "?"} min` : "ikke funnet"
      } · videregående: ${f.schools?.videregaaende.length ?? 0}`,
    );
    const krets = [f.schools?.barneskole?.navn, f.schools?.ungdomsskole?.navn].filter(Boolean);
    log(krets.length > 0 ? `Kretsskoler: ${krets.join(", ")}` : "Kretsskoler: ingen (utenfor dekning)");
  } else {
    log("Ingen board-fakta skrevet — FAQ-en står på kuratert innhold alene");
  }

  // ── Steg 8: Nabolags-editorial ─────────────────────────────────────────
  // Fail-soft (warnings) — UNNTATT skrive-/optimistisk-lås-feil som KASTER
  // (aldri delvis editorial i config; håndteres inni inheritAreaEditorial).
  section("Steg 8: Nabolags-editorial");
  const inheritResult = await inheritAreaEditorialViaRoute({
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
    if (inheritResult.themesWithFaq.length > 0) {
      log(`Kuratert FAQ arvet for: ${inheritResult.themesWithFaq.join(", ")}`);
    }
    if (inheritResult.globalFaqAnswers > 0) {
      log(`Global nabolags-FAQ: ${inheritResult.globalFaqAnswers} kuraterte svar`);
    }
    log(`Highlights beholdt: ${inheritResult.highlights.kept}`);
    if (inheritResult.highlights.dropped.length > 0) {
      log(`Highlights droppet: ${inheritResult.highlights.dropped.length}`);
      for (const d of inheritResult.highlights.dropped) {
        log(`   · [${d.themeId}] ${d.id} — ${d.reason}`);
      }
    }
  }

  // ── Steg 9: Revalidering ───────────────────────────────────────────────
  section("Steg 9: Revalidering");
  await revalidateProject(projectResult.customerSlug, projectResult.slug, reporter, {
    existed: projectResult.existed,
  });

  // ── Steg 10: Akseptansesjekk ───────────────────────────────────────────
  section("Steg 10: Akseptansesjekk");
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
 * Flatene et board kan ligge cachet på, i den rekkefølgen de forsøkes.
 *
 * ## Hvorfor en LISTE og ikke én URL (2026-08-24)
 *
 * Funksjonen pekte på `NEXT_PUBLIC_APP_URL ?? https://www.placy.no` og ingenting
 * annet. Ved lokal provisjonering betydde det at cache-bustet gikk til PROD,
 * der `ADMIN_ENABLED` er avslått (403 siden 2026-07-07) — mens dev-serveren som
 * faktisk serverte det oppdaterte boardet aldri fikk beskjed. Resultatet var en
 * re-provisjonering som meldte «✓ fullført» mens localhost fortsatte å servere
 * gamle POI-er til noen tilfeldigvis gjorde hard refresh (målt: 127 steder i
 * nettleseren mot 264 i databasen).
 *
 * Rekkefølgen er bevisst: eksplisitt override først, så app-URL-en fra env, så
 * prod, så den lokale dev-serveren. ALLE forsøkes — et board kan være cachet på
 * flere flater samtidig, og prod-treffet skal ikke hindre localhost-treffet.
 */
function revalidateTargets(): string[] {
  const explicit = (process.env.PLACY_REVALIDATE_URLS ?? "")
    .split(",")
    .map((u) => u.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const localPort = process.env.PORT ?? "3000";
  const candidates = [
    ...explicit,
    ...(appUrl ? [appUrl] : []),
    "https://www.placy.no",
    `http://localhost:${localPort}`,
  ];
  return [...new Set(candidates)];
}

/**
 * Revalider board-cachen via admin-API på hver kjente flate. Fail-soft: kaster
 * aldri, men SIER FRA når ingen flate tok imot — for et eksisterende board
 * rendrer ikke noe «ferskt ved første request», det fortsetter å servere den
 * cachede versjonen til noen tvinger den ut.
 */
export async function revalidateProject(
  customer: string,
  slug: string,
  reporter: ProvisionReporter = NOOP_REPORTER,
  options: { existed?: boolean } = {}
): Promise<{ revalidated: string[] }> {
  const tag = `product:${customer}_${slug}`;
  const path = `/eiendom/${customer}/${slug}/rapport-board`;
  const revalidated: string[] = [];

  for (const base of revalidateTargets()) {
    try {
      const res = await fetch(`${base}/api/admin/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag, path }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        revalidated.push(base);
        reporter.log(`✓ Revalidert på ${base}: ${tag} + ${path}`);
      } else {
        reporter.log(`· ${base}: ${res.status} (hoppet over)`);
      }
    } catch {
      reporter.log(`· ${base}: ikke tilgjengelig (hoppet over)`);
    }
  }

  if (revalidated.length === 0) {
    reporter.warn(
      options.existed
        ? `⚠️  Ingen flate tok imot revalidering (tag: ${tag}). Boardet FINNES fra før, så den cachede versjonen serveres videre — hard refresh (Cmd+Shift+R) eller restart dev-serveren for å se endringene.`
        : `ℹ️  Ingen flate tok imot revalidering — nytt prosjekt rendrer ferskt ved første request (tag: ${tag})`
    );
  }

  return { revalidated };
}
