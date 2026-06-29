/**
 * Hydrerer rapport-produktet etter at alle POI-er er importert:
 * 1. Linker project_pois → product_pois
 * 2. Scorer og markerer featured (topp 3 per kategori, maks 1500 m)
 * 3. Sletter + re-inserts product_categories med display_order
 *
 * Rekkefølge-krav: featured SETTES SIST (etter all filtrering/linking).
 */

import { createServerClient } from "@/lib/supabase/client";
import { REPORT_THEME_DEFAULTS } from "@/lib/pipeline/report-defaults";

// ── Haversine ─────────────────────────────────────────────────────────────

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Scoring ───────────────────────────────────────────────────────────────

const INSTITUTIONAL_CATEGORIES = new Set(["skole", "barnehage", "idrett"]);
const FEATURED_MAX_DISTANCE_M = 1500;
const FEATURED_TOP_N = 3;

function scorePoi(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  rating: number | null,
  reviewCount: number | null,
  categoryId: string
): number {
  const isInstitutional = INSTITUTIONAL_CATEGORIES.has(categoryId);
  const r = isInstitutional ? 4.0 : (rating ?? 0);
  const rc = isInstitutional ? 10 : (reviewCount ?? 0);
  const reviewWeight = Math.min(rc / 50, 1.0);
  const walkMin = haversineMeters(centerLat, centerLng, lat, lng) / 80;
  const proximityBonus = Math.max(0, (15 - walkMin) / 15) * 0.5;
  return r * reviewWeight + proximityBonus;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface HydrateReportResult {
  productPoisLinked: number;
  featuredMarked: number;
  categoriesPopulated: number;
  warnings: string[];
}

// ── Hoved-funksjon ────────────────────────────────────────────────────────

export async function hydrateReport(options: {
  projectId: string;
  productId: string;
  centerLat: number;
  centerLng: number;
}): Promise<HydrateReportResult> {
  const baseClient = createServerClient();
  if (!baseClient) {
    throw new Error("Supabase ikke konfigurert");
  }
  // v2-skrivesti (PRD 3 / r03.6 AC8): product_pois/product_categories-hydrering +
  // POI-les går mot v2. v2-typene (r01.6) lar as-any-castene fjernes.
  const db = baseClient.schema("v2");

  const { projectId, productId, centerLat, centerLng } = options;
  const warnings: string[] = [];

  // 1. Hent alle POI-er koblet til prosjektet
  const { data: projectPois, error: ppError } = await db
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", projectId);

  if (ppError) throw new Error(`Henting av project_pois feilet: ${ppError.message}`);
  if (!projectPois || projectPois.length === 0) {
    warnings.push("⚠️  Ingen POI-er koblet til prosjektet ennå");
    return { productPoisLinked: 0, featuredMarked: 0, categoriesPopulated: 0, warnings };
  }

  const poiIds = projectPois.map((p) => p.poi_id);

  // 2. Slett eksisterende product_pois og re-insert fra project_pois (ren re-hydrering)
  await db.from("product_pois").delete().eq("product_id", productId);

  // featured settes SIST (batch nedenfor) — ved re-link er alle false. v2.product_pois
  // .featured er NOT NULL uten default (baseline 070:311) → eksplisitt false.
  const productPoiRows = poiIds.map((poi_id) => ({
    product_id: productId,
    poi_id,
    featured: false,
  }));
  const { error: linkError } = await db
    .from("product_pois")
    .insert(productPoiRows);
  if (linkError) throw new Error(`product_pois linking feilet: ${linkError.message}`);

  // 3. Hent POI-data for scoring
  const { data: poisData, error: poisError } = await db
    .from("pois")
    .select("id, category_id, lat, lng, google_rating, google_review_count")
    .in("id", poiIds);

  if (poisError) throw new Error(`Henting av poi-data feilet: ${poisError.message}`);

  // 4. Featured-scoring: topp 3 per kategori innenfor 1500 m — SETTES SIST
  const categoryMap: Record<string, string[]> = {};
  for (const theme of REPORT_THEME_DEFAULTS) {
    for (const cat of theme.categories) {
      categoryMap[cat] = categoryMap[cat] ?? [];
    }
  }

  const poiScores: Array<{
    id: string;
    categoryId: string;
    score: number;
    distM: number;
  }> = [];

  for (const poi of poisData ?? []) {
    if (!poi.lat || !poi.lng || !poi.category_id) continue;
    const distM = haversineMeters(centerLat, centerLng, poi.lat, poi.lng);
    if (distM > FEATURED_MAX_DISTANCE_M) continue;

    poiScores.push({
      id: poi.id,
      categoryId: poi.category_id,
      score: scorePoi(
        poi.lat,
        poi.lng,
        centerLat,
        centerLng,
        poi.google_rating,
        poi.google_review_count,
        poi.category_id
      ),
      distM,
    });
  }

  // Grupper per kategori, velg topp N
  const byCategory: Record<string, typeof poiScores> = {};
  for (const p of poiScores) {
    byCategory[p.categoryId] = byCategory[p.categoryId] ?? [];
    byCategory[p.categoryId].push(p);
  }

  const featuredIds: string[] = [];
  for (const catPois of Object.values(byCategory)) {
    catPois.sort((a, b) => b.score - a.score);
    featuredIds.push(...catPois.slice(0, FEATURED_TOP_N).map((p) => p.id));
  }

  // Marker featured — ÉN batch-oppdatering (AC4), ikke per-POI-løkke
  let featuredMarked = 0;
  if (featuredIds.length > 0) {
    const { error: featError } = await db
      .from("product_pois")
      .update({ featured: true })
      .eq("product_id", productId)
      .in("poi_id", featuredIds);
    if (featError) {
      warnings.push(`⚠️  Kunne ikke markere featured: ${featError.message}`);
    } else {
      featuredMarked = featuredIds.length;
    }
  }

  // 5. product_categories — slett eksisterende, re-insert med display_order
  const uniqueCategoryIds = Array.from(
    new Set((poisData ?? []).map((p) => p.category_id).filter(Boolean))
  ) as string[];

  // Display_order basert på tema-rekkefølge i REPORT_THEME_DEFAULTS
  const themeOrder = REPORT_THEME_DEFAULTS.flatMap((t) => t.categories);

  const categoryRows = uniqueCategoryIds
    .map((cat_id) => ({
      product_id: productId,
      category_id: cat_id,
      display_order: themeOrder.indexOf(cat_id) >= 0 ? themeOrder.indexOf(cat_id) : 999,
    }))
    .sort((a, b) => a.display_order - b.display_order);

  await db.from("product_categories").delete().eq("product_id", productId);

  if (categoryRows.length > 0) {
    const { error: catError } = await db
      .from("product_categories")
      .insert(categoryRows);
    if (catError) {
      throw new Error(`product_categories insert feilet: ${catError.message}`);
    }
  } else {
    warnings.push("⚠️  Ingen kategorier — product_categories er tom (0 av 0 steder)");
  }

  return {
    productPoisLinked: poiIds.length,
    featuredMarked,
    categoriesPopulated: categoryRows.length,
    warnings,
  };
}
