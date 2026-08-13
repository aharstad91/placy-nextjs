/**
 * Delte byggesteiner for Places-fakta-backfillene.
 *
 * Brukes av `refresh-opening-hours.ts`, `backfill-gallery-images.ts` og
 * `refresh-photo-urls.ts`.
 *
 * HVORFOR EN EGEN MODUL: CLI-ene kaller `process.exit()` på top-level, så de kan
 * ikke importeres i test (samme grunn som `audio-tour-build.contract.test.ts`
 * dokumenterer). All logikk som SKAL testes med faktisk kjøring — URL-bygging,
 * kvote-abort, patch-shape, dry-run-regnskap, API-kall-telling — bor derfor her,
 * og scriptene er tynne skall rundt den.
 *
 * TO-FASE-KONTRAKTEN: alle collect-funksjonene henter ALT fra Google før noe
 * skrives til DB. En kvotefeil (403/429) aborterer da hele kjøringen med null
 * writes, i stedet for å etterlate halve boardet med fakta i en tilstand som
 * ser komplett ut. Se `lib/google-places/errors.ts`.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  fetchPlaceDetails,
  OPENING_HOURS_FIELDS,
  type PlaceDetails,
} from "../lib/google-places/fetch-place-details";
import { fetchPhotoNames, resolvePhotoUri } from "../lib/google-places/photo-api";
import { isQuotaError } from "../lib/google-places/errors";
import { isValidProjectIdShape } from "../lib/pipeline/project-id";

// ─── Konstanter ─────────────────────────────────────────────────────────────

export const BATCH_SIZE = 5;
export const BATCH_DELAY_MS = 300;

/** Antall bilder per POI i `gallery_images`. */
export const GALLERY_SIZE = 3;

/**
 * Språk for `weekday_text`.
 *
 * VALGT: engelsk — og det er et bevisst valg, ikke en forglemmelse.
 *
 * Alle konsumenter av `openingHoursJson.weekday_text` matcher på ENGELSK:
 *   - `lib/hooks/useOpeningHours.ts` → `computeIsOpen()` matcher dagsnavn
 *     ("Monday"…) OG parser klokkeslett med AM/PM-regex
 *   - `components/variants/report/MapPopupCard.tsx:69` → samme dagsnavn-matching
 *     for `todayHours`
 *
 * Norsk output ville brutt begge STILLE: `todayHours` blir null og åpent/stengt-
 * merket forsvinner, uten noen feilmelding. Norsk ville dessuten gitt 24-timers
 * klokke ("08:00–17:00"), som AM/PM-regexen i `computeIsOpen` ikke matcher — så
 * det er ikke nok å oversette dagsnavnene. Konvensjonen er allerede ratifisert
 * i kodebasen: `lib/gigs/midtbyen/build-project.test.ts:46` asserter eksplisitt
 * på engelske dagsnavn med samme begrunnelse.
 *
 * Google velger språk selv når `languageCode` utelates (Accept-Language/IP), så
 * den MÅ settes eksplisitt for at output skal være deterministisk.
 */
export const OPENING_HOURS_LANGUAGE = "en";

// ─── Scope ──────────────────────────────────────────────────────────────────

export type BackfillScope =
  | { kind: "project"; projectId: string }
  | { kind: "area"; areaSlug: string }
  | { kind: "all" };

export interface BackfillMode {
  apply: boolean;
  force: boolean;
  limit?: number;
}

/**
 * Parser scope fra argv. Ett scope er PÅKREVD.
 *
 * HVORFOR IKKE «alle POI-er» SOM DEFAULT: `v2.pois` har 5 386 rader. Et
 * utilsiktet kall uten scope ville truffet alle, på Enterprise-SKU. Tidligere
 * lekkasje var 339 kr/halvmåned (Photo-SKU 71 %), så eksplisitt scope er
 * kostnadsvern og ikke bekvemmelighet. `--all` finnes, men må skrives.
 */
export function parseScope(argv: string[]): { scope: BackfillScope } | { error: string } {
  const projectIdx = argv.indexOf("--project");
  const areaIdx = argv.indexOf("--area");
  const all = argv.includes("--all");

  const chosen = [projectIdx !== -1, areaIdx !== -1, all].filter(Boolean).length;
  if (chosen === 0) {
    return {
      error:
        "Mangler scope. Bruk --project <project_id>, --area <slug> eller --all.\n" +
        "  --all treffer ALLE POI-er i v2.pois og koster Google-kvote — skriv den bevisst.",
    };
  }
  if (chosen > 1) {
    return { error: "Oppgi kun ETT scope (--project, --area eller --all)." };
  }

  if (projectIdx !== -1) {
    const projectId = argv[projectIdx + 1];
    if (!projectId || projectId.startsWith("--")) {
      return { error: "--project krever en project_id, f.eks. placy-demo_sundsoya" };
    }
    // Samme form-vakt som scripts/gemini-grounding.ts: en feilskrevet ID ville
    // ellers stille gitt 0 POI-er og se ut som «ingenting å gjøre».
    if (!isValidProjectIdShape(projectId)) {
      return {
        error:
          `Ugyldig project_id: "${projectId}". Forventet {customer}_{slug}, ` +
          `f.eks. "placy-demo_sundsoya".`,
      };
    }
    return { scope: { kind: "project", projectId } };
  }

  if (areaIdx !== -1) {
    const areaSlug = argv[areaIdx + 1];
    if (!areaSlug || areaSlug.startsWith("--")) {
      return { error: "--area krever en slug, f.eks. ranheim" };
    }
    return { scope: { kind: "area", areaSlug } };
  }

  return { scope: { kind: "all" } };
}

/** Parser `--apply`, `--force` og `--limit N`. Dry-run er default. */
export function parseMode(argv: string[]): BackfillMode | { error: string } {
  const limitIdx = argv.indexOf("--limit");
  let limit: number | undefined;
  if (limitIdx !== -1) {
    const parsed = Number.parseInt(argv[limitIdx + 1] ?? "", 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      return { error: "--limit krever et positivt heltall" };
    }
    limit = parsed;
  }
  return { apply: argv.includes("--apply"), force: argv.includes("--force"), limit };
}

export function describeScope(scope: BackfillScope): string {
  switch (scope.kind) {
    case "project":
      return `prosjekt ${scope.projectId}`;
    case "area":
      return `strøk ${scope.areaSlug}`;
    case "all":
      return "ALLE POI-er";
  }
}

// ─── Supabase ───────────────────────────────────────────────────────────────

export interface SupabaseCtx {
  url: string;
  key: string;
  /** Injiserbar for test. Default er global fetch. */
  fetchImpl?: typeof fetch;
}

function sbFetch(ctx: SupabaseCtx): typeof fetch {
  return ctx.fetchImpl ?? fetch;
}

function readHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "Accept-Profile": "v2",
  };
}

function writeHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=minimal",
    // v2 er ENESTE skjema (public droppet ved cutover 2026-07-06).
    "Content-Profile": "v2",
  };
}

/** Minimum en POI-rad må ha for at backfill-logikken skal virke. */
export interface BackfillPoiRow {
  id: string;
  name: string;
  google_place_id: string | null;
}

/**
 * Henter POI-radene i scope.
 *
 * HVORFOR `product_pois` OG IKKE `area_id` FOR PROSJEKT-SCOPE (verifisert
 * 2026-08-12): alle 78 Sundsøya-POI-er har `area_id = null`. `--area` kan altså
 * ikke nå dem i det hele tatt — join-tabellen er den eneste veien til et boards
 * POI-sett.
 */
export async function fetchScopedPois<T extends BackfillPoiRow>(
  ctx: SupabaseCtx,
  scope: BackfillScope,
  selectColumns: string,
): Promise<{ pois: T[]; note: string }> {
  const doFetch = sbFetch(ctx);
  const headers = readHeaders(ctx.key);

  if (scope.kind === "project") {
    const productsRes = await doFetch(
      `${ctx.url}/rest/v1/products?project_id=eq.${encodeURIComponent(scope.projectId)}&select=id,product_type`,
      { headers },
    );
    if (!productsRes.ok) {
      throw new Error(`Kunne ikke hente produkter: ${productsRes.status} ${await productsRes.text()}`);
    }
    const products = (await productsRes.json()) as { id: string; product_type: string }[];
    if (products.length === 0) {
      throw new Error(`Fant ingen produkter for project_id=${scope.projectId}`);
    }

    const productIds = products.map((p) => p.id);
    const inList = productIds.map((id) => `"${id}"`).join(",");
    const rowsRes = await doFetch(
      `${ctx.url}/rest/v1/product_pois?product_id=in.(${inList})&select=poi_id,pois(${selectColumns})`,
      { headers },
    );
    if (!rowsRes.ok) {
      throw new Error(`Kunne ikke hente product_pois: ${rowsRes.status} ${await rowsRes.text()}`);
    }
    const rows = (await rowsRes.json()) as { poi_id: string; pois: T | null }[];

    // Samme POI kan ligge på flere produkter i samme prosjekt — dedupliser, ellers
    // hentes og betales samme sted flere ganger.
    const byId = new Map<string, T>();
    for (const row of rows) {
      if (row.pois) byId.set(row.pois.id, row.pois);
    }
    const pois = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "nb"));
    const breakdown = products.map((p) => `${p.product_type}:${p.id.slice(0, 8)}`).join(", ");
    return { pois, note: `${products.length} produkt (${breakdown}), ${pois.length} unike POI-er` };
  }

  if (scope.kind === "area") {
    const areaRes = await doFetch(
      `${ctx.url}/rest/v1/areas?slug_no=eq.${encodeURIComponent(scope.areaSlug)}&select=id`,
      { headers },
    );
    if (!areaRes.ok) {
      throw new Error(`Kunne ikke hente strøk: ${areaRes.status} ${await areaRes.text()}`);
    }
    const areas = (await areaRes.json()) as { id: string }[];
    if (areas.length === 0) {
      throw new Error(`Fant ikke strøk med slug_no=${scope.areaSlug}`);
    }
    const pois = await fetchPoiPages<T>(ctx, `${selectColumns}`, `&area_id=eq.${areas[0].id}`);
    return { pois, note: `${pois.length} POI-er i strøket` };
  }

  const pois = await fetchPoiPages<T>(ctx, selectColumns, "");
  return { pois, note: `${pois.length} POI-er totalt i v2.pois` };
}

async function fetchPoiPages<T>(
  ctx: SupabaseCtx,
  selectColumns: string,
  extraFilter: string,
): Promise<T[]> {
  const doFetch = sbFetch(ctx);
  const headers = readHeaders(ctx.key);
  const pageSize = 1000;
  const out: T[] = [];
  let offset = 0;

  for (;;) {
    const res = await doFetch(
      `${ctx.url}/rest/v1/pois?select=${selectColumns}${extraFilter}&order=name&offset=${offset}&limit=${pageSize}`,
      { headers },
    );
    if (!res.ok) {
      throw new Error(`Kunne ikke hente POI-er: ${res.status} ${await res.text()}`);
    }
    const page = (await res.json()) as T[];
    out.push(...page);
    if (page.length < pageSize) return out;
    offset += pageSize;
  }
}

/**
 * PATCH av navngitte kolonner på én POI.
 *
 * Kun kolonnene i `data` berøres. jsonb-kolonner sendes som ferdig sammenslåtte
 * objekter fra kalleren (se `buildOpeningHoursPatch`) — ALDRI som naiv
 * overskriving av en kolonne kalleren ikke har lest først
 * (`docs/solutions/database-issues/jsonb-merge-vs-overwrite-seed-scripts-20260413.md`).
 */
export async function patchPoi(
  ctx: SupabaseCtx,
  poiId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const res = await sbFetch(ctx)(
    `${ctx.url}/rest/v1/pois?id=eq.${encodeURIComponent(poiId)}`,
    { method: "PATCH", headers: writeHeaders(ctx.key), body: JSON.stringify(data) },
  );
  if (!res.ok) {
    throw new Error(`DB-oppdatering feilet: ${res.status} ${await res.text()}`);
  }
}

/** Skriver backup av radene til `backups/` og returnerer stien. */
export function writeBackup(label: string, payload: unknown): string {
  const dir = path.resolve(".", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${label}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

// ─── Innsamlings-resultat ───────────────────────────────────────────────────

export interface CollectedFact {
  poiId: string;
  name: string;
  /** Kolonnene som skal PATCH-es. Aldri tom. */
  patch: Record<string, unknown>;
  /** Kort beskrivelse for logg, f.eks. "hours, phone" eller "3 bilder". */
  summary: string;
}

export interface CollectResult {
  facts: CollectedFact[];
  /** POI-er uten `google_place_id` — kan ikke hentes fra Google i det hele tatt. */
  skippedNoPlaceId: { id: string; name: string }[];
  /** Google svarte 404 — utdatert place_id. */
  notFound: { id: string; name: string }[];
  /** Google svarte, men hadde ingenting å lagre (park uten åpningstider o.l.). */
  noData: { id: string; name: string }[];
  /** Transiente feil per POI. Batchen fortsatte. */
  failed: { id: string; name: string; error: string }[];
  /** FAKTISK antall HTTP-kall mot Google. Kostnadskontroll (R12). */
  apiCalls: number;
}

function emptyResult(): CollectResult {
  return {
    facts: [],
    skippedNoPlaceId: [],
    notFound: [],
    noData: [],
    failed: [],
    apiCalls: 0,
  };
}

export class QuotaAbort extends Error {
  constructor(
    readonly status: number,
    readonly partial: CollectResult,
  ) {
    super(
      `Google Places svarte ${status} (kvote/nøkkel). Kjøringen er avbrutt FØR ` +
        `noe ble skrevet, så ingen POI-er står halvferdige. ` +
        `${status === 429 ? "Vent på rate-limit-vinduet" : "Sjekk at nøkkelen har Places API (New) aktivert"} og kjør på nytt.`,
    );
    this.name = "QuotaAbort";
  }
}

interface BatchOptions {
  batchSize?: number;
  delayMs?: number;
  limit?: number;
  onPoi?: (line: string) => void;
  /** Injiserbar for test — hopper over ekte venting. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Kjører `handle` batchvis med Promise.allSettled, og aborterer mellom batcher
 * hvis noe kastet kvotefeil.
 *
 * `allSettled` og ikke `all`: én kvotefeil skal ikke maskere resultatene fra de
 * andre POI-ene i samme batch, og in-flight-kall skal få gjøre seg ferdige.
 */
async function runBatched<T extends BackfillPoiRow>(
  pois: T[],
  result: CollectResult,
  handle: (poi: T, result: CollectResult) => Promise<void>,
  opts: BatchOptions,
): Promise<CollectResult> {
  const batchSize = opts.batchSize ?? BATCH_SIZE;
  const delayMs = opts.delayMs ?? BATCH_DELAY_MS;
  const sleep = opts.sleep ?? defaultSleep;
  const work = opts.limit ? pois.slice(0, opts.limit) : pois;

  for (let i = 0; i < work.length; i += batchSize) {
    const batch = work.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((poi) => handle(poi, result)));

    for (const outcome of settled) {
      if (outcome.status === "rejected" && isQuotaError(outcome.reason)) {
        throw new QuotaAbort(outcome.reason.status, result);
      }
    }
    // Ikke-kvote-rejects: `handle` fanger sine egne feil, så dette er uventet.
    for (const [idx, outcome] of settled.entries()) {
      if (outcome.status === "rejected") {
        result.failed.push({
          id: batch[idx].id,
          name: batch[idx].name,
          error: `uventet: ${(outcome.reason as Error)?.message ?? String(outcome.reason)}`,
        });
      }
    }

    if (i + batchSize < work.length && delayMs > 0) await sleep(delayMs);
  }

  return result;
}

// ─── Åpningstider + telefon ─────────────────────────────────────────────────

export interface OpeningHoursPoiRow extends BackfillPoiRow {
  /** Eksisterende verdi — leses for å kunne slå sammen i stedet for å overskrive. */
  opening_hours_json: { weekday_text?: string[] } | Record<string, unknown> | null;
}

/**
 * Bygger PATCH-payloaden for åpningstider + telefon.
 *
 * Ren funksjon — testbar uten API-kall.
 *
 * jsonb: `opening_hours_json` slås sammen med den EKSISTERENDE verdien i stedet
 * for å overskrives, slik at eventuelle andre nøkler i kolonnen overlever.
 * Uten åpningstider settes kolonnen IKKE i det hele tatt — vi lagrer aldri
 * `{}` eller `null` over reelle data (en park uten åpningstider skal ikke se ut
 * som «hentet, tomt»).
 */
export function buildOpeningHoursPatch(
  existing: OpeningHoursPoiRow["opening_hours_json"],
  details: PlaceDetails,
): { patch: Record<string, unknown>; summary: string } {
  const patch: Record<string, unknown> = {};
  const parts: string[] = [];

  const weekdayText = details.openingHours;
  if (weekdayText && weekdayText.length > 0) {
    const base = existing && typeof existing === "object" ? existing : {};
    patch.opening_hours_json = { ...base, weekday_text: weekdayText };
    patch.opening_hours_updated_at = new Date().toISOString();
    parts.push(`${weekdayText.length} dager`);
  }

  if (details.phone) {
    patch.google_phone = details.phone;
    parts.push("telefon");
  }

  return { patch, summary: parts.join(", ") };
}

export interface CollectOpeningHoursOptions extends BatchOptions {
  apiKey: string;
  /** Injiserbar for test. */
  fetchDetails?: typeof fetchPlaceDetails;
  /** Hopp over POI-er som allerede har åpningstider (default true). */
  skipExisting?: boolean;
}

/**
 * Fase 1: henter åpningstider + telefon for alle POI-er i settet. Skriver ingenting.
 */
export async function collectOpeningHours(
  pois: OpeningHoursPoiRow[],
  opts: CollectOpeningHoursOptions,
): Promise<CollectResult> {
  const fetchDetails = opts.fetchDetails ?? fetchPlaceDetails;
  const skipExisting = opts.skipExisting ?? true;

  return runBatched(pois, emptyResult(), async (poi, result) => {
    if (!poi.google_place_id) {
      result.skippedNoPlaceId.push({ id: poi.id, name: poi.name });
      opts.onPoi?.(`  SKIP ${poi.name} — ingen google_place_id`);
      return;
    }

    const existingHours = (poi.opening_hours_json as { weekday_text?: string[] } | null)
      ?.weekday_text;
    if (skipExisting && existingHours && existingHours.length > 0) {
      result.noData.push({ id: poi.id, name: poi.name });
      opts.onPoi?.(`  SKIP ${poi.name} — har allerede åpningstider (--force for å hente på nytt)`);
      return;
    }

    let details: PlaceDetails | null;
    try {
      result.apiCalls++;
      details = await fetchDetails(poi.google_place_id, opts.apiKey, OPENING_HOURS_FIELDS, {
        languageCode: OPENING_HOURS_LANGUAGE,
      });
    } catch (err) {
      // Kvotefeil bobler opp og aborterer hele kjøringen — ALDRI svelget her.
      if (isQuotaError(err)) throw err;
      result.failed.push({
        id: poi.id,
        name: poi.name,
        error: err instanceof Error ? err.message : String(err),
      });
      opts.onPoi?.(`  ERR  ${poi.name} — ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    if (!details) {
      result.notFound.push({ id: poi.id, name: poi.name });
      opts.onPoi?.(`  404  ${poi.name} — utdatert place_id`);
      return;
    }

    const { patch, summary } = buildOpeningHoursPatch(poi.opening_hours_json, details);
    if (Object.keys(patch).length === 0) {
      result.noData.push({ id: poi.id, name: poi.name });
      opts.onPoi?.(`  TOM  ${poi.name} — ingen åpningstider eller telefon hos Google`);
      return;
    }

    result.facts.push({ poiId: poi.id, name: poi.name, patch, summary });
    opts.onPoi?.(`  OK   ${poi.name} — ${summary}`);
  }, opts);
}

// ─── Bilder ─────────────────────────────────────────────────────────────────

export interface GalleryPoiRow extends BackfillPoiRow {
  gallery_images: string[] | null;
}

export interface CollectGalleryOptions extends BatchOptions {
  apiKey: string;
  /** Injiserbare for test. */
  fetchNames?: typeof fetchPhotoNames;
  resolveUri?: typeof resolvePhotoUri;
  gallerySize?: number;
  /** Hopp over POI-er som allerede har bilder (default true). */
  skipExisting?: boolean;
}

/**
 * Fase 1: henter bilde-URL-er for alle POI-er i settet. Skriver ingenting.
 *
 * `photo_resolved_at` stemples sammen med `gallery_images` fordi lh3-CDN-URL-ene
 * utløper. Uten stempelet finner `refresh-photo-urls.ts` dem aldri igjen, og
 * bildene blir brutte midt i en salgsperiode.
 */
export async function collectGalleryImages(
  pois: GalleryPoiRow[],
  opts: CollectGalleryOptions,
): Promise<CollectResult> {
  const fetchNames = opts.fetchNames ?? fetchPhotoNames;
  const resolveUri = opts.resolveUri ?? resolvePhotoUri;
  const gallerySize = opts.gallerySize ?? GALLERY_SIZE;
  const skipExisting = opts.skipExisting ?? true;

  return runBatched(pois, emptyResult(), async (poi, result) => {
    if (!poi.google_place_id) {
      result.skippedNoPlaceId.push({ id: poi.id, name: poi.name });
      opts.onPoi?.(`  SKIP ${poi.name} — ingen google_place_id`);
      return;
    }

    if (skipExisting && poi.gallery_images && poi.gallery_images.length > 0) {
      result.noData.push({ id: poi.id, name: poi.name });
      opts.onPoi?.(`  SKIP ${poi.name} — har allerede bilder (--force for å hente på nytt)`);
      return;
    }

    try {
      result.apiCalls++;
      const names = await fetchNames(poi.google_place_id, opts.apiKey);
      if (names.length === 0) {
        result.noData.push({ id: poi.id, name: poi.name });
        opts.onPoi?.(`  TOM  ${poi.name} — ingen bilder hos Google`);
        return;
      }

      const urls: string[] = [];
      for (let i = 0; i < Math.min(gallerySize, names.length); i++) {
        result.apiCalls++;
        const url = await resolveUri(names[i], opts.apiKey, i === 0 ? 800 : 400);
        if (url) urls.push(url);
      }

      if (urls.length === 0) {
        result.failed.push({ id: poi.id, name: poi.name, error: "alle bilde-oppslag ga tomt svar" });
        opts.onPoi?.(`  ERR  ${poi.name} — ingen bilde-URL kunne resolves`);
        return;
      }

      result.facts.push({
        poiId: poi.id,
        name: poi.name,
        patch: { gallery_images: urls, photo_resolved_at: new Date().toISOString() },
        summary: `${urls.length} bilder`,
      });
      opts.onPoi?.(`  OK   ${poi.name} — ${urls.length} bilder`);
    } catch (err) {
      if (isQuotaError(err)) throw err;
      result.failed.push({
        id: poi.id,
        name: poi.name,
        error: err instanceof Error ? err.message : String(err),
      });
      opts.onPoi?.(`  ERR  ${poi.name} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }, opts);
}

// ─── Fase 2: skriving ───────────────────────────────────────────────────────

export interface WriteReport {
  written: number;
  failed: { id: string; name: string; error: string }[];
}

/** Fase 2: skriver de innsamlede faktaene. Kalles kun ved `--apply`. */
export async function writeFacts(
  ctx: SupabaseCtx,
  facts: CollectedFact[],
  onPoi?: (line: string) => void,
): Promise<WriteReport> {
  const report: WriteReport = { written: 0, failed: [] };

  for (const fact of facts) {
    try {
      await patchPoi(ctx, fact.poiId, fact.patch);
      report.written++;
    } catch (err) {
      report.failed.push({
        id: fact.poiId,
        name: fact.name,
        error: err instanceof Error ? err.message : String(err),
      });
      onPoi?.(`  ERR  ${fact.name} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return report;
}

/**
 * Post-write-verifisering: leser radene tilbake og bekrefter at kolonnene faktisk
 * har verdi. Returnerer POI-ene som IKKE fikk data.
 */
export async function verifyWritten(
  ctx: SupabaseCtx,
  facts: CollectedFact[],
  columns: string[],
): Promise<{ id: string; name: string; missing: string[] }[]> {
  if (facts.length === 0) return [];

  const idList = facts.map((f) => `"${f.poiId}"`).join(",");
  const res = await sbFetch(ctx)(
    `${ctx.url}/rest/v1/pois?id=in.(${idList})&select=id,${columns.join(",")}`,
    { headers: readHeaders(ctx.key) },
  );
  if (!res.ok) {
    throw new Error(`Post-write-verifisering feilet: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Record<string, unknown>[];
  const byId = new Map(rows.map((r) => [r.id as string, r]));

  const problems: { id: string; name: string; missing: string[] }[] = [];
  for (const fact of facts) {
    const row = byId.get(fact.poiId);
    const missing = Object.keys(fact.patch).filter(
      (col) => columns.includes(col) && (row?.[col] === null || row?.[col] === undefined),
    );
    if (!row || missing.length > 0) {
      problems.push({ id: fact.poiId, name: fact.name, missing: row ? missing : columns });
    }
  }
  return problems;
}

// ─── Rapportering ───────────────────────────────────────────────────────────

/** Konsollrapporten som er kostnadskontrollens kvittering (R12). */
export function formatSummary(result: CollectResult, mode: BackfillMode): string {
  const rows: [string, number][] = [
    ["Klare til skriving", result.facts.length],
    ["Uten google_place_id", result.skippedNoPlaceId.length],
    ["Ikke funnet (404)", result.notFound.length],
    ["Ingen data/hoppet over", result.noData.length],
    ["Feilet", result.failed.length],
    ["Google-API-kall", result.apiCalls],
  ];
  const width = Math.max(...rows.map(([label]) => label.length)) + 1;

  const lines = [
    "=== Oppsummering ===",
    ...rows.map(([label, value]) => `${(label + ":").padEnd(width + 1)} ${value}`),
  ];
  if (!mode.apply) {
    lines.push("", "DRY RUN — ingenting er skrevet. Kjør med --apply for å skrive.");
  }
  return lines.join("\n");
}
