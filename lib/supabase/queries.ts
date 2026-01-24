import { supabase, isSupabaseConfigured } from "./client";
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
 * Fetch theme stories for a project with all sections and POI references
 */
export async function getProjectThemeStories(
  projectId: string
): Promise<ThemeStory[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Fetch theme stories
  const { data: themeStories, error: tsError } = await supabase
    .from("theme_stories")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  if (tsError || !themeStories) {
    console.error("Error fetching theme stories:", tsError);
    return [];
  }

  // For each theme story, fetch its sections and POIs
  const results: ThemeStory[] = [];

  for (const ts of themeStories) {
    // Fetch sections
    const { data: sections, error: secError } = await supabase
      .from("theme_story_sections")
      .select("*")
      .eq("theme_story_id", ts.id)
      .order("sort_order");

    if (secError || !sections) {
      console.error("Error fetching theme story sections:", secError);
      continue;
    }

    // For each section, get POI IDs
    const transformedSections: ThemeStorySection[] = [];

    for (const section of sections) {
      const { data: sectionPois, error: spError } = await supabase
        .from("theme_section_pois")
        .select("poi_id")
        .eq("section_id", section.id)
        .order("sort_order");

      if (spError) {
        console.error("Error fetching theme section POIs:", spError);
      }

      const poiIds = sectionPois?.map((sp) => sp.poi_id) ?? [];
      transformedSections.push(transformThemeStorySection(section, poiIds));
    }

    results.push(transformThemeStory(ts, transformedSections));
  }

  return results;
}

/**
 * Fetch story sections for a project with POI references
 */
export async function getProjectStorySections(
  projectId: string
): Promise<StorySection[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Fetch sections
  const { data: sections, error: secError } = await supabase
    .from("story_sections")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order");

  if (secError || !sections) {
    console.error("Error fetching story sections:", secError);
    return [];
  }

  // For each section, get POI IDs
  const results: StorySection[] = [];

  for (const section of sections) {
    const { data: sectionPois, error: spError } = await supabase
      .from("section_pois")
      .select("poi_id")
      .eq("section_id", section.id)
      .order("sort_order");

    if (spError) {
      console.error("Error fetching section POIs:", spError);
    }

    const poiIds = sectionPois?.map((sp) => sp.poi_id) ?? [];
    results.push(transformStorySection(section, poiIds));
  }

  return results;
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
 * Fetch a single theme story by project and slug
 */
export async function getThemeStoryFromSupabase(
  projectId: string,
  themeStorySlug: string
): Promise<ThemeStory | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

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

  // Fetch sections
  const { data: sections, error: secError } = await supabase
    .from("theme_story_sections")
    .select("*")
    .eq("theme_story_id", ts.id)
    .order("sort_order");

  if (secError || !sections) {
    console.error("Error fetching theme story sections:", secError);
    return transformThemeStory(ts, []);
  }

  // For each section, get POI IDs
  const transformedSections: ThemeStorySection[] = [];

  for (const section of sections) {
    const { data: sectionPois } = await supabase
      .from("theme_section_pois")
      .select("poi_id")
      .eq("section_id", section.id)
      .order("sort_order");

    const poiIds = sectionPois?.map((sp) => sp.poi_id) ?? [];
    transformedSections.push(transformThemeStorySection(section, poiIds));
  }

  return transformThemeStory(ts, transformedSections);
}
