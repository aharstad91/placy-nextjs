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

/**
 * Fetch photo names for a place using Places API (New).
 *
 * Returns photo resource names (e.g. "places/ChIJ.../photos/AUc...").
 * Cost: $0 (Essentials IDs Only tier with `photos` field mask).
 */
export async function fetchPhotoNames(
  placeId: string,
  apiKey: string,
): Promise<string[]> {
  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
  });

  if (!res.ok) return [];

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
  const url = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true&key=${apiKey}`;
  const res = await fetch(url);

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
  return photoReference.startsWith("places/");
}
