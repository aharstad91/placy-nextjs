/**
 * Containment-innhøsting: hvem ligger INNE i hvem?
 *
 * Googles `containingPlaces` er gate 1 i anker-oppløsningen og den eneste
 * autoritative kilden vi har til at et sted ligger inne i et annet. Feltet er
 * med i `NEARBY_FIELD_MASK` og skrives av importen — men det ble lagt til
 * 2026-08-27, og nesten hele poolen er eldre. Målt 2026-08-28: **4 av 1 908
 * Google-rader** bærer `contained_in_ids`. Gate 1 er altså i praksis tom, og
 * både kjøpesenter- og anleggs-ankrene kjører på adresse og nærhet alene.
 *
 * Dette steget fyller hullet uten å re-importere noe. Det henter ikke steder;
 * det spør Google om containment for steder vi ALLEREDE har, og skriver svaret
 * på radene som finnes.
 *
 * ## Hvorfor klynge-søk og ikke ett kall per POI
 *
 * `places/{id}`-oppslag ville kostet ett kall per rad — 1 908 kall for poolen.
 * Ett `searchNearby` returnerer `containingPlaces` for opptil 20 steder, og
 * containment er per definisjon et NÆRHETS-fenomen: alt som ligger inne i et
 * bygg ligger også nær det. Ett kall per klynge dekker derfor hele klyngen.
 * Målt over hele poolen: 18 kall mot 1 908.
 *
 * ## Hva steget IKKE gjør
 *
 * Det oppretter ingen rader. Kommer Google tilbake med et sted vi ikke har,
 * ignoreres det — recall er discoveryens jobb, ikke denne. Og det NULLER aldri
 * et felt: `containingPlaces` som mangler betyr «Google sa ingenting», ikke
 * «ligger ikke i noe bygg» (samme regel som `mapContainingPlaces`).
 *
 * ## Taket på 20
 *
 * Et `searchNearby` gir maks 20 treff. I en tett klynge betyr det at de
 * fjerneste medlemmene ikke blir spurt. Det er akseptert her og ikke i
 * discoveryen, fordi konsekvensen er ulik: discoveryen MISTER et sted, mens
 * dette steget bare lar en peker være uoppdaget — ankeret faller da tilbake på
 * navne-gaten, altså dagens oppførsel.
 */

import {
  searchNearbyOnce,
  mapContainingPlaces,
  type SearchCircle,
} from "@/lib/pipeline/poi-discovery";
import { createServerClient } from "@/lib/supabase/client";
import { chunkIds } from "@/lib/supabase/chunk-ids";

/** Enkeltlenke-avstanden som binder POI-er til samme klynge. */
export const CLUSTER_LINK_M = 250;

/**
 * Færrest UNIKE navn en klynge må ha før den er verdt et kall.
 *
 * Tre, ikke fire. Realitets-gaten på fire gjelder MEDLEMMER, og containeren
 * selv er ikke medlem — en klynge med tre unike navn kan bli et anker med fire
 * når containeren løftes ut av medlemslista.
 */
export const CLUSTER_MIN_NAMES = 3;

/** Søkeradiusens påslag utenpå klyngens halve spenn, og taket på den. */
const RADIUS_PADDING_M = 120;
const RADIUS_MAX_M = 500;

export interface ContainmentPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  googlePlaceId: string | null;
  containedInIds: string[] | null;
}

export interface EnrichContainmentResult {
  /** Klynger som ble spurt. */
  clusters: number;
  /** searchNearby-kall brukt. */
  calls: number;
  /** Rader som fikk `contained_in_ids` satt eller endret. */
  rowsUpdated: number;
  /** Peker-par funnet, uansett om raden fantes hos oss. */
  pointersFound: number;
  /** Steder Google pekte på som vi ikke har i basen — recall-signal, ikke feil. */
  unknownContainers: number;
  /**
   * Alt steget fant, POI-id → container-id-er, uavhengig av om raden ble
   * skrevet. Sendes videre til oppløsningen som overlegg.
   *
   * Uten dette ville en TØRRKJØRING løyet: containment skrives ikke, så
   * oppløsningen leste gårsdagens tomme felt og rapporterte en plan som ikke
   * er den planen `--commit` faktisk utfører. Kontrakten i dette repoet er at
   * tørrkjøringen gir NØYAKTIG samme rapport som en ekte kjøring.
   */
  pointers: Map<string, string[]>;
  warnings: string[];
}

const METERS_PER_DEGREE_LAT = 111_320;

function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * METERS_PER_DEGREE_LAT;
  const dLng =
    (b.lng - a.lng) *
    METERS_PER_DEGREE_LAT *
    Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(dLat, dLng);
}

/**
 * Enkeltlenke-klynging på {@link CLUSTER_LINK_M}. Deterministisk: punktene
 * sorteres på id, og klyngene returneres i rekkefølgen første medlem har.
 */
export function clusterPoints(
  points: readonly ContainmentPoint[],
  linkMeters: number = CLUSTER_LINK_M,
): ContainmentPoint[][] {
  const sorted = [...points].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (distanceMeters(sorted[i], sorted[j]) <= linkMeters) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[a] = b;
      }
    }
  }
  const groups = new Map<number, ContainmentPoint[]>();
  sorted.forEach((p, i) => {
    const key = find(i);
    const arr = groups.get(key);
    if (arr) arr.push(p);
    else groups.set(key, [p]);
  });
  return [...groups.values()];
}

/** Klyngens søkesirkel: halve spennet pluss et påslag, med tak. */
export function clusterCircle(cluster: readonly ContainmentPoint[]): SearchCircle {
  let span = 0;
  for (let i = 0; i < cluster.length; i++) {
    for (let j = i + 1; j < cluster.length; j++) {
      span = Math.max(span, distanceMeters(cluster[i], cluster[j]));
    }
  }
  return {
    lat: cluster.reduce((s, p) => s + p.lat, 0) / cluster.length,
    lng: cluster.reduce((s, p) => s + p.lng, 0) / cluster.length,
    radius: Math.min(RADIUS_MAX_M, Math.round(span / 2) + RADIUS_PADDING_M),
    depth: 0,
  };
}

/** Verdt et kall? Én bane alene har ingen containment å avsløre. */
export function isWorthProbing(
  cluster: readonly ContainmentPoint[],
  minNames: number = CLUSTER_MIN_NAMES,
): boolean {
  return new Set(cluster.map((p) => p.name.toLocaleLowerCase("nb-NO"))).size >= minNames;
}

/**
 * Høst containment for POI-ene i en kategori, i ett prosjekts pool.
 *
 * Fail-soft som resten av pipelinen: samler warnings, aborterer aldri.
 */
export async function enrichContainment(options: {
  projectId: string;
  /** Kategoriene klyngene bygges av. Anleggs-familien sender `idrett`. */
  categoryIds: readonly string[];
  apiKey: string;
  dryRun?: boolean;
}): Promise<EnrichContainmentResult> {
  const dryRun = options.dryRun ?? false;
  const result: EnrichContainmentResult = {
    clusters: 0,
    calls: 0,
    rowsUpdated: 0,
    pointersFound: 0,
    unknownContainers: 0,
    pointers: new Map(),
    warnings: [],
  };

  let baseClient: ReturnType<typeof createServerClient>;
  try {
    baseClient = createServerClient();
  } catch (err) {
    result.warnings.push(
      `⚠️  Supabase ikke konfigurert (${err instanceof Error ? err.message : String(err)}) — containment-høsting hoppet over`,
    );
    return result;
  }
  const db = baseClient.schema("v2") as unknown as typeof baseClient;

  const { data: projectPois, error: ppError } = await db
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", options.projectId);
  if (ppError || !projectPois?.length) {
    result.warnings.push(
      `⚠️  Kunne ikke lese project_pois (${ppError?.message ?? "tom"}) — containment-høsting hoppet over`,
    );
    return result;
  }

  const rows: ContainmentPoint[] = [];
  const seeds: ContainmentPoint[] = [];
  for (const chunk of chunkIds(projectPois.map((p) => p.poi_id))) {
    const { data, error } = await db
      .from("pois")
      .select("id, name, lat, lng, google_place_id, contained_in_ids, category_id")
      .in("id", chunk);
    if (error || !data) {
      result.warnings.push(`⚠️  Kunne ikke lese POI-data (${error?.message ?? "ukjent"})`);
      return result;
    }
    for (const raw of data as unknown as Array<Record<string, unknown>>) {
      const lat = Number(raw.lat);
      const lng = Number(raw.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const point: ContainmentPoint = {
        id: String(raw.id),
        name: String(raw.name),
        lat,
        lng,
        googlePlaceId: (raw.google_place_id as string | null) ?? null,
        containedInIds: (raw.contained_in_ids as string[] | null) ?? null,
      };
      rows.push(point);
      if (options.categoryIds.includes(String(raw.category_id ?? ""))) seeds.push(point);
    }
  }

  const byPlaceId = new Map<string, ContainmentPoint>();
  for (const row of rows) if (row.googlePlaceId) byPlaceId.set(row.googlePlaceId, row);

  const updates = new Map<string, string[]>();

  for (const cluster of clusterPoints(seeds)) {
    if (!isWorthProbing(cluster)) continue;
    result.clusters++;

    const { places } = await searchNearbyOnce(null, clusterCircle(cluster), options.apiKey, "DISTANCE");
    result.calls++;

    for (const place of places) {
      const containedIn = mapContainingPlaces(place.containingPlaces);
      if (!containedIn || !place.id) continue;
      result.pointersFound += containedIn.length;

      const row = byPlaceId.get(place.id);
      if (!row) {
        // Google kjenner stedet, vi gjør ikke. Discoveryens problem, ikke vårt.
        result.unknownContainers++;
        continue;
      }
      result.pointers.set(row.id, containedIn);

      const before = [...(row.containedInIds ?? [])].sort().join("|");
      const after = [...containedIn].sort().join("|");
      if (before === after) continue;
      updates.set(row.id, containedIn);
    }
  }

  for (const [id, containedIn] of updates) {
    if (dryRun) {
      result.rowsUpdated++;
      continue;
    }
    const { error } = await db.from("pois").update({ contained_in_ids: containedIn }).eq("id", id);
    if (error) {
      result.warnings.push(`⚠️  Kunne ikke skrive containment for ${id}: ${error.message}`);
      continue;
    }
    result.rowsUpdated++;
  }

  return result;
}
