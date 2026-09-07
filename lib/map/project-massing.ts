/**
 * Skjematiske bygningsvolumer for prosjekter som ennå ikke finnes i kartflisene.
 *
 * Dette er design-intent, ikke BIM-/byggesaksdata. Wesselsløkka-volumene er
 * tolket fra utbyggers situasjonsplan (A1, A2 og B) og lagt relativt til
 * prosjektets lagrede adressepunkt. Relative meter gjør prototypen enkel å
 * finjustere uten å håndredigere fire lat/lng-hjørner per bygg.
 */

export type LngLat = readonly [lng: number, lat: number];

export interface ProjectBuildingMassing {
  id: string;
  name: string;
  /** Fire hjørner. Kartlagene lukker ringen ved behov. */
  footprint: readonly LngLat[];
  /** Skjematisk gesimshøyde i meter over terreng. */
  heightMeters: number;
}

export interface ProjectMassing {
  projectSlug: string;
  sourceNote: string;
  buildings: readonly ProjectBuildingMassing[];
}

interface RectangleSpec {
  id: string;
  name: string;
  /** Senterforskyvning fra prosjektets adressepunkt. */
  eastMeters: number;
  northMeters: number;
  /** Lengderetning og bredde i meter. */
  lengthMeters: number;
  widthMeters: number;
  /** Lengderetning som kompasskurs: 0 = nord, 90 = øst. */
  headingDegrees: number;
  heightMeters: number;
}

const METERS_PER_LATITUDE_DEGREE = 111_320;

function offsetCoordinate(
  origin: { lat: number; lng: number },
  eastMeters: number,
  northMeters: number,
): LngLat {
  const latitudeRadians = (origin.lat * Math.PI) / 180;
  return [
    origin.lng +
      eastMeters / (METERS_PER_LATITUDE_DEGREE * Math.cos(latitudeRadians)),
    origin.lat + northMeters / METERS_PER_LATITUDE_DEGREE,
  ];
}

/** Bygger et rotert rektangel i et lokalt øst/nord-koordinatsystem. */
export function rectangleFootprint(
  origin: { lat: number; lng: number },
  spec: RectangleSpec,
): ProjectBuildingMassing {
  const headingRadians = (spec.headingDegrees * Math.PI) / 180;
  const halfLength = spec.lengthMeters / 2;
  const halfWidth = spec.widthMeters / 2;

  // Enhetsvektor langs bygget og 90° mot høyre, uttrykt som [øst, nord].
  const along = {
    east: Math.sin(headingRadians),
    north: Math.cos(headingRadians),
  };
  const across = {
    east: Math.cos(headingRadians),
    north: -Math.sin(headingRadians),
  };

  const localCorners = [
    [-halfLength, -halfWidth],
    [halfLength, -halfWidth],
    [halfLength, halfWidth],
    [-halfLength, halfWidth],
  ] as const;

  return {
    id: spec.id,
    name: spec.name,
    heightMeters: spec.heightMeters,
    footprint: localCorners.map(([alongMeters, acrossMeters]) =>
      offsetCoordinate(
        origin,
        spec.eastMeters + along.east * alongMeters + across.east * acrossMeters,
        spec.northMeters + along.north * alongMeters + across.north * acrossMeters,
      ),
    ),
  };
}

/**
 * Produksjonsdataenes adressepunkt ligger i Brøsetvegen ved holdeplassen.
 * Situasjonsplanen plasserer de tre volumene som en L sørøst for dette punktet:
 * A1/A2 langs den framtidige kollektivgata og B på tvers mot nord.
 *
 * Målene er bevisst avrundede. Hensikten er å synliggjøre planlagt bebyggelse,
 * ikke å representere prosjekteringsgrunnlaget med falsk presisjon.
 */
const WESSELSLOKKA_ORIGIN = { lat: 63.422074, lng: 10.450617 } as const;
const WESSELSLOKKA_BUILDINGS: readonly ProjectBuildingMassing[] = [
  rectangleFootprint(WESSELSLOKKA_ORIGIN, {
    id: "a1",
    name: "Bygg A1",
    eastMeters: 0,
    northMeters: -46,
    lengthMeters: 34,
    widthMeters: 16,
    headingDegrees: 78,
    heightMeters: 14,
  }),
  rectangleFootprint(WESSELSLOKKA_ORIGIN, {
    id: "a2",
    name: "Bygg A2",
    eastMeters: 34,
    northMeters: -39,
    lengthMeters: 34,
    widthMeters: 16,
    headingDegrees: 78,
    heightMeters: 14,
  }),
  rectangleFootprint(WESSELSLOKKA_ORIGIN, {
    id: "b",
    name: "Bygg B",
    eastMeters: 36,
    northMeters: -12,
    lengthMeters: 38,
    widthMeters: 18,
    headingDegrees: -8,
    heightMeters: 14,
  }),
] as const;

const PROJECT_MASSING_BY_SLUG: Readonly<Record<string, ProjectMassing>> = {
  wesselslokka: {
    projectSlug: "wesselslokka",
    sourceNote:
      "Skjematisk volumstudie tolket fra utbyggers situasjonsplan; ikke prosjekteringsgrunnlag.",
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
    features: massing.buildings.map((building) => ({
      type: "Feature",
      properties: {
        id: building.id,
        name: building.name,
        heightMeters: building.heightMeters,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [...building.footprint, building.footprint[0]].map(
            ([lng, lat]) => [lng, lat],
          ),
        ],
      },
    })),
  };
}
