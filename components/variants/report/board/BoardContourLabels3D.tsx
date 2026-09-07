"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { projectLatLngToScreen } from "@/components/map/project-latlng-to-screen";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import { contourLabelCandidates, contourRingsForMode } from "@/lib/board/contour-geometry";
import {
  chooseContourLabels,
  type ContourLabelSlot,
} from "@/lib/board/contour-label-placement";
import { useBoard } from "./board-state";
import { ContourLabelChip } from "./ContourLabelChip";

/**
 * «5 min til fots» / «10 min til fots» / «15 min til fots» på Google-motoren.
 *
 * Google 3D har ingen linje-plasserte etiketter i det hele tatt, så etikettene
 * er HTML posisjonert per frame — samme mønster som reise-chipen i 3D, og av
 * samme grunn: `translate3d` skrevet rett til DOM går til compositoren, mens
 * `setState` per frame gir hopping under kamera-animasjon.
 *
 * ## To takter: valg ved ro, posisjon per frame
 *
 * HVILKET punkt på konturen etiketten henger på velges når kameraet faller til
 * ro (`chooseContourLabels`); DER punktet ligger på skjermen oppdateres hver
 * frame. Delingen er nødvendig fordi valget må se skjermen: konturen er nøstet
 * rundt boligen, og i Satelitt rammer kameraet inn prosjektet — da lå 10- og
 * 15-minutters-etiketten på y=−330 og y=−812, altså over skjermkanten og
 * usynlige (målt 2026-09-07). Ett fast punkt per kontur kan ikke løse det.
 *
 * Valget kan ikke gjøres per frame heller: det projiserer opptil 48 punkter per
 * kontur, og under en kontinuerlig drone-orbit ville det kjørt for hver eneste
 * frame uten at svaret endret seg nevneverdig.
 *
 * Kandidatene og utvelgelsen deles med Mapbox-laget. En etikett som sto nord
 * for konturen i «Kart» og øst for den i «Satelitt» ville lest som to ulike
 * kart.
 */

interface Props {
  map3d: Map3DInstance | null;
  /**
   * Bredden (px) en sidekolonne dekker fra venstre. Kartelementet ligger UNDER
   * panelet på desktop, så en etikett bak det er tegnet men usett — og ville
   * blitt valgt fremfor en som faktisk vises.
   */
  insetLeftPx?: number;
}

/** Litt over konturlinjas 3 m, så etiketten ikke skjæres av bakkemesh. */
const LABEL_ALTITUDE_M = 10;

/** Hvor lenge kameraet må stå stille før etikett-punktene velges på nytt. */
const SETTLE_MS = 220;

export function BoardContourLabels3D({ map3d, insetLeftPx = 0 }: Props) {
  const { state, data } = useBoard();
  const [slots, setSlots] = useState<ContourLabelSlot[]>([]);

  const rings = useMemo(
    () => contourRingsForMode(data.isochrones, state.travelMode),
    [data.isochrones, state.travelMode],
  );
  const candidates = useMemo(() => contourLabelCandidates(rings), [rings]);

  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | undefined>(undefined);

  const active = state.showContours && candidates.length > 0;

  // Etikett-punktene velges mot skjermen slik den ser ut NÅ. Lest via ref-fri
  // callback fordi både ro-lytteren og datasett-effekten kaller den.
  const choose = useCallback(() => {
    if (!map3d || !active) return;
    /* Det SYNLIGE vinduet, ikke elementets rektangel.
     *
     * Kartelementet strekkes forbi høyre vindukant for å få siktepunktet i
     * midten av det brukeren ser (se `overhangRightPx` i BoardMap3D), og ligger
     * dessuten UNDER sidekolonnen på desktop. Målt i Satelitt 2026-09-07: med
     * elementets eget rektangel som ramme landet 10-minutters-etiketten på
     * x=1676 og 15-min på x=1871 i et 1566 px vindu — valgt, men fortsatt
     * usynlig. Vinduet er snittet av element, viewport og panel-kanten. */
    const rect = (map3d as unknown as HTMLElement).getBoundingClientRect();
    const next = chooseContourLabels(
      candidates,
      (lng, lat) => projectLatLngToScreen(map3d, lat, lng, LABEL_ALTITUDE_M),
      {
        left: Math.max(rect.left, insetLeftPx) + 8,
        top: Math.max(rect.top, 0) + 8,
        right: Math.min(rect.right, window.innerWidth) - 8,
        bottom: Math.min(rect.bottom, window.innerHeight) - 8,
      },
    );
    setSlots((prev) =>
      prev.length === next.length &&
      prev.every(
        (p, i) =>
          p.minutes === next[i].minutes &&
          p.lng === next[i].lng &&
          p.lat === next[i].lat,
      )
        ? prev
        : next,
    );
  }, [map3d, active, candidates, insetLeftPx]);

  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  // Ro-signalet: trailing debounce på kamera-endringer, samme mønster som
  // markør-utglisningen (`use-3d-marker-declutter`).
  useEffect(() => {
    if (!map3d || !active) {
      setSlots((prev) => (prev.length === 0 ? prev : []));
      return;
    }
    const el = map3d as unknown as HTMLElement;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => chooseRef.current(), SETTLE_MS);
    };
    el.addEventListener("gmp-camerapositionchange", schedule);
    el.addEventListener("gmp-steadychange", schedule);
    schedule();
    return () => {
      el.removeEventListener("gmp-camerapositionchange", schedule);
      el.removeEventListener("gmp-steadychange", schedule);
      if (timer !== null) clearTimeout(timer);
    };
  }, [map3d, active]);

  // Datasett-endring (reisemåte, av/på) flytter ikke kameraet, så ro-lytteren
  // fyrer ikke. Uten denne sto forrige reisemåtes punkter igjen.
  useEffect(() => {
    if (!map3d || !active) return;
    const timer = setTimeout(() => chooseRef.current(), 0);
    return () => clearTimeout(timer);
  }, [map3d, active, candidates, insetLeftPx]);

  // Primitivene i dep-arrayet, ikke slot-OBJEKTENE: et nytt array med samme
  // verdier ville restartet rAF-løkken hver render.
  const key = slots.map((l) => `${l.minutes}:${l.lng}:${l.lat}`).join("|");

  useEffect(() => {
    if (!map3d || !active || key === "") {
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
      {slots.map((slot, i) => (
        <div
          key={slot.minutes}
          ref={(el) => {
            refs.current[i] = el;
          }}
          data-testid="contour-label-3d"
          className="pointer-events-none fixed left-0 top-0 z-20"
          style={{ willChange: "transform", opacity: 0 }}
        >
          <ContourLabelChip minutes={slot.minutes} mode={state.travelMode} />
        </div>
      ))}
    </>
  );
}
