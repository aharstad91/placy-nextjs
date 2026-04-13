import type { POI, Coordinates } from "@/lib/types";
import type { AnnotatedMapMarker } from "./AnnotatedMap";

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

function walkMinFor(poi: POI, center: Coordinates): number | null {
  if (poi.travelTime?.walk != null) return Math.round(poi.travelTime.walk / 60);
  const m = Math.round((haversineM(center, poi.coordinates) * 1.3) / 83);
  return m > 0 ? m : null;
}

/**
 * Kurate 4-5 nature markers for the illustrated map. Posisjonene er
 * håndplukket for Wesselsløkka-illustrasjonen; for andre prosjekter
 * vil vi trenge egne komposisjoner (eller auto-plassering basert på
 * faktiske koordinater projisert på et kart-image).
 */
export function getNaturMarkers(
  pois: POI[],
  center: Coordinates,
): AnnotatedMapMarker[] {
  // Pick nearest park-like POIs sorted by distance
  const parkLike = pois
    .filter(
      (p) =>
        p.category.id === "park" ||
        p.category.id === "playground" ||
        p.category.id === "natur" ||
        p.name.toLowerCase().includes("park") ||
        p.name.toLowerCase().includes("allmenning") ||
        p.name.toLowerCase().includes("stien") ||
        p.name.toLowerCase().includes("myra"),
    )
    .sort(
      (a, b) => haversineM(center, a.coordinates) - haversineM(center, b.coordinates),
    );

  // Hand-curated positions on the natur illustration — these correspond to
  // compositionally balanced points. Would be per-project in a full system.
  const positions: Array<{ top: string; left: string }> = [
    { top: "28%", left: "22%" }, // upper-left
    { top: "42%", left: "70%" }, // mid-right
    { top: "68%", left: "38%" }, // lower-center
    { top: "55%", left: "12%" }, // lower-left
    { top: "22%", left: "62%" }, // upper-right
  ];

  return parkLike.slice(0, positions.length).map((poi, i) => {
    const min = walkMinFor(poi, center);
    return {
      number: i + 1,
      top: positions[i].top,
      left: positions[i].left,
      title: poi.name,
      subtitle: min != null ? `${min} min gange` : poi.category.name,
      description: poi.editorialHook ?? undefined,
    };
  });
}
