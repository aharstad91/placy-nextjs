import { readFile, writeFile } from "node:fs/promises";

import { localPlacesSchema } from "@/lib/demo/local-board/schema";
import { createServerClient } from "@/lib/supabase/client";

interface Options {
  projectId: string;
  placesPath: string;
  outputPath: string;
}

function options(): Options {
  const values = process.argv.slice(2);
  const value = (flag: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] : undefined;
  };
  const projectId = value("--project-id");
  const placesPath = value("--places");
  const outputPath = value("--output");
  if (!projectId || !placesPath || !outputPath) {
    throw new Error("--project-id, --places og --output er påkrevd");
  }
  return { projectId, placesPath, outputPath };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nb")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function distanceMeters(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(right.lat - left.lat);
  const dLng = radians(right.lng - left.lng);
  const lat1 = radians(left.lat);
  const lat2 = radians(right.lat);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function allProjectPoiIds(projectId: string): Promise<string[]> {
  const db = createServerClient().schema("v2");
  const result: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("project_pois")
      .select("poi_id")
      .eq("project_id", projectId)
      .order("poi_id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    result.push(...(data ?? []).map((row) => row.poi_id));
    if (!data || data.length < 1000) return result;
  }
}

async function main() {
  const args = options();
  const places = localPlacesSchema.parse(JSON.parse(await readFile(args.placesPath, "utf8")));
  const ids = await allProjectPoiIds(args.projectId);
  const db = createServerClient().schema("v2");
  const pool: Array<{ id: string; name: string; address: string | null; lat: number; lng: number }> = [];
  for (let index = 0; index < ids.length; index += 200) {
    const { data, error } = await db
      .from("pois")
      .select("id,name,address,lat,lng")
      .in("id", ids.slice(index, index + 200));
    if (error) throw new Error(error.message);
    pool.push(...(data ?? []));
  }
  const byId = new Map(pool.map((poi) => [poi.id, poi]));
  const byName = new Map<string, typeof pool>();
  for (const poi of pool) {
    const key = normalize(poi.name);
    byName.set(key, [...(byName.get(key) ?? []), poi]);
  }

  const rows = places.map((place) => {
    const exactId = byId.get(place.id);
    const named = byName.get(normalize(place.name)) ?? [];
    const nearby = pool
      .map((poi) => ({
        poi,
        distanceMeters: distanceMeters(place.coordinates, { lat: poi.lat, lng: poi.lng }),
      }))
      .filter((candidate) => candidate.distanceMeters <= 250)
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .slice(0, 8)
      .map((candidate) => candidate.poi);
    const candidatePool = exactId ? [exactId] : named.length ? named : nearby;
    const candidates = candidatePool
      .map((poi) => ({
        poiId: poi.id,
        productionName: poi.name,
        productionAddress: poi.address,
        distanceMeters: distanceMeters(place.coordinates, { lat: poi.lat, lng: poi.lng }),
      }))
      .sort((left, right) => left.distanceMeters - right.distanceMeters);
    const winner = exactId
      ? candidates[0]
      : candidates.length === 1 && candidates[0]!.distanceMeters <= 250
        ? candidates[0]
        : null;
    return {
      localPlaceId: place.id,
      localName: place.name,
      localAddress: place.address ?? null,
      decision: winner ? "mapped" : candidates.length ? "review_required" : "unmapped",
      ...(winner ? {
        poiId: winner.poiId,
        evidence: exactId
          ? "Exact POI identifier in the standard project pool."
          : `Unique normalized name and coordinates ${winner.distanceMeters} m apart.`,
      } : {}),
      candidates: candidates.slice(0, 8),
    };
  });
  const counts = Object.fromEntries(Object.entries(Object.groupBy(rows, (row) => row.decision))
    .map(([decision, items]) => [decision, items?.length ?? 0]));
  const review = {
    schemaVersion: 1,
    reviewedAt: new Date().toISOString().slice(0, 10),
    projectId: args.projectId,
    sourcePath: args.placesPath,
    poolSize: pool.length,
    counts,
    mappings: rows,
  };
  await writeFile(args.outputPath, `${JSON.stringify(review, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ outputPath: args.outputPath, ...counts }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
