/**
 * Story Mode v2 — Type definitions.
 * Compact, map-driven conversational scrollytelling.
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

/** Compact map stripe showing all theme POIs as dots — tap to open full map */
export interface MapStripeBlock extends StoryBlockBase {
  readonly type: "map-stripe";
  readonly staticMapUrl: string | null;
  readonly themeColor: string;
  readonly poiCount: number;
  readonly themeName: string;
  readonly pois: readonly POI[];
  readonly center: Coordinates;
}

/** 2×2 photo grid replacing map stripe — 3 POI images + "Vis kart" cell */
export interface PhotoGridBlock extends StoryBlockBase {
  readonly type: "photo-grid";
  readonly photos: readonly { name: string; imageUrl: string }[];
  readonly themeColor: string;
  readonly themeName: string;
  readonly poiCount: number;
  /** Data for map modal (opened from "Vis kart" cell) */
  readonly pois: readonly POI[];
  readonly center: Coordinates;
}

/** Compact list of POIs inside a chat bubble — tap to expand */
export interface POIListBlock extends StoryBlockBase {
  readonly type: "poi-list";
  readonly pois: readonly POI[];
  readonly themeColor: string;
}

export interface ChoiceBlock extends StoryBlockBase {
  readonly type: "choice";
  readonly options: readonly ChoiceOption[];
}

export interface SummaryBlock extends StoryBlockBase {
  readonly type: "summary";
  readonly themes: readonly SummaryTheme[];
  readonly explorerUrl: string;
  readonly reportUrl: string;
}

export type StoryBlock =
  | ChatBlock
  | MapStripeBlock
  | PhotoGridBlock
  | POIListBlock
  | ChoiceBlock
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

export const STORY_BATCH_SIZE = 5;
export const THEME_MIN_POIS = 2;
