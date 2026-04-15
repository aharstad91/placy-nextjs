"use client";

import { useEffect, useState } from "react";
import { useMap3D } from "@vis.gl/react-google-maps";
import { Navigation, RotateCw, RotateCcw, ChevronUp, ChevronDown, Plus, Minus } from "lucide-react";

/**
 * Flytende UI-kontroller i kanten av 3D-kartet.
 *
 * Alle knapper bruker Googles native `flyCameraTo` for smooth animasjon —
 * samme motor som drag-gestures, ingen JS-kamp.
 *
 * Plasseres som children til <Map3D> slik at `useMap3D()` returnerer instansen.
 */
interface Map3DControlsProps {
  minTilt: number;
  maxTilt: number;
  minAltitude: number;
  maxAltitude: number;
  /** Grader per klikk for rotér-knappene */
  headingStep?: number;
  /** Grader per klikk for tilt-knappene */
  tiltStep?: number;
  /** Faktor per klikk for zoom (range × faktor for zoom-inn, / for zoom-ut) */
  zoomFactor?: number;
}

type Map3DAny = {
  heading: number;
  tilt: number;
  range: number;
  center: { lat: number; lng: number; altitude: number };
  flyCameraTo: (opts: {
    endCamera: {
      center: { lat: number; lng: number; altitude: number };
      range: number;
      tilt: number;
      heading: number;
    };
    durationMillis: number;
  }) => void;
  addEventListener: (type: string, listener: EventListener) => void;
  removeEventListener: (type: string, listener: EventListener) => void;
};

export function Map3DControls({
  minTilt,
  maxTilt,
  minAltitude,
  maxAltitude,
  headingStep = 45,
  tiltStep = 15,
  zoomFactor = 1.5,
}: Map3DControlsProps) {
  const map3d = useMap3D() as unknown as Map3DAny | null;
  const [heading, setHeading] = useState(0);

  // Lytt til heading-endringer for å rotere kompasset live
  useEffect(() => {
    if (!map3d) return;
    const update = () => setHeading(map3d.heading ?? 0);
    update();
    map3d.addEventListener("gmp-headingchange", update);
    return () => map3d.removeEventListener("gmp-headingchange", update);
  }, [map3d]);

  if (!map3d) return null;

  const flyBy = (delta: Partial<{ heading: number; tilt: number; range: number }>) => {
    map3d.flyCameraTo({
      endCamera: {
        center: { ...map3d.center },
        range: delta.range ?? map3d.range,
        tilt: delta.tilt ?? map3d.tilt,
        heading: delta.heading ?? map3d.heading,
      },
      durationMillis: 400,
    });
  };

  const rotateBy = (deg: number) => {
    let next = (map3d.heading ?? 0) + deg;
    next = ((next % 360) + 360) % 360;
    flyBy({ heading: next });
  };

  const tiltBy = (deg: number) => {
    const next = (map3d.tilt ?? 45) + deg;
    flyBy({ tilt: Math.max(minTilt, Math.min(maxTilt, next)) });
  };

  const zoomBy = (factor: number) => {
    // Mindre range = nærmere. Zoom inn = del på faktor, zoom ut = gang med faktor.
    const next = (map3d.range ?? 900) * factor;
    // Avgrens til altitude-range sånn omtrentlig (range ~ kamera-høyde i vår tilt-setting)
    const clamped = Math.max(minAltitude, Math.min(maxAltitude, next));
    flyBy({ range: clamped });
  };

  const resetHeading = () => flyBy({ heading: 0 });

  const btn =
    "w-10 h-10 flex items-center justify-center bg-white/95 backdrop-blur-sm border border-[#eae6e1] text-[#5d5348] hover:text-[#1a1a1a] hover:border-[#d4cfc8] hover:bg-white transition-colors shadow-sm";

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-2 select-none">
      {/* Kompass — klikk for å resette heading til nord */}
      <button
        onClick={resetHeading}
        className={`${btn} rounded-full`}
        aria-label="Pek mot nord"
        title="Pek mot nord"
      >
        <Navigation
          className="w-4 h-4 transition-transform"
          style={{ transform: `rotate(${-heading}deg)` }}
          strokeWidth={2.5}
        />
      </button>

      {/* Rotér CCW / CW */}
      <div className="flex flex-col rounded-full overflow-hidden border border-[#eae6e1]">
        <button
          onClick={() => rotateBy(-headingStep)}
          className={`${btn} rounded-none border-0 border-b border-[#eae6e1]`}
          aria-label="Rotér mot venstre"
          title="Rotér venstre"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={() => rotateBy(headingStep)}
          className={`${btn} rounded-none border-0`}
          aria-label="Rotér mot høyre"
          title="Rotér høyre"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tilt opp / ned */}
      <div className="flex flex-col rounded-full overflow-hidden border border-[#eae6e1]">
        <button
          onClick={() => tiltBy(-tiltStep)}
          className={`${btn} rounded-none border-0 border-b border-[#eae6e1]`}
          aria-label="Tilt opp (mer ovenfra)"
          title="Tilt opp"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => tiltBy(tiltStep)}
          className={`${btn} rounded-none border-0`}
          aria-label="Tilt ned (mer skrått)"
          title="Tilt ned"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom inn / ut */}
      <div className="flex flex-col rounded-full overflow-hidden border border-[#eae6e1]">
        <button
          onClick={() => zoomBy(1 / zoomFactor)}
          className={`${btn} rounded-none border-0 border-b border-[#eae6e1]`}
          aria-label="Zoom inn"
          title="Zoom inn"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => zoomBy(zoomFactor)}
          className={`${btn} rounded-none border-0`}
          aria-label="Zoom ut"
          title="Zoom ut"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
