import type { POI, Coordinates } from "@/lib/types";
import type { FeatureCarouselItem } from "./FeatureCarousel";

/** Haversine meters */
function haversineM(a: Coordinates, b: Coordinates): number {
  const R = 6_371_000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function imageUrlFor(poi: POI): string | null {
  if (!poi.featuredImage) return null;
  if (poi.featuredImage.includes("mymaps.usercontent.google.com")) {
    return `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`;
  }
  return poi.featuredImage;
}

/**
 * Mat & Drikke carousel — horizontal scrollable list of eateries.
 * Ranks by tier+rating+image-availability (image-first feels more curated),
 * caps at 10 items to keep the lane focused.
 */
export function getMatDrikkeCarousel(
  pois: POI[],
  center: Coordinates,
): FeatureCarouselItem[] {
  // Rank: image-present first, then by rating × tier
  const ranked = [...pois].sort((a, b) => {
    const aImg = a.featuredImage ? 1 : 0;
    const bImg = b.featuredImage ? 1 : 0;
    if (aImg !== bImg) return bImg - aImg;
    const aScore = (a.googleRating ?? 0) * (4 - (a.poiTier ?? 3));
    const bScore = (b.googleRating ?? 0) * (4 - (b.poiTier ?? 3));
    return bScore - aScore;
  });

  const walkMin = (p: POI): number | null => {
    if (p.travelTime?.walk != null) return Math.round(p.travelTime.walk / 60);
    const m = Math.round((haversineM(center, p.coordinates) * 1.3) / 83);
    return m > 0 ? m : null;
  };

  return ranked.slice(0, 10).map((p) => ({
    id: p.id,
    title: p.name,
    kicker: p.category.name.toUpperCase(),
    imageUrl: imageUrlFor(p),
    rating: p.googleRating ?? null,
    walkMin: walkMin(p),
    body: p.editorialHook ?? undefined,
    iconName: p.category.icon,
    iconColor: p.category.color,
    href: p.googleMapsUrl ?? undefined,
  }));
}
