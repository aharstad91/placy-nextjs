/**
 * Ren markør-synlighets-helper for event-board filter-sømmen (Unit 4).
 *
 * `BoardMap.markerStates` bygger først et `visibleIds`-sett fra phase/aktiv
 * kategori/sub-filter. Denne helperen intersekter DET med det tema/dag/tid-
 * filtrerte `visiblePoiIds`-settet — én markør må passere BEGGE (komposisjon).
 * Trukket ut hit så invarianten kan enhetstestes uten å mounte hele Mapbox-
 * kartet (WebGL).
 *
 * - `visiblePoiIds === undefined` (boligrapport, eller event uten aktivt filter)
 *   → ingen begrensning; `baseVisible` returneres uberørt.
 * - Ellers fjernes alle IDer som IKKE er i `visiblePoiIds`.
 *
 * Returnerer et NYTT sett (muterer ikke input).
 */
export function intersectVisible(
  baseVisible: Set<string>,
  visiblePoiIds: Set<string> | undefined,
): Set<string> {
  if (!visiblePoiIds) return new Set(baseVisible);
  const out = new Set<string>();
  for (const id of Array.from(baseVisible)) {
    if (visiblePoiIds.has(id)) out.add(id);
  }
  return out;
}
