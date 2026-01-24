// Placy TypeScript Typer
// Basert på placy-concept-spec.md

// === Grunnleggende typer ===

export type TravelMode = "walk" | "bike" | "car";
export type TimeBudget = 5 | 10 | 15 | 20 | 30;
export type StoryPriority = "must_have" | "nice_to_have" | "filler";

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

// === Project ===

export interface Project {
  id: string;
  name: string;
  customer: string;
  urlSlug: string;
  centerCoordinates: Coordinates;
  story: Story;
  pois: POI[];
  categories: Category[];
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
