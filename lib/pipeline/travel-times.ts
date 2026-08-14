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

      const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
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

    // Liten pause mellom batcher — unngår Matrix-API-ets rate-limit
    if (batches.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
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
    return { computed: 0, total: 0, coverage: emptyCoverage(), warnings };
  }

  try {
    const db = createServerClient().schema("v2");

    // v2 har ingen FK-metadata → nested select feiler; split-queries-mønsteret.
    const { data: projectPois, error: ppError } = await db
      .from("project_pois")
      .select("poi_id")
      .eq("project_id", projectId);
    if (ppError) {
      warnings.push(`⚠️  Henting av project_pois feilet: ${ppError.message} — reisetider hoppet over`);
      return { computed: 0, total: 0, coverage: emptyCoverage(), warnings };
    }
    if (!projectPois || projectPois.length === 0) {
      return { computed: 0, total: 0, coverage: emptyCoverage(), warnings };
    }

    const poiIds = projectPois.map((p) => p.poi_id);
    const { data: pois, error: poisError } = await db
      .from("pois")
      .select("id, lat, lng")
      .in("id", poiIds);
    if (poisError) {
      warnings.push(`⚠️  Henting av poi-koordinater feilet: ${poisError.message} — reisetider hoppet over`);
      return { computed: 0, total: poiIds.length, coverage: emptyCoverage(), warnings };
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

    let computed = 0;
    const coverage = emptyCoverage();
    for (const t of times) {
      if (t.walk === undefined && t.bike === undefined && t.car === undefined) {
        continue;
      }
      const travel_times: Record<string, number> = {};
      if (t.walk !== undefined) travel_times.walk = t.walk;
      if (t.bike !== undefined) travel_times.bike = t.bike;
      if (t.car !== undefined) travel_times.car = t.car;

      const { error: updateError } = await db
        .from("project_pois")
        .update({ travel_times })
        .eq("project_id", projectId)
        .eq("poi_id", t.poiId);
      if (updateError) {
        warnings.push(`⚠️  Skriving av reisetid for ${t.poiId} feilet: ${updateError.message}`);
        continue;
      }
      // Telles etter skriving, ikke etter beregning — dekningen skal speile basen.
      for (const profile of PROVISION_PROFILES) {
        if (t[profile] !== undefined) coverage[profile]++;
      }
      computed++;
    }

    return { computed, total: poiIds.length, coverage, warnings };
  } catch (error) {
    warnings.push(
      `⚠️  Reisetid-steget feilet: ${error instanceof Error ? error.message : String(error)} — boardet bruker haversine-fallback`
    );
    return { computed: 0, total: 0, coverage: emptyCoverage(), warnings };
  }
}
