/**
 * Venue profiles define POI relevance for different project types.
 *
 * - categoryBlacklist: categories never shown
 * - categoryWeights: relevance multiplier (0-1) applied to POI score
 * - transportCaps: per-category limits within transport theme
 */

export type VenueType = "hotel" | "residential" | "commercial";

export interface VenueProfile {
  type: VenueType;
  categoryBlacklist: string[];
  categoryWeights: Record<string, number>;
  transportCaps: Record<string, number>;
}

export const VENUE_PROFILES: Record<VenueType, VenueProfile> = {
  hotel: {
    type: "hotel",
    categoryBlacklist: ["mma", "kickboxing", "martial_arts", "boxing"],
    categoryWeights: {
      // Low relevance for hotels
      haircare: 0.3,
      bank: 0.4,
      post_office: 0.4,
      hospital: 0.3,
      doctor: 0.3,
      dentist: 0.3,
      // Everything else defaults to 1.0
    },
    transportCaps: {
      bus: 6,
      bike: 10,
      train: 3,
      tram: 3,
      parking: 4,
      taxi: 2,
    },
  },
  residential: {
    type: "residential",
    categoryBlacklist: ["mma", "kickboxing", "martial_arts", "boxing"],
    categoryWeights: {
      // Higher weight for daily needs
      supermarket: 1.2,
      pharmacy: 1.2,
      haircare: 0.8,
      // Everything else defaults to 1.0
    },
    transportCaps: {
      bus: 6,
      bike: 8,
      train: 4,
      tram: 4,
      parking: 6,
      taxi: 2,
    },
  },
  commercial: {
    type: "commercial",
    categoryBlacklist: ["mma", "kickboxing", "martial_arts", "boxing"],
    categoryWeights: {
      restaurant: 1.2,
      cafe: 1.2,
      // Everything else defaults to 1.0
    },
    transportCaps: {
      bus: 5,
      bike: 6,
      train: 4,
      tram: 4,
      parking: 6,
      taxi: 3,
    },
  },
};

export function getVenueProfile(venueType?: string | null): VenueProfile {
  if (venueType && venueType in VENUE_PROFILES) {
    return VENUE_PROFILES[venueType as VenueType];
  }
  return VENUE_PROFILES.hotel;
}
