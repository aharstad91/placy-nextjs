/**
 * Story Mode — Block composition engine.
 * Pure function: Project + themes → StoryComposition.
 *
 * No side effects, no fetching, no state. Runs client-side in useMemo().
 */

import type { Project, POI } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes/theme-definitions";
import { byTierThenScore } from "@/lib/utils/poi-score";
import { buildCategoryToTheme } from "@/lib/themes/bransjeprofiler";
import { getStaticMapUrlMulti } from "@/lib/mapbox-static";
import type {
  StoryBlock,
  StoryComposition,
  ChoiceOption,
  SummaryTheme,
} from "./types";
import { STORY_BATCH_SIZE, THEME_MIN_POIS } from "./types";
import {
  introText,
  themeIntroText,
  bridgeText,
  totalPoisFact,
  themePoisFact,
  summaryIntroText,
  CHOICE_SEE_MORE,
  CHOICE_NEXT_THEME,
  CHOICE_SUMMARY,
} from "./story-templates";

let blockCounter = 0;
function nextId(): string {
  return `sb-${++blockCounter}`;
}

/** Group POIs by theme, sorted by tier then score */
function groupPoisByTheme(
  pois: readonly POI[],
  themes: readonly ThemeDefinition[],
): Record<string, POI[]> {
  const catToTheme = buildCategoryToTheme(themes as ThemeDefinition[]);
  const groups: Record<string, POI[]> = {};

  for (const theme of themes) {
    groups[theme.id] = [];
  }

  for (const poi of pois) {
    if (!poi.category?.id) continue;
    const themeId = catToTheme[poi.category.id];
    if (themeId && groups[themeId]) {
      groups[themeId].push(poi);
    }
  }

  // Sort each group by quality
  for (const themeId of Object.keys(groups)) {
    groups[themeId].sort(byTierThenScore);
  }

  return groups;
}

/** Calculate walk minutes from travel time data */
function getWalkMinutes(poi: POI): number | null {
  const walkSeconds = poi.travelTime?.walk;
  if (walkSeconds == null) return null;
  return Math.round(walkSeconds / 60);
}

/** Average walk minutes for a set of POIs */
function avgWalkMinutes(pois: readonly POI[]): number | null {
  const times = pois
    .map(getWalkMinutes)
    .filter((t): t is number => t != null);
  if (times.length === 0) return null;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

/** Count total walkable POIs (with travel time data) */
function countWalkablePois(pois: readonly POI[]): number {
  return pois.filter((p) => p.travelTime?.walk != null).length;
}

export function composeStoryBlocks(
  project: Project,
  themes: ThemeDefinition[],
): StoryComposition {
  // Reset counter for each composition
  blockCounter = 0;

  const poisByTheme = groupPoisByTheme(project.pois, themes);

  // Filter themes with enough POIs and enrich with poiCount
  const availableThemes = themes
    .filter((t) => (poisByTheme[t.id]?.length ?? 0) >= THEME_MIN_POIS)
    .map((t) => ({ ...t, poiCount: poisByTheme[t.id]?.length ?? 0 }));

  // Build intro blocks
  const projectName = project.name;
  const totalWalkable = countWalkablePois(project.pois);

  const intro: StoryBlock[] = [
    {
      id: nextId(),
      type: "chat",
      text: introText(projectName),
      showAvatar: true,
    },
    {
      id: nextId(),
      type: "fact",
      icon: "MapPin",
      number: totalWalkable > 0 ? totalWalkable : project.pois.length,
      label: "steder innen gangavstand",
      themeColor: "#1a1a1a",
    },
  ];

  // Get theme blocks for a specific batch
  function getThemeBlocks(themeId: string, batchIndex: number): readonly StoryBlock[] {
    const theme = availableThemes.find((t) => t.id === themeId);
    if (!theme) return [];

    const allPois = poisByTheme[themeId] ?? [];
    const start = batchIndex * STORY_BATCH_SIZE;
    const batchPois = allPois.slice(start, start + STORY_BATCH_SIZE);
    const remaining = allPois.length - (start + batchPois.length);

    const blocks: StoryBlock[] = [];

    // First batch: add bridge + chat intro
    if (batchIndex === 0) {
      blocks.push({
        id: nextId(),
        type: "bridge",
        themeId: theme.id,
        themeName: theme.name,
        themeIcon: theme.icon,
        themeColor: theme.color,
        bridgeText: bridgeText(theme.name),
      });
      blocks.push({
        id: nextId(),
        type: "chat",
        text: themeIntroText(theme.name),
        showAvatar: false,
      });
    }

    // POI cards
    for (const poi of batchPois) {
      blocks.push({
        id: nextId(),
        type: "poi",
        poi,
      });
    }

    // Fact after first batch
    if (batchIndex === 0) {
      blocks.push({
        id: nextId(),
        type: "fact",
        icon: theme.icon,
        number: allPois.length,
        label: `${theme.name.toLowerCase()}-steder i nærheten`,
        themeColor: theme.color,
      });
    }

    // Choice prompt
    const options: ChoiceOption[] = [];
    if (remaining > 0) {
      options.push({ id: "more", label: `${CHOICE_SEE_MORE} (${remaining})`, action: "more" });
    }
    options.push({ id: "next-theme", label: CHOICE_NEXT_THEME, action: "next-theme" });
    options.push({ id: "summary", label: CHOICE_SUMMARY, action: "summary" });

    blocks.push({
      id: nextId(),
      type: "choice",
      options,
    });

    // Map after last batch of this theme
    if (remaining <= 0) {
      const mapUrl = getStaticMapUrlMulti({
        markers: allPois.slice(0, 15).map((p) => ({
          lat: p.coordinates.lat,
          lng: p.coordinates.lng,
          color: theme.color.replace("#", ""),
        })),
        width: 580,
        height: 326,
      });

      blocks.push({
        id: nextId(),
        type: "map",
        pois: allPois,
        center: project.centerCoordinates,
        themeColor: theme.color,
        staticMapUrl: mapUrl,
      });
    }

    return blocks;
  }

  function getThemeRemainingCount(themeId: string, batchIndex: number): number {
    const allPois = poisByTheme[themeId] ?? [];
    const consumed = (batchIndex + 1) * STORY_BATCH_SIZE;
    return Math.max(0, allPois.length - consumed);
  }

  // Build summary
  function getSummary(visitedThemeIds: readonly string[]): readonly StoryBlock[] {
    const summaryThemes: SummaryTheme[] = [];

    for (const themeId of visitedThemeIds) {
      const theme = availableThemes.find((t) => t.id === themeId);
      if (!theme) continue;
      const pois = poisByTheme[themeId] ?? [];
      if (pois.length === 0) continue;

      summaryThemes.push({
        themeId: theme.id,
        themeName: theme.name,
        themeIcon: theme.icon,
        themeColor: theme.color,
        poiCount: pois.length,
        topPOI: pois[0],
        avgWalkMinutes: avgWalkMinutes(pois),
      });
    }

    const blocks: StoryBlock[] = [
      {
        id: nextId(),
        type: "chat",
        text: summaryIntroText(),
        showAvatar: true,
      },
      {
        id: nextId(),
        type: "summary",
        themes: summaryThemes,
        explorerUrl: "",
        reportUrl: "",
      },
    ];

    return blocks;
  }

  return {
    intro,
    themes: availableThemes,
    getThemeBlocks,
    getThemeRemainingCount,
    getSummary,
  };
}
