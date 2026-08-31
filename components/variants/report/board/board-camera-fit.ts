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

/** Flatens piksel-mål + hvor mye av den en flate over kartet dekker. */
export interface Viewport3DMetrics {
  widthPx: number;
  heightPx: number;
  occludedBottomPx: number;
  /**
   * Bredden (px) en sidekolonne dekker fra VENSTRE. Desktop-panelet svømmer
   * oppå et kart i full bredde (2026-08-27), så en tredjedel av lerretet er
   * skjult bak det — uten dette leddet ville lista lovet «stedene i utsnittet»
   * og tatt med dem som ligger under panelet. Default 0: mobil har ingen
   * sidekolonne, og geometrien er da bit-for-bit den samme som før.
   */
  occludedLeftPx?: number;
  /**
   * Bredden (px) elementet stikker ut TIL HØYRE for det synlige vinduet.
   * Google-motorens element strekkes forbi vindukanten for å få sikte­punktet i
   * midten av det synlige kartet (se BoardMap); den stripen er rendret, men
   * ingen ser den. Default 0.
   */
  overhangRightPx?: number;
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
 * Okkluderingen fra flatene over kartet håndteres i skjerm-rommet før
 * konverteringen: den synlige andelen `v` krymper båndet til `[H(1−2v), H]`
 * langs blikk-retningen, altså både smalere OG forskjøvet bort fra brukeren —
 * samme geometri som når 2D-stien måler høyden `canvas − sheet`. En sidekolonne
 * fra venstre gjør det samme på tvers av blikket (`occludedLeftPx`).
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
  const occludedLeftPx = viewport.occludedLeftPx ?? 0;
  const overhangRightPx = viewport.overhangRightPx ?? 0;
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
  // Sidekolonnen spiser fra venstre, med nøyaktig samme geometri på tvers av
  // blikket: dekker den andelen f av bredden, begynner det synlige båndet på
  // −halvBredde·(1−2f) i stedet for på −halvBredde. f ≥ 0,5 ville snudd båndet,
  // så det klemmes — en degenerert avlesning skal bli et smalt scope, ikke et
  // speilvendt.
  const leftFraction = Math.min(Math.max(occludedLeftPx / widthPx, 0), 0.5);
  const leftM = -halfWidthM * (1 - 2 * leftFraction);
  // Overhenget på høyre side er ikke okkludert, men usett — samme sak for et
  // scope som lover «det du ser».
  const rightFraction = Math.min(Math.max(overhangRightPx / widthPx, 0), 0.5);
  const rightM = halfWidthM * (1 - 2 * rightFraction);

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
    for (const right of [leftM, rightM]) {
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

// ── Innramming for Google Maps 3D ───────────────────────────────────────────

/** Googles dokumenterte default for `fov` når den ikke er satt eksplisitt.
 *  Delt med `use-3d-viewport-publish` — samme kamera, samme antakelse. */
export const DEFAULT_FOV_DEG = 35;

/** Luft rundt punktene, som andel av deres egen utstrekning. Speiler
 *  `FIT_EDGE_PADDING_PX` i 2D-stien: et sted helt inntil kanten leser som at
 *  det ligger utenfor. */
const FOCUS_PADDING_FACTOR = 1.2;
/** Gulv for luften, i meter. Et stopp med ETT sted har null utstrekning, og en
 *  ren prosentmargin ville da vært null — kameraet ville stått i bakken. */
const FOCUS_MIN_MARGIN_M = 150;
/**
 * Klamping av `range`. Gulvet holder kameraet over hustakene.
 *
 * Taket er bevisst høyt. Med vertikal `fov` på 35° og en telefon i portrett er
 * det BREDDEN som koster: halv bredde = range · tan(fov/2) · (W/H), og på 390 ×
 * 844 px er den siste faktoren 0,46 — et stopp med et halvt kilometer mellom
 * ytterpunktene øst–vest krever da flere kilometer range. Et lavt tak ville
 * klippet stedene bort i stedet for å ramme dem, og 2D-stien (`fitBounds` med
 * `maxZoom`) zoomer ut så langt den må. Taket er derfor der for ekstremtilfellet,
 * ikke for normalbruk.
 */
const FOCUS_RANGE_MIN_M = 380;
const FOCUS_RANGE_MAX_M = 4000;

/** Kamera-posituren en innramming lander på (heading/tilt eies av kalleren). */
export interface FocusCamera3D {
  lat: number;
  lng: number;
  rangeM: number;
}

export interface FocusCamera3DInput {
  /** Punktene som skal ligge i det IKKE-okkluderte båndet. */
  points: readonly LngLat[];
  viewport: Viewport3DMetrics;
  fovDeg: number;
  /** Kompass-retningen rammen regnes i. Omvisningen bruker 0 (nord opp). */
  headingDeg: number;
}

/**
 * Inversen av {@link rectFromCamera}: gitt punktene som SKAL være i bildet,
 * hvilket kamerasenter og hvilken `range` gir det?
 *
 * `gmp-map-3d` har ingen `fitBounds`. Mapbox-stien kan be om en ramme med
 * padding og få kartet til å regne; her må vi regne selv. Vi bruker nøyaktig den
 * samme geometrien avlesningen bruker — halv dybde = range · tan(fov/2), halv
 * bredde = halv dybde · sideforhold, kameraet lest som om det så rett ned — så
 * det som rammes inn og det som senere leses ut er samme modell, ikke to.
 *
 * Okkluderingen løses i BEGGE retninger, som den må: rammen må både være VIDERE
 * (bare en andel av flaten er synlig) og FORSKJØVET (det synlige båndet ligger
 * ikke midt i bildet). Bare å zoome ut ville lagt stedene rett bak flatene
 * brukeren leser i.
 *
 * De tre okkluderings-leddene er de samme tre `rectFromCamera` trekker fra, og
 * må være det — ellers rammer vi inn mot ett bilde og leser av et annet:
 *
 *  - `occludedBottomPx` (sheeten på mobil) spiser nedenfra langs blikket. Det
 *    synlige båndet får halv dybde `halvDybde · v` og midtpunkt
 *    `halvDybde · (1 − v)` foran kameraet.
 *  - `occludedLeftPx` (sidekolonnen på desktop) og `overhangRightPx` (stripen
 *    Google-elementet strekker forbi vindukanten) spiser på tvers. Båndet får
 *    halv bredde `halvBredde · (1 − f − r)` og midtpunkt `halvBredde · (f − r)`
 *    — altså forskjøvet mot HØYRE når panelet står til venstre, som er
 *    nøyaktig der det synlige kartet ligger.
 *
 * Returnerer null for degenerert input — ingen punkter, en flate som dekker
 * hele kartet, eller okkludering som ikke levner noen bredde. Kalleren skal da
 * la kameraet stå.
 */
export function deriveFocusCamera3D(
  input: FocusCamera3DInput,
): FocusCamera3D | null {
  const { points, viewport, fovDeg, headingDeg } = input;
  const { widthPx, heightPx, occludedBottomPx } = viewport;
  if (points.length === 0) return null;
  if (!Number.isFinite(fovDeg) || fovDeg <= 0) return null;
  if (widthPx <= 0 || heightPx <= 0) return null;

  const visibleFraction = Math.min(1, (heightPx - occludedBottomPx) / heightPx);
  if (visibleFraction <= 0) return null;

  // Samme klamping som `rectFromCamera`: en andel over 0,5 ville snudd båndet,
  // og en degenerert avlesning skal bli et smalt utsnitt, ikke et speilvendt.
  const leftFraction = Math.min(
    Math.max((viewport.occludedLeftPx ?? 0) / widthPx, 0),
    0.5,
  );
  const rightFraction = Math.min(
    Math.max((viewport.overhangRightPx ?? 0) / widthPx, 0),
    0.5,
  );
  /** Andelen av halv bredde som faktisk er synlig. 0 → panel + overheng dekker
   *  alt; da finnes ingen ærlig ramme og kameraet skal stå. */
  const acrossFraction = 1 - leftFraction - rightFraction;
  if (acrossFraction <= 0) return null;

  let latSum = 0;
  let lngSum = 0;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
    latSum += p.lat;
    lngSum += p.lng;
  }
  const originLat = latSum / points.length;
  const originLng = lngSum / points.length;
  const metersPerDegLng =
    METERS_PER_DEG_LAT * Math.cos((originLat * Math.PI) / 180);
  if (!Number.isFinite(metersPerDegLng) || metersPerDegLng === 0) return null;

  // Punktene inn i kameraets eget aksekors: `forward` er blikkretningen,
  // `right` står vinkelrett på den. Invers av projeksjonen i `rectFromCamera`.
  const h = (headingDeg * Math.PI) / 180;
  const cosH = Math.cos(h);
  const sinH = Math.sin(h);
  let minF = Infinity;
  let maxF = -Infinity;
  let minR = Infinity;
  let maxR = -Infinity;
  for (const p of points) {
    const east = (p.lng - originLng) * metersPerDegLng;
    const north = (p.lat - originLat) * METERS_PER_DEG_LAT;
    const forward = east * sinH + north * cosH;
    const right = east * cosH - north * sinH;
    if (forward < minF) minF = forward;
    if (forward > maxF) maxF = forward;
    if (right < minR) minR = right;
    if (right > maxR) maxR = right;
  }

  const halfSpanF = (maxF - minF) / 2;
  const halfSpanR = (maxR - minR) / 2;
  const needF = halfSpanF * FOCUS_PADDING_FACTOR + FOCUS_MIN_MARGIN_M;
  const needR = halfSpanR * FOCUS_PADDING_FACTOR + FOCUS_MIN_MARGIN_M;
  // Dybden må romme `needF` innenfor det synlige båndet (halv dybde · v), og
  // bredden må romme `needR` innenfor båndets halve bredde
  // (halv dybde · W/H · acrossFraction).
  const halfDepthNeeded = Math.max(
    needF / visibleFraction,
    (needR * heightPx) / (widthPx * acrossFraction),
  );

  const tanHalfFov = Math.tan((fovDeg * Math.PI) / 360);
  const rangeM = Math.max(
    FOCUS_RANGE_MIN_M,
    Math.min(FOCUS_RANGE_MAX_M, halfDepthNeeded / tanHalfFov),
  );
  // Klampingen kan ha flyttet dybden, og forskyvningene under må regnes på den
  // dybden kameraet FAKTISK får — ikke på den vi ba om.
  const halfDepth = rangeM * tanHalfFov;
  const halfWidth = halfDepth * (widthPx / heightPx);

  // Punktenes midtpunkt skal ligge i det synlige båndets midtpunkt, så kameraet
  // trekkes like langt motsatt vei — langs blikket og på tvers av det.
  const centerF = (maxF + minF) / 2 - halfDepth * (1 - visibleFraction);
  const centerR =
    (maxR + minR) / 2 - halfWidth * (leftFraction - rightFraction);
  const east = centerR * cosH + centerF * sinH;
  const north = -centerR * sinH + centerF * cosH;
  return {
    lat: originLat + north / METERS_PER_DEG_LAT,
    lng: originLng + east / metersPerDegLng,
    rangeM,
  };
}
