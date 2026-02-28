import type { Project, POI, Coordinates } from "@/lib/types";
import { getReportThemes } from "./report-themes";
import {
  calculateCategoryScore,
  generateCategoryQuote,
  type CategoryScore,
} from "@/lib/utils/category-score";
import { calculateReportScore, NULL_TIER_VALUE } from "@/lib/utils/poi-score";
import { getSchoolZone } from "@/lib/utils/school-zones";

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
  bridgeText?: string;
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
export const INITIAL_VISIBLE_COUNT = 12;

/** Display mode per theme — editorial gets photo cards, functional gets compact list */
const CATEGORY_DISPLAY_MODE: Record<string, ThemeDisplayMode> = {
  "mat-drikke": "editorial",
  "kultur-opplevelser": "editorial",
  "trening-velvare": "editorial",
  "hverdagsbehov": "functional",
  "transport": "functional",
};

// ---------- Per-category filtering rules ----------

interface CategoryFilterRule {
  /** Max total POIs to include (before split). Rest are discarded, not hidden. */
  maxCount?: number;
  /** How many to show initially (rest go behind "Hent flere"). Overrides INITIAL_VISIBLE_COUNT. */
  initialVisibleCount?: number;
  /** Special filter: "school-zone" uses skolekrets lookup to keep only zone-matching schools. */
  filter?: "school-zone";
}

/**
 * Per-category rules for how many POIs to show in the report.
 * Categories not listed here use the global INITIAL_VISIBLE_COUNT with no max cap.
 */
const CATEGORY_FILTER_RULES: Record<string, CategoryFilterRule> = {
  bus:      { maxCount: 5, initialVisibleCount: 5 },
  tram:     { maxCount: 5, initialVisibleCount: 5 },
  bike:     { maxCount: 5, initialVisibleCount: 5 },
  skole:    { filter: "school-zone" },
  barnehage: { initialVisibleCount: 6 },
  idrett:   { maxCount: 3, initialVisibleCount: 3 },
  lekeplass: { initialVisibleCount: 5 },
};

/**
 * Higher education categories are NOT filtered by school zone — we show nearest N.
 * These are shown alongside zone-matched schools in the "skole" sub-section.
 */
const HIGHER_ED_KEYWORDS = ["vgs", "videregående", "ntnu", "høgskole", "høyskole", "universitet"];

// --- Shared helpers (used by both buildSubSections and transformToReportData) ---

/** Sort comparator: highest formula score first (rating × log2(1 + reviews)) */
function byFormulaScore(a: POI, b: POI): number {
  return calculateReportScore(b) - calculateReportScore(a);
}

/** Sort comparator: tier first (lower = better), then formula score within same tier */
export function byTierThenScore(a: POI, b: POI): number {
  const aTier = a.poiTier ?? NULL_TIER_VALUE;
  const bTier = b.poiTier ?? NULL_TIER_VALUE;
  if (aTier !== bTier) return aTier - bTier;
  return calculateReportScore(b) - calculateReportScore(a);
}

/** Pick highlight POIs: featured first, then Tier 1, fallback to formula score. Returns [] for functional mode. */
function pickHighlights(pois: POI[], displayMode: ThemeDisplayMode): POI[] {
  if (displayMode !== "editorial") return [];

  // 1. Featured POIs (manually curated) — return ALL featured, nothing else
  const featured = pois.filter((p) => p.featured);
  if (featured.length > 0) return featured;

  // 2. Tier 1 first, fill remaining with top formula-scored
  const tier1 = pois.filter((p) => p.poiTier === 1);
  const rest = pois.filter((p) => p.poiTier !== 1).sort(byFormulaScore);
  return [...tier1, ...rest].slice(0, HIGHLIGHT_FALLBACK_COUNT);
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

/** Split POIs into listPOIs (visible) and hiddenPOIs (behind "Hent flere") */
function splitVisibleHidden(pois: POI[], highlights: POI[], visibleCount = INITIAL_VISIBLE_COUNT) {
  const highlightIds = new Set(highlights.map((p) => p.id));
  const rest = pois.filter((p) => !highlightIds.has(p.id));
  return {
    listPOIs: rest.slice(0, visibleCount),
    hiddenPOIs: rest.slice(visibleCount),
  };
}

// ---------- Category-level filtering ----------

/**
 * Apply per-category filter rules to a set of POIs (already sorted by distance).
 * For "school-zone" filter: keep only schools in the project's skolekrets + higher ed.
 * For maxCount: keep only the N nearest.
 */
export function applyCategoryFilter(
  categoryId: string,
  pois: POI[],
  center: Coordinates,
): POI[] {
  const rule = CATEGORY_FILTER_RULES[categoryId];
  if (!rule) return pois;

  let filtered = pois;

  // School zone filter: keep matching zone schools + higher ed
  if (rule.filter === "school-zone") {
    const zone = getSchoolZone(center.lat, center.lng);
    filtered = pois.filter((poi) => {
      const name = poi.name.toLowerCase();
      // Always keep higher education (VGS, NTNU, etc.)
      if (HIGHER_ED_KEYWORDS.some((kw) => name.includes(kw))) return true;
      // Keep if school name matches the zone's barneskole or ungdomsskole
      if (zone.barneskole && name.includes(zone.barneskole.toLowerCase())) return true;
      if (zone.ungdomsskole && name.includes(zone.ungdomsskole.toLowerCase())) return true;
      return false;
    });
  }

  // Max count cap: keep only the N nearest (already sorted by distance)
  if (rule.maxCount != null) {
    filtered = filtered.slice(0, rule.maxCount);
  }

  return filtered;
}

/** Get the initialVisibleCount for a category, falling back to the global default */
function getInitialVisibleCount(categoryId: string): number {
  return CATEGORY_FILTER_RULES[categoryId]?.initialVisibleCount ?? INITIAL_VISIBLE_COUNT;
}

/**
 * Apply per-category filters across all POIs in a theme.
 * Groups by category, applies each category's filter rules, then reassembles
 * in the original distance-sorted order.
 */
function applyThemeCategoryFilters(sortedPOIs: POI[], center: Coordinates): POI[] {
  // Group by category while preserving order
  const byCat = new Map<string, POI[]>();
  for (const poi of sortedPOIs) {
    const catId = poi.category.id;
    const arr = byCat.get(catId);
    if (arr) arr.push(poi);
    else byCat.set(catId, [poi]);
  }

  // Apply filter to each category group
  const allowedIds = new Set<string>();
  byCat.forEach((pois, catId) => {
    const filtered = applyCategoryFilter(catId, pois, center);
    for (const poi of filtered) allowedIds.add(poi.id);
  });

  // Return in original order, keeping only allowed POIs
  return sortedPOIs.filter((p) => allowedIds.has(p.id));
}

/**
 * Group sorted POIs by category and build sub-sections for categories
 * exceeding SUB_SECTION_THRESHOLD. Returns empty array if no splitting needed.
 */
function buildSubSections(
  themePOIs: POI[],
  parentDisplayMode: ThemeDisplayMode,
  projectId: string,
  center: Coordinates,
  categoryDescriptions?: Record<string, string>,
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
    // Apply per-category filtering (school-zone, maxCount) before sorting/splitting
    const filteredPOIs = applyCategoryFilter(catId, catPOIs, center);
    // Sort by tier then formula score so highlights and visible list show best POIs
    const sortedCatPOIs = [...filteredPOIs].sort(byTierThenScore);
    const highlights = pickHighlights(sortedCatPOIs, parentDisplayMode);
    const visibleCount = getInitialVisibleCount(catId);
    const { listPOIs, hiddenPOIs } = splitVisibleHidden(sortedCatPOIs, highlights, visibleCount);
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
        totalPOIs: sortedCatPOIs.length,
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
      bridgeText: categoryDescriptions?.[catId],
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

  const center = project.centerCoordinates;

  for (const themeDef of themeDefinitions) {
    const cats = new Set(themeDef.categories);
    const themePOIs = allPOIs.filter((p) => cats.has(p.category.id));

    if (themePOIs.length < THEME_MIN_POIS) continue;

    // Sort by distance to project center (closest first)
    const distanceSorted = [...themePOIs].sort((a, b) => {
      const aWalk = a.travelTime?.walk;
      const bWalk = b.travelTime?.walk;
      if (aWalk != null && bWalk != null) return aWalk - bWalk;
      return (
        haversineMeters(center, a.coordinates) -
        haversineMeters(center, b.coordinates)
      );
    });

    // Apply per-category filtering (school-zone, maxCount) to each category group,
    // then reassemble the theme's POI list preserving distance order.
    const filtered = applyThemeCategoryFilters(distanceSorted, center);

    // Split into highlight POIs (featured/top-rated) and the rest
    const displayMode = (CATEGORY_DISPLAY_MODE[themeDef.id] ?? "editorial") as ThemeDisplayMode;
    const highlightPOIs = pickHighlights(filtered, displayMode);

    // For theme-level split, use the smallest per-category initialVisibleCount
    // or the global default if no categories have custom rules
    const { listPOIs, hiddenPOIs } = splitVisibleHidden(filtered, highlightPOIs);
    const themeStats = computePOIStats(filtered);

    const uniqueCategories = new Set(filtered.map((p) => p.category.id)).size;

    const richnessScore =
      themeStats.ratedCount * 2 + themeStats.editorialCount * 3 + filtered.length;

    const score = calculateCategoryScore({
      totalPOIs: filtered.length,
      avgRating: themeStats.avgRating,
      avgWalkTimeMinutes: null,
      uniqueCategories,
    });

    const quote = generateCategoryQuote(
      themeDef.id,
      score.total,
      uniqueCategories,
      project.id
    );

    // Build sub-sections with per-category filtering
    const subSections = buildSubSections(filtered, displayMode, project.id, center, themeDef.categoryDescriptions);

    themes.push({
      id: themeDef.id,
      name: themeDef.name,
      icon: themeDef.icon,
      intro: themeDef.intro,
      bridgeText: themeDef.bridgeText,
      stats: {
        totalPOIs: filtered.length,
        ratedPOIs: themeStats.ratedCount,
        avgRating: themeStats.avgRating,
        totalReviews: themeStats.totalReviews,
        editorialCount: themeStats.editorialCount,
        uniqueCategories,
      },
      highlightPOIs,
      listPOIs,
      allPOIs: filtered,
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
