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
        id="project-massing-street"
        type="fill"
        filter={["==", ["get", "kind"], "street"]}
        paint={{ "fill-color": "#b7ada3", "fill-opacity": 0.65 }}
      />
      <Layer
        id="project-massing-street-edge"
        type="line"
        filter={["==", ["get", "kind"], "street"]}
        paint={{ "line-color": "#8d8176", "line-width": 1, "line-opacity": 0.75 }}
      />
      <Layer
        id="project-massing-fill"
        type="fill"
        source="project-massing-source"
        filter={["==", ["get", "kind"], "building"]}
        paint={{
          "fill-color": "#edf3ef",
          "fill-opacity": 0.55,
        }}
      />
      <Layer
        id="project-massing-outline"
        type="line"
        source="project-massing-source"
        filter={["==", ["get", "kind"], "building"]}
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
