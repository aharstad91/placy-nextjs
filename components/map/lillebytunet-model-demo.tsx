"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  GestureHandling,
  Map3D,
  MapMode,
  useMap3D,
} from "@vis.gl/react-google-maps";
import {
  HUS_B_GROUND_MASL,
  renderRigCamera as rigCamera,
} from "@/lib/map/lillebytunet-render-rig";

/**
 * Isolert demo: én GLB-modell plassert med Model3DElement i Google Maps 3D,
 * på tomten til Lillebytunet.
 *
 * Formålet var å måle det Google ikke dokumenterer: hvilken vei modellens
 * akser peker i kartet. Målingen er gjort — se
 * docs/research/lillebytunet-3d/02-kartintegrasjon.md. Motoren leser GLB-en som
 * +X mot øst, +Y mot nord og +Z opp, altså ikke glTF-ens egen +Y-opp-konvensjon.
 * Modeller må eksporteres Z-opp med bunnen i z = 0.
 *
 * Siden er ikke en del av boardet og deler ingen tilstand med det.
 */

export interface LillebytunetModelDemoProps {
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
  /** Scene 0–95 når render-kameraet er valgt, ellers `null`. */
  renderDir: number | null;
  /** Overstyrer siktepunktets høyde i meter over havet. */
  aimAltitudeOverride: number | null;
}

function renderPreset(dir: number): CameraPreset {
  const rig = rigCamera(dir);
  return {
    id: `render-${dir}`,
    label: `Render dir ${dir}`,
    heading: rig.heading,
    tilt: rig.tilt,
    range: rig.range,
    aimHeightMeters: rig.aimHeightMeters,
  };
}

interface CameraPreset {
  id: string;
  label: string;
  /** Kameraets siktretning i grader. Kameraet står på motsatt side. */
  heading: number;
  tilt: number;
  range: number;
  /**
   * Siktepunktets høyde over bakken i meter.
   *
   * `range` er avstanden til siktepunktet, ikke til modellen. Ligger punktet på
   * bakken samtidig som tilt er høy og range kort, havner kameraet under
   * fotoflisene og modellen forsvinner. Nærvisningen og render-riggen løfter
   * derfor punktet opp på fasaden.
   */
  aimHeightMeters: number;
}

/**
 * Fire skrå luftvinkler, én mellomvinkel og én nærvisning.
 *
 * Google-kameraets `heading` er siktretningen, ikke der kameraet står. Skal
 * modellen ses fra nord, må kameraet se mot sør — derfor 180 på «fra nord».
 */
const CAMERA_PRESETS: CameraPreset[] = [
  { id: "n", label: "Fra nord", heading: 180, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "e", label: "Fra øst", heading: 270, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "s", label: "Fra sør", heading: 0, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "w", label: "Fra vest", heading: 90, tilt: 45, range: 150, aimHeightMeters: 8 },
  { id: "mid", label: "Mellomvinkel", heading: 215, tilt: 62, range: 320, aimHeightMeters: 8 },
  { id: "near", label: "Nærvisning", heading: 200, tilt: 66, range: 70, aimHeightMeters: 9 },
];

/**
 * Legger GLB-en inn i den persistente Map3DElement-instansen.
 *
 * Elementet gjenbrukes ved propendring og remountes ikke — samme
 * WebGL-forsiktige lifecycle som prosjektvolumene bruker i denne motoren.
 */
function ModelLayer({
  modelSrc,
  lat,
  lng,
  heading,
  altitude,
  altitudeMode,
  scale,
  onStatus,
}: Pick<
  LillebytunetModelDemoProps,
  "modelSrc" | "lat" | "lng" | "heading" | "altitude" | "altitudeMode" | "scale"
> & { onStatus: (status: string) => void }) {
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
          onStatus("Model3DElement finnes ikke i denne API-versjonen");
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

        onStatus("Model3DElement lagt til");
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          onStatus(`Feil: ${message}`);
          console.warn("[LillebytunetModelDemo] modell feilet:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    map3d,
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
  renderDir,
  aimAltitudeOverride,
  ...model
}: LillebytunetModelDemoProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const renderCamera = renderDir === null ? null : renderPreset(renderDir);
  const [camera, setCamera] = useState<CameraPreset>(
    renderCamera ?? CAMERA_PRESETS[0],
  );
  const [status, setStatus] = useState("Laster …");
  const onStatus = useCallback((next: string) => setStatus(next), []);

  const aimAltitude =
    aimAltitudeOverride ?? HUS_B_GROUND_MASL + camera.aimHeightMeters;

  if (!apiKey) {
    return (
      <div className="flex h-dvh items-center justify-center bg-gray-100 p-8 text-center">
        <p className="text-sm text-gray-500">
          Mangler NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
        </p>
      </div>
    );
  }

  const chips = renderCamera
    ? [renderCamera, ...CAMERA_PRESETS]
    : CAMERA_PRESETS;

  return (
    <div className="relative h-dvh w-full">
      <APIProvider apiKey={apiKey} libraries={["maps3d"]}>
        <Map3D
          id="lillebytunet-demo"
          className="h-full w-full"
          mode={MapMode.SATELLITE}
          gestureHandling={GestureHandling.GREEDY}
          center={{ lat: model.lat, lng: model.lng, altitude: aimAltitude }}
          heading={camera.heading}
          tilt={camera.tilt}
          range={camera.range}
        >
          <ModelLayer {...model} onStatus={onStatus} />
        </Map3D>
      </APIProvider>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          {chips.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => setCamera(preset)}
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
          <dt className="text-gray-500">modell</dt>
          <dd className="break-all">{model.modelSrc}</dd>
          <dt className="text-gray-500">posisjon</dt>
          <dd>
            {model.lat.toFixed(6)}, {model.lng.toFixed(6)}
          </dd>
          <dt className="text-gray-500">heading</dt>
          <dd>{model.heading}°</dd>
          <dt className="text-gray-500">altitude</dt>
          <dd>
            {model.altitude} m / {model.altitudeMode}
          </dd>
          <dt className="text-gray-500">scale</dt>
          <dd>{model.scale}</dd>
          <dt className="text-gray-500">kamera</dt>
          <dd>
            {camera.heading.toFixed(1)}° / tilt {camera.tilt.toFixed(1)}° /{" "}
            {camera.range.toFixed(1)} m
          </dd>
          <dt className="text-gray-500">siktepunkt</dt>
          <dd>{aimAltitude.toFixed(1)} m o.h.</dd>
          <dt className="text-gray-500">status</dt>
          <dd data-testid="model-status">{status}</dd>
        </dl>
      </div>
    </div>
  );
}
