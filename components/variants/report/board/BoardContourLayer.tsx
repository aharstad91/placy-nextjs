"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Source, Layer, Marker } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import {
  contourFeatureCollection,
  contourLabelCandidates,
  contourRingsForMode,
} from "@/lib/board/contour-geometry";
import {
  chooseContourLabels,
  type ContourLabelSlot,
} from "@/lib/board/contour-label-placement";
import { useBoard } from "./board-state";
import { ContourLabelChip } from "./ContourLabelChip";
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
  /**
   * Bredden (px) en sidekolonne dekker fra venstre. Kartet ligger UNDER panelet
   * på desktop, så en etikett bak det er tegnet men usett — og ville blitt
   * valgt fremfor en som faktisk vises. Default 0.
   */
  insetLeftPx?: number;
}

export function BoardContourLayer({
  mapRef,
  mapLoaded,
  insetLeftPx = 0,
}: Props) {
  const { state, data } = useBoard();
  const labelsVisible = useContourLabelsVisible(mapRef, mapLoaded);

  const rings = useMemo(
    () => contourRingsForMode(data.isochrones, state.travelMode),
    [data.isochrones, state.travelMode],
  );

  const geojson = useMemo(() => contourFeatureCollection(rings), [rings]);
  const candidates = useMemo(() => contourLabelCandidates(rings), [rings]);

  /* Etikett-punktene velges mot det kameraet FAKTISK ser, ikke mot konturens
   * nordligste punkt — se `contourLabelCandidates`. Zoomer leseren inn på
   * boligen, ligger 15-minutters-konturens nordspiss langt over skjermkanten,
   * og etiketten var da tegnet uten å være synlig. Regnes ved kamera-ro, samme
   * takt som markør-utglisningen i `BoardMap`. */
  const [slots, setSlots] = useState<ContourLabelSlot[]>([]);
  const chooseLabels = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!map || candidates.length === 0) {
      setSlots((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const container = map.getContainer();
    const next = chooseContourLabels(
      candidates,
      (lng, lat) => map.project([lng, lat]),
      {
        left: insetLeftPx + 8,
        top: 8,
        right: container.clientWidth - 8,
        bottom: container.clientHeight - 8,
      },
    );
    setSlots((prev) =>
      prev.length === next.length &&
      prev.every(
        (p, i) =>
          p.minutes === next[i].minutes &&
          p.lng === next[i].lng &&
          p.lat === next[i].lat,
      )
        ? prev
        : next,
    );
  }, [mapRef, candidates, insetLeftPx]);

  useEffect(() => {
    if (!mapLoaded) return;
    chooseLabels();
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    map.on("moveend", chooseLabels);
    return () => {
      map.off("moveend", chooseLabels);
    };
  }, [mapLoaded, mapRef, chooseLabels]);

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
        slots.map((slot) => (
          <Marker
            key={slot.minutes}
            longitude={slot.lng}
            latitude={slot.lat}
            anchor="bottom"
          >
            <ContourLabelChip minutes={slot.minutes} mode={state.travelMode} />
          </Marker>
        ))}
    </>
  );
}
