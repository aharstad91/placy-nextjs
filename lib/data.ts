import type { Project, POI, ThemeStory } from "./types";
import { isSupabaseConfigured } from "./supabase/client";
import { getProjectFromSupabase } from "./supabase/queries";

// JSON fallback imports
import ferjemannsveien10 from "@/data/projects/klp-eiendom/ferjemannsveien-10.json";
import testGenerator from "@/data/projects/klp-eiendom/test-generator.json";

// Prosjekt-register (JSON fallback)
const projects: Record<string, Record<string, unknown>> = {
  "klp-eiendom": {
    "ferjemannsveien-10": ferjemannsveien10,
    "test-generator": testGenerator,
  },
};

/**
 * Get project from JSON files (fallback when Supabase is not configured)
 */
function getProjectFromJSON(customer: string, projectSlug: string): Project | null {
  const customerProjects = projects[customer];
  if (!customerProjects) return null;

  const project = customerProjects[projectSlug];
  if (!project) return null;

  return project as unknown as Project;
}

/**
 * Load project data - tries Supabase first, falls back to JSON
 * Note: This is a synchronous function for backward compatibility.
 * Use getProjectAsync for the async Supabase version.
 */
export function getProject(customer: string, projectSlug: string): Project | null {
  // Always use JSON for synchronous calls (client components)
  // Supabase requires async, so we fall back to JSON
  return getProjectFromJSON(customer, projectSlug);
}

/**
 * Load project data asynchronously - prefers Supabase when configured
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

  // Fall back to JSON
  return getProjectFromJSON(customer, projectSlug);
}

/**
 * Check if data source is Supabase (for UI indicators)
 */
export function isUsingSupabase(): boolean {
  return isSupabaseConfigured();
}

// Hent POI fra prosjekt
export function getPOI(project: Project, poiId: string): POI | undefined {
  return project.pois.find((poi) => poi.id === poiId);
}

// Hent flere POIs
export function getPOIs(project: Project, poiIds: string[]): POI[] {
  return poiIds
    .map((id) => getPOI(project, id))
    .filter((poi): poi is POI => poi !== undefined);
}

// Hent Theme Story
export function getThemeStory(
  project: Project,
  themeStoryId: string
): ThemeStory | undefined {
  return project.story.themeStories.find((ts) => ts.id === themeStoryId || ts.slug === themeStoryId);
}

// Hent alle POIs i en Theme Story
export function getThemeStoryPOIs(project: Project, themeStory: ThemeStory): POI[] {
  const poiIds = themeStory.sections.flatMap((section) => section.pois);
  const uniquePoiIds = Array.from(new Set(poiIds));
  return getPOIs(project, uniquePoiIds);
}

// Tell POIs innenfor tidsbudsjett
export function countPOIsWithinBudget(
  pois: POI[],
  timeBudget: number,
  travelMode: "walk" | "bike" | "car"
): number {
  return pois.filter((poi) => {
    const time = poi.travelTime?.[travelMode];
    return time !== undefined && time <= timeBudget;
  }).length;
}
