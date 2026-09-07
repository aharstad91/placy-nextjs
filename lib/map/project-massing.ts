import {
  sitePlanCoordinate,
  WESSELSLOKKA_PLAN_BUILDINGS,
} from "@/lib/map/wesselslokka-site-plan";

export type LngLat = readonly [lng: number, lat: number];

export interface ProjectBuildingMassing {
  id: string;
  name: string;
  /** Byggets bokstav slik den står i salgsmaterialet («A1»). Tegnes i kartet. */
  label: string;
  footprint: readonly LngLat[];
  /** Sketch height; the supplied plan has no elevation information. */
  heightMeters: number;
}

/** Fargene volumene tegnes i. Hentet fra prosjektets eget salgsmateriale, så
 *  omrisset i kartet leses som «dette er byggene i planen du nettopp så». */
export interface ProjectMassingPalette {
  fill: string;
  line: string;
  label: string;
  labelHalo: string;
}

export interface ProjectMassing {
  projectSlug: string;
  sourceNote: string;
  palette: ProjectMassingPalette;
  buildings: readonly ProjectBuildingMassing[];
}

// Rosa som i situasjonsplanen (flatene), konturen i logoens mørkere rosa.
const WESSELSLOKKA_PALETTE: ProjectMassingPalette = {
  fill: "#e79bbc",
  line: "#a8386a",
  label: "#7d2a4f",
  labelHalo: "rgba(255, 255, 255, 0.92)",
};

const PROJECT_MASSING_BY_SLUG: Readonly<Record<string, ProjectMassing>> = {
  wesselslokka: {
    projectSlug: "wesselslokka",
    sourceNote: "Skjematisk volumstudie fra innpasset situasjonsplan; høyder anslått.",
    palette: WESSELSLOKKA_PALETTE,
    buildings: WESSELSLOKKA_PLAN_BUILDINGS.map(({ id, name, label, pixels }) => ({
      id,
      name,
      label,
      footprint: pixels.map(sitePlanCoordinate),
      heightMeters: 14,
    })),
  },
};

export function getProjectMassing(projectSlug?: string): ProjectMassing | undefined {
  return projectSlug ? PROJECT_MASSING_BY_SLUG[projectSlug] : undefined;
}

export function projectMassingFeatureCollection(
  massing: ProjectMassing,
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: massing.buildings.map(({ footprint, ...properties }) => ({
      type: "Feature",
      properties,
      geometry: {
        type: "Polygon",
        coordinates: [[...footprint, footprint[0]].map(([lng, lat]) => [lng, lat])],
      },
    })),
  };
}
