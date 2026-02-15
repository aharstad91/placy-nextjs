/**
 * Adapter: Trip (Supabase) → Project (legacy shape consumed by UI components)
 *
 * This thin adapter converts the new Trip + ProjectTripOverride types
 * into the legacy Project shape that TripPage and related components consume.
 * This avoids rewriting all trip UI components at once.
 */

import type {
  Trip,
  TripStop,
  ProjectTripOverride,
  Project,
  POI,
  TripStopConfig,
  TripConfig,
  RewardConfig,
  RewardValidityDays,
  NonEmptyArray,
} from "./types";
import { createTripStopId, createPOIId } from "./types";

/**
 * Convert a Supabase Trip (+ optional project override) into the legacy Project shape.
 *
 * The resulting Project has productType "guide" and a fully populated tripConfig
 * that existing TripPage, TripStopPanel, etc. can consume unchanged.
 */
export function tripToProject(
  trip: Trip,
  override?: ProjectTripOverride
): Project {
  // Build the stops array — optionally prepending a start POI
  let stops = [...trip.stops];
  if (override?.startPoi) {
    const startStop: TripStop = {
      id: createTripStopId(`start-${override.startPoi.id}`),
      poi: override.startPoi,
      sortOrder: -1,
      nameOverride: override.startName,
      descriptionOverride: override.startDescription,
      transitionText: override.startTransitionText,
    };
    stops = [startStop, ...stops];
  }

  // Build POI array from stops
  const pois: POI[] = stops.map((stop) => ({
    ...stop.poi,
    // Apply stop-level overrides to POI fields
    ...(stop.nameOverride ? { name: stop.nameOverride } : {}),
    ...(stop.descriptionOverride ? { description: stop.descriptionOverride } : {}),
    ...(stop.imageUrlOverride ? { featuredImage: stop.imageUrlOverride } : {}),
  }));

  // Build TripStopConfig array
  const stopConfigs: TripStopConfig[] = stops.map((stop) => ({
    id: stop.id,
    poiId: createPOIId(stop.poi.id),
    nameOverride: stop.nameOverride,
    descriptionOverride: stop.descriptionOverride,
    imageUrlOverride: stop.imageUrlOverride,
    transitionText: stop.transitionText,
  }));

  // Build reward config
  const reward = buildRewardConfig(trip, override);

  // Build TripConfig
  const tripConfig: TripConfig = {
    id: trip.id,
    title: trip.title,
    description: trip.description,
    coverImageUrl: trip.coverImageUrl,
    difficulty: trip.difficulty,
    stops: stopConfigs as NonEmptyArray<TripStopConfig>,
    precomputedDistanceMeters: trip.distanceMeters,
    precomputedDurationMinutes: trip.durationMinutes,
    reward,
    defaultMode: trip.defaultMode,
    category: trip.category,
    tags: trip.tags,
    featured: trip.featured,
    sortOrder: override?.sortOrder,
  };

  // Collect unique categories from POIs
  const categoryMap = new Map<string, POI["category"]>();
  for (const poi of pois) {
    if (poi.category && !categoryMap.has(poi.category.id)) {
      categoryMap.set(poi.category.id, poi.category);
    }
  }

  return {
    id: trip.id,
    name: trip.title,
    customer: "", // Not needed for trip rendering
    urlSlug: trip.urlSlug,
    productType: "guide",
    centerCoordinates: trip.center,
    story: {
      id: trip.id,
      title: trip.title,
      introText: trip.description,
      sections: [],
      themeStories: [],
    },
    pois,
    categories: Array.from(categoryMap.values()),
    tripConfig,
  };
}

/**
 * Build a RewardConfig from trip defaults + optional project override.
 * Project override takes precedence when present.
 */
function buildRewardConfig(
  trip: Trip,
  override?: ProjectTripOverride
): RewardConfig | undefined {
  const title = override?.rewardTitle ?? trip.defaultRewardTitle;
  const description = override?.rewardDescription ?? trip.defaultRewardDescription;

  if (!title || !description) return undefined;

  const validityDays = (override?.rewardValidityDays ?? 7) as RewardValidityDays;

  return {
    title,
    description,
    hotelName: override?.startName ?? "",
    validityDays,
  };
}
