import type { Project, POI, ThemeStory } from "./types";
import ferjemannsveien10 from "@/data/projects/klp-eiendom/ferjemannsveien-10.json";
import testGenerator from "@/data/projects/klp-eiendom/test-generator.json";

// Prosjekt-register
const projects: Record<string, Record<string, unknown>> = {
  "klp-eiendom": {
    "ferjemannsveien-10": ferjemannsveien10,
    "test-generator": testGenerator,
  },
};

// Last prosjektdata
export function getProject(customer: string, projectSlug: string): Project | null {
  const customerProjects = projects[customer];
  if (!customerProjects) return null;

  const project = customerProjects[projectSlug];
  if (!project) return null;

  return project as unknown as Project;
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
