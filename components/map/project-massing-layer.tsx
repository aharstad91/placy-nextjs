"use client";

import { useMemo } from "react";
import { Layer, Source } from "react-map-gl/mapbox";
import {
  projectMassingFeatureCollection,
  type ProjectMassing,
} from "@/lib/map/project-massing";

interface ProjectMassingLayerProps {
  massing: ProjectMassing;
}

/**
 * Planlagte bygg i Mapbox-visningen. Kartet er ovenfra, så et transparent
 * flatefyll + tydelig kontur er ærligere og mer lesbart enn en perspektivisk
 * ekstrudering som brukeren aldri ser siden pitch er 0.
 */
export function ProjectMassingLayer({ massing }: ProjectMassingLayerProps) {
  const geojson = useMemo(
    () => projectMassingFeatureCollection(massing),
    [massing],
  );

  return (
    <Source id="project-massing-source" type="geojson" data={geojson}>
      <Layer
        id="project-massing-fill"
        type="fill"
        source="project-massing-source"
        paint={{
          "fill-color": "#edf3ef",
          "fill-opacity": 0.55,
        }}
      />
      <Layer
        id="project-massing-outline"
        type="line"
        source="project-massing-source"
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": "#60736b",
          "line-width": 2.5,
          "line-opacity": 0.9,
        }}
      />
    </Source>
  );
}
