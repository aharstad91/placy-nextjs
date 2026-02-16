/**
 * Resolve a Google Places photo reference to a direct CDN URL.
 *
 * Uses Places API (New) for new-format photo names (places/X/photos/REF).
 * Falls back to Legacy API for old-format references during migration.
 *
 * Used at ISR time to get direct CDN URLs for <Image> components.
 * Safe to expose client-side — the CDN URL contains no API key.
 */

import { resolvePhotoUri, isNewPhotoFormat } from "@/lib/google-places/photo-api";

export async function resolveGooglePhotoUrl(
  photoReference: string,
  maxWidth = 400,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

  // New format: resolve via Places API (New) — $0
  if (isNewPhotoFormat(photoReference)) {
    return resolvePhotoUri(photoReference, apiKey, maxWidth);
  }

  // Legacy format: use old 302-redirect approach during transition
  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${apiKey}`;
    const res = await fetch(url, { redirect: "manual", cache: "force-cache" });

    if (res.status === 302) {
      const location = res.headers.get("location");
      if (location?.includes("googleusercontent.com")) {
        return location;
      }
    }
    return null;
  } catch {
    return null;
  }
}
