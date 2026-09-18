/**
 * Importerer det brede, eksisterende POI-registeret til et lokalt demo-board.
 *
 * Det lokale datasettet beholder de håndreviderte stedene som `audited` og
 * legger Supabase-punktene ved siden av som `register`. Registerpunkter gir
 * kartet bredde og Anja navn/type/adresse/reisetid, men aldri redaksjonelle
 * fakta. Kjør uten `--write` for en ren opptelling.
 *
 * Eksempel:
 * NODE_OPTIONS=--conditions=react-server node --env-file=.env.local \
 *   ./node_modules/.bin/tsx scripts/demo/import-local-register.ts \
 *   --customer placy-demo --source-slug leangenbukta \
 *   --dataset data/demo/leangenbukta-lokal --radius-km 2 --write
 */

import "server-only";

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { adaptBoardData, type BoardPOI } from "@/components/variants/report/board/board-data";
import { transformToReportData } from "@/components/variants/report/report-data";
import { localBoardSchema, localPlacesSchema, type LocalPlace } from "@/lib/demo/local-board/schema";
import { getProductFromSupabaseV2 } from "@/lib/supabase/v2-queries";
import type { POI } from "@/lib/types";
import { calculateDistance } from "@/lib/utils/geo";

interface Args {
  customer: string;
  sourceSlug: string;
  dataset: string;
  radiusKm: number;
  checkedAt: string;
  write: boolean;
}

function args(): Args {
  const values = process.argv.slice(2);
  const value = (flag: string, fallback: string) => {
    const index = values.indexOf(flag);
    return index >= 0 ? values[index + 1] ?? fallback : fallback;
  };
  const radiusKm = Number(value("--radius-km", "2"));
  if (!Number.isFinite(radiusKm) || radiusKm <= 0 || radiusKm > 10) {
    throw new Error("--radius-km må være et tall mellom 0 og 10.");
  }
  const checkedAt = value("--checked-at", new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt)) {
    throw new Error("--checked-at må være en dato på formatet ÅÅÅÅ-MM-DD.");
  }
  return {
    customer: value("--customer", "placy-demo"),
    sourceSlug: value("--source-slug", "leangenbukta"),
    dataset: value("--dataset", "data/demo/leangenbukta-lokal"),
    radiusKm,
    checkedAt,
    write: values.includes("--write"),
  };
}

const normalize = (value: string) =>
  value
    .toLocaleLowerCase("nb")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9æøå]/g, "");

const slug = (value: string) =>
  value
    .toLocaleLowerCase("nb")
    .replaceAll("æ", "ae")
    .replaceAll("ø", "o")
    .replaceAll("å", "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "sted";

const registerId = (name: string, recordId: string) => {
  const hash = createHash("sha256").update(recordId).digest("hex").slice(0, 10);
  return `register-${slug(name)}-${hash}`.slice(0, 80);
};

interface RootCandidate {
  poi: BoardPOI;
  categoryId: string;
  children: Map<string, { poi: POI; categoryId: string }>;
}

function samePlace(a: Pick<LocalPlace, "name" | "coordinates">, b: Pick<POI, "name" | "coordinates">): boolean {
  return normalize(a.name) === normalize(b.name) &&
    calculateDistance(a.coordinates.lat, a.coordinates.lng, b.coordinates.lat, b.coordinates.lng) <= 250;
}

function status(poi: POI): LocalPlace["status"] {
  return poi.developmentStatus === "planned" ? "planned" : "existing";
}

function registerPlace(poi: POI, categoryId: string, checkedAt: string, parentPlaceId?: string): LocalPlace {
  return localPlacesSchema.element.parse({
    provenance: { provider: "supabase", recordId: String(poi.id), importedAt: checkedAt },
    knowledgeLevel: "register",
    id: registerId(poi.name, String(poi.id)),
    name: poi.name,
    ...(parentPlaceId ? { parentPlaceId } : {}),
    categoryId,
    coordinates: poi.coordinates,
    ...(poi.address ? { address: poi.address } : {}),
    placeType: poi.category.name,
    ...(poi.category.icon ? { icon: poi.category.icon } : {}),
    poiCategoryId: slug(poi.category.name),
    status: status(poi),
    summary: "",
    ...(poi.travelTime ? { travelTime: poi.travelTime } : {}),
    locationPrecision: poi.locationPrecision === "approximate" ? "approximate" : "sourced",
    ...(poi.locationPrecision === "approximate" && poi.locationNote ? { locationNote: poi.locationNote } : {}),
    checkedAt,
  });
}

/** Holder den store registerfila lesbar; lasteren setter de samme standardene. */
function compactPlace(place: LocalPlace): Record<string, unknown> {
  const compact: Record<string, unknown> = { ...place };
  if (place.knowledgeLevel === "audited") delete compact.knowledgeLevel;
  if (place.aliases.length === 0) delete compact.aliases;
  if (place.facts.length === 0) delete compact.facts;
  if (place.sourceIds.length === 0) delete compact.sourceIds;
  if (place.caveats.length === 0) delete compact.caveats;
  if (place.summary === "") delete compact.summary;
  if (place.status === "existing") delete compact.status;
  if (place.locationPrecision === "sourced") delete compact.locationPrecision;
  if (!place.anchorKeepsOwnName) delete compact.anchorKeepsOwnName;
  return compact;
}

async function main() {
  const options = args();
  const [boardRaw, placesRaw, product] = await Promise.all([
    readFile(join(options.dataset, "board.json"), "utf8"),
    readFile(join(options.dataset, "places.json"), "utf8"),
    getProductFromSupabaseV2(options.customer, options.sourceSlug, "report"),
  ]);
  if (!product) throw new Error(`Fant ikke ${options.customer}/${options.sourceSlug}/report i Supabase.`);

  const localBoard = localBoardSchema.parse(JSON.parse(boardRaw));
  const currentSource = JSON.parse(placesRaw) as Array<Record<string, unknown>>;
  const current = localPlacesSchema.parse(currentSource);
  const auditedSource = currentSource.filter((place) => place.knowledgeLevel !== "register");
  const audited = current.filter((place) => place.knowledgeLevel === "audited");
  const sourceBoard = adaptBoardData(transformToReportData(product));
  const localCategoryIdByName = new Map(
    localBoard.categories.map(category => [normalize(category.name), category.id]),
  );
  const roots = new Map<string, RootCandidate>();

  for (const category of sourceBoard.categories) {
    const categoryId = localCategoryIdByName.get(normalize(category.label));
    if (!categoryId) continue;
    for (const poi of category.pois) {
      const sourceCoordinates = poi.raw.coordinates;
      const distanceKm = calculateDistance(
        localBoard.center.lat,
        localBoard.center.lng,
        sourceCoordinates.lat,
        sourceCoordinates.lng,
      ) / 1000;
      if (distanceKm > options.radiusKm) continue;
      const id = String(poi.id);
      const root = roots.get(id) ?? { poi, categoryId, children: new Map() };
      for (const child of poi.childPOIs ?? []) {
        if (!root.children.has(String(child.id))) {
          root.children.set(String(child.id), { poi: child, categoryId });
        }
      }
      roots.set(id, root);
    }
  }

  const output: LocalPlace[] = [...audited];
  let matchedAuditedRoots = 0;
  let matchedRegisterRoots = 0;
  let skippedDuplicateChildren = 0;
  let importedRoots = 0;
  let importedChildren = 0;
  const matchedRoots: Array<{ source_id: string; source_name: string; local_id: string; knowledge_level: LocalPlace["knowledgeLevel"] }> = [];
  const skippedChildren: Array<{ source_id: string; source_name: string; local_id: string; knowledge_level: LocalPlace["knowledgeLevel"] }> = [];

  const findExisting = (poi: POI) => output.find((place) => samePlace(place, poi));
  for (const root of roots.values()) {
    const matchedRoot = findExisting(root.poi.raw);
    let rootPlace = matchedRoot;
    const newChildren: LocalPlace[] = [];

    for (const child of root.children.values()) {
      const existingChild = findExisting(child.poi);
      if (existingChild) {
        skippedDuplicateChildren += 1;
        skippedChildren.push({
          source_id: String(child.poi.id),
          source_name: child.poi.name,
          local_id: existingChild.id,
          knowledge_level: existingChild.knowledgeLevel,
        });
        continue;
      }
      // Forelderen opprettes under, men ID-en er deterministisk allerede her.
      const parentId = rootPlace?.parentPlaceId ?? rootPlace?.id ?? registerId(root.poi.name, String(root.poi.id));
      newChildren.push(registerPlace(child.poi, child.categoryId, options.checkedAt, parentId));
    }

    if (!rootPlace) {
      rootPlace = registerPlace(root.poi.raw, root.categoryId, options.checkedAt);
      if (newChildren.length > 0) {
        rootPlace = localPlacesSchema.element.parse({
          ...rootPlace,
          anchorSummary: root.poi.raw.anchorSummary?.trim() || `${newChildren.length} registrerte steder i ${root.poi.name}.`,
          anchorKeepsOwnName: true,
        });
      }
      output.push(rootPlace);
      importedRoots += 1;
    } else {
      if (rootPlace.knowledgeLevel === "audited") matchedAuditedRoots += 1;
      else matchedRegisterRoots += 1;
      matchedRoots.push({
        source_id: String(root.poi.id),
        source_name: root.poi.name,
        local_id: rootPlace.id,
        knowledge_level: rootPlace.knowledgeLevel,
      });
      // Et auditert medlem peker alt på sitt dokumenterte anker. Nye medlemmer
      // skal knyttes dit, ikke gjøre medlemmet til et nytt anker.
      const parentId = rootPlace.parentPlaceId ?? rootPlace.id;
      for (const child of newChildren) child.parentPlaceId = parentId;
    }

    output.push(...newChildren);
    importedChildren += newChildren.length;
  }

  const parsed = localPlacesSchema.parse(output);
  const topLevel = parsed.filter((place) => !place.parentPlaceId);
  const report = {
    schema_version: 1,
    imported_at: options.checkedAt,
    source: `${options.customer}/${options.sourceSlug}/report`,
    radius_km: options.radiusKm,
    center: localBoard.center,
    audited_places_preserved: audited.length,
    source_roots_within_radius: roots.size,
    matched_audited_roots: matchedAuditedRoots,
    matched_register_roots: matchedRegisterRoots,
    imported_register_roots: importedRoots,
    imported_register_children: importedChildren,
    skipped_duplicate_children: skippedDuplicateChildren,
    output_places: parsed.length,
    output_map_anchors: topLevel.length,
    register_places: parsed.filter((place) => place.knowledgeLevel === "register").length,
    matched_roots: matchedRoots,
    skipped_children: skippedChildren,
    write: options.write,
  };

  if (options.write) {
    const registerSource = parsed
      .filter((place) => place.knowledgeLevel === "register")
      .map(compactPlace);
    await writeFile(join(options.dataset, "places.json"), `${JSON.stringify([...auditedSource, ...registerSource], null, 2)}\n`);
    const datasetName = options.dataset.split("/").filter(Boolean).at(-1);
    if (!datasetName) throw new Error(`Kan ikke utlede datasett-ID fra ${options.dataset}.`);
    const reportPath = join("docs/research", `${datasetName}-demo`, "register-import-report.json");
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
