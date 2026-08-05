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

/** Meter per breddegrad. Samme konstant som `project-latlng-to-screen`. */
const METERS_PER_DEG_LAT = 111320;

/** Kamera-posituren `rectFromCamera` trenger. Speiler feltene `Map3DElement`
 *  eksponerer som properties (`center`, `range`, `heading`, `fov`). */
export interface Camera3DPose {
  lat: number;
  lng: number;
  /** Avstand kamera → sikte­punkt i meter (Googles `range`). */
  rangeM: number;
  /** Kompass-retning i grader, 0 = nord. */
  headingDeg: number;
  /** Vertikal field-of-view i grader (Googles `fov`, default 35). */
  fovDeg: number;
}

/** Flatens piksel-mål + hvor mye av bunnen sheeten dekker. */
export interface Viewport3DMetrics {
  widthPx: number;
  heightPx: number;
  occludedBottomPx: number;
}

/**
 * Det ikke-okkluderte utsnittet for Google Maps 3D, avledet av KAMERASENTER +
 * RANGE — ikke av en skjerm→geo-projeksjon.
 *
 * `gmp-map-3d` eksponerer ingen `unproject`, så 2D-stien (unprojiser kartets
 * pikselhjørner) finnes ikke her. Men den trengs heller ikke: Googles `center`
 * ER sikte­punktet — nøyaktig det retikkelet nabolagsflaten er bygget rundt — og
 * `range` er avstanden til det. Sammen med `fov` gir de bakke-utstrekningen
 * direkte:
 *
 *   halv dybde = range · tan(fov / 2)     (eksakt når kameraet ser rett ned)
 *   halv bredde = halv dybde · sideforhold
 *
 * ## Hvorfor TILT ikke er med i regnestykket
 *
 * Med tilt er den synlige bakken en trapes som strekker seg mot horisonten: på
 * 45° ser man bakken fra ~330 m til ~1220 m foran seg, og nær 90° er den i
 * praksis uendelig. Scopet vi lot vokse med tilt ville derfor blitt en
 * horisont-dump — «i nærheten» ville listet steder kilometer unna fordi de så
 * vidt er noen piksler høye ved horisonten.
 *
 * Vi leser i stedet utsnittet som om kameraet så rett ned fra samme avstand.
 * Det gir et scope som er STABILT når brukeren tilter (det man sikter på endrer
 * seg ikke av at man legger blikket ned), og som alltid er en DELMENGDE av det
 * som faktisk er i bildet — feilen går mot å utelate det fjerneste, aldri mot å
 * påstå at noe usett er synlig.
 *
 * Okkluderingen fra sheeten håndteres i skjerm-rommet før konverteringen: den
 * synlige andelen `v` krymper båndet til `[H(1−2v), H]` langs blikk-retningen,
 * altså både smalere OG forskjøvet bort fra brukeren — samme geometri som når
 * 2D-stien måler høyden `canvas − sheet`.
 *
 * Returnerer null for degenerert input (ikke-endelige tall, ingen synlig flate).
 * Konsumenten skal da falle tilbake til «vis alt», aldri til en tom liste.
 */
export function rectFromCamera(
  camera: Camera3DPose,
  viewport: Viewport3DMetrics,
): ViewportRect | null {
  const { lat, lng, rangeM, headingDeg, fovDeg } = camera;
  const { widthPx, heightPx, occludedBottomPx } = viewport;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    !Number.isFinite(rangeM) ||
    !Number.isFinite(headingDeg) ||
    !Number.isFinite(fovDeg)
  ) {
    return null;
  }
  if (rangeM <= 0 || fovDeg <= 0 || widthPx <= 0 || heightPx <= 0) return null;

  // Synlig andel av flaten. ≤ 0 → sheeten dekker hele kartet: ingen ærlig
  // avlesning finnes, så konsumenten skal vise alt.
  const visibleFraction = (heightPx - occludedBottomPx) / heightPx;
  if (visibleFraction <= 0) return null;

  const halfDepthM = rangeM * Math.tan((fovDeg * Math.PI) / 360);
  const halfWidthM = halfDepthM * (widthPx / heightPx);
  // Skjermens topp ligger på +halfDepth langs blikket, bunnen på −halfDepth.
  // Sheeten spiser nedenfra, så det synlige båndet ender på H(1−2v).
  const nearM = halfDepthM * (1 - 2 * visibleFraction);
  const farM = halfDepthM;

  const h = (headingDeg * Math.PI) / 180;
  const cosH = Math.cos(h);
  const sinH = Math.sin(h);
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  if (!Number.isFinite(metersPerDegLng) || metersPerDegLng === 0) return null;

  // Alle fire hjørner, ikke to: med heading ≠ 0 er utsnittet rotert, og de to
  // diagonalt motsatte hjørnene er ikke lenger ytterpunktene. `rectFromCorners`
  // gir den akse-justerte konvolutten — eksakt ved heading 0, en kontrollert
  // over-seleksjon ellers (samme kontrakt som 2D-stien).
  const corners: LngLat[] = [];
  for (const forward of [farM, nearM]) {
    for (const right of [-halfWidthM, halfWidthM]) {
      const east = right * cosH + forward * sinH;
      const north = -right * sinH + forward * cosH;
      corners.push({
        lng: lng + east / metersPerDegLng,
        lat: lat + north / METERS_PER_DEG_LAT,
      });
    }
  }
  return rectFromCorners(corners);
}
