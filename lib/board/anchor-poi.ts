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

/** Tomt filter — «ingenting er skjult». Delt konstant så kallesteder slipper å
 *  allokere et nytt Set per render. */
export const NO_HIDDEN_CATEGORIES: ReadonlySet<string> = new Set<string>();

/**
 * Medlemmene ankeret representerer akkurat nå.
 *
 * Barna er allerede TEMA-avgrenset når de kommer hit (Unit 4): Sirkus i
 * «Mat & Drikke» bærer de åtte spisestedene, ikke de femti butikkene.
 * `hiddenCategoryIds` er sub-kategori-filterets negative form
 * (`useSubCategoryFilter`) og snevrer inn ytterligere; tom = alle.
 */
export function visibleAnchorMembers(
  poi: Pick<POI, "anchorSummary" | "childPOIs">,
  hiddenCategoryIds: ReadonlySet<string> = NO_HIDDEN_CATEGORIES,
): POI[] {
  if (!isAnchorPOI(poi) || !poi.childPOIs) return [];
  if (hiddenCategoryIds.size === 0) return poi.childPOIs;
  return poi.childPOIs.filter((child) => !hiddenCategoryIds.has(child.category.id));
}

/**
 * Overlever ankeret et sub-kategori-filter det selv ikke matcher?
 *
 * R4: ligger en POI som oppfyller kategorien inne i ankeret, er kategorien
 * oppfylt. Uten dette forsvinner seks dagligvarebutikker fra kartet i det
 * brukeren filtrerer på dagligvare — de er absorbert, så de har ingen egen
 * markør å komme tilbake som.
 */
export function anchorRepresentsFilter(
  poi: Pick<POI, "anchorSummary" | "childPOIs">,
  hiddenCategoryIds: ReadonlySet<string>,
): boolean {
  return visibleAnchorMembers(poi, hiddenCategoryIds).length > 0;
}

/**
 * Markør-navnet: «SATS Sirkus — i Sirkus Shopping».
 *
 * KUN når ankeret representerer nøyaktig ETT sted her. Det er R4s halvdel om
 * navngivning: står treningssenteret alene inne i Sirkus i «Trening &
 * Aktivitet», skal pinnen si hvilket sted det er — ikke stå som en anonym pin
 * på et tak. Har senteret femti butikker i «Hverdagsliv», er senterets eget
 * navn det ærlige svaret.
 *
 * Vi teller ALDRI i labelen («6 dagligvare»): tallet ble forkastet sammen med
 * FINN-mønsteret, `+`-merket sier allerede kvalitativt at det er mer inni, og
 * norsk flertallsbøyning av kategorinavn er en felle («Apotek» → «apotek»,
 * «Kafé» → «kafeer»). En label som bøyer feil er verre enn en som lar være.
 *
 * Kjent grensetilfelle, akseptert: et lite nærsenter som selv hører hjemme i
 * temaet OG bare har ett medlem der, får medlemmets navn foran sitt eget.
 * Utsagnet er fortsatt sant, og alternativet krever at temaets kategorisett
 * følger med ned i board-laget.
 */
export function anchorMarkerName(
  poi: Pick<POI, "name" | "anchorSummary" | "childPOIs">,
  hiddenCategoryIds: ReadonlySet<string> = NO_HIDDEN_CATEGORIES,
): string {
  const visible = visibleAnchorMembers(poi, hiddenCategoryIds);
  return visible.length === 1 ? `${visible[0].name} — i ${poi.name}` : poi.name;
}

/**
 * POI-en markøren skal tegne: samme objekt når navnet står uendret, en kopi når
 * ankeret navngir stedet det representerer.
 *
 * Referanse-identiteten er ikke pynt — `Marker3DItem` er memoisert, og et
 * ferskt objekt per render ville re-rendret hele markørsettet ved hver
 * kamerabevegelse. Samme disiplin som `toDisplayPOI`.
 */
export function withAnchorMarkerName(
  poi: POI,
  hiddenCategoryIds: ReadonlySet<string> = NO_HIDDEN_CATEGORIES,
): POI {
  const name = anchorMarkerName(poi, hiddenCategoryIds);
  return name === poi.name ? poi : { ...poi, name };
}
