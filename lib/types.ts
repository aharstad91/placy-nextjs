// Placy TypeScript Typer
// Basert på placy-concept-spec.md

import { z } from "zod";

// === Grunnleggende typer ===

export type TravelMode = "walk" | "bike" | "car";
export type TimeBudget = 5 | 10 | 15 | 20 | 30;
export type StoryPriority = "must_have" | "nice_to_have" | "filler";
export type ProductType = "explorer" | "report" | "guide";

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
  galleryImages?: string[];

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

  // Trust validation
  trustScore?: number;
  trustFlags?: string[];
  trustScoreUpdatedAt?: string;

  // Social media links
  facebookUrl?: string;

  // Google enrichment (Layer 1)
  googleWebsite?: string;
  googleBusinessStatus?: string;
  googlePriceLevel?: number;
  googlePhone?: string;

  // Cached opening hours (from periodic refresh)
  openingHoursJson?: { weekday_text?: string[] };

  // POI Tier System
  poiTier?: 1 | 2 | 3;
  tierReason?: string;
  isChain?: boolean;
  isLocalGem?: boolean;
  poiMetadata?: Record<string, unknown>;
  tierEvaluatedAt?: string;

  // Event data (for event-type projects)
  eventDates?: string[];       // ["2026-04-18", "2026-04-19"]
  eventTimeStart?: string;     // "10:00"
  eventTimeEnd?: string;       // "16:00"
  eventDescription?: string;
  eventUrl?: string;           // Link to organizer's event page
  eventTags?: string[];        // ["Gratis", "Barnevennlig"]

  // Product-specific flags (set per product_pois)
  featured?: boolean;

  // Transport-integrasjoner
  enturStopplaceId?: string;
  bysykkelStationId?: string;
  hyreStationId?: string;

  // Parent-child POI hierarchy (e.g., shopping center → stores)
  parentPoiId?: string;
  anchorSummary?: string;
  childPOIs?: POI[];

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

// === Trail Overlay (Overpass/OSM route relations) ===

export interface TrailFeatureProperties {
  id: string;
  name: string;
  routeType: "bicycle" | "hiking" | "foot";
  network: "lcn" | "rcn" | "ncn" | null;
}

export interface TrailFeature {
  type: "Feature";
  properties: TrailFeatureProperties;
  geometry: GeoJSON.LineString | GeoJSON.MultiLineString;
}

export interface TrailCollection {
  type: "FeatureCollection";
  features: TrailFeature[];
}

// === Report Config ===

export interface ReportThemeGroundingSource {
  title: string;
  /** Resolved final URL (eller redirect hvis resolve feilet). */
  url: string;
  /** Original Gemini redirect-URL — beholdt for re-resolve. */
  redirectUrl: string;
  domain: string;
}

/**
 * Build-time-generert grounding-data fra Gemini API med google_search-tool.
 * Lagret i products.config.reportConfig.themes[].grounding. Omit (ikke null)
 * ved feil — matcher optional ?:.
 *
 * Google ToS krever at searchEntryPointHtml rendres verbatim (DOMPurify-sanert
 * før lagring). groundingVersion bumpes for å tvinge regen.
 *
 * Version 1: raw Gemini narrative + sources + searchEntryPointHtml.
 * Version 2: legger til curatedNarrative (Claude-kuratert unified tekst med
 * POI-inline-lenker), curatedAt, poiLinksUsed. Raw narrative beholdes som
 * backup. Per-tema — v1 og v2 kan coexist i samme themes[]-array.
 */
export interface ReportThemeGrounding {
  /** Markdown-prosa, min 200 tegn. Raw Gemini-output for v1, råbackup for v2. */
  narrative: string;
  sources: ReportThemeGroundingSource[];
  /** Google Search-attribution-HTML — DOMPurify-sanert. Renders via dangerouslySetInnerHTML. */
  searchEntryPointHtml: string;
  /** ISO-8601 tidspunkt for Gemini-kallet. */
  fetchedAt: string;
  /** Per-tema version-flagg. Tillater partial rollout v1→v2. */
  groundingVersion: 1 | 2;
  meta: {
    model: "gemini-2.5-flash";
    /** Debug-only — Gemini sine auto-genererte søk. */
    searchQueries: string[];
  };
  /** V2 only — Claude-kuratert unified tekst med [POI-navn](poi:uuid)-lenker. */
  curatedNarrative?: string;
  /** V2 only — ISO-8601 tidspunkt for curation. */
  curatedAt?: string;
  /** V2 only — UUIDs for POIs som ble inline-lenket. Sporer rendring + invalidation. */
  poiLinksUsed?: string[];
}

/**
 * Runtime-schema brukt ved render for å validere JSONB-innhold. Discriminated
 * union på groundingVersion tillater v1 (raw narrative) og v2 (curated +
 * POI-lenker) coexisting. Silent skip + server-log ved mismatch.
 *
 * V1-skjema er .passthrough() for rollout-tolerance: lar extra v2-felter (som
 * curatedNarrative) eksistere på rad som fortsatt er flagget v1, uten å feile.
 * Dette håndterer mellomtilstanden mens curation pågår.
 */
const GroundingSourceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  domain: z.string(),
});

export const ReportThemeGroundingV1Schema = z
  .object({
    narrative: z.string().min(1),
    sources: z.array(GroundingSourceSchema).default([]),
    searchEntryPointHtml: z.string().min(1),
    fetchedAt: z.string(),
    groundingVersion: z.literal(1),
  })
  .passthrough();

export const ReportThemeGroundingV2Schema = z.object({
  /** Raw Gemini-output beholdt som backup. */
  narrative: z.string().min(1),
  /** Claude-kuratert unified tekst — primær rendering-kilde i v2. */
  curatedNarrative: z.string().min(100),
  sources: z.array(GroundingSourceSchema).default([]),
  searchEntryPointHtml: z.string().min(1),
  fetchedAt: z.string(),
  curatedAt: z.string(),
  poiLinksUsed: z.array(z.string().uuid()).default([]),
  groundingVersion: z.literal(2),
});

export const ReportThemeGroundingViewSchema = z.discriminatedUnion(
  "groundingVersion",
  [ReportThemeGroundingV1Schema, ReportThemeGroundingV2Schema],
);

export type ReportThemeGroundingView = z.infer<
  typeof ReportThemeGroundingViewSchema
>;
export type ReportThemeGroundingViewV1 = z.infer<
  typeof ReportThemeGroundingV1Schema
>;
export type ReportThemeGroundingViewV2 = z.infer<
  typeof ReportThemeGroundingV2Schema
>;

export interface ReportThemeConfig {
  id: string;
  name: string;
  icon: string;
  categories: string[];
  color: string;
  intro?: string;
  bridgeText?: string;
  upperNarrative?: string;
  lowerNarrative?: string;
  categoryDescriptions?: Record<string, string>;
  /** Google AI Mode-søk (udm=50) for "Les mer"-knapp. Short, generic query — Google handler fersk detalj. */
  readMoreQuery?: string;
  /** Build-time-generert Gemini-grounding. Omit ved feil — ikke null. */
  grounding?: ReportThemeGrounding;
}

export interface BrokerInfo {
  name: string;
  firstName?: string;
  title: string;
  phone: string;
  email: string;
  photoUrl: string;
  officeName: string;
  officeLogoUrl?: string;
  bio?: string;
}

export interface ReportSummary {
  headline: string;
  insights: string[];
  brokerInviteText?: string;
}

export interface ReportCTA {
  leadUrl?: string;
  primaryLabel?: string;
  primarySubject?: string;
  shareTitle?: string;
}

export interface ReportConfig {
  label?: string;
  heroIntro?: string;
  /** Path (absolute or /public) til illustrasjon som vises i hero + summary. Optional. */
  heroImage?: string;
  themes?: ReportThemeConfig[];
  summary?: ReportSummary;
  brokers?: BrokerInfo[];
  cta?: ReportCTA;
  mapStyle?: string;
  trails?: TrailCollection;
}

// === Origin Mode (for Explorer geolocation behavior) ===

export type OriginMode = "geolocation" | "fixed" | "geolocation-with-fallback";

// === Discovery Circle ===

export interface DiscoveryCircle {
  lat: number;
  lng: number;
  radiusMeters: number;
}

// === White-label theming ===
//
// ProjectTheme maps to shadcn semantic CSS tokens. Each field is a hex color
// that gets converted to HSL channel values via hexToHslChannels() and
// injected as inline style on the report route wrapper. Channel values are
// required so Tailwind's `hsl(var(--x) / <alpha-value>)` pattern keeps
// opacity modifiers working.

export interface ProjectTheme {
  // Semantic colors → override shadcn tokens
  backgroundColor?: string;        // → --background
  foregroundColor?: string;        // → --foreground
  primaryColor?: string;           // → --primary (accent, CTA buttons)
  primaryForegroundColor?: string; // → --primary-foreground (text on CTAs)
  cardColor?: string;              // → --card (broker card, surface)
  mutedColor?: string;             // → --muted (secondary surface)
  mutedForegroundColor?: string;   // → --muted-foreground (secondary text)
  borderColor?: string;            // → --border
  // Typography
  fontFamily?: string;             // CSS font-family string (free-form)
  // Branding
  logoUrl?: string;                // Logo in header
}

// === Project Container (NEW: Hierarchy) ===

/**
 * Project container - groups related products for a single location/concept.
 * POIs are shared at this level, then selected per product.
 */
export interface ProjectContainer {
  id: string;
  customerId: string;
  name: string;
  urlSlug: string;
  centerCoordinates: Coordinates;
  description?: string;
  /** All POIs available to products under this project */
  pois: POI[];
  /** All categories used by POIs in this project */
  categories: Category[];
  /** Products under this project container */
  products: ProductInstance[];
  /** Bransje-tags (envalg) — determines bransjeprofil for themes/categories */
  tags?: string[];
  venueType?: "hotel" | "residential" | "commercial" | null;
  discoveryCircles?: DiscoveryCircle[] | null;
  /** Hero title for the welcome screen (e.g. "Velkommen over til Overvik") */
  welcomeTitle?: string;
  /** Short tagline shown on the welcome screen */
  welcomeTagline?: string;
  /** Hero image URL for the welcome screen */
  welcomeImage?: string;
  /** Default product to navigate to from the welcome screen */
  defaultProduct: ProductType;
  /** White-label theme configuration */
  theme?: ProjectTheme;
  /** URL til kundens hjemmeside — brukes i rapport-shell som tilbake-link og i footer */
  homepageUrl?: string | null;
  /** Whether this project has purchased the 3D map add-on (Google Photorealistic 3D Tiles) */
  has3dAddon?: boolean;
  /** Project context — drives illustration anchor selection and future style decisions */
  venueContext?: 'suburban' | 'urban';
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product instance - a specific product type (Explorer/Report/Trip) under a project.
 */
export interface ProductInstance {
  id: string;
  projectId: string;
  productType: ProductType;
  config: Record<string, unknown>;
  storyTitle?: string;
  storyIntroText?: string;
  storyHeroImages?: string[];
  /** POI IDs this product uses (subset of project's POI pool) */
  poiIds: string[];
  /** POI IDs marked as featured for this product */
  featuredPoiIds: string[];
  /** Category IDs this product shows */
  categoryIds: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Summary of a product for display (e.g., in landing page cards)
 */
export interface ProductSummary {
  type: ProductType;
  poiCount: number;
  hasStory: boolean;
}

// === Project (LEGACY - for backward compatibility) ===

/**
 * @deprecated Use ProjectContainer and ProductInstance instead.
 * This type is kept for backward compatibility during migration.
 */
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
  /** Bransje-tags (envalg) — determines bransjeprofil for themes/categories */
  tags?: string[];
  // Explorer-specific settings
  originMode?: OriginMode; // Default: "geolocation-with-fallback"
  venueType?: "hotel" | "residential" | "commercial" | null;
  // Trip-specific settings
  tripConfig?: TripConfig;
  /** Per-project white-label theme (CSS overrides) */
  theme?: ProjectTheme;
  /** URL til kundens hjemmeside — brukes i rapport-shell som tilbake-link og i footer */
  homepageUrl?: string | null;
  /** Whether the project has a 3D map add-on enabled */
  has3dAddon?: boolean;
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
export type TripStopId = Brand<string, "TripStopId">;

// Constructor functions for branded types
export function createPOIId(value: string): POIId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid POI ID: ${value}`);
  }
  return value as POIId;
}

export function createTripStopId(value: string): TripStopId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid TripStop ID: ${value}`);
  }
  return value as TripStopId;
}

// Exhaustiveness checking utility
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

// Non-empty array type
export type NonEmptyArray<T> = [T, ...T[]];

// === Trip Types ===

// Trip categories for library grouping
export const TRIP_CATEGORIES = [
  "food", // Mat & drikke
  "culture", // Kultur og historie
  "nature", // Natur
  "family", // Familieutflukt
  "active", // Aktiv tur
  "hidden-gems", // Skjulte perler
  "sightseeing", // Sightseeing
] as const;

export type TripCategory = (typeof TRIP_CATEGORIES)[number];

// Norwegian labels for categories
export const TRIP_CATEGORY_LABELS: Record<TripCategory, string> = {
  food: "Mat & drikke",
  culture: "Kultur og historie",
  nature: "Natur",
  family: "Familieutflukt",
  active: "Aktiv tur",
  "hidden-gems": "Skjulte perler",
  sightseeing: "Sightseeing",
};

export type TripDifficulty = "easy" | "moderate" | "challenging";

export type TripSeason = "spring" | "summer" | "autumn" | "winter" | "all-year";

export type TripMode = "guided" | "free";

// Static configuration (JSON/database)
export interface TripStopConfig {
  id: TripStopId;
  poiId: POIId;
  nameOverride?: string;
  descriptionOverride?: string;
  imageUrlOverride?: string;
  transitionText?: string; // "Herfra går du over brua..."
}

export interface TripConfig {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  difficulty?: TripDifficulty;
  stops: NonEmptyArray<TripStopConfig>;
  precomputedDistanceMeters?: number;
  precomputedDurationMinutes?: number;
  reward?: RewardConfig;
  defaultMode?: TripMode; // "guided" (follow route) or "free" (explore freely)
  // Trip Library fields
  category?: TripCategory; // For grouping in library
  tags?: string[]; // Extra tags for filtering
  featured?: boolean; // Show in "Featured" section
  sortOrder?: number; // Manual sorting within category
}

// === Resolved Trip Types (from Supabase) ===
// These types are returned by query functions with POIs already resolved.
// TripConfig/TripStopConfig above are the JSON-based config types.

export interface TripStop {
  id: TripStopId;
  poi: POI;
  sortOrder: number;
  nameOverride?: string;
  descriptionOverride?: string;
  imageUrlOverride?: string;
  transitionText?: string;
  localInsight?: string;
}

export interface Trip {
  id: string;
  title: string;
  urlSlug: string;
  description?: string;
  coverImageUrl?: string;
  category?: TripCategory;
  difficulty?: TripDifficulty;
  season: TripSeason;
  tags: string[];
  featured: boolean;
  city: string;
  region?: string;
  country: string;
  center: Coordinates;
  distanceMeters?: number;
  durationMinutes?: number;
  stopCount: number;
  stops: TripStop[];
  defaultMode: TripMode;
  defaultRewardTitle?: string;
  defaultRewardDescription?: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTripOverride {
  id: string;
  projectId: string;
  tripId: string;
  sortOrder: number;
  enabled: boolean;
  startPoi?: POI;
  startName?: string;
  startDescription?: string;
  startTransitionText?: string;
  rewardTitle?: string;
  rewardDescription?: string;
  rewardCode?: string;
  rewardValidityDays?: number;
  welcomeText?: string;
}

// A Trip as seen through a project's lens (with overrides applied)
export interface ProjectTrip {
  trip: Trip;
  override: ProjectTripOverride;
}

// Runtime state
export type TripStopStatus =
  | { type: "available" }
  | { type: "active" }
  | { type: "completed"; completedAt: number }; // Unix timestamp

// Type guard for status narrowing
export function isCompletedStop(
  status: TripStopStatus
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

// === Trip Gamification Types ===

// Branded type for Trip ID (konsistent med eksisterende TripStopId)
export type TripId = Brand<string, "TripId">;

export function createTripId(value: string): TripId {
  if (!value || typeof value !== "string") {
    throw new Error(`Invalid Trip ID: ${value}`);
  }
  return value as TripId;
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

// Trip completion state - bruker branded types og unix timestamps
export interface TripCompletionState {
  tripId: TripId;
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

// === Place Knowledge Types ===

export const KNOWLEDGE_TOPICS = [
  'history', 'people', 'awards', 'media', 'controversy',
  'atmosphere', 'signature', 'culture', 'seasonal',
  'food', 'drinks', 'sustainability',
  'architecture', 'spatial', 'nature', 'accessibility',
  'practical', 'insider', 'relationships',
  'local_knowledge', // legacy — mapped to 'inside' category
] as const;

export type KnowledgeTopic = (typeof KNOWLEDGE_TOPICS)[number];

// Category definition for type-safe grouping
interface CategoryDef {
  readonly labelNo: string;
  readonly labelEn: string;
  readonly topics: readonly KnowledgeTopic[];
}

export const KNOWLEDGE_CATEGORIES = {
  story: {
    labelNo: 'Historien',
    labelEn: 'The Story',
    topics: ['history', 'people', 'awards', 'media', 'controversy'],
  },
  experience: {
    labelNo: 'Opplevelsen',
    labelEn: 'The Experience',
    topics: ['atmosphere', 'signature', 'culture', 'seasonal'],
  },
  taste: {
    labelNo: 'Smaken',
    labelEn: 'The Taste',
    topics: ['food', 'drinks', 'sustainability'],
  },
  place: {
    labelNo: 'Stedet',
    labelEn: 'The Place',
    topics: ['architecture', 'spatial', 'nature', 'accessibility'],
  },
  inside: {
    labelNo: 'Innsiden',
    labelEn: 'The Inside Track',
    topics: ['practical', 'insider', 'relationships', 'local_knowledge'],
  },
} as const satisfies Record<string, CategoryDef>;

export type KnowledgeCategory = keyof typeof KNOWLEDGE_CATEGORIES;

export const KNOWLEDGE_TOPIC_LABELS: Record<KnowledgeTopic, string> = {
  history: 'Historikk',
  people: 'Mennesker',
  awards: 'Anerkjennelse',
  media: 'I media',
  controversy: 'Debatt',
  atmosphere: 'Atmosfære',
  signature: 'Signaturen',
  culture: 'Kultur',
  seasonal: 'Sesong',
  food: 'Mat',
  drinks: 'Drikke',
  sustainability: 'Bærekraft',
  architecture: 'Arkitektur',
  spatial: 'Beliggenhet',
  nature: 'Natur',
  accessibility: 'Tilgjengelighet',
  practical: 'Praktisk',
  insider: 'Insider',
  relationships: 'Koblinger',
  local_knowledge: 'Visste du?',
};

export const KNOWLEDGE_TOPIC_LABELS_EN: Record<KnowledgeTopic, string> = {
  history: 'History',
  people: 'People',
  awards: 'Awards',
  media: 'In the Media',
  controversy: 'Debate',
  atmosphere: 'Atmosphere',
  signature: 'Signature',
  culture: 'Culture',
  seasonal: 'Seasonal',
  food: 'Food',
  drinks: 'Drinks',
  sustainability: 'Sustainability',
  architecture: 'Architecture',
  spatial: 'Location',
  nature: 'Nature',
  accessibility: 'Accessibility',
  practical: 'Practical',
  insider: 'Insider',
  relationships: 'Connections',
  local_knowledge: 'Did you know?',
};

export type KnowledgeConfidence = 'verified' | 'unverified' | 'disputed';

export interface PlaceKnowledge {
  id: string;
  poiId?: string;
  areaId?: string;
  topic: KnowledgeTopic;
  factText: string;
  factTextEn?: string;
  structuredData?: Record<string, unknown>;
  confidence: KnowledgeConfidence;
  sourceUrl?: string;
  sourceName?: string;
  sortOrder: number;
  displayReady: boolean;
  verifiedAt?: string;
}
