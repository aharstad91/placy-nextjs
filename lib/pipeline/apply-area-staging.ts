/**
 * Kurator-kjerne: staging → `v2.areas` read-modify-write. EKSTRAHERT fra
 * `scripts/curate-area.ts` (Unit 4) slik at BÅDE CLI-scriptet OG den fremtidige
 * PRD-15-kurerings-overflaten kan dele kjernen uten å shelle ut til script.
 *
 * Skrivemønster (dokumentert valg, Beslutning 4): `areas` har INGEN
 * `updated_at`-kolonne (verifisert prod-schema-snapshot linje 4–20), så
 * optimistisk lås à la `inherit-area-editorial.ts`/`apply-curation-staging.ts`
 * er IKKE mulig her. Dette er en én-operatør-PoC — vi bruker enkel GET → branch:
 *   - finnes ikke raden: INSERT (POST) fra `meta` + boundary + report_editorial
 *   - finnes raden: klient-side spread-merge → PATCH på id. Merge-semantikk:
 *     staging overskriver `boundary` og de `report_editorial`-temaene den har;
 *     eksisterende temaer som ikke er i staging BEHOLDES. `meta` ignoreres ved
 *     update (endrer aldri identitet på en eksisterende rad).
 *
 * v2-targeting (AC1 / INDEX note #7): rå REST treffer `public` som default —
 * `Accept-Profile: v2` på GET / `Content-Profile: v2` på INSERT+PATCH velger
 * `v2.areas`. v2 er eksponert via `pgrst.db_schemas = 'public,…,v2'`.
 * Speiler `inherit-area-editorial.ts:215–222/384–386`.
 *
 * Return-kontrakt (AC2): kjernen EXIT-er aldri prosessen — den returnerer et
 * strukturert resultat (`{ ok: true, … } | { ok: false, error }`) slik at
 * PRD-15-overflaten kan håndtere feil uten å drepe en server-prosess. CLI-skallet
 * oversetter `ok:false` til `process.exit(1)`. 0-rader-PATCH er en `ok:false`-feil.
 *
 * sha256-dedup (AC5, ikke påkrevd nå): HVIS kjernen senere skal skrive
 * `place_knowledge`-rader, er dedup-mønsteret fra `scripts/backfill-knowledge.ts:82–84`
 * (`computeHash(poiId, topic, normalisert factText)` via `createHash("sha256")` +
 * existing-hash-set) tilgjengelig for gjenbruk. `areas`-kuratering skriver IKKE
 * `place_knowledge` i denne PRD-en, så ingen dedup implementeres her.
 */

import type { AreaStaging } from "@/lib/pipeline/area-staging";

/** Timeout på Supabase REST-kall — henger aldri evig (mønster: checkWebsite). */
const REST_TIMEOUT_MS = 30_000;

/** Injiserbare REST-avhengigheter — `fetchFn` gjør kjernen offline-testbar. */
export interface AreaStagingDeps {
  supabaseUrl: string;
  serviceKey: string;
  /** Default: global `fetch`. Injiseres i tester. */
  fetchFn?: typeof fetch;
}

/** Den delmengden av en `areas`-rad kjernen + plan-presentasjonen trenger. */
export interface AreaRow {
  id: string;
  name_no: string | null;
  level: string | null;
  center_lat: number | null;
  center_lng: number | null;
  boundary: unknown | null;
  report_editorial: Record<string, unknown> | null;
}

/** Strukturert resultat — kjernen exit-er aldri prosessen (AC2). */
export type ApplyAreaStagingResult =
  | { ok: true; mode: "create" | "update"; areaId: string; themesWritten: number }
  | { ok: false; areaId: string; error: string };

/** Service-key i header (apikey + Authorization Bearer), ALDRI i URL (AC4). */
function restHeaders(serviceKey: string): Record<string, string> {
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY ikke satt");
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
}

/** fetch med AbortController-timeout — timeout/nettverksfeil kaster som annen fetch-feil. */
async function fetchWithTimeout(
  fetchFn: typeof fetch,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * GET `v2.areas`-raden for `areaId` (rå REST, `Accept-Profile: v2`).
 * Returnerer raden eller `null`. Kaster ved !ok (kall-stedet bestemmer
 * fail-soft for read — kun WRITE-feil skal alltid være høylytt, AC4).
 */
export async function fetchAreaRow(
  areaId: string,
  deps: AreaStagingDeps
): Promise<AreaRow | null> {
  const fetchFn = deps.fetchFn ?? fetch;
  const url =
    `${deps.supabaseUrl}/rest/v1/areas?id=eq.${encodeURIComponent(areaId)}` +
    `&select=id,name_no,level,center_lat,center_lng,boundary,report_editorial`;
  const res = await fetchWithTimeout(fetchFn, url, {
    headers: { ...restHeaders(deps.serviceKey), "Accept-Profile": "v2" },
  });
  if (!res.ok) {
    throw new Error(`GET areas feilet: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as AreaRow[];
  return rows[0] ?? null;
}

/**
 * Klient-side spread-merge (AC1): staging overskriver de temaene den har;
 * eksisterende temaer som ikke er i staging BEHOLDES. Ren funksjon — ingen I/O.
 */
export function mergeEditorial(
  existing: Record<string, unknown> | null | undefined,
  staging: AreaStaging
): Record<string, unknown> {
  return { ...(existing ?? {}), ...staging.report_editorial };
}

/**
 * WRITE-logikken delegert fra `curate-area.ts` (AC3). Tar en allerede-hentet
 * rad (`null` → INSERT, krever `meta`; ellers PATCH-merge på id) — slik at
 * kall-stedet kan gjenbruke den raden det allerede leste for sin diff/plan
 * (unngår dobbel-GET + holder plan==write konsistent). Ingen optimistisk lås
 * (`areas` mangler `updated_at`). 0-rader-PATCH/INSERT → `ok:false`-feil.
 */
export async function writeAreaStaging(
  staging: AreaStaging,
  existingRow: AreaRow | null,
  deps: AreaStagingDeps
): Promise<ApplyAreaStagingResult> {
  const fetchFn = deps.fetchFn ?? fetch;
  const headers = restHeaders(deps.serviceKey);

  if (existingRow === null) {
    // ── INSERT — krever meta-blokk (NOT NULL-feltene ved opprettelse) ──
    if (!staging.meta) {
      return {
        ok: false,
        areaId: staging.areaId,
        error: `ingen areas-rad med id='${staging.areaId}', og staging mangler 'meta'-blokk (kan verken PATCHe eller INSERTe)`,
      };
    }
    const m = staging.meta;
    const insertRow: Record<string, unknown> = {
      id: staging.areaId,
      name_no: m.name_no,
      name_en: m.name_en,
      slug_no: m.slug_no,
      slug_en: m.slug_en,
      level: m.level,
      center_lat: m.center_lat,
      center_lng: m.center_lng,
      boundary: staging.boundary,
      report_editorial: staging.report_editorial,
    };
    if (m.zoom_level !== undefined) insertRow.zoom_level = m.zoom_level;
    if (m.parent_id !== undefined) insertRow.parent_id = m.parent_id;
    if (m.postal_codes !== undefined) insertRow.postal_codes = m.postal_codes;

    const res = await fetchWithTimeout(fetchFn, `${deps.supabaseUrl}/rest/v1/areas`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Content-Profile": "v2",
        Prefer: "return=representation",
      },
      body: JSON.stringify(insertRow),
    });
    if (!res.ok) {
      return {
        ok: false,
        areaId: staging.areaId,
        error: `INSERT feilet: ${res.status} ${await res.text()}`,
      };
    }
    const inserted = (await res.json()) as AreaRow[];
    if (!Array.isArray(inserted) || inserted.length === 0) {
      return {
        ok: false,
        areaId: staging.areaId,
        error: "INSERT returnerte 0 rader — opprettelse mislyktes",
      };
    }
    return {
      ok: true,
      mode: "create",
      areaId: staging.areaId,
      themesWritten: Object.keys(staging.report_editorial).length,
    };
  }

  // ── UPDATE — klient-side spread-merge → PATCH på id ──
  const nextEditorial = mergeEditorial(existingRow.report_editorial, staging);
  const patchUrl = `${deps.supabaseUrl}/rest/v1/areas?id=eq.${encodeURIComponent(staging.areaId)}`;
  const res = await fetchWithTimeout(fetchFn, patchUrl, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Content-Profile": "v2",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      boundary: staging.boundary,
      report_editorial: nextEditorial,
    }),
  });
  if (!res.ok) {
    return {
      ok: false,
      areaId: staging.areaId,
      error: `PATCH feilet: ${res.status} ${await res.text()}`,
    };
  }
  const patched = (await res.json()) as AreaRow[];
  if (!Array.isArray(patched) || patched.length === 0) {
    return {
      ok: false,
      areaId: staging.areaId,
      error: "PATCH traff 0 rader — sjekk at areas-raden fortsatt finnes",
    };
  }
  return {
    ok: true,
    mode: "update",
    areaId: staging.areaId,
    themesWritten: Object.keys(nextEditorial).length,
  };
}

/**
 * Bekvemmelighet for PRD-15-overflaten: GET → write i ett kall. CLI-scriptet
 * bruker `fetchAreaRow` + `writeAreaStaging` hver for seg (det trenger raden
 * til sin dry-run-plan), mens en server-action-overflate som ikke presenterer
 * en diff kan kalle denne direkte.
 */
export async function applyAreaStaging(
  staging: AreaStaging,
  deps: AreaStagingDeps
): Promise<ApplyAreaStagingResult> {
  const existing = await fetchAreaRow(staging.areaId, deps);
  return writeAreaStaging(staging, existing, deps);
}
