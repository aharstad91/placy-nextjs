export type HousingType = "family" | "young" | "senior";

// Maps housing type to Google Places categories for POI discovery
const HOUSING_CATEGORIES: Record<HousingType, string[]> = {
  family: [
    "restaurant", "cafe", "bakery", "supermarket", "pharmacy",
    "gym", "park", "library", "museum", "doctor", "dentist",
  ],
  young: [
    "restaurant", "cafe", "bar", "bakery", "gym",
    "supermarket", "museum", "movie_theater",
  ],
  senior: [
    "supermarket", "pharmacy", "doctor", "dentist",
    "park", "library", "cafe", "restaurant",
  ],
};

export function getHousingCategories(housingType: HousingType): string[] {
  return HOUSING_CATEGORIES[housingType];
}
