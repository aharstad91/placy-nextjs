"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { CameraPose } from "@/lib/types";

interface Props {
  /** Map3DElement-instansen vi leser live-kamera fra. */
  map3dInstance: unknown | null;
  /** Aktiv kategori — brukes som nøkkel i den genererte JSON-en. */
  activeCategoryId: string | null;
  className?: string;
}

/** Lesbar delmengde av Map3DElement (center kan eksponere lat/lng som getter
 *  ELLER metode avhengig av Google-versjon — vi håndterer begge). */
type CameraReadable = {
  center?: {
    lat: number | (() => number);
    lng: number | (() => number);
  } | null;
  range?: number;
  tilt?: number;
  heading?: number;
};

function num(v: number | (() => number) | undefined): number | undefined {
  if (typeof v === "function") return v();
  return v;
}

/** Leser nåværende kamera som CameraPose. Kopierer lat/lng EKSPLISITT (aldri
 *  spread — LatLngAltitude har dem som prototype-gettere). Returnerer null hvis
 *  kameraet ikke er lesbart ennå. */
function readPose(map: unknown | null): CameraPose | null {
  const m = map as CameraReadable | null;
  const c = m?.center;
  if (!c) return null;
  const lat = num(c.lat);
  const lng = num(c.lng);
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    range: Math.round(m?.range ?? 0),
    tilt: Math.round(m?.tilt ?? 0),
    heading: Math.round(m?.heading ?? 0),
  };
}

const BTN =
  "rounded-lg bg-white/10 px-2.5 py-1.5 font-medium transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Dev-only authoring-affordance for å fange kamera-waypoints. Fly kameraet
 * manuelt i 3D-visningen, trykk «Lagre A» / «Lagre B», og «Kopier» legger en
 * ferdig `"kategori": { a, b }`-snutt på clipboard som limes rett inn i
 * components/variants/report/board/camera-tours.ts. Renderes kun bak `?author=1`
 * (se BoardMap3D) — aldri eksponert i produksjon.
 */
export function CameraWaypointAuthor({
  map3dInstance,
  activeCategoryId,
  className,
}: Props) {
  const [a, setA] = useState<CameraPose | null>(null);
  const [b, setB] = useState<CameraPose | null>(null);
  const [copied, setCopied] = useState(false);

  const disabled = !map3dInstance;

  const capture = (which: "a" | "b") => {
    const pose = readPose(map3dInstance);
    if (!pose) return;
    if (which === "a") setA(pose);
    else setB(pose);
    setCopied(false);
  };

  const copyJson = async () => {
    if (!a) return;
    const cfg: { a: CameraPose; b?: CameraPose } = b ? { a, b } : { a };
    const key = activeCategoryId ?? "KATEGORI";
    const json = `"${key}": ${JSON.stringify(cfg, null, 2)},`;
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      // Clipboard kan feile i usikker kontekst — fall tilbake til konsoll.
      // eslint-disable-next-line no-console
      console.log("[camera-author] kopier manuelt:\n" + json);
    }
    setCopied(true);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-44 flex-col gap-1.5 rounded-xl bg-stone-900/85 p-2 text-xs text-white shadow-lg ring-1 ring-black/10 backdrop-blur-md",
        className,
      )}
    >
      <div className="px-1 font-semibold tracking-wide text-amber-300">
        Author · {activeCategoryId ?? "ingen kategori"}
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => capture("a")}
          className={cn(BTN, "flex-1")}
        >
          Lagre A{a ? " ✓" : ""}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => capture("b")}
          className={cn(BTN, "flex-1")}
        >
          Lagre B{b ? " ✓" : ""}
        </button>
      </div>
      <button
        type="button"
        disabled={!a}
        onClick={copyJson}
        className={cn(BTN, "bg-amber-500/90 text-stone-900 hover:bg-amber-400")}
      >
        {copied ? "Kopiert ✓" : "Kopier kategori-JSON"}
      </button>
    </div>
  );
}
