/**
 * Resolve a Google Places photo reference to a direct CDN URL.
 *
 * The Google Places Photo API returns a 302 redirect to
 * lh3.googleusercontent.com. By resolving the redirect at ISR time
 * we can use the direct CDN URL in <Image>, eliminating the
 * /api/places/photo proxy hop entirely.
 *
 * Safe to expose client-side — the redirect URL contains no API key.
 */
export async function resolveGooglePhotoUrl(
  photoReference: string,
  maxWidth = 400,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;

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
