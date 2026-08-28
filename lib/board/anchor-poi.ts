import type { POI } from "@/lib/types";

/**
 * Er dette stedet et anker — et kjøpesenter som representerer virksomhetene inni?
 *
 * Flagget er `anchorSummary`, ikke antall barn. Det er bevisst: teksten skrives
 * KUN av de to stedene i pipelinen som har bevist at bygget samler minst fire
 * virksomheter — `resolve-anchors-step` (som teller dem i poolen) og
 * `discover-anchors` (som teller dem hos Google uten å importere dem). Å telle
 * barn i stedet ville gjort Thon Senter Verdal usynlig på Sundsøya-boardet, for
 * det ankeret har null barn i basen og er like fullt et kjøpesenter.
 *
 * Feiler tekst-skrivingen (begge stedene er fail-soft), oppfører stedet seg som
 * i dag: barna vises hver for seg. Ingenting forsvinner.
 *
 * Ligger i `lib/board/` og ikke i rapport-laget fordi tre lag spør om det
 * samme: temaene (`report-data`), markørene (`map-view-3d`) og utglisningen
 * (`use-3d-marker-declutter`).
 */
export function isAnchorPOI(poi: Pick<POI, "anchorSummary">): boolean {
  return Boolean(poi.anchorSummary);
}
