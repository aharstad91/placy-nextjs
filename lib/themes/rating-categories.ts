/**
 * Categories where Google rating is meaningful and should be displayed in UI.
 * Transport, nature, and service categories are excluded due to
 * unreliable or irrelevant rating data.
 */
export const CATEGORIES_WITH_RATING = new Set([
  // Mat & Drikke
  "restaurant",
  "cafe",
  "bar",
  "bakery",
  // Kultur & Opplevelser
  "museum",
  "cinema",
  "library",
  // Hverdagsbehov
  "supermarket",
  "pharmacy",
  "shopping",
  "liquor_store",
  "haircare",
  // Trening & Velvære
  "gym",
  "spa",
  "swimming",
]);

export function shouldShowRating(categoryId: string): boolean {
  return CATEGORIES_WITH_RATING.has(categoryId);
}
