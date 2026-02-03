// Placy TypeScript Typer
// Basert på placy-concept-spec.md

// === Grunnleggende typer ===

export type TravelMode = "walk" | "bike" | "car";
export type TimeBudget = 5 | 10 | 15 | 20 | 30;
export type StoryPriority = "must_have" | "nice_to_have" | "filler";
export type ProductType = "explorer" | "report" | "portrait" | "guide";

export interface Coordinates {
  lat: number;
  lng: number;
}

// === Kategori ===

export interface Category {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  color: string; // Hex farge for markør
}

// === POI (Point of Interest) ===

export interface POI {
  id: string;
  name: string;
  coordinates: Coordinates;
  address?: string;
  category: Category;
  description?: string;
  featuredImage?: string;

  // Google Places data (for Google Points)
  googlePlaceId?: string;
  googleRating?: number;
  googleReviewCount?: number;
  googleMapsUrl?: string;
  photoReference?: string;

  // Redaksjonelt innhold (Storytelling)
  editorialHook?: string;
  localInsight?: string;
  storyPriority?: StoryPriority;
  editorialSources?: string[];

  // Transport-integrasjoner
  enturStopplaceId?: string;
  bysykkelStationId?: string;
  hyreStationId?: string;

  // Beregnet data (runtime)
  travelTime?: {
    walk?: number;
    bike?: number;
    car?: number;
  };
}

// === Story Seksjon ===

export type SectionType = "text" | "image_gallery" | "poi_list" | "theme_story_cta" | "map";

export interface StorySection {
  id: string;
  type: SectionType;
  categoryLabel?: string;
  title?: string;
  bridgeText?: string;
  content?: string;
  images?: string[];
  pois?: string[]; // POI IDs
  themeStoryId?: string;
}

// === Theme Story ===

export interface ThemeStory {
  id: string;
  slug: string;
  title: string;
  bridgeText?: string;
  illustration?: string;
  sections: ThemeStorySection[];
}

export interface ThemeStorySection {
  id: string;
  title: string;
  description?: string;
  images?: string[];
  pois: string[]; // POI IDs
}

// === Story ===

export interface Story {
  id: string;
  title: string;
  introText?: string;
  heroImages?: string[];
  sections: StorySection[];
  themeStories: ThemeStory[];
}

// === Report Config ===

export interface ReportThemeConfig {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  intro?: string;
}

export interface ReportConfig {
  label?: string;
  heroIntro?: string;
  themes?: ReportThemeConfig[];
  closingTitle?: string;
  closingText?: string;
  mapStyle?: string;
}

// === Category Package (for Explorer filtering) ===

export interface CategoryPackage {
  id: string;
  name: string;
  icon: string; // Lucide icon name
  categoryIds: string[];
}

// === Origin Mode (for Explorer geolocation behavior) ===

export type OriginMode = "geolocation" | "fixed" | "geolocation-with-fallback";

// === Project ===

export interface Project {
  id: string;
  name: string;
  customer: string;
  urlSlug: string;
  productType: ProductType;
  centerCoordinates: Coordinates;
  story: Story;
  pois: POI[];
  categories: Category[];
  reportConfig?: ReportConfig;
  // Explorer-specific settings
  originMode?: OriginMode; // Default: "geolocation-with-fallback"
  packages?: CategoryPackage[] | null; // Custom package filters (null = hide UI, undefined = EXPLORER_PACKAGES)
  // Guide-specific settings
  guideConfig?: GuideConfig;
}

// === Global State ===

export interface PlacyState {
  // Reiseinnstillinger
  travelMode: TravelMode;
  timeBudget: TimeBudget;

  // Aktive elementer
  activePOI: string | null;
  activeThemeStory: string | null;

  // Actions
  setTravelMode: (mode: TravelMode) => void;
  setTimeBudget: (budget: TimeBudget) => void;
  setActivePOI: (poiId: string | null) => void;
  setActiveThemeStory: (themeStoryId: string | null) => void;
}

// === API Response Types ===

export interface DirectionsResponse {
  routes: {
    duration: number; // sekunder
    distance: number; // meter
    geometry: {
      coordinates: [number, number][];
    };
  }[];
}

export interface TravelTimeResult {
  poiId: string;
  walk?: number;
  bike?: number;
  car?: number;
}

// === Async State ===

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

// Helper type for async state with data
export type AsyncStateWithData<T> = AsyncState<T> & { data: T };

// Initial async state factory
export const createInitialAsyncState = <T>(): AsyncState<T> => ({
  data: null,
  loading: false,
  error: null,
});

// Loading async state factory
export const createLoadingAsyncState = <T>(currentData?: T | null): AsyncState<T> => ({
  data: currentData ?? null,
  loading: true,
  error: null,
});

// Success async state factory
export const createSuccessAsyncState = <T>(data: T): AsyncState<T> => ({
  data,
  loading: false,
  error: null,
});

// Error async state factory
export const createErrorAsyncState = <T>(error: string, currentData?: T | null): AsyncState<T> => ({
  data: currentData ?? null,
  loading: false,
  error,
});

// === Branded Types ===

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type POIId = Brand<string, "POIId">;
export type GuideStopId = Brand<string, "GuideStopId">;

// Constructor functions for branded types
export function createPOIId(value: string): POIId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid POI ID: ${value}`);
  }
  return value as POIId;
}

export function createGuideStopId(value: string): GuideStopId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid GuideStop ID: ${value}`);
  }
  return value as GuideStopId;
}

// Exhaustiveness checking utility
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

// Non-empty array type
export type NonEmptyArray<T> = [T, ...T[]];

// === Guide Types ===

export type GuideDifficulty = "easy" | "moderate" | "challenging";

// Static configuration (JSON/database)
export interface GuideStopConfig {
  id: GuideStopId;
  poiId: POIId;
  nameOverride?: string;
  descriptionOverride?: string;
  imageUrlOverride?: string;
  transitionText?: string; // "Herfra går du over brua..."
}

export interface GuideConfig {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  difficulty?: GuideDifficulty;
  stops: NonEmptyArray<GuideStopConfig>;
  precomputedDistanceMeters?: number;
  precomputedDurationMinutes?: number;
  reward?: RewardConfig;
}

// Runtime state
export type GuideStopStatus =
  | { type: "available" }
  | { type: "active" }
  | { type: "completed"; completedAt: number }; // Unix timestamp

// Type guard for status narrowing
export function isCompletedStop(
  status: GuideStopStatus
): status is { type: "completed"; completedAt: number } {
  return status.type === "completed";
}

// === Camera Constraints (3D Map Performance) ===

export interface CameraConstraints {
  minTilt?: number;       // Default: 0 (degrees)
  maxTilt?: number;       // Default: 70 (degrees)
  minRange?: number;      // Default: 150 (meters)
  maxRange?: number;      // Default: 3000 (meters)
  bounds?: {
    north: number;        // Max latitude
    south: number;        // Min latitude
    east: number;         // Max longitude
    west: number;         // Min longitude
  };
  boundsBuffer?: number;  // Default: 0.2 (20% of diagonal)
}

// Default camera constraints for consistent performance
export const DEFAULT_CAMERA_CONSTRAINTS: Required<Omit<CameraConstraints, 'bounds' | 'boundsBuffer'>> & Pick<CameraConstraints, 'boundsBuffer'> = {
  minTilt: 0,
  maxTilt: 70,
  minRange: 150,
  maxRange: 3000,
  boundsBuffer: 0.2,
};

// === Guide Gamification Types ===

// Branded type for Guide ID (konsistent med eksisterende GuideStopId)
export type GuideId = Brand<string, "GuideId">;

export function createGuideId(value: string): GuideId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid Guide ID: ${value}`);
  }
  return value as GuideId;
}

// Validity days - eksplisitte tillatte verdier
export type RewardValidityDays = 1 | 3 | 7 | 14 | 30;

// Stop completion record - ekstrahert for testbarhet
export interface StopCompletionRecord {
  markedAt: number;           // Unix timestamp
  verifiedByGPS: boolean;
  accuracy?: number;          // GPS nøyaktighet i meter (for audit)
  coordinates?: Coordinates;
}

// Guide completion state - bruker branded types og unix timestamps
export interface GuideCompletionState {
  guideId: GuideId;
  startedAt: number;           // Unix timestamp
  completedAt?: number;        // Unix timestamp
  redeemedAt?: number;         // Unix timestamp
  celebrationShownAt?: number; // Forhindrer dobbel konfetti
  stops: Record<string, StopCompletionRecord>; // string for JSON compat
}

// Reward configuration
export interface RewardConfig {
  title: string;               // "15% rabatt i baren"
  description: string;         // "Vis denne skjermen i resepsjonen"
  hotelName: string;           // "Scandic Nidelven"
  hotelLogoUrl?: string;
  validityDays: RewardValidityDays;
}
