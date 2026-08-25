/**
 * Reisetid-precompute (bead 2nj, Andreas-godkjent 2026-07-06) — provision-steg
 * som beregner ekte gangtider fra prosjekt-origo til alle prosjekt-POI-er via
 * Mapbox Matrix API og skriver dem til v2.project_pois.travel_times.
 *
 * Enhets-KONTRAKT: MINUTTER (Math.ceil av durasjon/60) — samme kontrakt som
 * POI.travelTime i lib/types.ts og haversine-fallbacken i report-data.ts.
 *
 * Alle tre profiler (walk, bike, car) beregnes i provision — boardets
 * reisemodus-veksler bytter perspektiv uten nettverkskall, og det krever at
 * tallene ligger i basen på forhånd.
 *
 * Fail-soft: steget samler warnings og kaster ALDRI — boardet degraderer til
 * haversine-estimat for POI-er uten precompute.
 *
 * MAPBOX TOKEN-SIKKERHET: access_token i URL-querystring er Matrix-API-ets
 * eneste auth-mekanisme (ingen header-variant), og NEXT_PUBLIC_MAPBOX_TOKEN er
 * bevisst offentlig (jf. CLAUDE.md-unntaket). Logg aldri full request-URL.
 *
 * Read-side (cutover-kontrakt): når board-lesingen flyttes til v2 (r01.3),
 * mappes project_pois.travel_times → POI.travelTime i container-loaderen.
 */

import { createServerClient } from "@/lib/supabase/client";
import { chunkIds } from "@/lib/supabase/chunk-ids";
import { fetchTravelTimeRows, hasProfile } from "@/lib/pipeline/travel-coverage";
import type { Coordinates, TravelMode } from "@/lib/types";

// ── Matrix-motor ────────────────────────────────────────────────────────────

export interface TravelTimeResult {
  poiId: string;
  walk?: number;
  bike?: number;
  car?: number;
}

interface Destination {
  id: string;
  coordinates: Coordinates;
}

const MAPBOX_PROFILES: Record<TravelMode, string> = {
  walk: "walking",
  bike: "cycling",
  car: "driving",
};

// Mapbox Matrix tillater 25 koordinater per request (1 origo + 24 destinasjoner)
const MAX_DESTINATIONS_PER_REQUEST = 24;

// ...og krever minst 2 matrise-elementer. Med sources=0 er antall elementer lik
// antall destinasjoner, så én destinasjon gir HTTP 422 «minimum number of
// matrix elements is 2».
const MIN_DESTINATIONS_PER_REQUEST = 2;

/**
 * Deler destinasjoner i bolker på maks 24, uten å etterlate en bolk med én.
 *
 * INVARIANT: hver bolk har 2–24 destinasjoner. Uten den mistet hvert POI-antall
 * ≡ 1 (mod 24) stille reisetiden for sitt siste punkt — Matrix svarte 422 og
 * fail-soft-kontrakten svelget det som en warning.
 *
 * Omfordelingen låner ett punkt fra forrige bolk (24 + 1 → 23 + 2). Å slå de to
 * sammen er ikke et alternativ: 25 destinasjoner + origo er over koordinatgrensen.
 *
 * Kanttilfellet med ÉN destinasjon totalt kan ikke redde seg selv — det finnes
 * ingen forrige bolk å låne fra. Da returneres ingen bolker, og kalleren samler
 * en warning i stedet for å fyre en forespørsel Matrix garantert avviser.
 */
export function batchDestinations<T>(destinations: T[]): T[][] {
  if (destinations.length < MIN_DESTINATIONS_PER_REQUEST) return [];

  const batches: T[][] = [];
  for (let i = 0; i < destinations.length; i += MAX_DESTINATIONS_PER_REQUEST) {
    batches.push(destinations.slice(i, i + MAX_DESTINATIONS_PER_REQUEST));
  }

  const last = batches[batches.length - 1];
  if (last.length < MIN_DESTINATIONS_PER_REQUEST && batches.length > 1) {
    const previous = batches[batches.length - 2];
    last.unshift(previous.pop()!);
  }

  return batches;
}

interface MapboxMatrixResponse {
  code: string;
  durations?: number[][];
}

// Matrix' rate-limit er 60 requests per minutt. En backfill over hele porteføljen
// fyrer flere hundre, og uten retry ble hver 429 en stille tapt bolk.
const RATE_LIMIT_RETRIES = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch med retry på 429. Respekterer `Retry-After` når Mapbox sender den, og
 * faller ellers tilbake på eksponentiell backoff. Returnerer null når alle
 * forsøk er brukt opp — da samler kalleren en warning.
 */
async function fetchMatrixWithRetry(
  url: string,
  profile: TravelMode,
  warnings: string[]
): Promise<Response | null> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (response.status !== 429) return response;

    if (attempt >= RATE_LIMIT_RETRIES) {
      warnings.push(
        `⚠️  Mapbox Matrix ${profile}: rate-limit (HTTP 429) etter ${RATE_LIMIT_RETRIES + 1} forsøk (batch hoppet over)`
      );
      return null;
    }

    const retryAfter = Number(response.headers?.get("retry-after"));
    const waitMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
    await sleep(waitMs);
  }
}

async function calculateForProfile(
  origin: Coordinates,
  destinations: Destination[],
  profile: TravelMode,
  mapboxToken: string,
  warnings: string[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const mapboxProfile = MAPBOX_PROFILES[profile];

  const batches = batchDestinations(destinations);
  if (batches.length === 0 && destinations.length > 0) {
    warnings.push(
      `⚠️  Mapbox Matrix ${profile}: ${destinations.length} destinasjon(er) er under Matrix' minimum på 2 matrise-elementer — hoppet over`
    );
    return results;
  }

  for (const batch of batches) {
    try {
      const coordinates = [
        `${origin.lng},${origin.lat}`,
        ...batch.map((d) => `${d.coordinates.lng},${d.coordinates.lat}`),
      ].join(";");
      const destinationIndices = batch.map((_, i) => i + 1).join(";");
      const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${mapboxProfile}/${coordinates}?access_token=${mapboxToken}&sources=0&destinations=${destinationIndices}&annotations=duration`;

      const response = await fetchMatrixWithRetry(url, profile, warnings);
      if (!response) continue; // rate-limit oppgitt — warning alt samlet
      if (!response.ok) {
        warnings.push(`⚠️  Mapbox Matrix ${profile}: HTTP ${response.status} (batch hoppet over)`);
        continue;
      }

      const data = (await response.json()) as MapboxMatrixResponse;
      if (data.code !== "Ok") {
        warnings.push(`⚠️  Mapbox Matrix ${profile}: kode ${data.code} (batch hoppet over)`);
        continue;
      }

      const durations = data.durations?.[0] ?? [];
      for (let i = 0; i < batch.length; i++) {
        const duration = durations[i];
        if (duration !== null && duration !== undefined) {
          results.set(batch[i].id, Math.ceil(duration / 60)); // sekunder → MINUTTER
        }
      }
    } catch (error) {
      warnings.push(
        `⚠️  Mapbox Matrix ${profile} feilet: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Liten pause mellom batcher — demper mot Matrix' rate-limit (retry tar resten)
    if (batches.length > 1) {
      await sleep(250);
    }
  }

  return results;
}

export async function calculateTravelTimes(
  origin: Coordinates,
  destinations: Destination[],
  mapboxToken: string,
  profiles: TravelMode[],
  warnings: string[] = []
): Promise<TravelTimeResult[]> {
  const timesByProfile = new Map<TravelMode, Map<string, number>>();
  for (const profile of profiles) {
    timesByProfile.set(
      profile,
      await calculateForProfile(origin, destinations, profile, mapboxToken, warnings)
    );
  }

  return destinations.map((d) => ({
    poiId: d.id,
    walk: timesByProfile.get("walk")?.get(d.id),
    bike: timesByProfile.get("bike")?.get(d.id),
    car: timesByProfile.get("car")?.get(d.id),
  }));
}

// ── Provision-steg ──────────────────────────────────────────────────────────

/** Profilene provisjonering beregner. Boardets modusveksler leser alle tre. */
const PROVISION_PROFILES: TravelMode[] = ["walk", "bike", "car"];

export interface ComputeTravelTimesResult {
  /** POI-er som fikk minst én reisetid skrevet. */
  computed: number;
  /**
   * POI-er som alt hadde identiske verdier og derfor ikke ble skrevet. En andre
   * kjøring rett etter en første skal ha `computed: 0` og alt her — det er
   * idempotensen målt, ikke antatt.
   */
  unchanged: number;
  /** Prosjektets totale POI-antall (full-dekning-rapportering). */
  total: number;
  /**
   * Antall POI-er som fikk verdi per profil. En profil som feilet helt mens de
   * andre lyktes er ellers usynlig i `computed` — den drukner i warnings.
   */
  coverage: Record<TravelMode, number>;
  warnings: string[];
}

function emptyCoverage(): Record<TravelMode, number> {
  return { walk: 0, bike: 0, car: 0 };
}

/**
 * Slår friske reisetider sammen med det som alt står i basen.
 *
 * `update({ travel_times })` erstatter HELE jsonb-objektet. Uten sammenslåing
 * sletter en profil som feilet (rate-limit, timeout) den verdien som allerede
 * var riktig — observert 2026-08-14: en backfill der sykkel ble rate-limitet
 * mens bil lyktes, tømte gangtiden på 31 POI-er.
 *
 * Friske verdier vinner over gamle; profiler som ikke ble beregnet beholdes.
 * Ubrukelige verdier (streng, NaN, null) tas ikke med videre.
 */
function mergeTravelTimes(
  existing: Record<string, unknown> | null,
  fresh: TravelTimeResult
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const profile of PROVISION_PROFILES) {
    if (hasProfile(existing, profile)) merged[profile] = existing![profile] as number;
  }
  for (const profile of PROVISION_PROFILES) {
    const value = fresh[profile];
    if (value !== undefined) merged[profile] = value;
  }
  return merged;
}

/** Sant når raden alt er identisk — da er skrivingen bortkastet. */
function isUnchanged(
  existing: Record<string, unknown> | null,
  merged: Record<string, number>
): boolean {
  if (!existing) return false;
  const existingKeys = Object.keys(existing);
  const mergedKeys = Object.keys(merged);
  if (existingKeys.length !== mergedKeys.length) return false;
  return mergedKeys.every((key) => existing[key] === merged[key]);
}

/**
 * Leser prosjektets POI-er fra v2, beregner gang-, sykkel- og biltid fra origo,
 * og skriver travel_times per project_pois-rad. Fail-soft: kaster aldri.
 *
 * Profilene beregnes uavhengig: feiler sykkel mens gå lykkes, beholder POI-et
 * gangtiden sin. Det er derfor `coverage` rapporteres per profil.
 */
export async function computeProjectTravelTimes(options: {
  projectId: string;
  centerLat: number;
  centerLng: number;
}): Promise<ComputeTravelTimesResult> {
  const warnings: string[] = [];
  const { projectId, centerLat, centerLng } = options;

  const token =
    process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    warnings.push("⚠️  MAPBOX_TOKEN mangler — reisetider hoppet over (haversine-fallback på board)");
    return { computed: 0, unchanged: 0, total: 0, coverage: emptyCoverage(), warnings };
  }

  try {
    const db = createServerClient().schema("v2");

    // v2 har ingen FK-metadata → nested select feiler; split-queries-mønsteret.
    // Sidet oppslag: et usidet select avkortes stille ved 1 000 rader, og et
    // board som passerer den grensen ville mistet reisetid for resten uten spor.
    const projectPois = await fetchTravelTimeRows([projectId]);
    if (projectPois.length === 0) {
      return { computed: 0, unchanged: 0, total: 0, coverage: emptyCoverage(), warnings };
    }

    const poiIds = projectPois.map((p) => p.poi_id);
    // Batchet av samme grunn som i hydrate-report: hele poolen i én `.in()`
    // sprenger URL-grensa på store boards. Se chunk-ids.ts.
    const pois: Array<{ id: string; lat: number; lng: number }> = [];
    for (const chunk of chunkIds(poiIds)) {
      const { data, error: poisError } = await db
        .from("pois")
        .select("id, lat, lng")
        .in("id", chunk);
      if (poisError) {
        warnings.push(`⚠️  Henting av poi-koordinater feilet: ${poisError.message} — reisetider hoppet over`);
        return { computed: 0, unchanged: 0, total: poiIds.length, coverage: emptyCoverage(), warnings };
      }
      pois.push(...(data ?? []));
    }

    const destinations: Destination[] = (pois ?? [])
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ id: p.id, coordinates: { lat: p.lat, lng: p.lng } }));

    const times = await calculateTravelTimes(
      { lat: centerLat, lng: centerLng },
      destinations,
      token,
      PROVISION_PROFILES,
      warnings
    );

    const existingById = new Map(projectPois.map((p) => [p.poi_id, p.travel_times]));

    let computed = 0;
    let unchanged = 0;
    const coverage = emptyCoverage();

    for (const t of times) {
      const existing = existingById.get(t.poiId) ?? null;
      const travel_times = mergeTravelTimes(existing, t);
      if (Object.keys(travel_times).length === 0) continue;

      if (isUnchanged(existing, travel_times)) {
        unchanged++;
      } else {
        const { error: updateError } = await db
          .from("project_pois")
          .update({ travel_times })
          .eq("project_id", projectId)
          .eq("poi_id", t.poiId);
        if (updateError) {
          warnings.push(`⚠️  Skriving av reisetid for ${t.poiId} feilet: ${updateError.message}`);
          continue;
        }
        computed++;
      }

      // Dekningen telles først når raden er bekreftet i basen — enten fordi den
      // ble skrevet, eller fordi den alt var identisk.
      for (const profile of PROVISION_PROFILES) {
        if (travel_times[profile] !== undefined) coverage[profile]++;
      }
    }

    return { computed, unchanged, total: poiIds.length, coverage, warnings };
  } catch (error) {
    warnings.push(
      `⚠️  Reisetid-steget feilet: ${error instanceof Error ? error.message : String(error)} — boardet bruker haversine-fallback`
    );
    return { computed: 0, unchanged: 0, total: 0, coverage: emptyCoverage(), warnings };
  }
}
