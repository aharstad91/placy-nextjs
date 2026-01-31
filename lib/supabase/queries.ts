import { supabase, isSupabaseConfigured, createServerClient } from "./client";
import type {
  DbCategory,
  DbPoi,
  DbProject,
  DbThemeStory,
  DbStorySection,
  DbThemeStorySection,
} from "./types";
import type {
  Project,
  POI,
  Category,
  ThemeStory,
  ThemeStorySection,
  StorySection,
  Story,
} from "../types";
import { calculateDistance, calculateBoundingBox } from "../utils/geo";

// ============================================
// Type Transformers
// ============================================

function transformCategory(dbCategory: DbCategory): Category {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    icon: dbCategory.icon,
    color: dbCategory.color,
  };
}

function transformPOI(
  dbPoi: DbPoi,
  category: Category | undefined
): POI {
  return {
    id: dbPoi.id,
    name: dbPoi.name,
    coordinates: {
      lat: dbPoi.lat,
      lng: dbPoi.lng,
    },
    address: dbPoi.address ?? undefined,
    category: category ?? {
      id: "unknown",
      name: "Ukjent",
      icon: "MapPin",
      color: "#6b7280",
    },
    description: dbPoi.description ?? undefined,
    featuredImage: dbPoi.featured_image ?? undefined,
    googlePlaceId: dbPoi.google_place_id ?? undefined,
    googleRating: dbPoi.google_rating ?? undefined,
    googleReviewCount: dbPoi.google_review_count ?? undefined,
    googleMapsUrl: dbPoi.google_maps_url ?? undefined,
    photoReference: dbPoi.photo_reference ?? undefined,
    editorialHook: dbPoi.editorial_hook ?? undefined,
    localInsight: dbPoi.local_insight ?? undefined,
    storyPriority: dbPoi.story_priority ?? undefined,
    editorialSources: dbPoi.editorial_sources ?? undefined,
    enturStopplaceId: dbPoi.entur_stopplace_id ?? undefined,
    bysykkelStationId: dbPoi.bysykkel_station_id ?? undefined,
    hyreStationId: dbPoi.hyre_station_id ?? undefined,
  };
}

function transformThemeStorySection(
  dbSection: DbThemeStorySection,
  poiIds: string[]
): ThemeStorySection {
  return {
    id: dbSection.id,
    title: dbSection.title,
    description: dbSection.description ?? undefined,
    images: dbSection.images ?? undefined,
    pois: poiIds,
  };
}

function transformThemeStory(
  dbThemeStory: DbThemeStory,
  sections: ThemeStorySection[]
): ThemeStory {
  return {
    id: dbThemeStory.id,
    slug: dbThemeStory.slug,
    title: dbThemeStory.title,
    bridgeText: dbThemeStory.bridge_text ?? undefined,
    illustration: dbThemeStory.illustration ?? undefined,
    sections,
  };
}

function transformStorySection(
  dbSection: DbStorySection,
  poiIds: string[]
): StorySection {
  return {
    id: dbSection.id,
    type: dbSection.type as StorySection["type"],
    categoryLabel: dbSection.category_label ?? undefined,
    title: dbSection.title ?? undefined,
    bridgeText: dbSection.bridge_text ?? undefined,
    content: dbSection.content ?? undefined,
    images: dbSection.images ?? undefined,
    pois: poiIds.length > 0 ? poiIds : undefined,
    themeStoryId: dbSection.theme_story_id ?? undefined,
  };
}

// ============================================
// Query Functions
// ============================================

/**
 * Fetch all POIs within a given radius from a center point.
 *
 * Uses a two-step filtering approach:
 * 1. Database bounding box filter (reduces data transfer by ~99%)
 * 2. Precise Haversine calculation on remaining POIs
 *
 * This avoids loading all POIs into memory while maintaining accuracy.
 */
export async function getPOIsWithinRadius(
  center: { lat: number; lng: number },
  radiusMeters: number,
  categoryIds?: string[]
): Promise<{ poi: DbPoi; category: DbCategory | null }[]> {
  const client = createServerClient();
  if (!client) {
    console.error("Supabase client not configured");
    return [];
  }

  // Step 1: Calculate bounding box for database-level pre-filtering
  const bbox = calculateBoundingBox(center, radiusMeters);

  // Build query with bounding box filter
  let query = client
    .from("pois")
    .select(`*, categories (*)`)
    // Bounding box pre-filter - reduces data by ~99%
    .gte("lat", bbox.minLat)
    .lte("lat", bbox.maxLat)
    .gte("lng", bbox.minLng)
    .lte("lng", bbox.maxLng);

  if (categoryIds && categoryIds.length > 0) {
    query = query.in("category_id", categoryIds);
  }

  const { data: pois, error } = await query;

  if (error) {
    console.error("Error fetching POIs:", error);
    return [];
  }

  if (!pois) {
    return [];
  }

  // Step 2: Precise Haversine filter on reduced dataset
  const filtered = pois.filter((poi) => {
    const distance = calculateDistance(
      center.lat,
      center.lng,
      poi.lat,
      poi.lng
    );
    return distance <= radiusMeters;
  });

  // Return POIs with their categories
  return filtered.map((poi) => ({
    poi: {
      id: poi.id,
      name: poi.name,
      lat: poi.lat,
      lng: poi.lng,
      address: poi.address,
      category_id: poi.category_id,
      google_place_id: poi.google_place_id,
      google_rating: poi.google_rating,
      google_review_count: poi.google_review_count,
      google_maps_url: poi.google_maps_url,
      photo_reference: poi.photo_reference,
      editorial_hook: poi.editorial_hook,
      local_insight: poi.local_insight,
      story_priority: poi.story_priority,
      editorial_sources: poi.editorial_sources,
      featured_image: poi.featured_image,
      description: poi.description,
      entur_stopplace_id: poi.entur_stopplace_id,
      bysykkel_station_id: poi.bysykkel_station_id,
      hyre_station_id: poi.hyre_station_id,
      created_at: poi.created_at,
      updated_at: poi.updated_at,
    } as DbPoi,
    category: poi.categories as DbCategory | null,
  }));
}

/**
 * Fetch all categories
 */
export async function getCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) {
    console.error("Error fetching categories:", error);
    return [];
  }

  return data.map(transformCategory);
}

/**
 * Fetch a single category by ID
 */
export async function getCategoryById(id: string): Promise<Category | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching category:", error);
    return null;
  }

  return transformCategory(data);
}

/**
 * Fetch all POIs for a project
 */
export async function getProjectPOIs(projectId: string): Promise<POI[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // First get the POI IDs linked to this project
  const { data: projectPois, error: linkError } = await supabase
    .from("project_pois")
    .select("poi_id")
    .eq("project_id", projectId);

  if (linkError || !projectPois) {
    console.error("Error fetching project POIs:", linkError);
    return [];
  }

  const poiIds = projectPois.map((pp) => pp.poi_id);
  if (poiIds.length === 0) return [];

  // Fetch the POIs with their categories
  const { data: pois, error: poiError } = await supabase
    .from("pois")
    .select(`
      *,
      categories (*)
    `)
    .in("id", poiIds);

  if (poiError || !pois) {
    console.error("Error fetching POIs:", poiError);
    return [];
  }

  return pois.map((poi) => {
    const category = poi.categories
      ? transformCategory(poi.categories as DbCategory)
      : undefined;
    return transformPOI(poi, category);
  });
}

/**
 * Helper function to group array by key
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Fetch theme stories for a project with all sections and POI references.
 *
 * Uses batch fetching to avoid N+1 queries:
 * - Query 1: All theme stories for project
 * - Query 2: All sections for those theme stories
 * - Query 3: All POI mappings for those sections
 *
 * This reduces query count from O(T + T*S) to O(3) constant.
 */
export async function getProjectThemeStories(
  projectId: string
): Promise<ThemeStory[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Query 1: Fetch all theme stories
  const { data: themeStories, error: tsError } = await supabase
    .from("theme_stories")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  if (tsError || !themeStories || themeStories.length === 0) {
    if (tsError) console.error("Error fetching theme stories:", tsError);
    return [];
  }

  const themeStoryIds = themeStories.map(ts => ts.id);

  // Query 2: Fetch all sections for all theme stories at once
  const { data: allSections, error: secError } = await supabase
    .from("theme_story_sections")
    .select("*")
    .in("theme_story_id", themeStoryIds)
    .order("sort_order");

  if (secError) {
    console.error("Error fetching theme story sections:", secError);
    return themeStories.map(ts => transformThemeStory(ts, []));
  }

  const sectionIds = (allSections || []).map(s => s.id);

  // Query 3: Fetch all POI mappings for all sections at once
  let allSectionPois: Array<{ section_id: string; poi_id: string; sort_order: number }> = [];
  if (sectionIds.length > 0) {
    const { data: pois, error: spError } = await supabase
      .from("theme_section_pois")
      .select("section_id, poi_id, sort_order")
      .in("section_id", sectionIds)
      .order("sort_order");

    if (spError) {
      console.error("Error fetching theme section POIs:", spError);
    } else {
      allSectionPois = pois || [];
    }
  }

  // Build lookup maps for in-memory assembly
  const sectionsByTheme = groupBy(allSections || [], s => s.theme_story_id || "");
  const poisBySection = groupBy(allSectionPois, sp => sp.section_id);

  // Assemble the result in memory
  return themeStories.map(ts => {
    const sections = sectionsByTheme[ts.id] || [];
    const transformedSections = sections.map(section => {
      const sectionPois = poisBySection[section.id] || [];
      const poiIds = sectionPois
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(sp => sp.poi_id);
      return transformThemeStorySection(section, poiIds);
    });
    return transformThemeStory(ts, transformedSections);
  });
}

/**
 * Fetch story sections for a project with POI references.
 *
 * Uses batch fetching to avoid N+1 queries:
 * - Query 1: All story sections for project
 * - Query 2: All POI mappings for those sections
 *
 * This reduces query count from O(S) to O(2) constant.
 */
export async function getProjectStorySections(
  projectId: string
): Promise<StorySection[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Query 1: Fetch all sections
  const { data: sections, error: secError } = await supabase
    .from("story_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  if (secError || !sections || sections.length === 0) {
    if (secError) console.error("Error fetching story sections:", secError);
    return [];
  }

  const sectionIds = sections.map(s => s.id);

  // Query 2: Fetch all POI mappings for all sections at once
  const { data: allSectionPois, error: spError } = await supabase
    .from("section_pois")
    .select("section_id, poi_id, sort_order")
    .in("section_id", sectionIds)
    .order("sort_order");

  if (spError) {
    console.error("Error fetching section POIs:", spError);
  }

  // Build lookup map
  const poisBySection = groupBy(allSectionPois || [], sp => sp.section_id);

  // Assemble results in memory
  return sections.map(section => {
    const sectionPois = poisBySection[section.id] || [];
    const poiIds = sectionPois
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(sp => sp.poi_id);
    return transformStorySection(section, poiIds);
  });
}

/**
 * Fetch a complete project by customer slug and project slug
 */
export async function getProjectFromSupabase(
  customerSlug: string,
  projectSlug: string
): Promise<Project | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  // First find the customer
  const { data: customer, error: custError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerSlug)
    .single();

  if (custError || !customer) {
    console.error("Customer not found:", customerSlug, custError);
    return null;
  }

  // Find the project
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("*")
    .eq("customer_id", customer.id)
    .eq("url_slug", projectSlug)
    .single();

  if (projError || !project) {
    console.error("Project not found:", projectSlug, projError);
    return null;
  }

  // Fetch all related data in parallel
  const [pois, themeStories, sections, categories] = await Promise.all([
    getProjectPOIs(project.id),
    getProjectThemeStories(project.id),
    getProjectStorySections(project.id),
    getCategories(),
  ]);

  // Build the Story object
  const story: Story = {
    id: `${project.id}-story`,
    title: project.story_title ?? project.name,
    introText: project.story_intro_text ?? undefined,
    heroImages: project.story_hero_images ?? undefined,
    sections,
    themeStories,
  };

  // Build and return the Project
  return {
    id: project.id,
    name: project.name,
    customer: customerSlug,
    urlSlug: project.url_slug,
    centerCoordinates: {
      lat: project.center_lat,
      lng: project.center_lng,
    },
    story,
    pois,
    categories,
  };
}

/**
 * Fetch a single theme story by project and slug.
 *
 * Uses batch fetching to avoid N+1 queries.
 */
export async function getThemeStoryFromSupabase(
  projectId: string,
  themeStorySlug: string
): Promise<ThemeStory | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  // Query 1: Fetch theme story
  const { data: ts, error } = await supabase
    .from("theme_stories")
    .select("*")
    .eq("project_id", projectId)
    .eq("slug", themeStorySlug)
    .single();

  if (error || !ts) {
    console.error("Theme story not found:", themeStorySlug, error);
    return null;
  }

  // Query 2: Fetch all sections
  const { data: sections, error: secError } = await supabase
    .from("theme_story_sections")
    .select("*")
    .eq("theme_story_id", ts.id)
    .order("sort_order");

  if (secError || !sections || sections.length === 0) {
    if (secError) console.error("Error fetching theme story sections:", secError);
    return transformThemeStory(ts, []);
  }

  const sectionIds = sections.map(s => s.id);

  // Query 3: Fetch all POI mappings at once
  const { data: allSectionPois, error: spError } = await supabase
    .from("theme_section_pois")
    .select("section_id, poi_id, sort_order")
    .in("section_id", sectionIds)
    .order("sort_order");

  if (spError) {
    console.error("Error fetching theme section POIs:", spError);
  }

  // Build lookup map
  const poisBySection = groupBy(allSectionPois || [], sp => sp.section_id);

  // Assemble sections
  const transformedSections = sections.map(section => {
    const sectionPois = poisBySection[section.id] || [];
    const poiIds = sectionPois
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(sp => sp.poi_id);
    return transformThemeStorySection(section, poiIds);
  });

  return transformThemeStory(ts, transformedSections);
}

// ============================================
// Collection Queries
// ============================================

/**
 * Fetch a collection by its slug
 */
export async function getCollectionBySlug(
  slug: string
): Promise<{ id: string; slug: string; project_id: string; poi_ids: string[]; email: string | null; created_at: string } | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("collections")
    .select("id, slug, project_id, poi_ids, email, created_at")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}
