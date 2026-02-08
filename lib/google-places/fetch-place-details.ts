/**
 * Shared Google Places Details function.
 * Used by both /api/places/[placeId] route and trust-validate endpoint.
 * Avoids internal HTTP overhead by calling Google API directly.
 */

export interface PlaceDetails {
  rating?: number;
  reviewCount?: number;
  photos?: Array<{ reference: string; url: string }>;
  website?: string;
  phone?: string;
  openingHours?: string[];
  isOpen?: boolean;
  businessStatus?: string; // "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY"
  priceLevel?: number; // 0-4
}

/** Default fields for full place details (client-facing) */
const DEFAULT_FIELDS = [
  "rating",
  "user_ratings_total",
  "photos",
  "website",
  "formatted_phone_number",
  "opening_hours",
  "business_status",
  "price_level",
];

/** Minimal fields for trust enrichment only */
export const TRUST_ENRICHMENT_FIELDS = [
  "website",
  "business_status",
  "price_level",
  "rating",
  "user_ratings_total",
];

/**
 * Fetch place details from Google Places API.
 *
 * @param placeId - Google Place ID
 * @param apiKey - Google Places API key
 * @param fields - Fields to request (defaults to all fields including photos)
 * @returns PlaceDetails or null if place not found
 */
export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  fields: string[] = DEFAULT_FIELDS
): Promise<PlaceDetails | null> {
  const fieldsParam = fields.join(",");
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fieldsParam}&key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "OK" || !data.result) {
    return null;
  }

  const place = data.result;

  return {
    rating: place.rating,
    reviewCount: place.user_ratings_total,
    photos: place.photos?.slice(0, 5).map((photo: { photo_reference: string }) => ({
      reference: photo.photo_reference,
      url: `/api/places/photo?photoReference=${photo.photo_reference}&maxWidth=400`,
    })),
    website: place.website,
    phone: place.formatted_phone_number,
    openingHours: place.opening_hours?.weekday_text,
    isOpen: place.opening_hours?.open_now,
    businessStatus: place.business_status,
    priceLevel: place.price_level,
  };
}
