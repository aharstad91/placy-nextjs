/**
 * Ren geometri for rekkevidde-konturene: GeoJSON-formen begge kartmotorene
 * tegner, og punktene etikettene kan henges på.
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
 * Kandidatpunkter etiketten kan henges på, per kontur — nord først.
 *
 * Fram til 2026-09-07 sto ett fast punkt per kontur her — det nordligste. Det
 * holder når kameraet rammer inn hele konturen, og feiler stille når det ikke
 * gjør det.
 * Målt i Satelitt på Wesselsløkka (2026-09-07): 5-minutters-etiketten sto på
 * y=96, 10 min på y=−330 og 15 min på y=−812 — to av tre projisert OVER
 * skjermkanten, altså usynlige. Etikettene er det eneste stedet på kartet som
 * navngir reisemåten, så to tapte etiketter er to tredjedeler av koblingen.
 *
 * Med en liste kan visningslaget velge det punktet som faktisk er på skjermen.
 * Rekkefølgen er nordligst først, så valget lander der etiketten alltid har
 * stått når det er plass — konturene er nøstet, og nord stabler dem utover fra
 * boligen i stedet for oppå hverandre.
 *
 * Punktene subsamples FØR sorteringen. Sorterte vi først og kappet, ville alle
 * kandidatene ligget i samme nordlige hjørne — og et kamera som ikke ser det
 * hjørnet hadde stått uten etikett likevel.
 */
export function contourLabelCandidates(
  rings: readonly ContourRing[],
  maxPerContour = 48
): { minutes: IsochroneMinutes; points: [number, number][] }[] {
  const out: { minutes: IsochroneMinutes; points: [number, number][] }[] = [];
  for (const minutes of ISOCHRONE_MINUTES) {
    const points: [number, number][] = [];
    for (const ring of rings) {
      if (ring.minutes !== minutes) continue;
      // Siste punkt er en gjentakelse av det første (lukket ring) — utelates.
      const outer = ring.outer.slice(0, -1);
      const step = Math.max(1, Math.ceil(outer.length / maxPerContour));
      for (let i = 0; i < outer.length; i += step) points.push(outer[i]);
    }
    if (points.length === 0) continue;
    points.sort((a, b) => b[1] - a[1]);
    out.push({ minutes, points });
  }
  return out;
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
