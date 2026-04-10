"use client";

import { Source, Layer } from "react-map-gl/mapbox";
import { useMemo } from "react";
import type { TrailCollection } from "@/lib/types";

interface TrailLayerProps {
  trails: TrailCollection;
  activated?: boolean;
}

export function TrailLayer({ trails, activated = false }: TrailLayerProps) {
  const data = useMemo(() => trails, [trails]);

  if (!trails.features || trails.features.length === 0) return null;

  return (
    <Source id="trail-source" type="geojson" data={data}>
      <Layer
        id="trail-lines"
        type="line"
        layout={{
          "line-join": "round",
          "line-cap": "round",
        }}
        paint={{
          "line-color": [
            "match",
            ["get", "routeType"],
            "bicycle", "#22C55E",
            "hiking", "#D97706",
            "foot", "#D97706",
            "#888888",
          ],
          "line-width": [
            "match",
            ["get", "routeType"],
            "bicycle", 3,
            "hiking", 2.5,
            "foot", 2.5,
            2,
          ],
          "line-opacity": activated ? 0.8 : 0.3,
          "line-opacity-transition": { duration: 300, delay: 0 },
        }}
      />
      <Layer
        id="trail-labels"
        type="symbol"
        layout={{
          "symbol-placement": "line-center",
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-font": ["Open Sans Semibold"],
          "text-offset": [0, -0.8],
          "text-max-angle": 30,
        }}
        paint={{
          "text-color": "#1a1a1a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
          "text-opacity": activated ? 1 : 0,
          "text-opacity-transition": { duration: 300, delay: 0 },
        }}
      />
    </Source>
  );
}
