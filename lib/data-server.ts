/**
 * Server-only data loading functions
 * Uses fs for dynamic JSON loading - only import in Server Components
 *
 * WARNING: Do not import this file in client components - it uses Node.js fs module
 */

import type { Project, ProjectContainer, ProductType, ProductSummary, Trip, ProjectTrip, ProjectTripOverride } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import {
  getProjectFromSupabase,
  getProjectContainerFromSupabase,
  getProductFromSupabase,
  getProjectProducts as getProjectProductsFromSupabase,
  getProjectShortId,
  getTripBySlug as getTripBySlugFromSupabase,
  getTripsByProject as getTripsByProjectFromSupabase,
  getTripsByCity as getTripsByCityFromSupabase,
  getProjectIdBySlug as getProjectIdBySlugFromSupabase,
  getProjectTripOverride as getProjectTripOverrideFromSupabase,
  getTripsByPoiId as getTripsByPoiIdFromSupabase,
} from "./supabase/queries";

export { getProjectShortId };
import * as fs from "fs";
import * as path from "path";

/**
 * Get project from JSON files dynamically
 * This reads from the filesystem at runtime, allowing new projects to be loaded
 * without restarting the server or adding manual imports.
 */
function getProjectFromJSON(customer: string, projectSlug: string): Project | null {
  try {
    const projectPath = path.join(process.cwd(), "data", "projects", customer, `${projectSlug}.json`);

    if (!fs.existsSync(projectPath)) {
      return null;
    }

    const content = fs.readFileSync(projectPath, "utf-8");
    const project = JSON.parse(content) as Project;
    if (!project.productType) {
      project.productType = "explorer";
    }
    return project;
  } catch (error) {
    console.error(`Failed to load project ${customer}/${projectSlug}:`, error);
    return null;
  }
}

/**
 * Check if a project slug exists for a customer
 * SERVER ONLY
 */
export async function projectExists(
  customer: string,
  projectSlug: string
): Promise<boolean> {
  const project = await getProjectAsync(customer, projectSlug);
  return project !== null;
}

/**
 * Derive sibling product slugs using naming convention:
 * - Report: {base-slug} (e.g. "quality-hotel-augustin")
 * - Explorer: {base-slug}-explore
 * - Guide: {base-slug}-guide
 *
 * Returns the base slug stripped of any product suffix.
 */
export function getBaseSlug(slug: string): string {
  if (slug.endsWith("-explore")) return slug.slice(0, -8);
  if (slug.endsWith("-guide")) return slug.slice(0, -6);
  return slug;
}

export interface SiblingProducts {
  explore?: string; // URL path like /customer/slug-explore
  guide?: string;
  report?: string;
}

/**
 * Find sibling product URLs for a given project
 * SERVER ONLY
 */
export async function getSiblingProducts(
  customer: string,
  projectSlug: string,
): Promise<SiblingProducts> {
  const base = getBaseSlug(projectSlug);

  const [hasReport, hasExplore, hasGuide] = await Promise.all([
    projectExists(customer, base),
    projectExists(customer, `${base}-explore`),
    projectExists(customer, `${base}-guide`),
  ]);

  const siblings: SiblingProducts = {};
  if (hasReport) siblings.report = `/${customer}/${base}`;
  if (hasExplore) siblings.explore = `/${customer}/${base}-explore`;
  if (hasGuide) siblings.guide = `/${customer}/${base}-guide`;

  return siblings;
}

/**
 * Load project data asynchronously - prefers Supabase when configured
 * SERVER ONLY - do not import in client components
 */
export async function getProjectAsync(
  customer: string,
  projectSlug: string
): Promise<Project | null> {
  // Try Supabase first if configured
  if (isSupabaseConfigured()) {
    const project = await getProjectFromSupabase(customer, projectSlug);
    if (project) {
      return project;
    }
    console.warn(
      `Project ${customer}/${projectSlug} not found in Supabase, falling back to JSON`
    );
  }

  // Fall back to JSON (dynamic loading)
  return getProjectFromJSON(customer, projectSlug);
}

/**
 * Get all trips for a customer
 * SERVER ONLY - do not import in client components
 */
export async function getTripsByCustomer(customer: string): Promise<Project[]> {
  const trips: Project[] = [];

  try {
    const customerPath = path.join(process.cwd(), "data", "projects", customer);

    if (!fs.existsSync(customerPath)) {
      return trips;
    }

    const files = fs.readdirSync(customerPath);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const slug = file.replace(".json", "");
      const project = await getProjectAsync(customer, slug);

      if (project && project.productType === "guide") {
        trips.push(project);
      }
    }

    // Sort by sortOrder, then by title
    trips.sort((a, b) => {
      const orderA = a.tripConfig?.sortOrder ?? 999;
      const orderB = b.tripConfig?.sortOrder ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.tripConfig?.title ?? a.name).localeCompare(
        b.tripConfig?.title ?? b.name
      );
    });

    return trips;
  } catch (error) {
    console.error(`Failed to get trips for customer ${customer}:`, error);
    return trips;
  }
}

// ============================================
// New Hierarchy Functions
// ============================================

/**
 * Load a project container with all its products.
 * SERVER ONLY - do not import in client components
 */
export async function getProjectContainerAsync(
  customer: string,
  projectSlug: string
): Promise<ProjectContainer | null> {
  if (isSupabaseConfigured()) {
    return getProjectContainerFromSupabase(customer, projectSlug);
  }

  // JSON fallback: simulate container from old project files
  const baseSlug = getBaseSlug(projectSlug);
  const [report, explore, guide] = await Promise.all([
    getProjectFromJSON(customer, baseSlug),
    getProjectFromJSON(customer, `${baseSlug}-explore`),
    getProjectFromJSON(customer, `${baseSlug}-guide`),
  ]);

  const firstProject = report || explore || guide;
  if (!firstProject) {
    return null;
  }

  // Collect all POIs from all products (merge duplicates)
  const poiMap = new Map();
  const categoryMap = new Map();

  [report, explore, guide].forEach((proj) => {
    if (!proj) return;
    proj.pois.forEach((poi) => poiMap.set(poi.id, poi));
    proj.categories.forEach((cat) => categoryMap.set(cat.id, cat));
  });

  return {
    id: `${customer}_${baseSlug}`,
    customerId: customer,
    name: firstProject.name.replace(/ (Explorer|Guide)$/, ""),
    urlSlug: baseSlug,
    centerCoordinates: firstProject.centerCoordinates,
    description: undefined,
    pois: Array.from(poiMap.values()),
    categories: Array.from(categoryMap.values()),
    products: [report, explore, guide]
      .filter((p): p is Project => p !== null)
      .map((p) => ({
        id: p.id,
        projectId: `${customer}_${baseSlug}`,
        productType: p.productType,
        config: {},
        storyTitle: p.story.title,
        storyIntroText: p.story.introText,
        storyHeroImages: p.story.heroImages,
        poiIds: p.pois.map((poi) => poi.id),
        featuredPoiIds: [],
        categoryIds: p.categories.map((cat) => cat.id),
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Load a specific product from a project container.
 * SERVER ONLY - do not import in client components
 */
export async function getProductAsync(
  customer: string,
  projectSlug: string,
  productType: ProductType
): Promise<Project | null> {
  if (isSupabaseConfigured()) {
    return getProductFromSupabase(customer, projectSlug, productType);
  }

  // JSON fallback: derive slug from product type
  const baseSlug = getBaseSlug(projectSlug);
  let slug: string;
  switch (productType) {
    case "explorer":
      slug = `${baseSlug}-explore`;
      break;
    case "guide":
      slug = `${baseSlug}-guide`;
      break;
    case "report":
    default:
      slug = baseSlug;
      break;
  }

  return getProjectFromJSON(customer, slug);
}

/**
 * Get available products for a project (for landing page).
 * SERVER ONLY - do not import in client components
 */
export async function getProjectProducts(
  customer: string,
  projectSlug: string
): Promise<ProductSummary[]> {
  if (isSupabaseConfigured()) {
    return getProjectProductsFromSupabase(customer, projectSlug);
  }

  // JSON fallback
  const baseSlug = getBaseSlug(projectSlug);
  const [report, explore, guide] = await Promise.all([
    getProjectFromJSON(customer, baseSlug),
    getProjectFromJSON(customer, `${baseSlug}-explore`),
    getProjectFromJSON(customer, `${baseSlug}-guide`),
  ]);

  const products: ProductSummary[] = [];

  if (report) {
    products.push({
      type: "report",
      poiCount: report.pois.length,
      hasStory: !!report.story.title,
    });
  }
  if (explore) {
    products.push({
      type: "explorer",
      poiCount: explore.pois.length,
      hasStory: !!explore.story.title,
    });
  }
  if (guide) {
    products.push({
      type: "guide",
      poiCount: guide.pois.length,
      hasStory: !!guide.story.title,
    });
  }

  return products;
}

/**
 * Check if a project container exists (new hierarchy).
 * SERVER ONLY
 */
export async function projectContainerExists(
  customer: string,
  projectSlug: string
): Promise<boolean> {
  const container = await getProjectContainerAsync(customer, projectSlug);
  return container !== null;
}

/**
 * Check if a specific product exists within a project container.
 * SERVER ONLY
 */
export async function productExists(
  customer: string,
  projectSlug: string,
  productType: ProductType
): Promise<boolean> {
  const products = await getProjectProducts(customer, projectSlug);
  return products.some((p) => p.type === productType);
}

// ============================================
// Trip Library Functions
// ============================================

/**
 * Load a trip by its URL slug.
 * Supabase only — no JSON fallback (trips live in Supabase).
 * SERVER ONLY
 */
export async function getTripBySlugAsync(
  slug: string
): Promise<Trip | null> {
  if (isSupabaseConfigured()) {
    return getTripBySlugFromSupabase(slug);
  }
  return null;
}

/**
 * Load all trips linked to a project (with overrides).
 * Supabase only — no JSON fallback.
 * SERVER ONLY
 */
export async function getProjectTripsAsync(
  projectId: string
): Promise<ProjectTrip[]> {
  if (isSupabaseConfigured()) {
    return getTripsByProjectFromSupabase(projectId);
  }
  return [];
}

/**
 * Load all published trips in a city (for discovery/SEO).
 * Supabase only — no JSON fallback.
 * SERVER ONLY
 */
export async function getTripsByCityAsync(
  city: string
): Promise<Trip[]> {
  if (isSupabaseConfigured()) {
    return getTripsByCityFromSupabase(city);
  }
  return [];
}

/**
 * Look up a project ID from customer + project slug.
 * Supabase only.
 * SERVER ONLY
 */
export async function getProjectIdBySlugAsync(
  customerSlug: string,
  projectSlug: string
): Promise<string | null> {
  if (isSupabaseConfigured()) {
    return getProjectIdBySlugFromSupabase(customerSlug, projectSlug);
  }
  return null;
}

/**
 * Get the project_trips override for a trip within a project.
 * Supabase only.
 * SERVER ONLY
 */
export async function getProjectTripOverrideAsync(
  tripSlug: string,
  customerSlug: string,
  projectSlug: string
): Promise<ProjectTripOverride | null> {
  if (isSupabaseConfigured()) {
    return getProjectTripOverrideFromSupabase(tripSlug, customerSlug, projectSlug);
  }
  return null;
}

/**
 * Get all published trips that include a specific POI.
 * Supabase only.
 * SERVER ONLY
 */
export async function getTripsByPoiIdAsync(
  poiId: string
): Promise<{ title: string; urlSlug: string }[]> {
  if (isSupabaseConfigured()) {
    return getTripsByPoiIdFromSupabase(poiId);
  }
  return [];
}
