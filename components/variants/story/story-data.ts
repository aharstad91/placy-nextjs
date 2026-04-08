/**
 * Story Data Transformation
 *
 * Transforms a Project into StoryData — the minimal structure needed
 * for the editorial Story view. Simpler than report-data.ts; focused
 * on narrative text and POI highlights rather than comprehensive grids.
 */

import type { Project, POI, Coordinates } from "@/lib/types";
import { getReportThemes, type ReportThemeDefinition } from "@/components/variants/report/report-themes";
import { byTierThenScore } from "@/components/variants/report/report-data";
import { generateBridgeText } from "@/lib/generators/bridge-text-generator";
import { getBransjeprofil } from "@/lib/themes";

// ============================================================
// Types
// ============================================================

export interface StoryThemeStats {
  totalPOIs: number;
  avgRating: number | null;
  totalReviews: number;
}

export interface StoryTheme {
  id: string;
  name: string;
  icon: string;
  color: string;
  bridgeText: string;
  extendedBridgeText?: string;
  highlights: POI[];
  allPOIs: POI[];
  stats: StoryThemeStats;
}

export interface StoryData {
  projectName: string;
  heroIntro: string;
  center: Coordinates;
  themes: StoryTheme[];
  explorerUrl?: string;
  reportUrl?: string;
}

// ============================================================
// Constants
// ============================================================

const THEME_MIN_POIS = 2;
const HIGHLIGHT_COUNT = 3;

// ============================================================
// Transform
// ============================================================

export function transformToStoryData(project: Project): StoryData {
  const allPOIs = project.pois;
  const themeDefinitions = getReportThemes(project);
  const center = project.centerCoordinates;

  // Build color lookup from bransjeprofil (reportConfig themes may lack color)
  const profil = getBransjeprofil(project.tags);
  const profilColorMap = new Map(profil.themes.map((t) => [t.id, t.color]));
  const DEFAULT_COLOR = "#6b7280";

  const themes: StoryTheme[] = [];

  for (const themeDef of themeDefinitions) {
    const cats = new Set(themeDef.categories);
    const themePOIs = allPOIs.filter((p) => cats.has(p.category.id));

    if (themePOIs.length < THEME_MIN_POIS) continue;

    // Sort by quality (tier + score)
    const sorted = [...themePOIs].sort(byTierThenScore);

    // Stats
    const rated = sorted.filter((p) => p.googleRating != null);
    const avgRating =
      rated.length > 0
        ? Math.round(
            (rated.reduce((s, p) => s + (p.googleRating ?? 0), 0) / rated.length) * 10,
          ) / 10
        : null;
    const totalReviews = sorted.reduce((s, p) => s + (p.googleReviewCount ?? 0), 0);

    // Narrative text: reportConfig override → auto-generated fallback
    const bridgeText =
      (themeDef as ReportThemeDefinition).bridgeText ||
      generateBridgeText(themeDef.id, sorted, center) ||
      "";

    const extendedBridgeText = (themeDef as ExtendedThemeDef).extendedBridgeText;

    if (!bridgeText) continue;

    const resolvedColor = themeDef.color || profilColorMap.get(themeDef.id) || DEFAULT_COLOR;

    themes.push({
      id: themeDef.id,
      name: themeDef.name,
      icon: themeDef.icon,
      color: resolvedColor,
      bridgeText,
      extendedBridgeText,
      highlights: sorted.slice(0, HIGHLIGHT_COUNT),
      allPOIs: sorted,
      stats: {
        totalPOIs: sorted.length,
        avgRating,
        totalReviews,
      },
    });
  }

  // Hero intro: reportConfig → generic fallback
  const heroIntro =
    project.reportConfig?.heroIntro ||
    `Oppdag nabolaget rundt ${project.name}.`;

  return {
    projectName: project.name,
    heroIntro,
    center,
    themes,
  };
}

// Internal: extended theme def that may carry extendedBridgeText from reportConfig
interface ExtendedThemeDef {
  extendedBridgeText?: string;
}
