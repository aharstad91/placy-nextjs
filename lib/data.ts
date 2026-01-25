import type { Project, POI, ThemeStory } from "./types";
import { isSupabaseConfigured } from "./supabase/client";

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
