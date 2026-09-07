import {
  BROSET_PLAN_BUILDINGS,
  BROSET_PLAN_SITE_OUTLINE,
} from "@/lib/map/broset-plan-buildings.generated";
import {
  sitePlanCoordinate,
  WESSELSLOKKA_PLAN_BUILDINGS,
  WESSELSLOKKA_STANDING_BUILDINGS,
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
  /** Volumenes materiale i 3D. Se shell-kommentaren under. */
  shellFill: string;
  shellEdge: string;
  /** Grunnflaten under volumene. Ikke en av planens farger, men jordets egen
   *  — se ground-kommentaren under. */
  ground: string;
}

/** Et bygg som allerede står på tomta, og som planen beholder. Det tegnes bare
 *  i 3D: der stikker det opp gjennom grunnflaten som ellers dekker det gamle,
 *  og et fotografert tak mellom rene volumer leser som rot. Mapbox trenger det
 *  ikke — der er bygget allerede med i kartet, og å legge det i `buildings`
 *  ville dessuten stemple et hus som står, som planlagt. */
export interface ProjectStandingBuilding {
  id: string;
  name: string;
  footprint: readonly LngLat[];
  heightMeters: number;
}

export interface ProjectMassing {
  projectSlug: string;
  sourceNote: string;
  palette: ProjectMassingPalette;
  buildings: readonly ProjectBuildingMassing[];
  /** Planområdets grunnflate, tegnet under volumene. Fotoflisene viser
   *  nabolaget slik det ser ut i dag — parkeringsplasser, innkjørsler og
   *  gammel asfalt akkurat der planen legger bygg og hage. Uten en grunnflate
   *  reiser volumene seg oppå det gamle, og bildet motsier seg selv.
   *
   *  Bare 3D bruker den. Mapbox tegner ikke det som skal bort. */
  siteGround?: readonly LngLat[];
  /** Se ProjectStandingBuilding. Tegnes over grunnflaten, under volumene. */
  standingBuildings?: readonly ProjectStandingBuilding[];
}

// Lyse volumer med farget kontur. Fyllet er så lyst at kartet under fortsatt
// leses, og høydeforskjellene får bære formen i stedet for fargen. Konturen
// holder igjen den varme tonen fra situasjonsplanen, og kontekstbyggene tegnes
// med stiplet linje — den kartografiske måten å si «planlagt, ikke bygd» på.
// En nøytral grå ble prøvd og var feil: da så de planlagte byggene ut som hus
// som allerede står der, siden Mapbox tegner eksisterende bygg i den grå tonen.
//
// `shellFill`/`shellEdge` gjelder bare 3D, og de er ikke planens farger heller.
// Der tegner vi ikke en karttegning, men en fysisk modell: bordmodellen på
// salgskontoret er hvit akryl på grønt underlag, og det er den lesningen
// volumene skal ha over fotoflisene.
//
// Rent hvitt, ikke nesten hvitt. Google skyggelegger flatene selv, etter hvilken
// vei de vender, og det lyset kan vi ikke sette. Målt på samme kamera tegner
// motoren én og samme helhvite flate fra 122 til 247 i luminans. Da er hver
// tilgjengelige verdi brukt opp av skyggen, og et fyll som starter under hvitt
// blir bare gråere. Dekkevnen hjelper heller ikke: veggene lå på 127 ved full
// dekning og 109 ved 0,55 — det er skyggen, ikke gjennomsiktigheten, som styrer.
// I 2D ville rent hvitt forsvinne i det lyse vektorkartet, så der blir den varme
// paletten stående.
//
// `ground` hører ikke til planen i det hele tatt. Den er avlest av Googles egne
// fotofliser over jordet rundt feltet (medianen av gresspikslene i utsnittet,
// #64815c, løftet et hakk fordi prøven lå delvis under volumene). Poenget er at
// kanten av grunnflaten ikke skal kunne ses.
const WESSELSLOKKA_PALETTE: ProjectMassingPalette = {
  fill: "#f6e7dc",
  line: "#c07f68",
  label: "#8d4f3c",
  labelHalo: "rgba(255, 255, 255, 0.92)",
  contextFill: "#fbf4ee",
  contextLine: "#cfa894",
  ground: "#6b8b5f",
  shellFill: "#ffffff",
  shellEdge: "#ffffff",
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
    siteGround: BROSET_PLAN_SITE_OUTLINE.map(sitePlanCoordinate),
    standingBuildings: WESSELSLOKKA_STANDING_BUILDINGS.map(
      ({ id, name, heightMeters, footprint }) => ({
        id,
        name,
        heightMeters,
        footprint: footprint.map(([lng, lat]) => [lng, lat] as LngLat),
      }),
    ),
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
