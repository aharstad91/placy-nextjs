/**
 * Pure kamera-fit-logikk for BoardMap — utskilt så den kan enhetstestes uten en
 * Mapbox/WebGL-instans (jsdom har ingen WebGL, så BoardMap-rendering mockes ut
 * i tester). BoardMap kaller disse for å regne ut bounds og avgjøre NÅR kameraet
 * skal ramme inn programmet (event-board ro-fit, B2/B3).
 */

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
