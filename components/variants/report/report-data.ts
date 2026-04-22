import type {
  Project,
  POI,
  Coordinates,
  TrailCollection,
  ReportSummary,
  BrokerInfo,
  ReportCTA,
  ReportThemeGroundingView,
} from "@/lib/types";
import { ReportThemeGroundingViewSchema } from "@/lib/types";
import { getReportThemes } from "./report-themes";
import {
  calculateCategoryScore,
  generateCategoryQuote,
  type CategoryScore,
} from "@/lib/utils/category-score";
import { calculateReportScore, NULL_TIER_VALUE, byTierThenScore } from "@/lib/utils/poi-score";
import { getSchoolZone } from "@/lib/utils/school-zones";
import { getThemeQuestion, t, interpolate, type Locale } from "@/lib/i18n/strings";
import { generateBridgeText } from "@/lib/generators/bridge-text-generator";
import { getHeroInsightPOIIds } from "./ReportHeroInsight";
import { getTopRankedPOIs } from "./top-ranked-pois";

/**
 * Zod-parse grounding fra products.config ved render-boundary. Silent skip +
 * server-log ved invalid shape — report-seksjonen rendres ellers normalt.
 */
function parseGroundingOrLog(
  raw: unknown,
  project: Project,
  themeId: string,
): ReportThemeGroundingView | undefined {
  if (!raw) return undefined;
  const result = ReportThemeGroundingViewSchema.safeParse(raw);
  if (result.success) return result.data;
  console.error("[grounding] Zod-parse failed — skipping", {
    projectId: `${project.customer}/${project.urlSlug}`,
    themeId,
    issue: result.error.issues[0]?.message ?? "unknown",
  });
  return undefined;
}

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

export interface ReportSubSection {
  categoryId: string;
  name: string;
  icon: string;
  color: string;
  stats: ReportThemeStats;
  /** All POIs sorted by tier then score. First `initialVisibleCount` are shown, rest behind "Hent flere". */
  pois: POI[];
  hiddenPOIs: POI[];
  allPOIs: POI[];
  quote: string;
  bridgeText?: string;
}

export interface ReportTheme {
  id: string;
  name: string;
  icon: string;
  color: string;
  question?: string;
  intro?: string;
  bridgeText?: string;
  upperNarrative?: string;
  extendedBridgeText?: string;
  lowerNarrative?: string;
  readMoreQuery?: string;
  /** Build-time Gemini-grounding, Zod-validated. Undefined = skjul "Utdyp med Google AI"-knappen. */
  grounding?: ReportThemeGroundingView;
  stats: ReportThemeStats;
  /** All POIs sorted by tier then score. First INITIAL_VISIBLE_COUNT shown, rest behind "Hent flere". */
  pois: POI[];
  allPOIs: POI[];
  /** Top-N ranked POIs (rating × tier-vekt). Precomputed én gang per theme-build.
   *  Brukes for map-bottom-carousel (10 items, ren ranking). */
  topRanked: readonly POI[];
  hiddenPOIs: POI[];
  richnessScore: number;
  score: CategoryScore;
  quote: string;
  /** Sub-sections for categories exceeding SUB_SECTION_THRESHOLD */
  subSections?: ReportSubSection[];
  /** Trail/route overlay GeoJSON — only set for natur-friluftsliv theme */
  trails?: TrailCollection;
  /** Optional banner illustration (auto-cropped, natural aspect). Rendered under heading + intro. */
  image?: ThemeIllustration;
}

export interface ThemeIllustration {
  src: string;
  /** Intrinsic width after auto-crop (used by next/image for aspect-ratio hint — prevents layout shift). */
  width: number;
  /** Intrinsic height after auto-crop. */
  height: number;
}

/**
 * Per-theme illustrations shown under the heading+intro in ReportThemeSection.
 * Files are auto-cropped to bounding box of non-white content (see scripts/crop_illustrations.py),
 * so each image has its own natural aspect ratio. Dimensions kept in sync with cropped files.
 */
const THEME_ILLUSTRATIONS: Record<string, ThemeIllustration> = {
  hverdagsliv: { src: "/illustrations/hverdagsliv.jpg", width: 1220, height: 654 },
  "barn-oppvekst": { src: "/illustrations/barn-aktivitet.jpg", width: 1255, height: 728 },
  "mat-drikke": { src: "/illustrations/mat-drikke.jpg", width: 1188, height: 748 },
  "natur-friluftsliv": { src: "/illustrations/natur-friluftsliv.jpg", width: 1219, height: 784 },
  "trening-aktivitet": { src: "/illustrations/trening-aktivitet.jpg", width: 1226, height: 771 },
  transport: { src: "/illustrations/transport-mobilitet.jpg", width: 1189, height: 728 },
};

/** Project-specific illustration overrides — use when a project needs a different visual character than the defaults. */
const PROJECT_THEME_ILLUSTRATIONS: Record<string, Record<string, ThemeIllustration>> = {
  "banenor-eiendom_stasjonskvartalet": {
    hverdagsliv:        { src: "/illustrations/stasjonskvartalet-hverdagsliv.jpg",      width: 1264, height: 848 },
    "barn-oppvekst":    { src: "/illustrations/stasjonskvartalet-barn-oppvekst.jpg",     width: 1264, height: 848 },
    "mat-drikke":       { src: "/illustrations/stasjonskvartalet-mat-drikke.jpg",        width: 1264, height: 848 },
    opplevelser:        { src: "/illustrations/stasjonskvartalet-opplevelser.jpg",       width: 1264, height: 848 },
    "natur-friluftsliv":{ src: "/illustrations/stasjonskvartalet-natur-friluftsliv.jpg",width: 1264, height: 848 },
    "trening-aktivitet":{ src: "/illustrations/stasjonskvartalet-trening-aktivitet.jpg",width: 1264, height: 848 },
    transport:          { src: "/illustrations/stasjonskvartalet-transport.jpg",         width: 1264, height: 848 },
  },
};

/** Per-prosjekt default heading for 3D-kart (0–359°). 0 = nord. */
const PROJECT_3D_HEADINGS: Record<string, number> = {
  "banenor-eiendom_stasjonskvartalet": 180,
};

export interface ReportData {
  projectName: string;
  address: string;
  centerCoordinates: { lat: number; lng: number };
  heroMetrics: ReportHeroMetrics;
  themes: ReportTheme[];
  /**
   * Hele prosjektets POI-set (ufiltrert). Brukes av curated-grounded-narrative
   * for å slå opp POI-chips på tvers av kategorier — theme-filtrerte POI-lister
   * kan droppe POIs som curated tekst refererer til.
   */
  allProjectPOIs: POI[];
  label?: string;
  heroIntro?: string;
  heroImage?: string;
  summary?: ReportSummary;
  brokers?: BrokerInfo[];
  cta?: ReportCTA;
  mapStyle?: string;
  /** Default heading for alle 3D-kart-instanser (0–359°). Undefined = nord (0). */
  initialHeading?: number;
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
  "charging_station",
]);

const THEME_MIN_POIS = 2;

/** When any category within a theme has >= this many POIs, all categories become sub-sections */
export const SUB_SECTION_THRESHOLD = 15;

/** How many cards to show before "Hent flere" */
export const INITIAL_VISIBLE_COUNT = 6;

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

// byTierThenScore is now imported from @/lib/utils/poi-score (shared with Story Mode)
// Re-export for backward compatibility with any imports from this file
export { byTierThenScore } from "@/lib/utils/poi-score";

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

/** Split sorted POIs into visible and hidden (behind "Hent flere") */
function splitVisibleHidden(pois: POI[], visibleCount = INITIAL_VISIBLE_COUNT) {
  return {
    visiblePOIs: pois.slice(0, visibleCount),
    hiddenPOIs: pois.slice(visibleCount),
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
      // Fuzzy: also match with last char stripped (handles Blussuvold vs Blussuvoll etc.)
      if (zone.barneskole) {
        const zn = zone.barneskole.toLowerCase();
        if (name.includes(zn) || (zn.length >= 4 && name.includes(zn.slice(0, -1)))) return true;
      }
      if (zone.ungdomsskole) {
        const zn = zone.ungdomsskole.toLowerCase();
        if (name.includes(zn) || (zn.length >= 4 && name.includes(zn.slice(0, -1)))) return true;
      }
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
    const visibleCount = getInitialVisibleCount(catId);
    const { visiblePOIs, hiddenPOIs } = splitVisibleHidden(sortedCatPOIs, visibleCount);
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
      pois: visiblePOIs,
      hiddenPOIs,
      allPOIs: sortedCatPOIs,
      quote,
      bridgeText: categoryDescriptions?.[catId],
    };
  });
}

/**
 * Get the hero intro key based on project tags (bransjeprofil).
 */
function getIntroKey(tags?: string[]): "heroIntroBolig" | "heroIntroNaering" | "heroIntroFallback" {
  const tag = tags?.[0];
  if (tag === "Eiendom - Bolig") return "heroIntroBolig";
  if (tag === "Eiendom - Næring") return "heroIntroNaering";
  return "heroIntroFallback";
}

export function transformToReportData(project: Project, locale: Locale = "no"): ReportData {
  const allPOIs = project.pois;

  // Build parent→children lookup for parent-child POI hierarchy
  const childByParent = new Map<string, POI[]>();
  for (const poi of allPOIs) {
    if (poi.parentPoiId) {
      const arr = childByParent.get(poi.parentPoiId);
      if (arr) arr.push(poi); else childByParent.set(poi.parentPoiId, [poi]);
    }
  }

  // Exclude child POIs from hero metrics
  const topLevelPOIs = allPOIs.filter((p) => !p.parentPoiId);

  // Build hero metrics
  const ratedPOIs = topLevelPOIs.filter((p) => p.googleRating != null);
  const totalReviews = topLevelPOIs.reduce(
    (sum, p) => sum + (p.googleReviewCount ?? 0),
    0
  );
  const avgRating =
    ratedPOIs.length > 0
      ? ratedPOIs.reduce((sum, p) => sum + (p.googleRating ?? 0), 0) /
        ratedPOIs.length
      : 0;
  const transportCount = topLevelPOIs.filter((p) =>
    TRANSPORT_CATEGORIES.has(p.category.id)
  ).length;

  const heroMetrics: ReportHeroMetrics = {
    totalPOIs: topLevelPOIs.length,
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

    // Opplevelser krever minst én POI innen 15 min — ellers er det ikke et reelt nabolagstilbud
    if (themeDef.id === "opplevelser") {
      const nearest = themePOIs.reduce((best, p) => {
        const walk = p.travelTime?.walk ?? Infinity;
        return walk < (best.travelTime?.walk ?? Infinity) ? p : best;
      }, themePOIs[0]);
      if ((nearest.travelTime?.walk ?? Infinity) > 15) continue;
    }

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
    const categoryFiltered = applyThemeCategoryFilters(distanceSorted, center);

    // Filter child POIs when their parent is in the same theme, and attach children to parents
    const parentIdsInTheme = new Set(categoryFiltered.filter(p => !p.parentPoiId).map(p => p.id));
    const filtered = categoryFiltered.filter(p => !p.parentPoiId || !parentIdsInTheme.has(p.parentPoiId)).map(p => {
      const children = childByParent.get(p.id);
      return children ? { ...p, childPOIs: children } : p;
    });

    // Sort by tier then score and split into visible/hidden
    const sorted = [...filtered].sort(byTierThenScore);
    const { visiblePOIs, hiddenPOIs } = splitVisibleHidden(sorted);
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
    const subSections = buildSubSections(filtered, project.id, center, themeDef.categoryDescriptions);

    themes.push({
      id: themeDef.id,
      name: themeDef.name,
      icon: themeDef.icon,
      color: themeDef.color,
      question: getThemeQuestion(locale, themeDef.id),
      intro: themeDef.intro,
      bridgeText: themeDef.bridgeText || generateBridgeText(
        themeDef.id, filtered, center,
        getHeroInsightPOIIds(themeDef.id, filtered, center),
      ),
      upperNarrative: (themeDef as { upperNarrative?: string }).upperNarrative,
      extendedBridgeText: (themeDef as { extendedBridgeText?: string }).extendedBridgeText,
      lowerNarrative: (themeDef as { lowerNarrative?: string }).lowerNarrative,
      readMoreQuery: themeDef.readMoreQuery,
      grounding: parseGroundingOrLog(themeDef.grounding, project, themeDef.id),
      stats: {
        totalPOIs: filtered.length,
        ratedPOIs: themeStats.ratedCount,
        avgRating: themeStats.avgRating,
        totalReviews: themeStats.totalReviews,
        editorialCount: themeStats.editorialCount,
        uniqueCategories,
      },
      pois: visiblePOIs,
      allPOIs: filtered,
      topRanked: getTopRankedPOIs(filtered, 10),
      hiddenPOIs,
      richnessScore,
      score,
      quote,
      subSections: subSections.length > 0 ? subSections : undefined,
      trails: themeDef.id === "natur-friluftsliv"
        ? project.reportConfig?.trails
        : undefined,
      image: PROJECT_THEME_ILLUSTRATIONS[`${project.customer}_${project.urlSlug}`]?.[themeDef.id] ?? THEME_ILLUSTRATIONS[themeDef.id],
    });
  }

  // If themes come from reportConfig, preserve that order; otherwise sort by richness
  if (!project.reportConfig?.themes) {
    themes.sort((a, b) => b.richnessScore - a.richnessScore);
  }

  const rc = project.reportConfig;

  // Hero intro: reportConfig override > bransjeprofil template > undefined
  const heroIntro = rc?.heroIntro
    ?? interpolate(t(locale, getIntroKey(project.tags)), { name: project.name });

  return {
    projectName: project.name,
    address: project.pois[0]?.address ?? "",
    centerCoordinates: project.centerCoordinates,
    heroMetrics,
    themes,
    allProjectPOIs: project.pois,
    label: rc?.label,
    heroIntro,
    heroImage: rc?.heroImage,
    summary: rc?.summary,
    brokers: rc?.brokers,
    cta: rc?.cta,
    mapStyle: rc?.mapStyle,
    initialHeading: PROJECT_3D_HEADINGS[`${project.customer}_${project.urlSlug}`],
  };
}
