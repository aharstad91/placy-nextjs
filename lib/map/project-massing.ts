import { BROSET_PLAN_BUILDINGS } from "@/lib/map/broset-plan-buildings.generated";
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
  /** Maks etasjetall fra reguleringens takplan. Bærer silhuetten i 3D. */
  storeys: number;
  /** `storeys` ganget opp; se STOREY_HEIGHT_METERS for hvorfor faktoren er 3,5. */
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

// Lyse volumer med farget kontur. Fyllet er så lyst at kartet under fortsatt
// leses, og høydeforskjellene får bære formen i stedet for fargen. Konturen
// holder igjen den varme tonen fra situasjonsplanen, og kontekstbyggene tegnes
// med stiplet linje — den kartografiske måten å si «planlagt, ikke bygd» på.
// En nøytral grå ble prøvd og var feil: da så de planlagte byggene ut som hus
// som allerede står der, siden Mapbox tegner eksisterende bygg i den grå tonen.
const WESSELSLOKKA_PALETTE: ProjectMassingPalette = {
  fill: "#f6e7dc",
  line: "#c07f68",
  label: "#8d4f3c",
  labelHalo: "rgba(255, 255, 255, 0.92)",
  contextFill: "#fbf4ee",
  contextLine: "#cfa894",
};

/** Etasje til meter. Takplanens maks kotehøyder minus dagens terreng (Kartverket
 *  DTM1) gir omtrent 3,5 m per etasje på blokkene den er mest til å stole på —
 *  de på seks til åtte etasjer, der en meters slingring betyr minst. Volumene
 *  settes på dagens terreng i 3D, så det er nettopp det tallet som passer. */
const STOREY_HEIGHT_METERS = 3.5;

const WESSELSLOKKA_BUILDINGS: readonly ProjectBuildingMassing[] = [
  ...WESSELSLOKKA_PLAN_BUILDINGS.map(({ id, name, label, storeys, pixels }) => ({
    id,
    name,
    label,
    role: "sale" as const,
    footprint: pixels.map(sitePlanCoordinate),
    storeys,
    heightMeters: storeys * STOREY_HEIGHT_METERS,
  })),
  ...BROSET_PLAN_BUILDINGS.map(({ storeys, pixels }, index) => ({
    id: `broset-${String(index + 1).padStart(2, "0")}`,
    name: `Brøset, planlagt bygg ${index + 1}`,
    role: "context" as const,
    footprint: pixels.map(sitePlanCoordinate),
    storeys,
    heightMeters: storeys * STOREY_HEIGHT_METERS,
  })),
];

const PROJECT_MASSING_BY_SLUG: Readonly<Record<string, ProjectMassing>> = {
  wesselslokka: {
    projectSlug: "wesselslokka",
    sourceNote:
      "Volumer fra innpasset situasjonsplan; etasjetall fra reguleringens takplan.",
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
