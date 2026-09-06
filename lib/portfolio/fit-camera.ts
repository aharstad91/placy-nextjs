import { zoomToRange, rangeToZoom } from "@/lib/utils/camera-map";

/**
 * Innramming for porteføljekartets ÅPNINGSVISNING.
 *
 * Boardets `deriveFocusCamera3D` kan ikke brukes: den klamper range til 4 000 m
 * og `DEFAULT_CAMERA_LOCK` klamper kamerahøyden til 2 000 m. HEMs fotavtrykk er
 * ~165 km bredt (Veiholmen i vest til Inderøy i øst), så begge grensene ville
 * kuttet halve porteføljen ut av bildet. Her regnes range fritt fra prosjektenes
 * bounding-boks, og `freeMode` i kartlaget slår av motorens egne grenser.
 *
 * Range regnes med `zoomToRange`, samme konvertering som Mapbox-reserven bruker,
 * så begge motorene åpner på samme utsnitt (`zoom` returneres ved siden av).
 */

/** Grader breddegrad per meter og omvendt — WGS-84, tilstrekkelig for innramming. */
const METERS_PER_DEG_LAT = 110_574;
const METERS_PER_DEG_LNG_EQUATOR = 111_320;

/**
 * Referanse-visning innrammingen regnes mot. Bevisst PORTRETT-aktig (smalere
 * enn desktop-ruta): et smalt synsfelt trenger STØRRE range for samme bredde, så
 * et utsnitt som rammer inn på denne formen rammer også inn på en bredere
 * desktop-rute. Motsatt vei ville mobilen mistet ytterpinnene.
 *
 * Alternativet, å måle den ekte ruta i nettleseren, ville krevd at kartet
 * mountes ETTER første måling — og `defaultRange` leses bare ved mount, så en
 * ny måling ville betydd remount av 3D-motoren. Det er nettopp det
 * WebGL-lærdommene forbyr.
 */
const REFERENCE_VIEWPORT = { width: 900, height: 1100 } as const;

/** Luft rundt ytterpinnene, så ingen chip klippes av kanten. */
const FIT_MARGIN = 1.2;

/** Google Maps 3D vertikale synsfelt (samme default som `camera-map`). */
const FOV_V_DEG = 35;

/**
 * Rett nedover. Med 165 km i bildet gir en skrå vinkel ingen romfølelse, bare en
 * horisont som skyver de fjerneste pinnene ut av ruta. Tilt er brukerens spak
 * etter at kartet har åpnet.
 */
const OVERVIEW_TILT = 0;

/** Range for ett enkelt punkt — nabolagsnært, samme størrelsesorden som boardet. */
const SINGLE_POINT_RANGE_M = 1_500;

export interface PortfolioPoint {
  lat: number;
  lng: number;
}

export interface PortfolioBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PortfolioCamera {
  center: { lat: number; lng: number };
  /** Google 3D-range i meter. */
  range: number;
  tilt: number;
  /** Samme utsnitt uttrykt som Mapbox-zoom, for 2D-reserven. */
  zoom: number;
  /** Prosjektenes bounding-boks, uten margin. Mates til Mapbox `fitBounds`. */
  bounds: PortfolioBounds;
}

/** Bounding-boksen rundt punktene, eller `null` for tom liste. */
export function boundsOf(points: PortfolioPoint[]): PortfolioBounds | null {
  if (points.length === 0) return null;
  let north = points[0].lat;
  let south = points[0].lat;
  let east = points[0].lng;
  let west = points[0].lng;
  for (const p of points) {
    if (p.lat > north) north = p.lat;
    if (p.lat < south) south = p.lat;
    if (p.lng > east) east = p.lng;
    if (p.lng < west) west = p.lng;
  }
  return { north, south, east, west };
}

/**
 * Kamera som rammer inn alle punktene. Tom liste gir `null` — kallstedet skal da
 * ikke rendre et kart i det hele tatt.
 */
export function fitPortfolioCamera(
  points: PortfolioPoint[],
  viewport: { width: number; height: number } = REFERENCE_VIEWPORT,
): PortfolioCamera | null {
  const bounds = boundsOf(points);
  if (!bounds) return null;

  const center = {
    lat: (bounds.north + bounds.south) / 2,
    lng: (bounds.east + bounds.west) / 2,
  };

  if (points.length === 1) {
    return {
      center,
      range: SINGLE_POINT_RANGE_M,
      tilt: OVERVIEW_TILT,
      zoom: rangeToZoom(
        SINGLE_POINT_RANGE_M,
        center.lat,
        OVERVIEW_TILT,
        viewport.width,
        viewport.height,
        FOV_V_DEG,
      ),
      bounds,
    };
  }

  const cosLat = Math.cos((center.lat * Math.PI) / 180);
  const widthM = (bounds.east - bounds.west) * METERS_PER_DEG_LNG_EQUATOR * cosLat;
  const heightM = (bounds.north - bounds.south) * METERS_PER_DEG_LAT;

  // Meter per piksel som trengs for at BEGGE aksene får plass i ruta. Den
  // trangeste aksen vinner — ellers stikker den andre utenfor kanten.
  const metersPerPixel = Math.max(
    (widthM * FIT_MARGIN) / viewport.width,
    (heightM * FIT_MARGIN) / viewport.height,
  );

  // To punkter på nøyaktig samme koordinat gir 0 utstrekning; fall til nær-range.
  if (!(metersPerPixel > 0)) {
    return {
      center,
      range: SINGLE_POINT_RANGE_M,
      tilt: OVERVIEW_TILT,
      zoom: rangeToZoom(
        SINGLE_POINT_RANGE_M,
        center.lat,
        OVERVIEW_TILT,
        viewport.width,
        viewport.height,
        FOV_V_DEG,
      ),
      bounds,
    };
  }

  const zoom = mppToZoom(metersPerPixel, center.lat);
  const range = zoomToRange(
    zoom,
    center.lat,
    OVERVIEW_TILT,
    viewport.width,
    viewport.height,
    FOV_V_DEG,
  );

  return { center, range, tilt: OVERVIEW_TILT, zoom, bounds };
}

/**
 * Meter per piksel → Mapbox-zoom. Invers av `metersPerPixel`-leddet i
 * `camera-map`; holdt her fordi bare innrammingen trenger den veien.
 */
function mppToZoom(metersPerPixel: number, latDeg: number): number {
  const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
  const latRad = (latDeg * Math.PI) / 180;
  return Math.log2(
    (EARTH_CIRCUMFERENCE_M * Math.cos(latRad)) / (metersPerPixel * 512),
  );
}
