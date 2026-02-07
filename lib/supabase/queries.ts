import { supabase, isSupabaseConfigured, createServerClient } from "./client";
import type {
  DbCategory,
  DbPoi,
  DbProject,
  DbProduct,
  DbThemeStory,
  DbStorySection,
  DbThemeStorySection,
} from "./types";
import type {
  Project,
  ProductType,
  POI,
  Category,
  ThemeStory,
  ThemeStorySection,
  StorySection,
  Story,
  ProjectContainer,
  ProductInstance,
  ProductSummary,
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
 * Fetch all POIs for a project with resolved categories.
 *
 * Note: project_category_id and project_categories support requires migration 005.
 * Until then, only global categories are used.
 */
export async function getProjectPOIs(projectId: string): Promise<POI[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Fetch project_pois with nested POI data and global category
  // Note: project_category_id column only exists after migration 005 is applied
  const { data: projectPois, error } = await supabase
    .from("project_pois")
    .select(`
      poi_id,
      pois (
        *,
        categories (*)
      )
    `)
    .eq("project_id", projectId);

  if (error) {
    console.error("Error fetching project POIs:", error);
    return [];
  }

  if (!projectPois || projectPois.length === 0) {
    return [];
  }

  // Transform POIs using global categories (project category override not yet available)
  return projectPois.map((pp) => {
    const poi = pp.pois as DbPoi & { categories: DbCategory | null };
    const globalCategory = poi.categories;

    const category: Category | undefined = globalCategory
      ? transformCategory(globalCategory)
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
  const [pois, themeStories, sections] = await Promise.all([
    getProjectPOIs(project.id),
    getProjectThemeStories(project.id),
    getProjectStorySections(project.id),
  ]);

  // Derive categories from project's POIs (not all categories in DB)
  const categoryMap = new Map<string, Category>();
  for (const poi of pois) {
    if (poi.category && !categoryMap.has(poi.category.id)) {
      categoryMap.set(poi.category.id, poi.category);
    }
  }
  const categories = Array.from(categoryMap.values());

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
    productType: (project.product_type as ProductType) || "explorer",
    centerCoordinates: {
      lat: project.center_lat,
      lng: project.center_lng,
    },
    story,
    pois,
    categories,
    venueType: (project as Record<string, unknown>).venue_type as "hotel" | "residential" | "commercial" | null ?? null,
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

// ============================================
// Project Hierarchy Queries (NEW)
// NOTE: These functions require migration 006_project_hierarchy_ddl.sql to be run.
// Until then, they return null/empty and data-server.ts handles fallback.
// ============================================

/**
 * Check if the new hierarchy tables exist (products table as indicator).
 * This is a simple check - in production you might want a more robust approach.
 */
async function isHierarchyMigrated(): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) {
    return false;
  }

  try {
    // Try to query the products table - if it doesn't exist, this will fail
    const { error } = await supabase
      .from("products")
      .select("id")
      .limit(1);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Fetch a project container by customer and project slug.
 * Returns the container with all its products and the full POI pool.
 *
 * NOTE: Requires migration 006 to be run. Returns null if migration not applied.
 */
export async function getProjectContainerFromSupabase(
  customerSlug: string,
  projectSlug: string
): Promise<ProjectContainer | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  // Check if migration has been applied
  const migrated = await isHierarchyMigrated();
  if (!migrated) {
    console.warn("Project hierarchy migration not yet applied. Using legacy fallback.");
    return null;
  }

  // Verify customer exists
  const { data: customer, error: custError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerSlug)
    .single();

  if (custError || !customer) {
    console.error("Customer not found:", customerSlug, custError);
    return null;
  }

  // Fetch the project container (new structure has description and version)
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

  // Fetch products for this project
  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("*")
    .eq("project_id", project.id);

  if (prodError) {
    console.error("Error fetching products:", prodError);
  }

  // Fetch project POI pool (new structure has sort_order)
  const { data: projectPois, error: ppError } = await supabase
    .from("project_pois")
    .select(`
      poi_id,
      pois (
        *,
        categories (*)
      )
    `)
    .eq("project_id", project.id);

  if (ppError) {
    console.error("Error fetching project POIs:", ppError);
  }

  // Transform POIs - using type assertion for the joined data
  const pois: POI[] = (projectPois || []).map((pp: { poi_id: string; pois: unknown }) => {
    const poi = pp.pois as DbPoi & { categories: DbCategory | null };
    const globalCategory = poi.categories;
    const category = globalCategory ? transformCategory(globalCategory) : undefined;
    return transformPOI(poi, category);
  });

  // Derive categories from POIs
  const categoryMap = new Map<string, Category>();
  for (const poi of pois) {
    if (poi.category && !categoryMap.has(poi.category.id)) {
      categoryMap.set(poi.category.id, poi.category);
    }
  }
  const categories = Array.from(categoryMap.values());

  // For each product, fetch its POI and category selections
  const productInstances: ProductInstance[] = [];
  for (const product of products || []) {
    // Type assertion for new product structure
    const prod = product as DbProduct;

    // Fetch product POIs (featured column added by migration 009)
    const { data: productPoisData } = await supabase
      .from("product_pois")
      .select("poi_id, sort_order")
      .eq("product_id", prod.id)
      .order("sort_order");

    // Separate query for featured (graceful if column doesn't exist yet)
    let featuredPoiIds: string[] = [];
    const { data: featuredData, error: featuredError } = await supabase
      .from("product_pois")
      .select("poi_id")
      .eq("product_id", prod.id)
      .eq("featured" as string, true); // TODO: Remove `as string` cast after regenerating Supabase types
    if (!featuredError) {
      featuredPoiIds = (featuredData || []).map((fp: { poi_id: string }) => fp.poi_id);
    }
    // featuredError means migration 009 not yet applied — gracefully skip

    // Fetch product categories
    const { data: productCatsData } = await supabase
      .from("product_categories")
      .select("category_id, display_order")
      .eq("product_id", prod.id)
      .order("display_order");

    productInstances.push({
      id: prod.id,
      projectId: prod.project_id,
      productType: prod.product_type,
      config: (prod.config as Record<string, unknown>) || {},
      storyTitle: prod.story_title ?? undefined,
      storyIntroText: prod.story_intro_text ?? undefined,
      storyHeroImages: prod.story_hero_images ?? undefined,
      poiIds: (productPoisData || []).map((pp) => pp.poi_id),
      featuredPoiIds,
      categoryIds: (productCatsData || []).map((pc) => pc.category_id),
      version: prod.version,
      createdAt: prod.created_at,
      updatedAt: prod.updated_at,
    });
  }

  // The new project structure - need to handle that description/version might not exist in old DB
  const projectAny = project as Record<string, unknown>;

  return {
    id: project.id,
    customerId: project.customer_id || customerSlug,
    name: project.name,
    urlSlug: project.url_slug,
    centerCoordinates: {
      lat: project.center_lat,
      lng: project.center_lng,
    },
    description: (projectAny.description as string | null) ?? undefined,
    pois,
    categories,
    products: productInstances,
    venueType: (projectAny.venue_type as "hotel" | "residential" | "commercial" | null) ?? null,
    version: (projectAny.version as number) ?? 1,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  };
}

/**
 * Fetch a specific product by customer, project slug, and product type.
 * Returns a Project object for backward compatibility with existing pages.
 *
 * NOTE: Requires migration 006 to be run. Returns null if migration not applied.
 */
export async function getProductFromSupabase(
  customerSlug: string,
  projectSlug: string,
  productType: ProductType
): Promise<Project | null> {
  if (!isSupabaseConfigured() || !supabase) {
    return null;
  }

  // Get the project container first
  const container = await getProjectContainerFromSupabase(customerSlug, projectSlug);
  if (!container) {
    // Migration not applied or project not found - let caller handle fallback
    return null;
  }

  // Find the specific product
  const product = container.products.find((p) => p.productType === productType);
  if (!product) {
    console.error(`Product ${productType} not found for project ${projectSlug}`);
    return null;
  }

  // Get POIs for this product (filter from project pool)
  const productPoiSet = new Set(product.poiIds);
  const featuredPoiSet = new Set(product.featuredPoiIds);
  const pois = container.pois
    .filter((poi) => productPoiSet.has(poi.id))
    .map((poi) => ({
      ...poi,
      featured: featuredPoiSet.has(poi.id) ? true : undefined,
    }));

  // Get categories for this product
  // If product_categories is populated, use it; otherwise derive from selected POIs
  let categories: typeof container.categories;
  if (product.categoryIds.length > 0) {
    const productCatSet = new Set(product.categoryIds);
    categories = container.categories.filter((cat) => productCatSet.has(cat.id));
  } else {
    // Derive categories from the POIs selected for this product
    const poiCategoryIds = new Set(
      pois.map((poi) => poi.category?.id).filter((id): id is string => !!id)
    );
    categories = container.categories.filter((cat) => poiCategoryIds.has(cat.id));
  }

  // Fetch story data (theme stories and sections are per-product via legacy tables)
  // For now, we continue using legacy queries until those are also migrated
  const [themeStories, sections] = await Promise.all([
    getProjectThemeStories(product.id),
    getProjectStorySections(product.id),
  ]);

  const story: Story = {
    id: `${product.id}-story`,
    title: product.storyTitle ?? container.name,
    introText: product.storyIntroText ?? undefined,
    heroImages: product.storyHeroImages ?? undefined,
    sections,
    themeStories,
  };

  // Extract reportConfig from product.config if available
  const reportConfig = (product.config as Record<string, unknown>)?.reportConfig as
    | import("@/lib/types").ReportConfig
    | undefined;

  return {
    id: product.id,
    name: container.name,
    customer: customerSlug,
    urlSlug: container.urlSlug,
    productType: product.productType,
    centerCoordinates: container.centerCoordinates,
    venueType: container.venueType,
    reportConfig,
    story,
    pois,
    categories,
  };
}

/**
 * Get available products for a project (for landing page).
 *
 * NOTE: Requires migration 006 to be run. Returns empty array if migration not applied.
 */
export async function getProjectProducts(
  customerSlug: string,
  projectSlug: string
): Promise<ProductSummary[]> {
  if (!isSupabaseConfigured() || !supabase) {
    return [];
  }

  // Check if migration has been applied
  const migrated = await isHierarchyMigrated();
  if (!migrated) {
    return [];
  }

  // First find the project
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id")
    .eq("customer_id", customerSlug)
    .eq("url_slug", projectSlug)
    .single();

  if (projError || !project) {
    return [];
  }

  // Fetch products with POI counts
  const { data: products, error: prodError } = await supabase
    .from("products")
    .select(`
      product_type,
      story_title,
      product_pois (count)
    `)
    .eq("project_id", project.id);

  if (prodError || !products) {
    return [];
  }

  return products.map((p) => ({
    type: p.product_type as ProductType,
    poiCount: (p.product_pois as unknown as { count: number }[])?.[0]?.count ?? 0,
    hasStory: !!p.story_title,
  }));
}
