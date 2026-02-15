/**
 * Data queries for public SEO pages.
 * Uses ISR-compatible Supabase client (no cache: "no-store").
 */

import { createPublicClient } from "./supabase/public-client";
import { slugify } from "./utils/slugify";
import { isSafeUrl } from "./utils/url";
import type { POI, Category, PlaceKnowledge, KnowledgeTopic, KnowledgeConfidence } from "./types";
import type { DbPlaceKnowledge } from "./supabase/types";
import { MIN_TRUST_SCORE } from "./utils/poi-trust";

/** Validate slug format to prevent PostgREST filter injection */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function isValidSlug(s: string): boolean {
  return SLUG_PATTERN.test(s) && s.length <= 100;
}

// ============================================
// Types
// ============================================

export interface Area {
  id: string;
  nameNo: string;
  nameEn: string;
  slugNo: string;
  slugEn: string;
  descriptionNo: string | null;
  descriptionEn: string | null;
  centerLat: number;
  centerLng: number;
  zoomLevel: number;
  active: boolean;
}

export interface CategorySlug {
  categoryId: string;
  locale: string;
  slug: string;
  seoTitle: string | null;
  seoDescription: string | null;
  introText: string | null;
}

export interface PublicPOI extends POI {
  slug: string;
}

export interface CategoryWithCount {
  id: string;
  name: string;
  icon: string;
  color: string;
  slug: string;
  seoTitle: string | null;
  count: number;
  avgRating: number | null;
}

// ============================================
// Area queries
// ============================================

export async function getAreas(): Promise<Area[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("areas")
    .select("*")
    .eq("active", true)
    .order("name_no");

  if (error) {
    console.error("Error fetching areas:", error);
    return [];
  }

  return (data ?? []).map((a) => ({
    id: a.id,
    nameNo: a.name_no,
    nameEn: a.name_en,
    slugNo: a.slug_no,
    slugEn: a.slug_en,
    descriptionNo: a.description_no,
    descriptionEn: a.description_en,
    centerLat: Number(a.center_lat),
    centerLng: Number(a.center_lng),
    zoomLevel: a.zoom_level ?? 13,
    active: a.active ?? true,
  }));
}

export async function getAreaBySlug(slug: string): Promise<Area | null> {
  if (!isValidSlug(slug)) return null;

  const client = createPublicClient();
  if (!client) return null;

  const { data, error } = await client
    .from("areas")
    .select("*")
    .or(`slug_no.eq.${slug},slug_en.eq.${slug}`)
    .eq("active", true)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    nameNo: data.name_no,
    nameEn: data.name_en,
    slugNo: data.slug_no,
    slugEn: data.slug_en,
    descriptionNo: data.description_no,
    descriptionEn: data.description_en,
    centerLat: Number(data.center_lat),
    centerLng: Number(data.center_lng),
    zoomLevel: data.zoom_level ?? 13,
    active: data.active ?? true,
  };
}

/**
 * Get the area slug for a product's POIs (all POIs in a product share the same area).
 * Accepts a product ID (UUID from the products table).
 * Returns the area's slug_no (e.g. "trondheim") or null if not found.
 */
export async function getAreaSlugForProject(productId: string): Promise<string | null> {
  const client = createPublicClient();
  if (!client) return null;

  // Single query: product_pois → pois → areas via nested joins
  const { data: row } = await client
    .from("product_pois")
    .select("pois(areas(slug_no))")
    .eq("product_id", productId)
    .limit(1)
    .single();

  const slug = (row as { pois: { areas: { slug_no: string } | null } | null } | null)
    ?.pois?.areas?.slug_no;
  return slug ?? null;
}

// ============================================
// Category queries
// ============================================

export async function getCategoriesForArea(
  areaId: string,
  locale: "no" | "en"
): Promise<CategoryWithCount[]> {
  const client = createPublicClient();
  if (!client) return [];

  // Get category slugs for this locale
  const { data: slugs, error: slugError } = await client
    .from("category_slugs")
    .select("category_id, slug, seo_title")
    .eq("locale", locale);

  if (slugError || !slugs) return [];

  // Get categories with POI counts
  const { data: categories, error: catError } = await client
    .from("categories")
    .select("id, name, icon, color");

  if (catError || !categories) return [];

  // Get POI counts per category in this area
  const { data: pois, error: poiError } = await client
    .from("pois")
    .select("category_id, google_rating")
    .eq("area_id", areaId)
    .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`);

  if (poiError) return [];

  const slugMap = new Map(slugs.map((s) => [s.category_id, s]));
  const countMap = new Map<string, { count: number; totalRating: number; ratedCount: number }>();

  for (const poi of pois ?? []) {
    if (!poi.category_id) continue;
    const entry = countMap.get(poi.category_id) ?? { count: 0, totalRating: 0, ratedCount: 0 };
    entry.count++;
    if (poi.google_rating != null && poi.google_rating > 0) {
      entry.totalRating += poi.google_rating;
      entry.ratedCount++;
    }
    countMap.set(poi.category_id, entry);
  }

  return categories
    .filter((cat) => slugMap.has(cat.id) && (countMap.get(cat.id)?.count ?? 0) > 0)
    .map((cat) => {
      const slug = slugMap.get(cat.id)!;
      const counts = countMap.get(cat.id)!;
      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        slug: slug.slug,
        seoTitle: slug.seo_title,
        count: counts.count,
        avgRating: counts.ratedCount > 0 ? Math.round((counts.totalRating / counts.ratedCount) * 10) / 10 : null,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export async function getCategoryBySlug(
  slug: string,
  locale: "no" | "en"
): Promise<{ categoryId: string; seoTitle: string | null; seoDescription: string | null; introText: string | null } | null> {
  if (!isValidSlug(slug)) return null;

  const client = createPublicClient();
  if (!client) return null;

  const { data, error } = await client
    .from("category_slugs")
    .select("category_id, seo_title, seo_description, intro_text")
    .eq("slug", slug)
    .eq("locale", locale)
    .single();

  if (error || !data) return null;

  return {
    categoryId: data.category_id,
    seoTitle: data.seo_title,
    seoDescription: data.seo_description,
    introText: data.intro_text,
  };
}

// ============================================
// POI queries
// ============================================

function transformPublicPOI(dbPoi: Record<string, unknown>, category: Category): PublicPOI {
  return {
    id: dbPoi.id as string,
    name: dbPoi.name as string,
    coordinates: {
      lat: dbPoi.lat as number,
      lng: dbPoi.lng as number,
    },
    address: (dbPoi.address as string) ?? undefined,
    category,
    description: (dbPoi.description as string) ?? undefined,
    featuredImage: (dbPoi.featured_image as string) ?? undefined,
    googlePlaceId: (dbPoi.google_place_id as string) ?? undefined,
    googleRating: (dbPoi.google_rating as number) ?? undefined,
    googleReviewCount: (dbPoi.google_review_count as number) ?? undefined,
    googleMapsUrl: (dbPoi.google_maps_url as string) ?? undefined,
    photoReference: (dbPoi.photo_reference as string) ?? undefined,
    editorialHook: (dbPoi.editorial_hook as string) ?? undefined,
    localInsight: (dbPoi.local_insight as string) ?? undefined,
    poiTier: (dbPoi.poi_tier as 1 | 2 | 3 | null) ?? undefined,
    tierReason: (dbPoi.tier_reason as string) ?? undefined,
    isChain: (dbPoi.is_chain as boolean) ?? undefined,
    isLocalGem: (dbPoi.is_local_gem as boolean) ?? undefined,
    googleWebsite: (dbPoi.google_website as string) ?? undefined,
    googlePhone: (dbPoi.google_phone as string) ?? undefined,
    openingHoursJson: (dbPoi.opening_hours_json as { weekday_text?: string[] }) ?? undefined,
    slug: slugify(dbPoi.name as string),
  };
}

export async function getPOIsForCategory(
  areaId: string,
  categoryId: string
): Promise<PublicPOI[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("pois")
    .select("*, categories!inner(id, name, icon, color)")
    .eq("area_id", areaId)
    .eq("category_id", categoryId)
    .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`)
    .order("poi_tier", { ascending: true, nullsFirst: false })
    .order("google_rating", { ascending: false, nullsFirst: true });

  if (error || !data) return [];

  return data.map((poi) => {
    const cat = poi.categories as unknown as { id: string; name: string; icon: string; color: string };
    return transformPublicPOI(poi, {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    });
  });
}

export async function getPOIBySlug(
  areaId: string,
  poiSlug: string
): Promise<PublicPOI | null> {
  if (!isValidSlug(poiSlug)) return null;

  const client = createPublicClient();
  if (!client) return null;

  // We need to find by generated slug — query all POIs and match
  // In production, consider adding a slug column to avoid this
  const { data, error } = await client
    .from("pois")
    .select("*, categories!inner(id, name, icon, color)")
    .eq("area_id", areaId)
    .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`);

  if (error || !data) return null;

  for (const poi of data) {
    if (slugify(poi.name) === poiSlug) {
      const cat = poi.categories as unknown as { id: string; name: string; icon: string; color: string };
      return transformPublicPOI(poi, {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
      });
    }
  }

  return null;
}

export async function getHighlightPOIs(
  areaId: string,
  limit = 12
): Promise<PublicPOI[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("pois")
    .select("*, categories!inner(id, name, icon, color)")
    .eq("area_id", areaId)
    .eq("poi_tier", 1)
    .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`)
    .order("google_rating", { ascending: false, nullsFirst: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map((poi) => {
    const cat = poi.categories as unknown as { id: string; name: string; icon: string; color: string };
    return transformPublicPOI(poi, {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    });
  });
}

export async function getCuratedPOIs(
  areaId: string,
  options: {
    categoryId?: string | null;
    categoryIds?: string[];
    tier?: 1;
    bbox?: [number, number, number, number];
    limit?: number;
  }
): Promise<PublicPOI[]> {
  const client = createPublicClient();
  if (!client) return [];

  let query = client
    .from("pois")
    .select("*, categories!inner(id, name, icon, color)")
    .eq("area_id", areaId)
    .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`);

  if (options.categoryIds?.length) {
    query = query.in("category_id", options.categoryIds);
  } else if (options.categoryId != null) {
    query = query.eq("category_id", options.categoryId);
  }
  if (options.tier) {
    query = query.eq("poi_tier", options.tier);
  }
  if (options.bbox) {
    const [south, west, north, east] = options.bbox;
    if ([south, west, north, east].every(Number.isFinite)) {
      query = query
        .gte("lat", south)
        .lte("lat", north)
        .gte("lng", west)
        .lte("lng", east);
    }
  }

  query = query
    .order("poi_tier", { ascending: true, nullsFirst: false })
    .order("google_rating", { ascending: false, nullsFirst: true });

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error || !data) return [];

  return data.map((poi) => {
    const cat = poi.categories as unknown as { id: string; name: string; icon: string; color: string };
    return transformPublicPOI(poi, {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    });
  });
}

export async function getSimilarPOIs(
  areaId: string,
  categoryId: string,
  excludePoiId: string,
  limit = 6
): Promise<PublicPOI[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("pois")
    .select("*, categories!inner(id, name, icon, color)")
    .eq("area_id", areaId)
    .eq("category_id", categoryId)
    .neq("id", excludePoiId)
    .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`)
    .order("poi_tier", { ascending: true, nullsFirst: false })
    .order("google_rating", { ascending: false, nullsFirst: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map((poi) => {
    const cat = poi.categories as unknown as { id: string; name: string; icon: string; color: string };
    return transformPublicPOI(poi, {
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: cat.color,
    });
  });
}

// ============================================
// Place Knowledge queries (public — RLS enforced)
// ============================================

function transformPlaceKnowledge(row: DbPlaceKnowledge): PlaceKnowledge {
  return {
    id: row.id,
    poiId: row.poi_id ?? undefined,
    areaId: row.area_id ?? undefined,
    topic: row.topic as KnowledgeTopic,
    factText: row.fact_text,
    factTextEn: row.fact_text_en ?? undefined,
    structuredData: (row.structured_data as Record<string, unknown>) ?? undefined,
    confidence: row.confidence as KnowledgeConfidence,
    sourceUrl: row.source_url && isSafeUrl(row.source_url) ? row.source_url : undefined,
    sourceName: row.source_name ?? undefined,
    sortOrder: row.sort_order ?? 0,
    displayReady: row.display_ready === true,
    verifiedAt: row.verified_at ?? undefined,
  };
}

/** Fetch all display-ready knowledge for a POI. */
export async function getPlaceKnowledge(poiId: string): Promise<PlaceKnowledge[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("place_knowledge")
    .select("*")
    .eq("poi_id", poiId)
    .eq("display_ready", true)
    .order("sort_order")
    .order("created_at");

  if (error || !data) return [];
  return data.map(transformPlaceKnowledge);
}

/** Batch-fetch knowledge for multiple POIs (max 100 IDs). */
export async function getPlaceKnowledgeBatch(
  poiIds: string[]
): Promise<Record<string, PlaceKnowledge[]>> {
  if (poiIds.length === 0) return {};
  const limitedIds = poiIds.slice(0, 100);

  const client = createPublicClient();
  if (!client) return {};

  const { data, error } = await client
    .from("place_knowledge")
    .select("*")
    .in("poi_id", limitedIds)
    .eq("display_ready", true)
    .order("sort_order");

  if (error || !data) return {};

  const result: Record<string, PlaceKnowledge[]> = {};
  for (const row of data) {
    const id = row.poi_id as string;
    if (!result[id]) result[id] = [];
    result[id].push(transformPlaceKnowledge(row));
  }
  return result;
}

/** Fetch knowledge for an area (city/neighborhood). */
export async function getAreaKnowledge(areaId: string): Promise<PlaceKnowledge[]> {
  const client = createPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("place_knowledge")
    .select("*")
    .eq("area_id", areaId)
    .eq("display_ready", true)
    .order("sort_order")
    .order("created_at");

  if (error || !data) return [];
  return data.map(transformPlaceKnowledge);
}
