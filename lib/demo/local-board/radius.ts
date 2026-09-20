import { calculateDistance } from '@/lib/utils/geo';

export const RADIUS_STEPS = [2, 4, 6, 8, 10] as const;
export interface RadiusPlace { id: string; categoryId: string; distanceKm: number; initiallyVisible?: boolean }

/**
 * Stedene som kan avdekkes gradvis, med avstanden sin.
 *
 * Hvilke kategorier det gjelder kommer fra datasettet (`discoveryCategoryIds`),
 * ikke fra en liste i koden: at trening og natur tåler «litt lenger unna» er en
 * egenskap ved innholdet på ett sted, ikke ved motoren.
 */
/**
 * Stedene manuset alt navngir, eller `undefined` når datasettet ikke har noe
 * manus. Skillet er ikke pynt: uten manus er «det som vises først» rent
 * avstandsstyrt (alt innen 2 km), MED manus er det manusets steder pluss de
 * tre nærmeste per kategori. Boardet og guiden må lese det likt, ellers kan
 * guiden avdekke steder kartet alt viser – eller motsatt.
 */
export function curatedInitialIds(segments: readonly { placeIds: readonly string[] }[] | undefined): string[] | undefined {
  return segments?.length ? segments.flatMap(s => s.placeIds) : undefined;
}

export function radiusPlaces(places: readonly { id: string; categoryId: string; coordinates: { lat: number; lng: number } }[], center: { lat: number; lng: number }, discoveryCategoryIds: readonly string[], initialIds?: readonly string[]): RadiusPlace[] {
  const sorted = places.filter(p => discoveryCategoryIds.includes(p.categoryId))
    .map(p => ({ id: p.id, categoryId: p.categoryId, distanceKm: calculateDistance(center.lat, center.lng, p.coordinates.lat, p.coordinates.lng) / 1000 }))
    .filter(p => p.distanceKm <= 10).sort((a,b) => a.distanceKm - b.distanceKm);
  return sorted.map(p => ({ ...p, initiallyVisible: initialIds === undefined ? p.distanceKm <= 2 : initialIds.includes(p.id) || (p.distanceKm <= 2 && sorted.filter(q => q.categoryId === p.categoryId).slice(0, 3).some(q => q.id === p.id)) }));
}
/** Radius only expands during a visit. Hidden IDs are the same on server and browser. */
export function radiusOptions(places: readonly RadiusPlace[], categoryId: string, revealed: ReadonlySet<string>) {
  const category = places.filter(p => p.categoryId === categoryId);
  const furthest = Math.max(2, ...category.filter(p => revealed.has(p.id)).map(p => p.distanceKm));
  const current = RADIUS_STEPS.find(r => r >= furthest) ?? 10;
  const options = RADIUS_STEPS.filter(r => r >= current).map(radiusKm => ({ radiusKm,
    ids: category.filter(p => !(p.initiallyVisible ?? p.distanceKm <= 2) && p.distanceKm <= radiusKm && !revealed.has(p.id)).map(p => p.id),
  })).filter(o => o.ids.length > 0);
  return { current, options };
}

/**
 * Om en kategori er en av datasettets utvidbare.
 *
 * Boardet bærer allerede svaret i `demoRadiusPlaces`, som har kategori-ID per
 * sted. Flatene spør derfor boardet i stedet for å kjenne kategori-ID-ene til
 * ett bestemt datasett.
 */
export function isDiscoveryCategory(places: readonly RadiusPlace[] | undefined, categoryId: string | null | undefined): categoryId is string {
  return Boolean(categoryId && places?.some(p => p.categoryId === categoryId));
}

/** Reuses the board's geometry layers in both map engines; this is a search radius, not a route. */
export function discoveryGeometry(data: import('@/components/variants/report/board/board-data').BoardData, categoryId: string | null | undefined): import('@/lib/types').CuratedGeometryFeature[] {
  const places = data.demoRadiusPlaces;
  if (!places || !isDiscoveryCategory(places, categoryId)) return [];
  const radiusKm = radiusOptions(places, categoryId, new Set(data.poisById.keys())).current;
  const { lat, lng } = data.home.coordinates;
  const angular = radiusKm / 6371;
  const latitude = lat * Math.PI / 180;
  const longitude = lng * Math.PI / 180;
  const coordinates: [number, number][] = Array.from({ length: 73 }, (_, i) => {
    const bearing = i * 2 * Math.PI / 72;
    const y = Math.asin(Math.sin(latitude) * Math.cos(angular) + Math.cos(latitude) * Math.sin(angular) * Math.cos(bearing));
    const x = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angular) * Math.cos(latitude), Math.cos(angular) - Math.sin(latitude) * Math.sin(y));
    return [x * 180 / Math.PI, y * 180 / Math.PI];
  });
  return [{ id: `discovery-radius-${categoryId}`, name: `${radiusKm} km fra ${data.home.name}`, kind: 'line', themeId: categoryId, status: 'existing', precision: 'sourced', color: '#64748b', coordinates }];
}
