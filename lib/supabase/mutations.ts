/**
 * Supabase Mutations
 * Skriveoperasjoner for POI-import (pipeline/admin), trust-validering og
 * collections. Story-generator-æraens skrivefunksjoner (writeStoryStructure
 * m.fl.) døde ved cutover-trimmen 2026-07-06.
 */

import { createServerClient } from "./client";
import { ALL_TRUST_FLAGS } from "@/lib/utils/poi-trust";

// ============================================
// Types for POI Import
// ============================================

/**
 * Fields that are imported from external sources (can be updated)
 */
export interface POIImportData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  category_id: string | null;
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_maps_url: string | null;
  photo_reference: string | null;
  entur_stopplace_id: string | null;
  bysykkel_station_id: string | null;
  hyre_station_id: string | null;
  trust_score: number | null;
  trust_flags: string[];
  trust_score_updated_at: string | null;
  google_website: string | null;
  google_business_status: string | null;
  google_price_level: number | null;
  source?: string | null;
  nsr_id?: string | null;
  barnehagefakta_id?: string | null;
  osm_id?: string | null;
}

/**
 * Editorial fields that should be preserved during re-imports
 */
interface EditorialFields {
  editorial_hook: string | null;
  local_insight: string | null;
  story_priority: "must_have" | "nice_to_have" | "filler" | null;
  editorial_sources: string[] | null;
  featured_image: string | null;
  description: string | null;
}

/**
 * Trust fields that should be preserved during re-imports
 */
interface TrustFields {
  trust_score: number | null;
  trust_flags: string[];
  trust_score_updated_at: string | null;
  google_website: string | null;
  google_business_status: string | null;
  google_price_level: number | null;
}

/**
 * Tier fields that should be preserved during re-imports
 */
interface TierFields {
  poi_tier: 1 | 2 | 3 | null;
  tier_reason: string | null;
  is_chain: boolean;
  is_local_gem: boolean;
  poi_metadata: Record<string, unknown>;
  tier_evaluated_at: string | null;
}

export interface POIUpsertResult {
  inserted: number;
  updated: number;
  errors: string[];
}

// ============================================
// POI Import Operations
// ============================================

/**
 * Upsert categories (simple upsert, no preservation needed)
 */
export async function upsertCategories(
  categories: Array<{ id: string; name: string; icon: string; color: string }>,
  opts: { schema?: "public" | "v2" } = {}
): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  if (categories.length === 0) return;

  // v2-skrivesti (PRD 3): provision-pipelinen sender schema:"v2"; legacy-kallere
  // (admin-import-route) bruker default "public" og er uberørt. v2 og public har
  // identisk tabell-form (paritet, PRD 1) → den scopede klienten castes til
  // public-typen så .from() typer entydig; runtime treffer valgt schema.
  const db =
    opts.schema === "v2"
      ? (supabase.schema("v2") as unknown as typeof supabase)
      : supabase;
  const { error } = await db
    .from("categories")
    .upsert(categories, { onConflict: "id" });

  if (error) {
    throw new Error(`Kunne ikke upserte kategorier: ${error.message}`);
  }
}

/**
 * Upsert POIs while preserving existing editorial content.
 *
 * This function implements a fetch-merge-upsert pattern:
 * 1. Fetch existing editorial fields for POIs that already exist
 * 2. Merge: keep existing editorial values, update import data
 * 3. Upsert the merged data
 *
 * Editorial fields preserved: editorial_hook, local_insight, story_priority,
 * editorial_sources, featured_image, description
 */
export async function upsertPOIsWithEditorialPreservation(
  pois: POIImportData[],
  opts: { schema?: "public" | "v2" } = {}
): Promise<POIUpsertResult> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  const result: POIUpsertResult = { inserted: 0, updated: 0, errors: [] };

  if (pois.length === 0) return result;

  // v2-skrivesti (PRD 3): provision-pipelinen sender schema:"v2"; legacy-kallere
  // (admin-import-route) bruker default "public" og er uberørt. v2 og public har
  // identisk tabell-form (paritet, PRD 1) → den scopede klienten castes til
  // public-typen så .from() typer entydig; runtime treffer valgt schema.
  const db =
    opts.schema === "v2"
      ? (supabase.schema("v2") as unknown as typeof supabase)
      : supabase;

  // Fetch existing POIs to preserve their editorial content
  const poiIds = pois.map(p => p.id);
  const { data: existingPois, error: fetchError } = await db
    .from("pois")
    .select("id, editorial_hook, local_insight, story_priority, editorial_sources, featured_image, description, trust_score, trust_flags, trust_score_updated_at, google_website, google_business_status, google_price_level, poi_tier, tier_reason, is_chain, is_local_gem, poi_metadata, tier_evaluated_at")
    .in("id", poiIds);

  if (fetchError) {
    result.errors.push(`Kunne ikke hente eksisterende POI-er: ${fetchError.message}`);
    return result;
  }

  // Create lookup map for existing editorial + trust content
  const existingMap = new Map<string, EditorialFields & TrustFields & TierFields>(
    (existingPois || []).map(poi => [poi.id, {
      editorial_hook: poi.editorial_hook,
      local_insight: poi.local_insight,
      story_priority: poi.story_priority,
      editorial_sources: poi.editorial_sources,
      featured_image: poi.featured_image,
      description: poi.description,
      trust_score: poi.trust_score,
      trust_flags: poi.trust_flags,
      trust_score_updated_at: poi.trust_score_updated_at,
      google_website: poi.google_website,
      google_business_status: poi.google_business_status,
      google_price_level: poi.google_price_level,
      poi_tier: poi.poi_tier as 1 | 2 | 3 | null,
      tier_reason: poi.tier_reason as string | null,
      is_chain: poi.is_chain as boolean,
      is_local_gem: poi.is_local_gem as boolean,
      poi_metadata: (poi.poi_metadata ?? {}) as Record<string, unknown>,
      tier_evaluated_at: poi.tier_evaluated_at as string | null,
    }])
  );

  // Merge import data with existing editorial content
  const mergedPois = pois.map(poi => {
    const existing = existingMap.get(poi.id);
    return {
      ...poi,
      // Preserve existing editorial fields, or null for new POIs
      editorial_hook: existing?.editorial_hook ?? null,
      local_insight: existing?.local_insight ?? null,
      story_priority: existing?.story_priority ?? null,
      editorial_sources: existing?.editorial_sources ?? null,
      featured_image: existing?.featured_image ?? null,
      description: existing?.description ?? null,
      // Preserve existing trust fields
      trust_score: poi.trust_score ?? existing?.trust_score ?? null,
      trust_flags: poi.trust_flags ?? existing?.trust_flags ?? [],
      trust_score_updated_at: poi.trust_score_updated_at ?? existing?.trust_score_updated_at ?? null,
      google_website: poi.google_website ?? existing?.google_website ?? null,
      google_business_status: poi.google_business_status ?? existing?.google_business_status ?? null,
      google_price_level: poi.google_price_level ?? existing?.google_price_level ?? null,
      // Preserve existing tier fields
      poi_tier: existing?.poi_tier ?? null,
      tier_reason: existing?.tier_reason ?? null,
      is_chain: existing?.is_chain ?? false,
      is_local_gem: existing?.is_local_gem ?? false,
      poi_metadata: existing?.poi_metadata ?? {},
      tier_evaluated_at: existing?.tier_evaluated_at ?? null,
    };
  });

  // Upsert merged data
  const { error: upsertError } = await db
    .from("pois")
    .upsert(mergedPois, { onConflict: "id" });

  if (upsertError) {
    result.errors.push(`Upsert feilet: ${upsertError.message}`);
    return result;
  }

  // Count inserts vs updates
  for (const poi of pois) {
    if (existingMap.has(poi.id)) {
      result.updated++;
    } else {
      result.inserted++;
    }
  }

  return result;
}

// ============================================
// Trust Score Operations
// ============================================

/** Allowed trust flag values — derived from single source of truth in poi-trust.ts */
const VALID_TRUST_FLAGS = new Set<string>(ALL_TRUST_FLAGS);

/**
 * Update a single POI's trust score and flags.
 * Used by the validation pipeline after Layer 1-3 checks.
 */
export async function updatePOITrustScore(
  poiId: string,
  trustScore: number,
  trustFlags: string[],
  opts: { schema?: "public" | "v2" } = {}
): Promise<void> {
  // Validate score range
  if (trustScore < 0 || trustScore > 1) {
    throw new Error(`Trust score must be 0.0-1.0, got ${trustScore}`);
  }

  // Validate flag values
  for (const flag of trustFlags) {
    if (!VALID_TRUST_FLAGS.has(flag)) {
      throw new Error(`Invalid trust flag: ${flag}`);
    }
  }

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  // v2-skrivesti (PRD 3): scoring-write går mot v2; legacy-kallere (admin trust-
  // validate-route) bruker default "public" og er uberørt. v2/public paritet → cast.
  const db =
    opts.schema === "v2"
      ? (supabase.schema("v2") as unknown as typeof supabase)
      : supabase;

  const { error } = await db
    .from("pois")
    .update({
      trust_score: trustScore,
      trust_flags: trustFlags,
      trust_score_updated_at: new Date().toISOString(),
    })
    .eq("id", poiId);

  if (error) {
    throw new Error(`Kunne ikke oppdatere trust score for POI ${poiId}: ${error.message}`);
  }
}

// ============================================
// POI Tier Operations
// ============================================

// ============================================
// Collection Operations
// ============================================

/**
 * Create a new collection in Supabase
 */
export async function createCollection(data: {
  slug: string;
  projectId: string;
  poiIds: string[];
  email?: string;
}): Promise<{ id: string; slug: string }> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  const { data: row, error } = await supabase
    .from("collections")
    .insert({
      slug: data.slug,
      project_id: data.projectId,
      poi_ids: data.poiIds,
      email: data.email || null,
    })
    .select("id, slug")
    .single();

  if (error || !row) {
    throw new Error(`Kunne ikke opprette samling: ${error?.message}`);
  }

  return { id: row.id, slug: row.slug };
}
