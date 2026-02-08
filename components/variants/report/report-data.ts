import type { Project, POI, Coordinates } from "@/lib/types";
import { getReportThemes } from "./report-themes";
import {
  calculateCategoryScore,
  generateCategoryQuote,
  type CategoryScore,
} from "@/lib/utils/category-score";

/** Haversine distance in meters between two coordinates */
function haversineMeters(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export interface ReportHeroMetrics {
  totalPOIs: number;
  ratedPOIs: number;
  avgRating: number;
  totalReviews: number;
  transportCount: number;
}

export interface ReportThemeStats {
  totalPOIs: number;
  ratedPOIs: number;
  avgRating: number | null;
  totalReviews: number;
  editorialCount: number;
  uniqueCategories: number;
}

export type ThemeDisplayMode = "editorial" | "functional";

export interface ReportTheme {
  id: string;
  name: string;
  icon: string;
  intro?: string;
  bridgeText?: string;
  stats: ReportThemeStats;
  highlightPOIs: POI[];
  listPOIs: POI[];
  allPOIs: POI[];
  hiddenPOIs: POI[];
  displayMode: ThemeDisplayMode;
  richnessScore: number;
  score: CategoryScore;
  quote: string;
}

export interface ReportData {
  projectName: string;
  address: string;
  centerCoordinates: { lat: number; lng: number };
  heroMetrics: ReportHeroMetrics;
  themes: ReportTheme[];
  label?: string;
  heroIntro?: string;
  closingTitle?: string;
  closingText?: string;
  mapStyle?: string;
}

const TRANSPORT_CATEGORIES = new Set([
  "bus",
  "train",
  "tram",
  "bike",
  "parking",
  "carshare",
  "taxi",
  "airport",
]);

const HIGHLIGHT_FALLBACK_COUNT = 3;
const THEME_MIN_POIS = 5;

/** How many compact cards to show before "Vis meg mer" */
export const INITIAL_VISIBLE_COUNT = 6;

/** Display mode per theme — editorial gets photo cards, functional gets compact list */
const CATEGORY_DISPLAY_MODE: Record<string, ThemeDisplayMode> = {
  "mat-drikke": "editorial",
  "kultur-opplevelser": "editorial",
  "trening-velvare": "editorial",
  "hverdagsbehov": "functional",
  "transport": "functional",
};

export function transformToReportData(project: Project): ReportData {
  const allPOIs = project.pois;

  // Build hero metrics
  const ratedPOIs = allPOIs.filter((p) => p.googleRating != null);
  const totalReviews = allPOIs.reduce(
    (sum, p) => sum + (p.googleReviewCount ?? 0),
    0
  );
  const avgRating =
    ratedPOIs.length > 0
      ? ratedPOIs.reduce((sum, p) => sum + (p.googleRating ?? 0), 0) /
        ratedPOIs.length
      : 0;
  const transportCount = allPOIs.filter((p) =>
    TRANSPORT_CATEGORIES.has(p.category.id)
  ).length;

  const heroMetrics: ReportHeroMetrics = {
    totalPOIs: allPOIs.length,
    ratedPOIs: ratedPOIs.length,
    avgRating: Math.round(avgRating * 10) / 10,
    totalReviews,
    transportCount,
  };

  // Group POIs by theme
  const themes: ReportTheme[] = [];
  const themeDefinitions = getReportThemes(project);
  const categorySet = new Map<string, Set<string>>();

  for (const theme of themeDefinitions) {
    const cats = new Set(theme.categories);
    categorySet.set(theme.id, cats);
  }

  for (const themeDef of themeDefinitions) {
    const cats = categorySet.get(themeDef.id)!;
    const themePOIs = allPOIs.filter((p) => cats.has(p.category.id));

    if (themePOIs.length < THEME_MIN_POIS) continue;

    const center = project.centerCoordinates;

    // Sort by distance to project center (closest first)
    const sorted = [...themePOIs].sort((a, b) => {
      // Prefer walk time when both have it
      const aWalk = a.travelTime?.walk;
      const bWalk = b.travelTime?.walk;
      if (aWalk != null && bWalk != null) return aWalk - bWalk;
      // Fall back to haversine
      return (
        haversineMeters(center, a.coordinates) -
        haversineMeters(center, b.coordinates)
      );
    });

    // Split into highlight POIs (featured/top-rated) and the rest
    const themeFeatured = sorted.filter((p) => p.featured);
    let highlightPOIs: POI[];
    const displayMode = (CATEGORY_DISPLAY_MODE[themeDef.id] ?? "editorial") as ThemeDisplayMode;

    if (displayMode === "editorial" && themeFeatured.length > 0) {
      highlightPOIs = themeFeatured;
    } else if (displayMode === "editorial") {
      // Fallback: top N by rating for editorial themes
      const byRating = [...sorted].sort((a, b) => {
        if (a.googleRating == null && b.googleRating == null) return 0;
        if (a.googleRating == null) return 1;
        if (b.googleRating == null) return -1;
        return b.googleRating - a.googleRating;
      });
      highlightPOIs = byRating.slice(0, HIGHLIGHT_FALLBACK_COUNT);
    } else {
      highlightPOIs = [];
    }

    const highlightIds = new Set(highlightPOIs.map((p) => p.id));
    const remaining = sorted.filter((p) => !highlightIds.has(p.id));

    // First INITIAL_VISIBLE_COUNT compact cards, rest behind "Vis meg mer"
    const listPOIs = remaining.slice(0, INITIAL_VISIBLE_COUNT);
    const hiddenPOIs = remaining.slice(INITIAL_VISIBLE_COUNT);

    const themeRated = sorted.filter((p) => p.googleRating != null);
    const themeAvg =
      themeRated.length > 0
        ? themeRated.reduce((s, p) => s + (p.googleRating ?? 0), 0) /
          themeRated.length
        : null;
    const themeReviews = sorted.reduce(
      (s, p) => s + (p.googleReviewCount ?? 0),
      0
    );
    const editorialCount = sorted.filter((p) => p.editorialHook).length;

    // Count unique categories within theme
    const uniqueCategories = new Set(sorted.map((p) => p.category.id)).size;

    const richnessScore =
      themeRated.length * 2 + editorialCount * 3 + sorted.length;

    // Calculate category score
    const score = calculateCategoryScore({
      totalPOIs: sorted.length,
      avgRating: themeAvg,
      avgWalkTimeMinutes: null,
      uniqueCategories,
    });

    // Generate quote based on score and variety
    const quote = generateCategoryQuote(
      themeDef.id,
      score.total,
      uniqueCategories,
      project.id
    );

    themes.push({
      id: themeDef.id,
      name: themeDef.name,
      icon: themeDef.icon,
      intro: themeDef.intro,
      bridgeText: themeDef.bridgeText,
      stats: {
        totalPOIs: sorted.length,
        ratedPOIs: themeRated.length,
        avgRating: themeAvg != null ? Math.round(themeAvg * 10) / 10 : null,
        totalReviews: themeReviews,
        editorialCount,
        uniqueCategories,
      },
      highlightPOIs,
      listPOIs,
      allPOIs: sorted,
      hiddenPOIs,
      displayMode,
      richnessScore,
      score,
      quote,
    });
  }

  // If themes come from reportConfig, preserve that order; otherwise sort by richness
  if (!project.reportConfig?.themes) {
    themes.sort((a, b) => b.richnessScore - a.richnessScore);
  }

  const rc = project.reportConfig;

  return {
    projectName: project.name,
    address: project.pois[0]?.address ?? "",
    centerCoordinates: project.centerCoordinates,
    heroMetrics,
    themes,
    label: rc?.label,
    heroIntro: rc?.heroIntro,
    closingTitle: rc?.closingTitle,
    closingText: rc?.closingText,
    mapStyle: rc?.mapStyle,
  };
}
