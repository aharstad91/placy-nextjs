/**
 * Story Mode v2 — Block composition engine.
 * Compact, map-driven: ~1 screen height per theme.
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
  CHOICE_SEE_MORE,
  CHOICE_NEXT_THEME,
  CHOICE_SUMMARY,
} from "./story-templates";

let blockCounter = 0;
function nextId(): string {
  return `sb-${++blockCounter}`;
}

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
  for (const themeId of Object.keys(groups)) {
    groups[themeId].sort(byTierThenScore);
  }
  return groups;
}

function avgWalkMinutes(pois: readonly POI[]): number | null {
  const times = pois
    .map((p) => p.travelTime?.walk)
    .filter((t): t is number => t != null)
    .map((s) => Math.round(s / 60));
  if (times.length === 0) return null;
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
}

/** Shorten address-style names */
function shortName(name: string): string {
  const firstComma = name.indexOf(",");
  return firstComma > 0 ? name.substring(0, firstComma).trim() : name;
}

export function composeStoryBlocks(
  project: Project,
  themes: ThemeDefinition[],
): StoryComposition {
  blockCounter = 0;

  const poisByTheme = groupPoisByTheme(project.pois, themes);

  const availableThemes = themes
    .filter((t) => (poisByTheme[t.id]?.length ?? 0) >= THEME_MIN_POIS)
    .map((t) => ({ ...t, poiCount: poisByTheme[t.id]?.length ?? 0 }));

  // v2 intro: just one chat bubble + theme selector
  const intro: StoryBlock[] = [
    {
      id: nextId(),
      type: "chat",
      text: `Hva vil du vite om ${shortName(project.name)}?`,
      showAvatar: true,
    },
  ];

  function getThemeBlocks(themeId: string, batchIndex: number): readonly StoryBlock[] {
    const theme = availableThemes.find((t) => t.id === themeId);
    if (!theme) return [];

    const allPois = poisByTheme[themeId] ?? [];
    const start = batchIndex * STORY_BATCH_SIZE;
    const batchPois = allPois.slice(start, start + STORY_BATCH_SIZE);
    const remaining = allPois.length - (start + batchPois.length);

    const blocks: StoryBlock[] = [];

    // First batch: map stripe + intro
    if (batchIndex === 0) {
      const mapUrl = getStaticMapUrlMulti({
        markers: allPois.slice(0, 15).map((p) => ({
          lat: p.coordinates.lat,
          lng: p.coordinates.lng,
          color: theme.color.replace("#", ""),
        })),
        width: 580,
        height: 200,
      });

      blocks.push({
        id: nextId(),
        type: "map-stripe",
        staticMapUrl: mapUrl,
        themeColor: theme.color,
        poiCount: allPois.length,
        themeName: theme.name,
      });
    }

    // POI list bubble
    blocks.push({
      id: nextId(),
      type: "poi-list",
      pois: batchPois,
      themeColor: theme.color,
    });

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

    return blocks;
  }

  function getThemeRemainingCount(themeId: string, batchIndex: number): number {
    const allPois = poisByTheme[themeId] ?? [];
    const consumed = (batchIndex + 1) * STORY_BATCH_SIZE;
    return Math.max(0, allPois.length - consumed);
  }

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

    return [
      {
        id: nextId(),
        type: "chat",
        text: "Her er området ditt oppsummert",
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
  }

  return {
    intro,
    themes: availableThemes,
    getThemeBlocks,
    getThemeRemainingCount,
    getSummary,
  };
}
