/**
 * Supabase Mutations
 * Write operations for StoryWriter and POI Importer
 */

import { createServerClient } from "./client";
import { ALL_TRUST_FLAGS } from "@/lib/utils/poi-trust";
import type {
  InsertTables,
  Database,
} from "./types";

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
// Types for Story Generation
// ============================================

export interface GeneratedStructure {
  projectPois: string[];
  themeStories: ThemeStoryInsert[];
  themeSections: ThemeSectionInsert[];
  themeSectionPois: ThemeSectionPoiInsert[];
  storySections: StorySectionInsert[];
  sectionPois: SectionPoiInsert[];
}

export interface ThemeStoryInsert {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  bridge_text: string | null;
  sort_order: number;
}

export interface ThemeSectionInsert {
  id: string;
  theme_story_id: string;
  title: string;
  description: string | null;
  sort_order: number;
}

export interface ThemeSectionPoiInsert {
  section_id: string;
  poi_id: string;
  sort_order: number;
}

export interface StorySectionInsert {
  id: string;
  project_id: string;
  type: string;
  title: string | null;
  bridge_text: string | null;
  category_label: string | null;
  theme_story_id: string | null;
  sort_order: number;
}

export interface SectionPoiInsert {
  section_id: string;
  poi_id: string;
  sort_order: number;
}

// ============================================
// Project Operations
// ============================================

/**
 * Create a new project in Supabase
 */
export async function createProject(data: {
  name: string;
  customerId: string;
  urlSlug: string;
  centerLat: number;
  centerLng: number;
  storyTitle?: string;
  storyIntroText?: string;
}): Promise<string> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  const id = crypto.randomUUID();

  const { error } = await supabase.from("projects").insert({
    id,
    name: data.name,
    customer_id: data.customerId,
    url_slug: data.urlSlug,
    center_lat: data.centerLat,
    center_lng: data.centerLng,
    story_title: data.storyTitle || data.name,
    story_intro_text: data.storyIntroText || null,
  });

  if (error) {
    throw new Error(`Kunne ikke opprette prosjekt: ${error.message}`);
  }

  return id;
}

/**
 * Get an existing project by customer and slug
 */
export async function getProjectBySlug(
  customerId: string,
  urlSlug: string
): Promise<{ id: string; name: string; center_lat: number; center_lng: number } | null> {
  const supabase = createServerClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, center_lat, center_lng")
    .eq("customer_id", customerId)
    .eq("url_slug", urlSlug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

// ============================================
// Project-POI Linking
// ============================================

/**
 * Link POIs to a project (replaces existing links)
 */
export async function linkPOIsToProject(
  projectId: string,
  poiIds: string[]
): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  // Delete existing links
  const { error: deleteError } = await supabase
    .from("project_pois")
    .delete()
    .eq("project_id", projectId);

  if (deleteError) {
    throw new Error(`Kunne ikke slette eksisterende POI-koblinger: ${deleteError.message}`);
  }

  // Insert new links
  if (poiIds.length > 0) {
    const inserts = poiIds.map((poiId) => ({
      project_id: projectId,
      poi_id: poiId,
    }));

    const { error: insertError } = await supabase
      .from("project_pois")
      .insert(inserts);

    if (insertError) {
      throw new Error(`Kunne ikke koble POI-er til prosjekt: ${insertError.message}`);
    }
  }
}

// ============================================
// Story Structure Writing
// ============================================

/**
 * Clear existing story structure for a project
 */
async function clearProjectStoryStructure(
  supabase: ReturnType<typeof createServerClient>,
  projectId: string
): Promise<void> {
  if (!supabase) return;

  // Get existing theme story IDs to delete their sections first
  const { data: themeStories } = await supabase
    .from("theme_stories")
    .select("id")
    .eq("project_id", projectId);

  if (themeStories && themeStories.length > 0) {
    const themeStoryIds = themeStories.map((ts) => ts.id);

    // Get section IDs
    const { data: themeSections } = await supabase
      .from("theme_story_sections")
      .select("id")
      .in("theme_story_id", themeStoryIds);

    if (themeSections && themeSections.length > 0) {
      const sectionIds = themeSections.map((s) => s.id);

      // Delete theme section POIs
      await supabase
        .from("theme_section_pois")
        .delete()
        .in("section_id", sectionIds);
    }

    // Delete theme sections
    await supabase
      .from("theme_story_sections")
      .delete()
      .in("theme_story_id", themeStoryIds);
  }

  // Delete theme stories
  await supabase
    .from("theme_stories")
    .delete()
    .eq("project_id", projectId);

  // Get existing story section IDs
  const { data: storySections } = await supabase
    .from("story_sections")
    .select("id")
    .eq("project_id", projectId);

  if (storySections && storySections.length > 0) {
    const sectionIds = storySections.map((s) => s.id);

    // Delete section POIs
    await supabase
      .from("section_pois")
      .delete()
      .in("section_id", sectionIds);
  }

  // Delete story sections
  await supabase
    .from("story_sections")
    .delete()
    .eq("project_id", projectId);
}

/**
 * Write complete story structure to Supabase
 */
export async function writeStoryStructure(
  projectId: string,
  structure: GeneratedStructure
): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  const errors: string[] = [];

  // 1. Link POIs to project
  await linkPOIsToProject(projectId, structure.projectPois);

  // 2. Clear existing story structure
  await clearProjectStoryStructure(supabase, projectId);

  // 3. Insert theme stories
  if (structure.themeStories.length > 0) {
    const { error } = await supabase
      .from("theme_stories")
      .insert(structure.themeStories);

    if (error) {
      errors.push(`theme_stories: ${error.message}`);
    }
  }

  // 4. Insert theme sections
  if (structure.themeSections.length > 0) {
    const { error } = await supabase
      .from("theme_story_sections")
      .insert(structure.themeSections);

    if (error) {
      errors.push(`theme_story_sections: ${error.message}`);
    }
  }

  // 5. Insert theme section POIs
  if (structure.themeSectionPois.length > 0) {
    const { error } = await supabase
      .from("theme_section_pois")
      .insert(structure.themeSectionPois);

    if (error) {
      errors.push(`theme_section_pois: ${error.message}`);
    }
  }

  // 6. Insert story sections
  if (structure.storySections.length > 0) {
    const { error } = await supabase
      .from("story_sections")
      .insert(structure.storySections);

    if (error) {
      errors.push(`story_sections: ${error.message}`);
    }
  }

  // 7. Insert section POIs
  if (structure.sectionPois.length > 0) {
    const { error } = await supabase
      .from("section_pois")
      .insert(structure.sectionPois);

    if (error) {
      errors.push(`section_pois: ${error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Feil ved skriving av story-struktur: ${errors.join("; ")}`);
  }
}

/**
 * Update project story metadata (title, intro text)
 */
export async function updateProjectStoryMetadata(
  projectId: string,
  data: {
    storyTitle?: string;
    storyIntroText?: string;
  }
): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  const updateData: Record<string, string | null> = {};
  if (data.storyTitle !== undefined) {
    updateData.story_title = data.storyTitle;
  }
  if (data.storyIntroText !== undefined) {
    updateData.story_intro_text = data.storyIntroText;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("id", projectId);

  if (error) {
    throw new Error(`Kunne ikke oppdatere prosjekt-metadata: ${error.message}`);
  }
}

// ============================================
// POI Import Operations
// ============================================

/**
 * Upsert categories (simple upsert, no preservation needed)
 */
export async function upsertCategories(
  categories: Array<{ id: string; name: string; icon: string; color: string }>
): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  if (categories.length === 0) return;

  const { error } = await supabase
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
  pois: POIImportData[]
): Promise<POIUpsertResult> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  const result: POIUpsertResult = { inserted: 0, updated: 0, errors: [] };

  if (pois.length === 0) return result;

  // Fetch existing POIs to preserve their editorial content
  const poiIds = pois.map(p => p.id);
  const { data: existingPois, error: fetchError } = await supabase
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
  const { error: upsertError } = await supabase
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
  trustFlags: string[]
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

  const { error } = await supabase
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

/**
 * Update a single POI's tier data.
 * Editorial overwrite policy: only writes editorial_hook/local_insight if existing value is null.
 */
export async function updatePOITier(
  poiId: string,
  data: {
    poi_tier: 1 | 2 | 3;
    tier_reason: string;
    is_chain: boolean;
    is_local_gem: boolean;
    poi_metadata: Record<string, unknown>;
    editorial_hook?: string;
    local_insight?: string;
    editorial_sources?: string[];
  }
): Promise<void> {
  if (data.poi_tier < 1 || data.poi_tier > 3) {
    throw new Error(`POI tier must be 1, 2, or 3, got ${data.poi_tier}`);
  }

  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  // Only write editorial fields if currently null (preserve hand-crafted content)
  const { data: existing } = await supabase
    .from("pois")
    .select("editorial_hook, local_insight, editorial_sources")
    .eq("id", poiId)
    .single();

  const updatePayload: Record<string, unknown> = {
    poi_tier: data.poi_tier,
    tier_reason: data.tier_reason,
    is_chain: data.is_chain,
    is_local_gem: data.is_local_gem,
    poi_metadata: data.poi_metadata,
    tier_evaluated_at: new Date().toISOString(),
  };

  // Editorial overwrite: strict null check (preserve even empty strings)
  if (existing?.editorial_hook === null && data.editorial_hook !== undefined) {
    updatePayload.editorial_hook = data.editorial_hook;
  }
  if (existing?.local_insight === null && data.local_insight !== undefined) {
    updatePayload.local_insight = data.local_insight;
  }
  if (existing?.editorial_sources === null && data.editorial_sources !== undefined) {
    updatePayload.editorial_sources = data.editorial_sources;
  }

  const { error } = await supabase
    .from("pois")
    .update(updatePayload as Record<string, unknown>)
    .eq("id", poiId);

  if (error) {
    throw new Error(`Kunne ikke oppdatere tier for POI ${poiId}: ${error.message}`);
  }
}

// ============================================
// Story Structure Writing with Transaction Support
// ============================================

/**
 * Backup structure for rollback on failure
 */
interface ProjectStructureBackup {
  projectPois: Array<{ project_id: string; poi_id: string }>;
  themeStories: Array<Database["public"]["Tables"]["theme_stories"]["Row"]>;
  themeSections: Array<Database["public"]["Tables"]["theme_story_sections"]["Row"]>;
  themeSectionPois: Array<{ section_id: string; poi_id: string; sort_order: number }>;
  storySections: Array<Database["public"]["Tables"]["story_sections"]["Row"]>;
  sectionPois: Array<{ section_id: string; poi_id: string; sort_order: number }>;
}

/**
 * Backup project structure before destructive operations
 */
async function backupProjectStructure(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string
): Promise<ProjectStructureBackup> {
  // Backup project POIs
  const { data: projectPois } = await supabase
    .from("project_pois")
    .select("*")
    .eq("project_id", projectId);

  // Backup theme stories
  const { data: themeStories } = await supabase
    .from("theme_stories")
    .select("*")
    .eq("project_id", projectId);

  const themeStoryIds = (themeStories || []).map(ts => ts.id);

  // Backup theme sections
  const { data: themeSections } = themeStoryIds.length > 0
    ? await supabase
        .from("theme_story_sections")
        .select("*")
        .in("theme_story_id", themeStoryIds)
    : { data: [] };

  const themeSectionIds = (themeSections || []).map(s => s.id);

  // Backup theme section POIs
  const { data: themeSectionPois } = themeSectionIds.length > 0
    ? await supabase
        .from("theme_section_pois")
        .select("*")
        .in("section_id", themeSectionIds)
    : { data: [] };

  // Backup story sections
  const { data: storySections } = await supabase
    .from("story_sections")
    .select("*")
    .eq("project_id", projectId);

  const storySectionIds = (storySections || []).map(s => s.id);

  // Backup section POIs
  const { data: sectionPois } = storySectionIds.length > 0
    ? await supabase
        .from("section_pois")
        .select("*")
        .in("section_id", storySectionIds)
    : { data: [] };

  return {
    projectPois: projectPois || [],
    themeStories: themeStories || [],
    themeSections: themeSections || [],
    themeSectionPois: themeSectionPois || [],
    storySections: storySections || [],
    sectionPois: sectionPois || [],
  };
}

/**
 * Restore project structure from backup
 */
async function restoreProjectStructure(
  supabase: NonNullable<ReturnType<typeof createServerClient>>,
  projectId: string,
  backup: ProjectStructureBackup
): Promise<void> {
  console.log(`[Mutations] Restoring backup for project ${projectId}...`);

  // Clear any partially written data first
  await clearProjectStoryStructure(supabase, projectId);

  // Restore in order (respecting foreign keys)
  if (backup.projectPois.length > 0) {
    await supabase.from("project_pois").insert(backup.projectPois);
  }

  if (backup.themeStories.length > 0) {
    await supabase.from("theme_stories").insert(backup.themeStories);
  }

  if (backup.themeSections.length > 0) {
    await supabase.from("theme_story_sections").insert(backup.themeSections);
  }

  if (backup.themeSectionPois.length > 0) {
    await supabase.from("theme_section_pois").insert(backup.themeSectionPois);
  }

  if (backup.storySections.length > 0) {
    await supabase.from("story_sections").insert(backup.storySections);
  }

  if (backup.sectionPois.length > 0) {
    await supabase.from("section_pois").insert(backup.sectionPois);
  }

  console.log(`[Mutations] Backup restored for project ${projectId}`);
}

/**
 * Write complete story structure to Supabase with rollback on failure.
 *
 * This is a safer version that backs up existing data before making changes,
 * and restores the backup if any step fails.
 */
export async function writeStoryStructureWithRollback(
  projectId: string,
  structure: GeneratedStructure
): Promise<void> {
  const supabase = createServerClient();
  if (!supabase) {
    throw new Error("Supabase ikke konfigurert");
  }

  // 1. Create backup of current state
  console.log(`[Mutations] Backing up project ${projectId} before write...`);
  const backup = await backupProjectStructure(supabase, projectId);

  try {
    // 2. Perform all write operations
    const errors: string[] = [];

    // Link POIs to project
    await linkPOIsToProject(projectId, structure.projectPois);

    // Clear existing story structure
    await clearProjectStoryStructure(supabase, projectId);

    // Insert theme stories
    if (structure.themeStories.length > 0) {
      const { error } = await supabase
        .from("theme_stories")
        .insert(structure.themeStories);
      if (error) errors.push(`theme_stories: ${error.message}`);
    }

    // Insert theme sections
    if (structure.themeSections.length > 0) {
      const { error } = await supabase
        .from("theme_story_sections")
        .insert(structure.themeSections);
      if (error) errors.push(`theme_story_sections: ${error.message}`);
    }

    // Insert theme section POIs
    if (structure.themeSectionPois.length > 0) {
      const { error } = await supabase
        .from("theme_section_pois")
        .insert(structure.themeSectionPois);
      if (error) errors.push(`theme_section_pois: ${error.message}`);
    }

    // Insert story sections
    if (structure.storySections.length > 0) {
      const { error } = await supabase
        .from("story_sections")
        .insert(structure.storySections);
      if (error) errors.push(`story_sections: ${error.message}`);
    }

    // Insert section POIs
    if (structure.sectionPois.length > 0) {
      const { error } = await supabase
        .from("section_pois")
        .insert(structure.sectionPois);
      if (error) errors.push(`section_pois: ${error.message}`);
    }

    // 3. Check for errors and rollback if needed
    if (errors.length > 0) {
      throw new Error(`Feil ved skriving: ${errors.join("; ")}`);
    }

    console.log(`[Mutations] Story structure written successfully for project ${projectId}`);
  } catch (error) {
    // Rollback to backup
    console.error(`[Mutations] Error writing story structure, rolling back...`, error);
    await restoreProjectStructure(supabase, projectId, backup);
    throw error;
  }
}

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
