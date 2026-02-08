import type { Project, POI } from "@/lib/types";
import { getReportThemes } from "./report-themes";
import {
  calculateCategoryScore,
  generateCategoryQuote,
  type CategoryScore,
} from "@/lib/utils/category-score";

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

/**
 * Variable cap per theme for Report view.
 * Transport gets all; other themes are capped to keep the report focused.
 */
const THEME_CAP: Record<string, number> = {
  "mat-drikke": 8,
  "kultur-opplevelser": 3,
  "hverdagsbehov": 3,
  "transport": Infinity,
  "trening-velvare": 3,
};
const DEFAULT_THEME_CAP = 5;

const HIGHLIGHT_FALLBACK_COUNT = 3;
const THEME_MIN_POIS = 2;

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

    // Apply variable capping (transport gets all, others are capped)
    const cap = THEME_CAP[themeDef.id] ?? DEFAULT_THEME_CAP;

    // Sort by rating descending (unrated at end)
    const sorted = [...themePOIs].sort((a, b) => {
      if (a.googleRating == null && b.googleRating == null) return 0;
      if (a.googleRating == null) return 1;
      if (b.googleRating == null) return -1;
      return b.googleRating - a.googleRating;
    });

    const capped = sorted.slice(0, cap);
    const hiddenPOIs = sorted.slice(cap);

    // Split into highlight and list POIs
    // Check per-theme so themes with featured flags use them while others use rating fallback
    const themeFeatured = capped.filter((p) => p.featured);
    let highlightPOIs: POI[];
    let listPOIs: POI[];

    if (themeFeatured.length > 0) {
      // Use DB-driven featured flags for this theme
      highlightPOIs = themeFeatured;
      listPOIs = capped.filter((p) => !p.featured);
    } else {
      // Fallback: top N by rating (backward compatible)
      highlightPOIs = capped.slice(0, HIGHLIGHT_FALLBACK_COUNT);
      listPOIs = capped.slice(HIGHLIGHT_FALLBACK_COUNT);
    }

    const themeRated = capped.filter((p) => p.googleRating != null);
    const themeAvg =
      themeRated.length > 0
        ? themeRated.reduce((s, p) => s + (p.googleRating ?? 0), 0) /
          themeRated.length
        : null;
    const themeReviews = capped.reduce(
      (s, p) => s + (p.googleReviewCount ?? 0),
      0
    );
    const editorialCount = capped.filter((p) => p.editorialHook).length;

    // Count unique categories within theme
    const uniqueCategories = new Set(capped.map((p) => p.category.id)).size;

    const richnessScore =
      themeRated.length * 2 + editorialCount * 3 + capped.length;

    // Calculate category score
    const score = calculateCategoryScore({
      totalPOIs: capped.length,
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
        totalPOIs: capped.length,
        ratedPOIs: themeRated.length,
        avgRating: themeAvg != null ? Math.round(themeAvg * 10) / 10 : null,
        totalReviews: themeReviews,
        editorialCount,
        uniqueCategories,
      },
      highlightPOIs,
      listPOIs,
      allPOIs: capped,
      hiddenPOIs,
      displayMode: (CATEGORY_DISPLAY_MODE[themeDef.id] ?? "editorial") as ThemeDisplayMode,
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
