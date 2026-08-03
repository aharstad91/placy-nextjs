/**
 * Pure kamera-fit-logikk for BoardMap — utskilt så den kan enhetstestes uten en
 * Mapbox/WebGL-instans (jsdom har ingen WebGL, så BoardMap-rendering mockes ut
 * i tester). BoardMap kaller disse for å regne ut bounds og avgjøre NÅR kameraet
 * skal ramme inn programmet (event-board ro-fit, B2/B3).
 */

import type { VisibleIdsSource, ViewportRect } from "@/lib/board/board-types";

export interface LngLat {
  lng: number;
  lat: number;
}

export interface Bounds {
  /** [west, south] */
  sw: [number, number];
  /** [east, north] */
  ne: [number, number];
}

/**
 * Regner ut bounding-box rundt et sett POI-koordinater + home-punktet. Home tas
 * alltid med så kartet aldri kollapser til ett enkelt punkt når settet er lite.
 * Returnerer null når det ikke er noen POIer å ramme inn (behold posisjon).
 */
export function computeFitBounds(
  poiCoords: LngLat[],
  home: LngLat,
): Bounds | null {
  if (poiCoords.length === 0) return null;
  let west = home.lng;
  let east = home.lng;
  let south = home.lat;
  let north = home.lat;
  for (const { lng, lat } of poiCoords) {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { sw: [west, south], ne: [east, north] };
}

/**
 * Event-board ro-fit-predikat (B2/B3).
 *
 * Events har ingen audio-tur (tour-fitten fyrer aldri) og filter-fitten fyrer kun
 * NÅR et filter er aktivt. Uten en ro-fit ville kartet (a) åpne på default-senteret
 * i stedet for rammet rundt hele programmet (B2), og (b) ikke zoome ut igjen når et
 * filter nullstilles (B3-asymmetri). Vi fitter til HELE programmet når:
 *   - vi er i event-modus,
 *   - kartet er lastet,
 *   - ingen audio-tur eier kameraet (tourActive=false), OG
 *   - intet filter er aktivt (visibleIdsKey === null → ro-tilstand).
 *
 * Effekten som kaller dette er nøklet på `visibleIdsKey`, så den re-fyrer kun ved
 * FAKTISK tilstandsskifte (initielt null ved last, og → null ved nullstilling) —
 * aldri per render mens man står i ro. Det gjør fitten one-shot per ro-inngang og
 * WebGL-trygt (Mapbox-instansen muteres, unmountes aldri).
 */
export function shouldFitToProgram(opts: {
  eventMode: boolean;
  mapLoaded: boolean;
  tourActive: boolean;
  /** Stabil join av sorterte filtrerte IDer, eller null i ro-tilstand. */
  visibleIdsKey: string | null;
}): boolean {
  return (
    opts.eventMode &&
    opts.mapLoaded &&
    !opts.tourActive &&
    opts.visibleIdsKey === null
  );
}

/**
 * Filter-fit-predikat — avgjør om en ENDRING i `visiblePoiIds` skal ramme
 * kameraet inn på det nye settet.
 *
 * Den avgjørende gaten er `visibleIdsSource` (mobil nabolagsflate, Unit 1). Før
 * diskriminatoren fantes var denne effekten ubetinget for ethvert definert
 * `visiblePoiIds` — greit så lenge event-filteret var eneste kilde, men dødelig
 * i det øyeblikket settet AVLEDES av kartutsnittet: fitten flytter kameraet,
 * kameraet gir et nytt utsnitt, utsnittet gir et nytt sett, som fitter igjen.
 * Løkken stopper aldri av seg selv.
 *
 * Fitter altså kun når:
 *  - et sett faktisk er aktivt (`visibleIdsKey !== null` — ellers eier
 *    ro-fitten kameraet),
 *  - ingen audio-tur eier kameraet, OG
 *  - settet er brukervalgt (`"event-filter"`), ikke kamera-avledet.
 */
export function shouldFitToFilter(opts: {
  /** Stabil join av sorterte synlige IDer, eller null i ro-tilstand. */
  visibleIdsKey: string | null;
  tourActive: boolean;
  visibleIdsSource: VisibleIdsSource | null;
}): boolean {
  if (opts.visibleIdsKey === null) return false;
  if (opts.tourActive) return false;
  return opts.visibleIdsSource !== "viewport-scope";
}

/**
 * Bygger det ikke-okkluderte rektangelet fra kart-hjørner som allerede er
 * projisert til geo-koordinater.
 *
 * ALLE FIRE hjørner, ikke bare topp-venstre/bunn-høyre: ved bearing ≠ 0 er de
 * to diagonalt motsatte hjørnene ikke lenger rektangelets ytterpunkter, og
 * to-hjørners-varianten ville gitt et vridd (i verste fall invertert) utsnitt.
 * Med fire hjørner får vi den akse-justerte konvolutten — eksakt ved bearing 0
 * (som er der flaten faktisk står, se `publishViewport`-låsen i `BoardMap`), og
 * en kontrollert over-seleksjon hvis rotasjon en dag slippes til.
 *
 * Returnerer null for et degenerert sett (tomt, eller ikke-endelige tall fra en
 * unproject på et kart som ikke er klart) — konsumenten skal da falle tilbake
 * til «vis alt», aldri til en tom liste.
 */
export function rectFromCorners(corners: LngLat[]): ViewportRect | null {
  if (corners.length === 0) return null;
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const { lng, lat } of corners) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, south, east, north };
}
