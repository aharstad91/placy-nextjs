"use client";

import { useEffect, useMemo, useRef } from "react";
import { projectLatLngToScreen } from "@/components/map/project-latlng-to-screen";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import { contourLabels, contourRingsForMode } from "@/lib/board/contour-geometry";
import { useBoard } from "./board-state";

/**
 * «5 min» / «10 min» / «15 min» på Google-motoren.
 *
 * Google 3D har ingen linje-plasserte etiketter i det hele tatt, så etikettene
 * er HTML posisjonert per frame — samme mønster som reise-chipen i 3D, og av
 * samme grunn: `translate3d` skrevet rett til DOM går til compositoren, mens
 * `setState` per frame gir hopping under kamera-animasjon.
 *
 * Punktene kommer fra `contourLabels`, som Mapbox-laget også bruker. En etikett
 * som sto nord for konturen i «Kart» og øst for den i «Satelitt» ville lest som
 * to ulike kart.
 *
 * Ingen zoom-terskel her: 3D-motoren har ingen zoom-nivåer, den har `range`.
 * Projeksjonen skjuler etiketten selv når punktet faller utenfor
 * projeksjonsdomenet (bak kameraet), som er den tilstanden som faktisk oppstår.
 */

interface Props {
  map3d: Map3DInstance | null;
}

/** Litt over konturlinjas 3 m, så etiketten ikke skjæres av bakkemesh. */
const LABEL_ALTITUDE_M = 10;

export function BoardContourLabels3D({ map3d }: Props) {
  const { state, data } = useBoard();

  const rings = useMemo(
    () => contourRingsForMode(data.isochrones, state.travelMode),
    [data.isochrones, state.travelMode],
  );
  const labels = useMemo(() => contourLabels(rings), [rings]);

  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | undefined>(undefined);

  // Primitivene i dep-arrayet, ikke etikett-OBJEKTENE: et nytt array med samme
  // verdier ville restartet rAF-løkken hver render.
  const key = labels.map((l) => `${l.minutes}:${l.lng}:${l.lat}`).join("|");
  const active = state.showContours && labels.length > 0;

  useEffect(() => {
    if (!map3d || !active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
      return;
    }

    const points = key.split("|").map((part) => {
      const [, lng, lat] = part.split(":");
      return { lng: Number(lng), lat: Number(lat) };
    });

    const update = () => {
      for (let i = 0; i < points.length; i++) {
        const el = refs.current[i];
        if (!el) continue;
        const p = projectLatLngToScreen(
          map3d,
          points[i].lat,
          points[i].lng,
          LABEL_ALTITUDE_M,
        );
        if (p) {
          el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -100%)`;
          el.style.opacity = "1";
        } else {
          el.style.opacity = "0";
        }
      }
      rafRef.current = requestAnimationFrame(update);
    };
    update();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    };
  }, [map3d, active, key]);

  if (!active || !map3d) return null;

  return (
    <>
      {labels.map((label, i) => (
        <div
          key={label.minutes}
          ref={(el) => {
            refs.current[i] = el;
          }}
          data-testid="contour-label-3d"
          className="pointer-events-none fixed left-0 top-0 z-20 select-none rounded-full bg-white/85 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-stone-600 shadow-sm ring-1 ring-black/5 backdrop-blur-sm"
          style={{ willChange: "transform", opacity: 0 }}
        >
          {label.text}
        </div>
      ))}
    </>
  );
}
