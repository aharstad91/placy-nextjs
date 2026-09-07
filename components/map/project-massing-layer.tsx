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
 * Planlagte bygg i Mapbox-visningen.
 *
 * Kartet er ovenfra, så et flatefyll med tydelig kontur er ærligere og mer
 * lesbart enn en perspektivisk ekstrudering brukeren aldri ser med pitch 0.
 *
 * To roller: salgsbyggene i prosjektets rosa, resten av områdeplanen i en
 * nøytral tone bak dem. Poenget er at leseren ser to ting samtidig — hvilke
 * tre bygg boligen ligger i, og at det kommer et helt nabolag rundt dem.
 *
 * Volumene toner INN med zoom. Boardet åpner på ~13,5 der hele feltet er noen
 * få piksler bredt: der er prosjektet pinnen, ikke femti omriss som krangler
 * med den. Fra zoom 15 er tomta stor nok til at grunnrisset faktisk sier noe.
 * Samme grunn til at bokstavene (A1/A2/B) først kommer på 15,5 — under det
 * får de ikke plass uten å kollidere med hverandre.
 */
const FADE_IN = ["interpolate", ["linear"], ["zoom"], 14, 0, 15.4, 1] as const;
const IS_SALE = ["==", ["get", "role"], "sale"] as const;
const IS_CONTEXT = ["==", ["get", "role"], "context"] as const;

export function ProjectMassingLayer({ massing }: ProjectMassingLayerProps) {
  const geojson = useMemo(
    () => projectMassingFeatureCollection(massing),
    [massing],
  );
  const { palette } = massing;

  return (
    <Source id="project-massing-source" type="geojson" data={geojson}>
      <Layer
        id="project-massing-context-fill"
        type="fill"
        filter={[...IS_CONTEXT]}
        paint={{
          "fill-color": palette.contextFill,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.4, 0.7],
        }}
      />
      <Layer
        id="project-massing-context-outline"
        type="line"
        filter={[...IS_CONTEXT]}
        // Stiplet = planlagt. Heltrukket ville lest som «står der allerede»,
        // som er nettopp det disse byggene ikke gjør.
        layout={{ "line-cap": "butt", "line-join": "round" }}
        paint={{
          "line-dasharray": [2.5, 1.5],
          "line-color": palette.contextLine,
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.4, 0.7],
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 17, 1.2],
        }}
      />
      <Layer
        id="project-massing-fill"
        type="fill"
        filter={[...IS_SALE]}
        paint={{
          "fill-color": palette.fill,
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.4, 0.6],
        }}
      />
      <Layer
        id="project-massing-outline"
        type="line"
        filter={[...IS_SALE]}
        layout={{ "line-cap": "round", "line-join": "round" }}
        paint={{
          "line-color": palette.line,
          "line-opacity": [...FADE_IN],
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.8, 17, 2.4],
        }}
      />
      <Layer
        id="project-massing-label"
        type="symbol"
        filter={[...IS_SALE]}
        minzoom={15.5}
        layout={{
          "text-field": ["get", "label"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 15.5, 11, 18, 15],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
        }}
        paint={{
          "text-color": palette.label,
          "text-halo-color": palette.labelHalo,
          "text-halo-width": 1.4,
          "text-opacity": ["interpolate", ["linear"], ["zoom"], 15.5, 0, 16, 1],
        }}
      />
    </Source>
  );
}
