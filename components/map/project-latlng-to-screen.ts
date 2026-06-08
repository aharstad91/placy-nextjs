/**
 * Full perspektiv-projeksjon fra (lat, lng, altitude) til skjerm-koordinater på
 * et Google Maps 3D (`gmp-map-3d`)-element. Google eksponerer ingen native
 * `latLngToScreen`, så vi regner det selv fra kameraets center/heading/tilt/range.
 *
 * Returnerer koordinater RELATIVT TIL kart-elementets øvre venstre hjørne (ikke
 * viewport). Konsumenten posisjonerer et HTML-overlay med `translate3d(x,y,0)`
 * (enten `position: absolute` inni kart-containeren, eller `fixed` når en
 * transformert ancestor gjør `fixed`-origo til kart-hjørnet).
 *
 * Ekstrahert fra BoardPOI3DMiniPopup så både POI-mini-popupen og prosjekt-pin-
 * overlayet deler ÉN projeksjon (ingen drift mellom to kopier av matten).
 *
 * Konvensjon: heading=0 → ser nord; tilt=0 → top-down, tilt=90 → horisontal.
 */

const FOV_Y_RAD = (35 * Math.PI) / 180; // estimat — Google 3D eksponerer ikke FOV
const METERS_PER_DEG_LAT = 111320;

/** Minimal kamera-flate vi leser fra Map3DElement-instansen. */
interface Map3DCameraLike {
  getBoundingClientRect(): DOMRect;
  center?: { lat: number; lng: number };
  heading?: number;
  tilt?: number;
  range?: number;
}

export function projectLatLngToScreen(
  map3d: unknown,
  lat: number,
  lng: number,
  altitudeM = 18,
): { x: number; y: number } | null {
  try {
    const m = map3d as Map3DCameraLike;
    const rect = m.getBoundingClientRect();
    const center = m.center;
    if (!center) return null;
    const heading = m.heading ?? 0;
    const tilt = m.tilt ?? 0;
    const range = m.range ?? 1200;

    // 1. World-delta → meter (lokal flat-approks med cos(lat) for lng)
    const metersPerDegLng =
      METERS_PER_DEG_LAT * Math.cos((center.lat * Math.PI) / 180);
    const dxEast = (lng - center.lng) * metersPerDegLng;
    const dyNorth = (lat - center.lat) * METERS_PER_DEG_LAT;

    // 2. Roter til kamera-frame: (east, north) → (right, forward)
    const h = (heading * Math.PI) / 180;
    const cosH = Math.cos(h);
    const sinH = Math.sin(h);
    const right = dxEast * cosH - dyNorth * sinH;
    const forward = dxEast * sinH + dyNorth * cosH;

    // 3. Tilt + altitude → kamera-frame
    const t = (tilt * Math.PI) / 180;
    const cosT = Math.cos(t);
    const sinT = Math.sin(t);
    const xCam = right;
    const yCam = forward * cosT + altitudeM * sinT;
    const zCam = range + forward * sinT - altitudeM * cosT;
    if (zCam <= 1) return null; // bak kameraet

    // 4. Perspektiv-projeksjon (koord relativt til kart-elementets hjørne)
    const focal = rect.height / (2 * Math.tan(FOV_Y_RAD / 2));
    const screenX = rect.width / 2 + (focal * xCam) / zCam;
    const screenY = rect.height / 2 - (focal * yCam) / zCam;
    return { x: screenX, y: screenY };
  } catch {
    return null;
  }
}
