/**
 * StoryWriter Module
 * Generates story structure from existing POIs in Supabase
 */

import type { DbPoi, DbCategory } from "@/lib/supabase/types";
import type { DiscoveredPOI } from "./poi-discovery";
import { generateStoryStructure, DEFAULT_THEMES, type StoryGeneratorConfig, type ThemeConfig } from "./story-structure";
import type {
  GeneratedStructure,
  ThemeStoryInsert,
  ThemeSectionInsert,
  ThemeSectionPoiInsert,
  StorySectionInsert,
  SectionPoiInsert,
} from "@/lib/supabase/mutations";

// ============================================
// POI Transformers
// ============================================

/**
 * Determine POI source based on available IDs
 */
function determineSource(poi: DbPoi): DiscoveredPOI["source"] {
  if (poi.google_place_id) return "google";
  if (poi.entur_stopplace_id) return "entur";
  if (poi.bysykkel_station_id) return "bysykkel";
  if (poi.nsr_id) return "nsr";
  if (poi.barnehagefakta_id) return "barnehagefakta";
  if (poi.osm_id) return "osm";
  return "manual";
}

/**
 * Transform database POI to DiscoveredPOI format for use with story-structure.ts
 */
export function dbPoiToDiscoveredPOI(
  dbPoi: DbPoi,
  category: DbCategory | null
): DiscoveredPOI {
  const defaultCategory = {
    id: "unknown",
    name: "Ukjent",
    icon: "MapPin",
    color: "#6b7280",
  };

  return {
    id: dbPoi.id,
    name: dbPoi.name,
    coordinates: {
      lat: dbPoi.lat,
      lng: dbPoi.lng,
    },
    address: dbPoi.address ?? undefined,
    category: category
      ? {
          id: category.id,
          name: category.name,
          icon: category.icon,
          color: category.color,
        }
      : defaultCategory,
    googlePlaceId: dbPoi.google_place_id ?? undefined,
    googleRating: dbPoi.google_rating ?? undefined,
    googleReviewCount: dbPoi.google_review_count ?? undefined,
    source: determineSource(dbPoi),
    enturStopplaceId: dbPoi.entur_stopplace_id ?? undefined,
    bysykkelStationId: dbPoi.bysykkel_station_id ?? undefined,
    editorialHook: dbPoi.editorial_hook ?? undefined,
    localInsight: dbPoi.local_insight ?? undefined,
  };
}

/**
 * Transform array of database POIs with categories to DiscoveredPOI format
 */
export function transformDbPoisToDiscovered(
  poisWithCategories: Array<{ poi: DbPoi; category: DbCategory | null }>
): DiscoveredPOI[] {
  return poisWithCategories.map(({ poi, category }) =>
    dbPoiToDiscoveredPOI(poi, category)
  );
}

// ============================================
// Story Structure Generation
// ============================================

/**
 * Default theme configurations to use if none provided
 */
export const STORY_WRITER_DEFAULT_THEMES: ThemeConfig[] = [
  { id: "mat-drikke", title: "Mat & Drikke" },
  { id: "transport", title: "Transport & Mobilitet" },
  { id: "trening-helse", title: "Trening & Helse" },
  { id: "daglig-liv", title: "Daglige Ærender" },
];

/**
 * Transform story-structure output to Supabase-compatible format
 */
function transformToSupabaseStructure(
  projectId: string,
  story: ReturnType<typeof generateStoryStructure>["story"],
  pois: DiscoveredPOI[]
): GeneratedStructure {
  const themeStories: ThemeStoryInsert[] = [];
  const themeSections: ThemeSectionInsert[] = [];
  const themeSectionPois: ThemeSectionPoiInsert[] = [];
  const storySections: StorySectionInsert[] = [];
  const sectionPois: SectionPoiInsert[] = [];

  // Collect all POI IDs used in the story
  const usedPoiIds = new Set<string>();

  // Transform theme stories
  story.themeStories.forEach((ts, tsIndex) => {
    const themeStoryId = crypto.randomUUID();

    themeStories.push({
      id: themeStoryId,
      project_id: projectId,
      slug: ts.slug,
      title: ts.title,
      bridge_text: ts.bridgeText ?? null,
      sort_order: tsIndex,
    });

    // Transform theme sections
    ts.sections.forEach((section, secIndex) => {
      const sectionId = crypto.randomUUID();

      themeSections.push({
        id: sectionId,
        theme_story_id: themeStoryId,
        title: section.title,
        description: section.description ?? null,
        sort_order: secIndex,
      });

      // Transform theme section POIs
      section.pois.forEach((poiId, poiIndex) => {
        themeSectionPois.push({
          section_id: sectionId,
          poi_id: poiId,
          sort_order: poiIndex,
        });
        usedPoiIds.add(poiId);
      });
    });
  });

  // Transform main story sections
  story.sections.forEach((section, secIndex) => {
    const sectionId = crypto.randomUUID();

    // Find matching theme story ID if this is a theme_story_cta
    let linkedThemeStoryId: string | null = null;
    if (section.themeStoryId) {
      const matchingThemeStory = themeStories.find(
        (ts) => ts.slug === section.themeStoryId
      );
      linkedThemeStoryId = matchingThemeStory?.id ?? null;
    }

    storySections.push({
      id: sectionId,
      project_id: projectId,
      type: section.type,
      title: section.title ?? null,
      bridge_text: section.bridgeText ?? null,
      category_label: section.categoryLabel ?? null,
      theme_story_id: linkedThemeStoryId,
      sort_order: secIndex,
    });

    // Transform section POIs
    if (section.pois) {
      section.pois.forEach((poiId, poiIndex) => {
        sectionPois.push({
          section_id: sectionId,
          poi_id: poiId,
          sort_order: poiIndex,
        });
        usedPoiIds.add(poiId);
      });
    }
  });

  // All POIs that are used should be linked to the project
  const projectPois = Array.from(usedPoiIds);

  return {
    projectPois,
    themeStories,
    themeSections,
    themeSectionPois,
    storySections,
    sectionPois,
  };
}

// ============================================
// Main StoryWriter Function
// ============================================

export interface StoryWriterInput {
  projectId: string;
  projectName: string;
  pois: Array<{ poi: DbPoi; category: DbCategory | null }>;
  themes?: ThemeConfig[];
  maxPOIsPerSection?: number;
  featuredPOIsInMainStory?: number;
}

export interface StoryWriterResult {
  structure: GeneratedStructure;
  stats: {
    totalPois: number;
    themeCount: number;
    sectionCount: number;
  };
}

/**
 * Generate story structure from database POIs
 * Main entry point for StoryWriter
 */
export function generateStoryForProject(
  input: StoryWriterInput
): StoryWriterResult {
  // Transform DB POIs to DiscoveredPOI format
  const discoveredPois = transformDbPoisToDiscovered(input.pois);

  // Configure story generation
  const config: StoryGeneratorConfig = {
    projectName: input.projectName,
    themes: input.themes || STORY_WRITER_DEFAULT_THEMES,
    maxPOIsPerSection: input.maxPOIsPerSection || 10,
    featuredPOIsInMainStory: input.featuredPOIsInMainStory || 3,
  };

  // Generate story structure using existing logic
  const { story, allCategories, missingEditorialHooks } = generateStoryStructure(
    discoveredPois,
    config
  );

  // Transform to Supabase format
  const structure = transformToSupabaseStructure(
    input.projectId,
    story,
    discoveredPois
  );

  return {
    structure,
    stats: {
      totalPois: structure.projectPois.length,
      themeCount: structure.themeStories.length,
      sectionCount: structure.storySections.length,
    },
  };
}

/**
 * Generate intro text for a story
 */
export function generateIntroText(projectName: string, poiCount: number): string {
  return `Oppdag nabolaget rundt ${projectName}. Med ${poiCount} steder innen gangavstand har du alt du trenger for hverdagen – og mer til.`;
}
