/**
 * Google 3D-kamera → ekvivalent Mapbox-zoomnivå (2026-08-23).
 *
 * 2D-kartet tierer markørene på `map.getZoom()`: prikk under 13, ikon under 16,
 * ikon + label over det (`use-board-zoom-tier`). Google Maps 3D har ingen zoom
 * — det har `range` (kamera-avstand i meter) og `fov`. Uten en oversettelse
 * måtte 3D fått sine EGNE terskler, og de to flatene ville drevet fra hverandre
 * hver gang noen justerte den ene.
 *
 * Broa er bakke-oppløsning: begge motorer kan uttrykkes som «hvor mange meter
 * dekker én piksel i skjermsenter». For Mapbox er det den kjente
 * `156543.03392 · cos(lat) / 2^zoom`. For Google er det synsfeltets
 * bakke-utstrekning delt på skjermhøyden:
 *
 *   halv dybde = range · tan(fov / 2)          (samme ledd som `rectFromCamera`)
 *   meter/px   = 2 · halv dybde / høyde_px
 *
 * Løser vi den første for `zoom` med den andres meter/px får vi et tall som kan
 * mates rett inn i `computeZoomTier`. Terskelen bor da fortsatt ÉTT sted.
 *
 * ## Hvorfor tilt ikke er med
 *
 * Samme resonnement som `rectFromCamera` i `board-camera-fit`: med tilt er
 * bakken en trapes mot horisonten, og «meter per piksel» er da ikke ett tall,
 * men en funksjon av skjermhøyden. Vi leser skalaen som om kameraet så rett ned
 * fra samme avstand. Det gir et tier-valg som er STABILT når brukeren tilter —
 * det å legge blikket ned skal ikke få labels til å forsvinne — og det er riktig
 * i skjermsenter, som er der markørene man faktisk leser ligger.
 */

/** Meter per piksel ved ekvator på zoom 0 (Mapbox/Web Mercator, 512 px-fliser). */
const EQUATOR_METERS_PER_PIXEL_Z0 = 156543.03392;

/** Kamera-avlesningen skalaen utledes av. Speiler `Map3DElement`-properties. */
export interface Camera3DScale {
  /** Avstand kamera → siktepunkt i meter (Googles `range`). */
  rangeM: number;
  /** Vertikal field-of-view i grader (Googles `fov`, default 35). */
  fovDeg: number;
  /** Breddegrad — Web Mercator-skalaen er breddegrads-avhengig. */
  lat: number;
  /** Kart-elementets høyde i CSS-piksler. */
  heightPx: number;
}

/**
 * Meter bakke per skjermpiksel i skjermsenter. Returnerer null for degenerert
 * input (kamera ikke lesbart ennå, kart uten høyde).
 */
export function metersPerPixelForCamera(camera: Camera3DScale): number | null {
  const { rangeM, fovDeg, heightPx } = camera;
  if (!Number.isFinite(rangeM) || !Number.isFinite(fovDeg)) return null;
  if (!Number.isFinite(heightPx)) return null;
  if (rangeM <= 0 || fovDeg <= 0 || fovDeg >= 180 || heightPx <= 0) return null;
  const halfDepthM = rangeM * Math.tan((fovDeg * Math.PI) / 360);
  return (2 * halfDepthM) / heightPx;
}

/**
 * Det Mapbox-zoomnivået som ville gitt samme bakke-oppløsning som dette
 * 3D-kameraet. Mates inn i `computeZoomTier` så begge motorene deler terskler.
 *
 * Returnerer null når kameraet ikke er lesbart — konsumenten skal da beholde
 * forrige tier, ikke gjette (et gjettet tier ved mount blinker markørene).
 */
export function equivalentZoomForCamera(camera: Camera3DScale): number | null {
  const metersPerPixel = metersPerPixelForCamera(camera);
  if (metersPerPixel === null || metersPerPixel <= 0) return null;
  if (!Number.isFinite(camera.lat) || Math.abs(camera.lat) >= 90) return null;
  const groundScale =
    EQUATOR_METERS_PER_PIXEL_Z0 * Math.cos((camera.lat * Math.PI) / 180);
  if (!(groundScale > 0)) return null;
  return Math.log2(groundScale / metersPerPixel);
}
