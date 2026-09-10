"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  APIProvider,
  GestureHandling,
  Map3D,
  MapMode,
  useMap3D,
} from "@vis.gl/react-google-maps";
import {
  HUS_B_GROUND_MASL,
  CAMERA_PRESETS,
  siteCameraPreset,
  siteExtent,
  type CameraPreset,
  renderRigCamera as rigCamera,
} from "@/lib/map/lillebytunet-render-rig";

/**
 * Isolert demo: én eller flere GLB-modeller plassert med Model3DElement i
 * Google Maps 3D, på tomten til Lillebytunet.
 *
 * Formålet var først å måle det Google ikke dokumenterer: hvilken vei modellens
 * akser peker i kartet. Målingen er gjort — se
 * docs/research/lillebytunet-3d/02-kartintegrasjon.md. Motoren leser GLB-en som
 * +X mot øst, +Y mot nord og +Z opp, altså ikke glTF-ens egen +Y-opp-konvensjon.
 * Modeller må eksporteres Z-opp med bunnen i z = 0.
 *
 * Siden tar nå en liste, ikke én modell, slik at de leverte byggene kan stå i
 * samme kart samtidig. Det er den eneste måten å se om to bygg forholder seg
 * riktig til hverandre — hvert bygg er kontrollert alene, men naboforholdet er
 * en egen påstand som ingen enkeltmodell-kontroll kan avvise.
 *
 * Siden er ikke en del av boardet og deler ingen tilstand med det.
 */

export interface PlacedModel {
  /** Stabil nøkkel; brukes også som synlig navn i infotabellen. */
  id: string;
  label: string;
  /** GLB-sti, relativ til domenet. */
  modelSrc: string;
  lat: number;
  lng: number;
  /** Modellens heading i grader. 0 = modellens +Y-akse peker rett nord. */
  heading: number;
  /** Meter, tolket etter `altitudeMode`. */
  altitude: number;
  altitudeMode: google.maps.maps3d.AltitudeModeString;
  scale: number;
  /** Fotavtrykk i meter. Brukes bare til å ramme inn flere bygg. */
  footprintMeters: readonly [number, number];
}

export interface LillebytunetModelDemoProps {
  /** Modellene som skal stå i kartet. Minst én. */
  models: PlacedModel[];
  /**
   * Hvilket bygg kameraet forholder seg til.
   *
   * Alle vinkler unntatt «Begge bygg» sikter på dette bygget; «Begge bygg»
   * sikter på midtpunktet. Render-riggen gjelder også bare det ene bygget,
   * siden nullpunktet er per bygningsserie.
   */
  focusIndex: number;
  /** Scene 0–95 når render-kameraet er valgt, ellers `null`. */
  renderDir: number | null;
  /** Navngitt fast kameravinkel for repeterbar før/etter-kontroll. */
  cameraPresetId: string | null;
  /** Overstyrer siktepunktets høyde i meter over havet. */
  aimAltitudeOverride: number | null;
  /** Kameraets bearing fra bygget ved scene 0. Per bygningsserie. */
  rigBearingAtDirZero: number;
}

function renderPreset(dir: number, bearingAtDirZero: number): CameraPreset {
  const rig = rigCamera(dir, bearingAtDirZero);
  return {
    id: `render-${dir}`,
    label: `Render dir ${dir}`,
    heading: rig.heading,
    tilt: rig.tilt,
    range: rig.range,
    aimHeightMeters: rig.aimHeightMeters,
  };
}

/**
 * Sett valgt kamera én gang, slik at kartets bevegelser kan fortsette fritt.
 * Kontrollerte kameraprops overstyrer ellers rotasjon ved nye kamerahendelser.
 */
function CameraLayer({
  camera,
  lat,
  lng,
  aimAltitude,
}: {
  camera: CameraPreset;
  lat: number;
  lng: number;
  aimAltitude: number;
}) {
  const map3d = useMap3D("lillebytunet-demo");
  useEffect(() => {
    if (!map3d) return;
    map3d.center = { lat, lng, altitude: aimAltitude };
    map3d.heading = camera.heading;
    map3d.tilt = camera.tilt;
    map3d.range = camera.range;
  }, [map3d, camera, lat, lng, aimAltitude]);
  return null;
}

/**
 * Legger én GLB inn i den persistente Map3DElement-instansen.
 *
 * Elementet gjenbrukes ved propendring og remountes ikke — samme
 * WebGL-forsiktige lifecycle som prosjektvolumene bruker i denne motoren. Én
 * instans av dette laget per modell: hvert `Model3DElement` eier sin egen kilde,
 * og et lag som byttet `src` på ett element ville vist ett bygg av gangen.
 */
function ModelLayer({
  id,
  modelSrc,
  lat,
  lng,
  heading,
  altitude,
  altitudeMode,
  scale,
  onStatus,
}: Pick<
  PlacedModel,
  | "id"
  | "modelSrc"
  | "lat"
  | "lng"
  | "heading"
  | "altitude"
  | "altitudeMode"
  | "scale"
> & { onStatus: (id: string, status: string) => void }) {
  const map3d = useMap3D("lillebytunet-demo");
  const modelRef = useRef<google.maps.maps3d.Model3DElement | null>(null);

  useEffect(() => {
    if (!map3d) return;
    let cancelled = false;

    (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          "maps3d",
        )) as google.maps.Maps3DLibrary;
        if (cancelled) return;

        if (!lib.Model3DElement) {
          onStatus(id, "Model3DElement finnes ikke i denne API-versjonen");
          return;
        }

        let model = modelRef.current;
        if (!model) {
          model = new lib.Model3DElement();
          modelRef.current = model;
        }

        model.src = modelSrc;
        model.position = { lat, lng, altitude };
        model.altitudeMode = altitudeMode;
        model.orientation = { heading, tilt: 0, roll: 0 };
        model.scale = scale;

        if (model.parentNode && model.parentNode !== map3d) model.remove();
        if (!model.parentNode) map3d.append(model);

        onStatus(id, "lagt til");
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          onStatus(id, `feil: ${message}`);
          console.warn(`[LillebytunetModelDemo] ${id} feilet:`, error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    map3d,
    id,
    modelSrc,
    lat,
    lng,
    heading,
    altitude,
    altitudeMode,
    scale,
    onStatus,
  ]);

  useEffect(() => {
    const holder = modelRef;
    return () => {
      if (holder.current?.parentNode) holder.current.remove();
      holder.current = null;
    };
  }, []);

  return null;
}

export function LillebytunetModelDemo({
  models,
  focusIndex,
  renderDir,
  cameraPresetId,
  aimAltitudeOverride,
  rigBearingAtDirZero,
}: LillebytunetModelDemoProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const focus = models[focusIndex] ?? models[0];
  const extent = useMemo(
    () => (models.length > 1 ? siteExtent(models) : null),
    [models],
  );
  const site = useMemo(
    () => (extent ? siteCameraPreset(extent) : null),
    [extent],
  );

  const renderCamera =
    renderDir === null ? null : renderPreset(renderDir, rigBearingAtDirZero);
  const presets = useMemo(
    () => [...(site ? [site] : []), ...CAMERA_PRESETS],
    [site],
  );
  const [camera, setCamera] = useState<CameraPreset>(
    renderCamera ??
      presets.find((preset) => preset.id === cameraPresetId) ??
      presets[0],
  );
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const onStatus = useCallback(
    (id: string, next: string) =>
      setStatuses((current) => ({ ...current, [id]: next })),
    [],
  );

  // «Begge bygg» sikter på midtpunktet; alle andre vinkler på det valgte bygget,
  // slik at før/etter-kontroller av ett bygg beholder samme ramme som før.
  const target = camera.id === "site" && extent ? extent : focus;
  const aimAltitude =
    aimAltitudeOverride ?? HUS_B_GROUND_MASL + camera.aimHeightMeters;

  const done = models.filter(
    (model) => statuses[model.id] === "lagt til",
  ).length;
  const failed = models.filter((model) =>
    statuses[model.id]?.startsWith("feil"),
  );
  const status = failed.length
    ? `${failed.map((model) => `${model.label}: ${statuses[model.id]}`).join("; ")}`
    : done === models.length
      ? `Model3DElement lagt til (${done} av ${models.length})`
      : `Laster … (${done} av ${models.length})`;

  if (!apiKey) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">
          Mangler NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        </p>
      </div>
    );
  }

  const chips = renderCamera ? [renderCamera, ...presets] : presets;

  return (
    <div className="relative h-dvh w-full">
      <APIProvider apiKey={apiKey} libraries={["maps3d"]}>
        <Map3D
          id="lillebytunet-demo"
          className="h-full w-full"
          mode={MapMode.SATELLITE}
          gestureHandling={GestureHandling.GREEDY}
          defaultCenter={{
            lat: target.lat,
            lng: target.lng,
            altitude: aimAltitude,
          }}
          defaultHeading={camera.heading}
          defaultTilt={camera.tilt}
          defaultRange={camera.range}
        >
          <CameraLayer
            camera={camera}
            lat={target.lat}
            lng={target.lng}
            aimAltitude={aimAltitude}
          />
          {models.map((model) => (
            <ModelLayer key={model.id} {...model} onStatus={onStatus} />
          ))}
        </Map3D>
      </APIProvider>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          {chips.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setCamera({ ...preset })}
              className={`rounded-full px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
                camera.id === preset.id
                  ? "bg-gray-900 text-white"
                  : "bg-white/90 text-gray-800 hover:bg-white"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <dl className="pointer-events-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg bg-white/90 p-3 font-mono text-[11px] leading-tight text-gray-800 shadow-sm">
          {models.map((model) => (
            <div key={model.id} className="col-span-2 grid grid-cols-subgrid">
              <dt className="text-gray-500">{model.label}</dt>
              <dd className="break-all">
                {model.modelSrc}
                <br />
                {model.lat.toFixed(6)}, {model.lng.toFixed(6)} / heading{" "}
                {model.heading}° / {model.altitude} m {model.altitudeMode} /
                scale {model.scale}
                {statuses[model.id] ? ` / ${statuses[model.id]}` : " / laster"}
              </dd>
            </div>
          ))}
          {extent ? (
            <>
              <dt className="text-gray-500">utstrekning</dt>
              <dd>{extent.spanMeters.toFixed(1)} m diagonal</dd>
            </>
          ) : null}
          <dt className="text-gray-500">kameravalg</dt>
          <dd>
            {camera.label} — {camera.heading.toFixed(1)}° / tilt{" "}
            {camera.tilt.toFixed(1)}° / {camera.range.toFixed(1)} m
          </dd>
          <dt className="text-gray-500">siktepunkt</dt>
          <dd>
            {target.lat.toFixed(6)}, {target.lng.toFixed(6)} /{" "}
            {aimAltitude.toFixed(1)} m o.h.
          </dd>
          <dt className="text-gray-500">status</dt>
          <dd data-testid="model-status">{status}</dd>
        </dl>
      </div>
    </div>
  );
}
