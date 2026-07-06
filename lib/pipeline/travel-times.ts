/**
 * Reisetid-precompute (bead 2nj, Andreas-godkjent 2026-07-06) — provision-steg
 * som beregner ekte gangtider fra prosjekt-origo til alle prosjekt-POI-er via
 * Mapbox Matrix API og skriver dem til v2.project_pois.travel_times.
 *
 * Enhets-KONTRAKT: MINUTTER (Math.ceil av durasjon/60) — samme kontrakt som
 * POI.travelTime i lib/types.ts og haversine-fallbacken i report-data.ts.
 *
 * Kun `walk` beregnes i provision (boardets UI leser utelukkende .walk);
 * motoren støtter bike/car for fremtidig travel-mode-bruk.
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

  const batches: Destination[][] = [];
  for (let i = 0; i < destinations.length; i += MAX_DESTINATIONS_PER_REQUEST) {
    batches.push(destinations.slice(i, i + MAX_DESTINATIONS_PER_REQUEST));
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

export interface ComputeTravelTimesResult {
  /** POI-er som fikk minst én reisetid skrevet. */
  computed: number;
  /** Prosjektets totale POI-antall (full-dekning-rapportering). */
  total: number;
  warnings: string[];
}

/**
 * Leser prosjektets POI-er fra v2, beregner gangtider fra origo, og skriver
 * travel_times per project_pois-rad. Fail-soft: kaster aldri.
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
    return { computed: 0, total: 0, warnings };
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
      return { computed: 0, total: 0, warnings };
    }
    if (!projectPois || projectPois.length === 0) {
      return { computed: 0, total: 0, warnings };
    }

    const poiIds = projectPois.map((p) => p.poi_id);
    const { data: pois, error: poisError } = await db
      .from("pois")
      .select("id, lat, lng")
      .in("id", poiIds);
    if (poisError) {
      warnings.push(`⚠️  Henting av poi-koordinater feilet: ${poisError.message} — reisetider hoppet over`);
      return { computed: 0, total: poiIds.length, warnings };
    }

    const destinations: Destination[] = (pois ?? [])
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({ id: p.id, coordinates: { lat: p.lat, lng: p.lng } }));

    const times = await calculateTravelTimes(
      { lat: centerLat, lng: centerLng },
      destinations,
      token,
      ["walk"],
      warnings
    );

    let computed = 0;
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
      computed++;
    }

    return { computed, total: poiIds.length, warnings };
  } catch (error) {
    warnings.push(
      `⚠️  Reisetid-steget feilet: ${error instanceof Error ? error.message : String(error)} — boardet bruker haversine-fallback`
    );
    return { computed: 0, total: 0, warnings };
  }
}
