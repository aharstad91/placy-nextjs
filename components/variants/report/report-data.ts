import type { Project, POI, Coordinates } from "@/lib/types";
import { getReportThemes } from "./report-themes";
import {
  calculateCategoryScore,
  generateCategoryQuote,
  type CategoryScore,
} from "@/lib/utils/category-score";
import { calculateReportScore } from "@/lib/utils/poi-score";

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

export interface ReportSubSection {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  stats: ReportThemeStats;
  highlightPOIs: POI[];
  listPOIs: POI[];
  hiddenPOIs: POI[];
  allPOIs: POI[];
  displayMode: ThemeDisplayMode;
  quote: string;
}

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
  /** Sub-sections for categories exceeding SUB_SECTION_THRESHOLD */
  subSections?: ReportSubSection[];
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

export const TRANSPORT_CATEGORIES = new Set([
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

/** When any category within a theme has >= this many POIs, all categories become sub-sections */
export const SUB_SECTION_THRESHOLD = 15;

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

// --- Shared helpers (used by both buildSubSections and transformToReportData) ---

/** Sort comparator: highest formula score first (rating × log2(1 + reviews)) */
function byFormulaScore(a: POI, b: POI): number {
  return calculateReportScore(b) - calculateReportScore(a);
}

/** Pick highlight POIs: featured first, fallback to top-rated. Returns [] for functional mode. */
function pickHighlights(pois: POI[], displayMode: ThemeDisplayMode): POI[] {
  if (displayMode !== "editorial") return [];
  const featured = pois.filter((p) => p.featured);
  if (featured.length > 0) return featured;
  return [...pois].sort(byFormulaScore).slice(0, HIGHLIGHT_FALLBACK_COUNT);
}

/** Compute stats from a POI array */
function computePOIStats(pois: POI[]) {
  const rated = pois.filter((p) => p.googleRating != null);
  const avg =
    rated.length > 0
      ? rated.reduce((s, p) => s + (p.googleRating ?? 0), 0) / rated.length
      : null;
  return {
    ratedCount: rated.length,
    avgRating: avg != null ? Math.round(avg * 10) / 10 : null,
    totalReviews: pois.reduce((s, p) => s + (p.googleReviewCount ?? 0), 0),
    editorialCount: pois.filter((p) => p.editorialHook).length,
  };
}

/** Split POIs into listPOIs (visible) and hiddenPOIs (behind "Vis meg mer") */
function splitVisibleHidden(pois: POI[], highlights: POI[]) {
  const highlightIds = new Set(highlights.map((p) => p.id));
  const rest = pois.filter((p) => !highlightIds.has(p.id));
  return {
    listPOIs: rest.slice(0, INITIAL_VISIBLE_COUNT),
    hiddenPOIs: rest.slice(INITIAL_VISIBLE_COUNT),
  };
}

/**
 * Group sorted POIs by category and build sub-sections for categories
 * exceeding SUB_SECTION_THRESHOLD. Returns empty array if no splitting needed.
 */
function buildSubSections(
  themePOIs: POI[],
  parentDisplayMode: ThemeDisplayMode,
  projectId: string,
): ReportSubSection[] {
  // Group by category
  const byCat = new Map<string, POI[]>();
  for (const poi of themePOIs) {
    const catId = poi.category.id;
    const arr = byCat.get(catId);
    if (arr) {
      arr.push(poi);
    } else {
      byCat.set(catId, [poi]);
    }
  }

  // When ANY category meets threshold, ALL categories become sub-sections
  const hasLargeCat = Array.from(byCat.values()).some(
    (pois) => pois.length >= SUB_SECTION_THRESHOLD
  );
  if (!hasLargeCat) return [];

  // Build sub-sections for ALL categories, sorted by count (most first)
  const allCats = Array.from(byCat.entries());
  allCats.sort((a, b) => b[1].length - a[1].length);

  return allCats.map(([catId, catPOIs]) => {
    const sample = catPOIs[0].category;
    // Sort by formula score so highlights and visible list show best POIs
    const sortedCatPOIs = [...catPOIs].sort(byFormulaScore);
    const highlights = pickHighlights(sortedCatPOIs, parentDisplayMode);
    const { listPOIs, hiddenPOIs } = splitVisibleHidden(sortedCatPOIs, highlights);
    const stats = computePOIStats(sortedCatPOIs);

    const subScore = calculateCategoryScore({
      totalPOIs: sortedCatPOIs.length,
      avgRating: stats.avgRating,
      avgWalkTimeMinutes: null,
      uniqueCategories: 1,
    });

    const quote = generateCategoryQuote(
      catId,
      subScore.total,
      1,
      projectId
    );

    return {
      categoryId: catId,
      name: sample.name,
      icon: sample.icon,
      color: sample.color,
      stats: {
        totalPOIs: catPOIs.length,
        ratedPOIs: stats.ratedCount,
        avgRating: stats.avgRating,
        totalReviews: stats.totalReviews,
        editorialCount: stats.editorialCount,
        uniqueCategories: 1,
      },
      highlightPOIs: highlights,
      listPOIs,
      hiddenPOIs,
      allPOIs: sortedCatPOIs,
      displayMode: parentDisplayMode,
      quote,
    };
  });
}

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

  for (const themeDef of themeDefinitions) {
    const cats = new Set(themeDef.categories);
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
    const displayMode = (CATEGORY_DISPLAY_MODE[themeDef.id] ?? "editorial") as ThemeDisplayMode;
    const highlightPOIs = pickHighlights(sorted, displayMode);
    const { listPOIs, hiddenPOIs } = splitVisibleHidden(sorted, highlightPOIs);
    const themeStats = computePOIStats(sorted);

    // Count unique categories within theme
    const uniqueCategories = new Set(sorted.map((p) => p.category.id)).size;

    const richnessScore =
      themeStats.ratedCount * 2 + themeStats.editorialCount * 3 + sorted.length;

    // Calculate category score
    const score = calculateCategoryScore({
      totalPOIs: sorted.length,
      avgRating: themeStats.avgRating,
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

    // Build sub-sections for categories exceeding threshold
    const subSections = buildSubSections(sorted, displayMode, project.id);

    themes.push({
      id: themeDef.id,
      name: themeDef.name,
      icon: themeDef.icon,
      intro: themeDef.intro,
      bridgeText: themeDef.bridgeText,
      stats: {
        totalPOIs: sorted.length,
        ratedPOIs: themeStats.ratedCount,
        avgRating: themeStats.avgRating,
        totalReviews: themeStats.totalReviews,
        editorialCount: themeStats.editorialCount,
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
      subSections: subSections.length > 0 ? subSections : undefined,
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
