import type { Metadata } from "next";
import {
  LillebytunetModelDemo,
  type LillebytunetModelDemoProps,
} from "@/components/map/lillebytunet-model-demo";
import { parseRenderDir } from "@/lib/map/lillebytunet-render-rig";

export const metadata: Metadata = {
  title: "Lillebytunet 3D-modell — teknisk demo",
  description:
    "Isolert demo som plasserer en GLB-modell med Google Maps 3D på Lillebytunet-tomten.",
  robots: { index: false, follow: false },
};

/**
 * Hus B på Lillebytunet, stedfestet.
 *
 * Kilde: `~/klienter/placy/lillebytunet/colmap-ov/georef.json`. Kamerarigen
 * bak boligvelgerens 96 oversiktsbilder er rekonstruert med COLMAP, og
 * rekonstruksjonen er lagt over i kartkoordinater med en likhetstransform mot
 * OpenStreetMap-fotavtrykkene til Ståltaugen 1 og 2. Restfeilen på det andre
 * kvartalets senter er 1,0 m, og begge kvartalene måler 39 × 17 m i
 * rekonstruksjonen mot 39 × 17 m i OSM — altså stemmer skalaen uavhengig av
 * passpunktene.
 *
 * Bygget måler 27,7 × 16,3 m og er 19,5 m høyt. Modellens +Y-akse er byggets
 * langakse og skal peke mot 110°; da havner +X — balkongsiden — på 200°.
 * `orientation.heading` legger +Y på oppgitt bearing, så heading 110 er riktig
 * for `husB.glb`.
 */
const DEFAULTS = {
  modelSrc: "/models/lillebytunet/husB.glb",
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
  const altitudeMode = (
    ALTITUDE_MODES.find((mode) => mode === requestedMode) ??
    DEFAULTS.altitudeMode
  ) as LillebytunetModelDemoProps["altitudeMode"];

  const wantsRenderCamera = first(params.cam)?.toLowerCase() === "render";
  const dir = parseRenderDir(first(params.dir));

  return (
    <LillebytunetModelDemo
      modelSrc={modelPath(params.model)}
      lat={num(params.lat, DEFAULTS.lat)}
      lng={num(params.lng, DEFAULTS.lng)}
      heading={num(params.heading, DEFAULTS.heading)}
      altitude={num(params.alt, DEFAULTS.altitude)}
      altitudeMode={altitudeMode}
      scale={num(params.scale, DEFAULTS.scale)}
      renderDir={wantsRenderCamera ? (dir ?? 0) : null}
      aimAltitudeOverride={
        params.calt === undefined ? null : num(params.calt, 0)
      }
    />
  );
}
