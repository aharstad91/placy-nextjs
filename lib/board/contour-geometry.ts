/**
 * Ren geometri for rekkevidde-konturene: GeoJSON-formen begge kartmotorene
 * tegner, og punktet etikettene henges på.
 *
 * Ligger utenfor komponentene fordi Mapbox-laget og Google-laget må gi SAMME
 * svar — en etikett som står nord for konturen i «Kart» og øst for den i
 * «Satelitt» ville lest som to ulike kart.
 */

import type { PolygonalGeometry } from "@/lib/geo/geojson-schema";
import type {
  IsochroneContours,
  IsochroneMinutes,
  IsochroneSet,
  TravelMode,
} from "@/lib/types";
import { ISOCHRONE_MINUTES } from "@/lib/types";

export interface ContourRing {
  minutes: IsochroneMinutes;
  /** Én ytre ring, `[lng, lat]`. Hull følger i `holes`. */
  outer: [number, number][];
  holes: [number, number][][];
}

/**
 * Deler konturene for én reisemåte i ytre ringer.
 *
 * En kontur kan være MultiPolygon: Isochrone returnerer flere flater når et
 * nåbart område henger på en bru eller gangvei uten kobling i veinettet.
 * Google-laget trenger ett polygon-element per ytre ring, så oppdelingen hører
 * her og ikke i komponenten.
 *
 * Rekkefølgen er 5 → 10 → 15, altså innerst først. Det er også tegnerekkefølgen.
 */
export function contourRings(contours: IsochroneContours | undefined): ContourRing[] {
  if (!contours) return [];
  const rings: ContourRing[] = [];
  for (const minutes of ISOCHRONE_MINUTES) {
    const geometry = contours[minutes] as PolygonalGeometry | undefined;
    if (!geometry) continue;
    const polygons =
      geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    for (const polygon of polygons) {
      const [outer, ...holes] = polygon;
      if (!outer || outer.length < 4) continue;
      rings.push({
        minutes,
        outer: outer.map((p: number[]) => [p[0], p[1]] as [number, number]),
        holes: holes.map((h: number[][]) =>
          h.map((p: number[]) => [p[0], p[1]] as [number, number])
        ),
      });
    }
  }
  return rings;
}

/** Konturene for den aktive reisemåten, eller tom liste når profilen mangler. */
export function contourRingsForMode(
  isochrones: IsochroneSet | undefined,
  mode: TravelMode
): ContourRing[] {
  return contourRings(isochrones?.byMode[mode]);
}

/**
 * Punktet etiketten henges på: konturens NORDLIGSTE punkt.
 *
 * Nord er valgt fordi konturene er nøstet — 5 min ligger inni 10, som ligger
 * inni 15 — så nordligste punkt stabler de tre etikettene utover fra boligen i
 * stedet for å legge dem oppå hverandre. Ved flere flater per kontur vinner
 * den nordligste av dem, så konturen får ÉN etikett og ikke én per flate.
 *
 * Alternativet, etiketter langs linja, er forkastet: Mapbox' linje-plasserte
 * etiketter er upålitelige i denne kodebasen, og Google-motoren har dem ikke.
 */
export function northmostPoint(rings: ContourRing[]): [number, number] | null {
  let best: [number, number] | null = null;
  for (const ring of rings) {
    for (const point of ring.outer) {
      if (!best || point[1] > best[1]) best = point;
    }
  }
  return best;
}

export interface ContourLabel {
  minutes: IsochroneMinutes;
  /** «5 min» — samme form som minutt-kolonnen i lista. */
  text: string;
  lng: number;
  lat: number;
}

/**
 * Én etikett per kontur, plassert på konturens nordligste punkt.
 *
 * Etikettene sorteres innerst-først, og en etikett som ville stått nærmere enn
 * `minGapDeg` breddegrader fra den forrige skyves nordover. Uten det kan to
 * konturer med samme nordligste flate — en fjord eller en ås rett nord for
 * boligen stopper begge på samme sted — legge to etiketter oppå hverandre.
 */
export function contourLabels(
  rings: ContourRing[],
  minGapDeg = 0.0012
): ContourLabel[] {
  const labels: ContourLabel[] = [];
  for (const minutes of ISOCHRONE_MINUTES) {
    const forMinute = rings.filter((r) => r.minutes === minutes);
    const point = northmostPoint(forMinute);
    if (!point) continue;
    let lat = point[1];
    const previous = labels[labels.length - 1];
    if (previous && lat - previous.lat < minGapDeg) {
      lat = previous.lat + minGapDeg;
    }
    labels.push({ minutes, text: `${minutes} min`, lng: point[0], lat });
  }
  return labels;
}

/** Mapbox-kilden: én LineString per ytre ring, med minuttverdien som egenskap. */
export function contourFeatureCollection(rings: ContourRing[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: rings.map((ring) => ({
      type: "Feature",
      properties: { contour: Number(ring.minutes) },
      geometry: { type: "LineString", coordinates: ring.outer },
    })),
  };
}
