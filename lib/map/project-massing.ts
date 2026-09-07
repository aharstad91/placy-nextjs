import { BROSET_PLAN_BUILDING_PIXELS } from "@/lib/map/broset-plan-buildings.generated";
import {
  sitePlanCoordinate,
  WESSELSLOKKA_PLAN_BUILDINGS,
} from "@/lib/map/wesselslokka-site-plan";

export type LngLat = readonly [lng: number, lat: number];

/** «sale» er byggene prosjektet selger, «context» er resten av områdeplanen
 *  som reises rundt dem. De tegnes ulikt: leseren skal se hvilke tre bygg
 *  boligen ligger i, og samtidig at nabolaget ikke er ferdig. */
export type MassingRole = "sale" | "context";

export interface ProjectBuildingMassing {
  id: string;
  name: string;
  role: MassingRole;
  /** Byggets bokstav slik den står i salgsmaterialet («A1»). Tegnes i kartet.
   *  Kontekstvolumene har ingen — planen navngir dem ikke. */
  label?: string;
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
  contextFill: string;
  contextLine: string;
}

export interface ProjectMassing {
  projectSlug: string;
  sourceNote: string;
  palette: ProjectMassingPalette;
  buildings: readonly ProjectBuildingMassing[];
}

// Rosa som i situasjonsplanen (flatene), konturen i logoens mørkere rosa.
// Kontekstvolumene tar en uttynnet variant av samme rosa. En nøytral grå ble
// prøvd først og var feil: da så de planlagte byggene ut som hus som allerede
// står der, siden Mapbox tegner eksisterende bygg i nettopp den grå tonen.
const WESSELSLOKKA_PALETTE: ProjectMassingPalette = {
  fill: "#e79bbc",
  line: "#a8386a",
  label: "#7d2a4f",
  labelHalo: "rgba(255, 255, 255, 0.92)",
  contextFill: "#f7ecf1",
  contextLine: "#bb8ba3",
};

/** Planen bærer ingen etasjetall. 14 m ≈ fire etasjer for salgsbyggene, 12 m
 *  for resten — nok til at 3D-motoren får et volum, og eksplisitt et anslag. */
const SALE_HEIGHT_METERS = 14;
const CONTEXT_HEIGHT_METERS = 12;

const WESSELSLOKKA_BUILDINGS: readonly ProjectBuildingMassing[] = [
  ...WESSELSLOKKA_PLAN_BUILDINGS.map(({ id, name, label, pixels }) => ({
    id,
    name,
    label,
    role: "sale" as const,
    footprint: pixels.map(sitePlanCoordinate),
    heightMeters: SALE_HEIGHT_METERS,
  })),
  ...BROSET_PLAN_BUILDING_PIXELS.map((pixels, index) => ({
    id: `broset-${String(index + 1).padStart(2, "0")}`,
    name: `Brøset, planlagt bygg ${index + 1}`,
    role: "context" as const,
    footprint: pixels.map(sitePlanCoordinate),
    heightMeters: CONTEXT_HEIGHT_METERS,
  })),
];

const PROJECT_MASSING_BY_SLUG: Readonly<Record<string, ProjectMassing>> = {
  wesselslokka: {
    projectSlug: "wesselslokka",
    sourceNote:
      "Skjematisk volumstudie fra innpasset situasjonsplan; høyder anslått.",
    palette: WESSELSLOKKA_PALETTE,
    buildings: WESSELSLOKKA_BUILDINGS,
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
