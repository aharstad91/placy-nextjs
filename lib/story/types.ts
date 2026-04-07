/**
 * Story Mode — Type definitions.
 * Proper discriminated union for type-safe block rendering.
 */

import type { POI, Coordinates } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes/theme-definitions";

// --- Block types (discriminated union) ---

interface StoryBlockBase {
  readonly id: string;
}

export interface ChatBlock extends StoryBlockBase {
  readonly type: "chat";
  readonly text: string;
  readonly showAvatar?: boolean;
}

export interface POIBlock extends StoryBlockBase {
  readonly type: "poi";
  readonly poi: POI;
  readonly preRevealed?: boolean;
}

export interface MapBlock extends StoryBlockBase {
  readonly type: "map";
  readonly pois: readonly POI[];
  readonly center: Coordinates;
  readonly themeColor: string;
  readonly staticMapUrl: string | null;
}

export interface ChoiceBlock extends StoryBlockBase {
  readonly type: "choice";
  readonly options: readonly ChoiceOption[];
}

export interface FactBlock extends StoryBlockBase {
  readonly type: "fact";
  readonly icon: string;
  readonly number: number;
  readonly label: string;
  readonly themeColor: string;
}

export interface BridgeBlock extends StoryBlockBase {
  readonly type: "bridge";
  readonly themeId: string;
  readonly themeName: string;
  readonly themeIcon: string;
  readonly themeColor: string;
  readonly bridgeText: string;
}

export interface SummaryBlock extends StoryBlockBase {
  readonly type: "summary";
  readonly themes: readonly SummaryTheme[];
  readonly explorerUrl: string;
  readonly reportUrl: string;
}

export type StoryBlock =
  | ChatBlock
  | POIBlock
  | MapBlock
  | ChoiceBlock
  | FactBlock
  | BridgeBlock
  | SummaryBlock;

// --- Supporting types ---

export interface ChoiceOption {
  readonly id: string;
  readonly label: string;
  readonly action: "more" | "next-theme" | "summary";
}

export interface SummaryTheme {
  readonly themeId: string;
  readonly themeName: string;
  readonly themeIcon: string;
  readonly themeColor: string;
  readonly poiCount: number;
  readonly topPOI: POI;
  readonly avgWalkMinutes: number | null;
}

// --- Composition result ---

export interface StoryComposition {
  readonly intro: readonly StoryBlock[];
  readonly themes: readonly ThemeDefinition[];
  readonly getThemeBlocks: (themeId: string, batchIndex: number) => readonly StoryBlock[];
  readonly getThemeRemainingCount: (themeId: string, batchIndex: number) => number;
  readonly getSummary: (visitedThemes: readonly string[]) => readonly StoryBlock[];
}

// --- Constants ---

export const STORY_BATCH_SIZE = 3;
export const THEME_MIN_POIS = 2;
