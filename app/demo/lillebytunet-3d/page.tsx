import type { Metadata } from "next";
import {
  LillebytunetModelDemo,
  type LillebytunetModelDemoProps,
  type PlacedModel,
} from "@/components/map/lillebytunet-model-demo";
import {
  parseRenderDir,
  RENDER_BEARING_AT_DIR_ZERO,
} from "@/lib/map/lillebytunet-render-rig";
import {
  LILLEBYTUNET_BUILDINGS,
  parseBuildingIds,
} from "@/lib/map/lillebytunet-buildings";

export const metadata: Metadata = {
  title: "Lillebytunet 3D-modell — teknisk demo",
  description:
    "Isolert demo som plasserer GLB-modeller med Google Maps 3D på Lillebytunet-tomten.",
  robots: { index: false, follow: false },
};

/**
 * To måter å velge modeller på, med vilje.
 *
 * `?buildings=husB,husC` leser de leverte byggene ut av registeret i
 * `lib/map/lillebytunet-buildings.ts` og setter dem i kartet samtidig, hvert med
 * sin egen målte plassering. `?focus=husC` sier hvilket bygg kameraet forholder
 * seg til. Det er visningen som svarer på om to bygg står riktig i forhold til
 * hverandre.
 *
 * Uten `buildings` gjelder de gamle enkeltmodell-parameterne uendret
 * (`model`, `lat`, `lng`, `heading`, `alt`, `altmode`, `scale`). Det er den veien
 * `capture-quality.mjs` og kjøreoppskriftene i docs bruker, og en ny modell som
 * ikke er levert ennå har ingen plass i registeret.
 *
 * Standardplasseringen er Hus B. Kilde:
 * `~/klienter/placy/lillebytunet/colmap-ov/georef.json`. Kamerarigen bak
 * boligvelgerens 96 oversiktsbilder er rekonstruert med COLMAP, og
 * rekonstruksjonen er lagt over i kartkoordinater med en likhetstransform mot
 * OpenStreetMap-fotavtrykkene til Ståltaugen 1 og 2. Restfeilen på det andre
 * kvartalets senter er 1,0 m, og begge kvartalene måler 39 × 17 m i
 * rekonstruksjonen mot 39 × 17 m i OSM — altså stemmer skalaen uavhengig av
 * passpunktene.
 *
 * Hus B måler 27,7 × 16,3 m og er 19,5 m høyt. Modellens +Y-akse er byggets
 * langakse og skal peke mot 110°; da havner +X — balkongsiden — på 200°.
 * `orientation.heading` legger +Y på oppgitt bearing, så heading 110 er riktig
 * for `husB-v2.glb` (og den bevarte prototypen `husB.glb`).
 */
const DEFAULTS = {
  modelSrc: "/models/lillebytunet/husB-v2.glb",
  lat: 63.441359,
  lng: 10.440215,
  heading: 110,
  altitude: 0,
  altitudeMode: "CLAMP_TO_GROUND",
  scale: 1,
} as const;

const ALTITUDE_MODES = [
  "ABSOLUTE",
  "CLAMP_TO_GROUND",
  "RELATIVE_TO_GROUND",
  "RELATIVE_TO_MESH",
] as const;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function num(value: string | string[] | undefined, fallback: number): number {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Bare lokale .glb-stier godtas. Uten den sjekken kunne en URL-parameter
 * pekt Model3DElement mot en vilkårlig ekstern vert.
 */
function modelPath(value: string | string[] | undefined): string {
  const candidate = first(value);
  if (!candidate) return DEFAULTS.modelSrc;
  const isLocalGlb =
    candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    candidate.toLowerCase().endsWith(".glb");
  return isLocalGlb ? candidate : DEFAULTS.modelSrc;
}

export default async function LillebytunetDemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requestedMode = first(params.altmode)?.toUpperCase();
  const altitudeMode = (ALTITUDE_MODES.find((mode) => mode === requestedMode) ??
    DEFAULTS.altitudeMode) as LillebytunetModelDemoProps["models"][number]["altitudeMode"];

  const wantsRenderCamera = first(params.cam)?.toLowerCase() === "render";
  const dir = parseRenderDir(first(params.dir));

  const selected = parseBuildingIds(first(params.buildings));
  const models: PlacedModel[] = selected.length
    ? selected.map((building) => ({
        id: building.id,
        label: building.label,
        modelSrc: building.modelSrc,
        lat: building.lat,
        lng: building.lng,
        heading: building.heading,
        // Registeret bærer plasseringen; høyde og skala er ikke en egenskap ved
        // bygget, så de kommer fortsatt fra URL-en og gjelder alle valgte bygg.
        altitude: num(params.alt, DEFAULTS.altitude),
        altitudeMode,
        scale: num(params.scale, DEFAULTS.scale),
        footprintMeters: building.footprintMeters,
      }))
    : [
        {
          id: "model",
          label: "Modell",
          modelSrc: modelPath(params.model),
          lat: num(params.lat, DEFAULTS.lat),
          lng: num(params.lng, DEFAULTS.lng),
          heading: num(params.heading, DEFAULTS.heading),
          altitude: num(params.alt, DEFAULTS.altitude),
          altitudeMode,
          scale: num(params.scale, DEFAULTS.scale),
          // Bare i bruk når flere bygg skal rammes inn, og denne veien har ett.
          footprintMeters: LILLEBYTUNET_BUILDINGS[0].footprintMeters,
        },
      ];

  const requestedFocus = first(params.focus);
  const focusIndex = Math.max(
    0,
    models.findIndex((model) => model.id === requestedFocus),
  );

  return (
    <LillebytunetModelDemo
      models={models}
      focusIndex={focusIndex}
      renderDir={wantsRenderCamera ? (dir ?? 0) : null}
      cameraPresetId={wantsRenderCamera ? null : (first(params.cam) ?? null)}
      aimAltitudeOverride={
        params.calt === undefined ? null : num(params.calt, 0)
      }
      rigBearingAtDirZero={num(
        params.dir0bearing,
        selected[focusIndex]?.rigBearingAtDirZero ??
          RENDER_BEARING_AT_DIR_ZERO.husB,
      )}
    />
  );
}
