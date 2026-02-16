/**
 * Google Places API (New) — Photo operations.
 *
 * Uses Places API (New) for photo lookups:
 * - Place Details Essentials (IDs Only) with `photos` field = $0/unlimited
 * - skipHttpRedirect=true returns photoUri directly (no 302 hack)
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/place-photos
 */

interface PhotoResource {
  name: string; // e.g. "places/ChIJ.../photos/AUc..."
  widthPx: number;
  heightPx: number;
  authorAttributions: { displayName: string; uri: string }[];
}

interface PlaceDetailsResponse {
  photos?: PhotoResource[];
}

interface MediaResponse {
  photoUri: string;
}

/** Google Place IDs are alphanumeric with hyphens and underscores */
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** New-format photo names: "places/{placeId}/photos/{ref}" */
const NEW_PHOTO_NAME_PATTERN = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/**
 * Fetch photo names for a place using Places API (New).
 *
 * Returns photo resource names (e.g. "places/ChIJ.../photos/AUc...").
 * Cost: $0 (Essentials IDs Only tier with `photos` field mask).
 *
 * Throws on API errors (403, 429, 500) to prevent callers from
 * interpreting failures as "no photos" and deleting existing data.
 * Returns empty array only when the place genuinely has no photos.
 */
export async function fetchPhotoNames(
  placeId: string,
  apiKey: string,
): Promise<string[]> {
  if (!PLACE_ID_PATTERN.test(placeId)) return [];

  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
  });

  // 404 = place not found, genuinely no photos
  if (res.status === 404) return [];

  // Other errors = API problem, throw to prevent data deletion
  if (!res.ok) {
    throw new Error(`Places API error: ${res.status}`);
  }

  const data: PlaceDetailsResponse = await res.json();
  return data.photos?.map((p) => p.name) ?? [];
}

/**
 * Resolve a photo name to a direct CDN URL using Places API (New).
 *
 * Uses skipHttpRedirect=true to get photoUri as JSON instead of 302.
 * Cost: $0 (Essentials IDs Only tier).
 */
export async function resolvePhotoUri(
  photoName: string,
  apiKey: string,
  maxWidthPx = 800,
): Promise<string | null> {
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`;
  const res = await fetch(url, {
    headers: { "X-Goog-Api-Key": apiKey },
  });

  if (!res.ok) return null;

  const data: MediaResponse = await res.json();
  return data.photoUri ?? null;
}

/**
 * Detect whether a photo_reference value is in New API format.
 *
 * New format: "places/{placeId}/photos/{ref}"
 * Legacy format: opaque string without "places/" prefix
 */
export function isNewPhotoFormat(photoReference: string): boolean {
  return NEW_PHOTO_NAME_PATTERN.test(photoReference);
}
