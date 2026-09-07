import { sitePlanCoordinate, WESSELSLOKKA_PLAN_BUILDINGS, WESSELSLOKKA_PLAN_STREET } from "@/lib/map/wesselslokka-site-plan";

export type LngLat = readonly [lng: number, lat: number];

export interface ProjectBuildingMassing {
  id: string;
  name: string;
  footprint: readonly LngLat[];
  /** Sketch height; the supplied plan has no elevation information. */
  heightMeters: number;
}

export interface ProjectMassing {
  projectSlug: string;
  sourceNote: string;
  buildings: readonly ProjectBuildingMassing[];
  streets?: readonly { id: string; footprint: readonly LngLat[] }[];
}

const PROJECT_MASSING_BY_SLUG: Readonly<Record<string, ProjectMassing>> = {
  wesselslokka: {
    projectSlug: "wesselslokka",
    sourceNote: "Skjematisk volumstudie fra innpasset situasjonsplan; høyder anslått.",
    buildings: WESSELSLOKKA_PLAN_BUILDINGS.map(({ id, name, pixels }) => ({
      id, name, footprint: pixels.map(sitePlanCoordinate), heightMeters: 14,
    })),
    streets: [{ id: "kollektivgata-wesselslokka", footprint: WESSELSLOKKA_PLAN_STREET.map(sitePlanCoordinate) }],
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
    features: [
      ...massing.buildings.map((building) => ({ ...building, kind: "building" })),
      ...(massing.streets ?? []).map((street) => ({ ...street, kind: "street" })),
    ].map(({ footprint, ...properties }) => ({
      type: "Feature", properties,
      geometry: {
        type: "Polygon",
        coordinates: [[...footprint, footprint[0]].map(([lng, lat]) => [lng, lat])],
      },
    })),
  };
}
