import type { Project, POI } from "@/lib/types";
import { REPORT_THEMES } from "./report-themes";

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
}

export interface ReportTheme {
  id: string;
  name: string;
  icon: string;
  stats: ReportThemeStats;
  highlightPOIs: POI[];
  listPOIs: POI[];
  allPOIs: POI[];
  richnessScore: number;
}

export interface ReportData {
  projectName: string;
  address: string;
  centerCoordinates: { lat: number; lng: number };
  heroMetrics: ReportHeroMetrics;
  themes: ReportTheme[];
}

const TRANSPORT_CATEGORIES = new Set([
  "bus",
  "train",
  "bike",
  "parking",
  "carshare",
  "taxi",
  "airport",
]);

const HIGHLIGHT_COUNT = 3;
const THEME_MIN_POIS = 3;

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
  const categorySet = new Map<string, Set<string>>();

  for (const theme of REPORT_THEMES) {
    const cats = new Set(theme.categories);
    categorySet.set(theme.id, cats);
  }

  for (const themeDef of REPORT_THEMES) {
    const cats = categorySet.get(themeDef.id)!;
    const themePOIs = allPOIs.filter((p) => cats.has(p.category.id));

    if (themePOIs.length < THEME_MIN_POIS) continue;

    // Sort by rating descending (unrated at end)
    const sorted = [...themePOIs].sort((a, b) => {
      if (a.googleRating == null && b.googleRating == null) return 0;
      if (a.googleRating == null) return 1;
      if (b.googleRating == null) return -1;
      return b.googleRating - a.googleRating;
    });

    const highlightPOIs = sorted.slice(0, HIGHLIGHT_COUNT);
    const listPOIs = sorted.slice(HIGHLIGHT_COUNT);

    const themeRated = themePOIs.filter((p) => p.googleRating != null);
    const themeAvg =
      themeRated.length > 0
        ? themeRated.reduce((s, p) => s + (p.googleRating ?? 0), 0) /
          themeRated.length
        : null;
    const themeReviews = themePOIs.reduce(
      (s, p) => s + (p.googleReviewCount ?? 0),
      0
    );
    const editorialCount = themePOIs.filter((p) => p.editorialHook).length;

    const richnessScore =
      themeRated.length * 2 + editorialCount * 3 + themePOIs.length;

    themes.push({
      id: themeDef.id,
      name: themeDef.name,
      icon: themeDef.icon,
      stats: {
        totalPOIs: themePOIs.length,
        ratedPOIs: themeRated.length,
        avgRating: themeAvg != null ? Math.round(themeAvg * 10) / 10 : null,
        totalReviews: themeReviews,
        editorialCount,
      },
      highlightPOIs,
      listPOIs,
      allPOIs: themePOIs,
      richnessScore,
    });
  }

  // Sort themes by richness descending
  themes.sort((a, b) => b.richnessScore - a.richnessScore);

  return {
    projectName: project.name,
    address: project.pois[0]?.address ?? "",
    centerCoordinates: project.centerCoordinates,
    heroMetrics,
    themes,
  };
}
