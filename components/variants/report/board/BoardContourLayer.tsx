"use client";

import { useMemo } from "react";
import { Source, Layer, Marker } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import {
  contourFeatureCollection,
  contourLabels,
  contourRingsForMode,
} from "@/lib/board/contour-geometry";
import { useBoard } from "./board-state";
import { useContourLabelsVisible } from "./use-board-zoom-tier";

/**
 * Rekkevidde-konturene i «Kart» (Mapbox-motoren): tre prikkede linjer for 5,
 * 10 og 15 minutter i aktiv reisemåte, med én etikett hver.
 *
 * INGEN FYLL. Konturene skal ikke konkurrere med pinnene — hele grunnen til at
 * vi gjør dette annerledes enn hjem.nos fire fargeflater, som dekker kartet og
 * skjuler stedene under. Den innerste linja er tydeligst, de ytre svakere, og
 * alle tre ligger under markørene (som er DOM-overlay og dermed alltid øverst).
 *
 * `line-dasharray` er ikke data-drevet i Mapbox, så de tre linjene er tre lag
 * med hvert sitt mønster i stedet for ett lag med et uttrykk. Linjebredden og
 * prikkmønsteret må velges sammen: dash-verdiene er MULTIPLER av bredden.
 *
 * Ved modusbytte byttes kilde-dataene under samme kilde-id — laget monteres
 * ikke om, så Mapbox beholder lagene og bytter bare geometri.
 */

/** Prikkmønster og styrke per kontur. Dash-verdiene er multipler av bredden. */
const CONTOUR_STYLE: Record<number, { width: number; opacity: number; dash: [number, number] }> = {
  5: { width: 2, opacity: 0.85, dash: [2, 2] },
  10: { width: 1.75, opacity: 0.6, dash: [2.5, 2.5] },
  15: { width: 1.5, opacity: 0.4, dash: [3, 3] },
};

/** Nøytral, mørk linje. Konturene er en ramme, ikke en kategori. */
const CONTOUR_COLOR = "#44403c";

interface Props {
  /** Kartreferansen etikett-terskelen leser zoom fra. */
  mapRef: React.RefObject<MapRef | null>;
  mapLoaded: boolean;
}

export function BoardContourLayer({ mapRef, mapLoaded }: Props) {
  const { state, data } = useBoard();
  const labelsVisible = useContourLabelsVisible(mapRef, mapLoaded);

  const rings = useMemo(
    () => contourRingsForMode(data.isochrones, state.travelMode),
    [data.isochrones, state.travelMode],
  );

  const geojson = useMemo(() => contourFeatureCollection(rings), [rings]);
  const labels = useMemo(() => contourLabels(rings), [rings]);

  // Av, eller ingen konturer for denne reisemåten (AE4): ingenting tegnes, men
  // knappen i kartkontrollen står — den gates på om NOEN profil har konturer.
  if (!state.showContours || rings.length === 0) return null;

  return (
    <>
      <Source id="board-contour-source" type="geojson" data={geojson}>
        {Object.entries(CONTOUR_STYLE).map(([minutes, style]) => (
          <Layer
            key={minutes}
            id={`board-contour-${minutes}`}
            type="line"
            source="board-contour-source"
            filter={["==", ["get", "contour"], Number(minutes)]}
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{
              "line-color": CONTOUR_COLOR,
              "line-width": style.width,
              "line-opacity": style.opacity,
              "line-dasharray": style.dash,
            }}
          />
        ))}
      </Source>

      {labelsVisible &&
        labels.map((label) => (
          <Marker
            key={label.minutes}
            longitude={label.lng}
            latitude={label.lat}
            anchor="bottom"
          >
            {/* pointer-events-none: etiketten skal aldri stjele et klikk fra en
                markør som ligger i nærheten. */}
            <span className="pointer-events-none select-none rounded-full bg-white/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-stone-600 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
              {label.text}
            </span>
          </Marker>
        ))}
    </>
  );
}
