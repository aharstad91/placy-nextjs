"use client";

import { useCallback, useEffect, useRef } from "react";
import { rectFromCamera } from "./board-camera-fit";
import { useBoard } from "./board-state";

/**
 * Viewport-publisering for Google Maps 3D — 3D-halvdelen av den mobile
 * nabolagsflaten (R9/R12).
 *
 * 2D-stien i `BoardMap` lever på Mapbox' `unproject` + `onMoveEnd`. Ingen av
 * delene finnes på `gmp-map-3d`, og siden Mapbox UNMOUNTES i 3D-visning
 * (`showMapbox` i BoardMap) sto lista stille med det siste 2D-rektangelet så
 * lenge brukeren utforsket i 3D. Denne hooken er de to manglende halvdelene:
 *
 *  - **Ro-signalet:** `gmp-steadychange` (bærer `isSteady`) fyrer når scenen er
 *    ferdig rendret — Googles ekvivalent til `moveend`.
 *  - **Avlesningen:** `center` + `range` + `heading` + `fov` er properties på
 *    elementet, og `rectFromCamera` gjør dem om til det samme `ViewportRect`
 *    2D-stien publiserer. Alt nedstrøms — lista, markør-snittet, kategorisiden —
 *    er derfor uendret.
 *
 * ## R12: kun brukergester re-scoper
 *
 * Google-eventene bærer ingen `originalEvent`, så diskriminatoren 2D bruker
 * finnes ikke. I stedet merker vi brukergrepet der det skjer — pointerdown/
 * wheel/touchstart på kart-elementet, med marker-tapp filtrert bort (det er
 * innholds-interaksjon, ikke kamera-grep). Samme lytter-form som drag-takeover
 * i `BoardMap3D`. Programmatiske bevegelser (drone-orbit, POI-innflyvning,
 * kategori-fit) fyrer ikke pointer-events og re-scoper derfor ikke lista.
 *
 * Flagget nullstilles IKKE ved publisering: har brukeren først tatt rattet,
 * eier hen kameraet — `onDragTakeover` stopper i tillegg drone-orbiten
 * permanent, så det finnes ingen løpende programmatisk bevegelse igjen å
 * beskytte seg mot. Det nullstilles når 3D slutter å være den fremste motoren.
 *
 * Første ro-hendelse publiserer alltid, uansett gest: kamera-feltene deriveres
 * av Google og er typisk ikke lesbare ennå ved mount, så det er den avlesningen
 * som faktisk lander det initielle scopet.
 */

/** Googles dokumenterte default for `fov` når den ikke er satt eksplisitt. */
const DEFAULT_FOV_DEG = 35;

/** Minimal flate vi leser fra Map3DElement-instansen. Alt er nullable fordi
 *  Google deriverer feltene og de kan mangle før første scene er rendret. */
interface Map3DPoseLike extends HTMLElement {
  center?: { lat: number; lng: number } | null;
  heading?: number | null;
  range?: number | null;
  fov?: number | null;
}

export function use3DViewportPublish({
  map3d,
  enabled,
  occludedBottomPx,
}: {
  /** Map3DElement-instansen (castes internt), eller null før den er klar. */
  map3d: unknown | null;
  /** Kun sann når 3D er den FREMSTE motoren og flaten publiserer utsnitt.
   *  I 2D-visning eier Mapbox kanalen og denne hooken skal tie. */
  enabled: boolean;
  /** Høyden (px) sheeten dekker nederst. */
  occludedBottomPx: number;
}) {
  const { setViewportRect } = useBoard();

  /** Publiserer gjeldende utsnitt. Returnerer false når kameraet ennå ikke er
   *  lesbart — da skrives INGENTING (en `null` her ville blinket hele lista inn
   *  før første scene var rendret). */
  const publish = useCallback(
    (userGesture: boolean): boolean => {
      const map = map3d as Map3DPoseLike | null;
      if (!map) return false;
      const center = map.center;
      const range = map.range;
      if (!center || range == null) return false;
      const box = map.getBoundingClientRect();
      setViewportRect(
        rectFromCamera(
          {
            lat: center.lat,
            lng: center.lng,
            rangeM: range,
            headingDeg: map.heading ?? 0,
            fovDeg: map.fov ?? DEFAULT_FOV_DEG,
          },
          {
            widthPx: box.width,
            heightPx: box.height,
            occludedBottomPx,
          },
        ),
        { userGesture },
      );
      return true;
    },
    [map3d, occludedBottomPx, setViewportRect],
  );

  // Lytterne leser publiseringen via ref, ellers ville de re-registrert seg ved
  // hver endring i sheet-høyden.
  const publishRef = useRef(publish);
  publishRef.current = publish;

  const userDrivenRef = useRef(false);
  const publishedRef = useRef(false);

  // Brukergrepet (R12). Marker-tapp er innholds-interaksjon og filtreres bort.
  useEffect(() => {
    if (!enabled || !map3d) return;
    const el = map3d as HTMLElement;
    const onGrab = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("gmp-marker-3d-interactive")) return;
      userDrivenRef.current = true;
    };
    el.addEventListener("pointerdown", onGrab);
    el.addEventListener("wheel", onGrab, { passive: true });
    el.addEventListener("touchstart", onGrab, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onGrab);
      el.removeEventListener("wheel", onGrab);
      el.removeEventListener("touchstart", onGrab);
    };
  }, [enabled, map3d]);

  // Ro-signalet — Googles `moveend`.
  useEffect(() => {
    if (!enabled || !map3d) return;
    const el = map3d as HTMLElement;
    const onSteady = (e: Event) => {
      // Hendelsen fyrer i BEGGE retninger; `isSteady: false` er «bevegelse
      // startet» og skal ikke publisere noe.
      if ((e as Event & { isSteady?: boolean }).isSteady === false) return;
      const userGesture = userDrivenRef.current;
      if (!userGesture && publishedRef.current) return;
      if (publishRef.current(userGesture)) publishedRef.current = true;
    };
    el.addEventListener("gmp-steadychange", onSteady);
    return () => el.removeEventListener("gmp-steadychange", onSteady);
  }, [enabled, map3d]);

  // Initiell publisering, og re-publisering når sheeten endrer høyde: en ny
  // hvileposisjon endrer det ikke-okkluderte området og teller som en
  // scope-endring (R12). Speiler effekten på 2D-stien i `BoardMap`.
  useEffect(() => {
    if (!enabled || !map3d) return;
    if (publish(false)) publishedRef.current = true;
  }, [enabled, map3d, publish]);

  // Nullstill sporingen når 3D slutter å være fremste motor (eller instansen
  // byttes). Uten dette ville en retur til 3D arvet «brukeren eier kameraet»
  // fra forrige økt, og drone-orbiten kunne re-scopet lista uten at noen tok i
  // kartet. Egen effekt så en endring i sheet-høyden ikke nullstiller noe.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      userDrivenRef.current = false;
      publishedRef.current = false;
    };
  }, [enabled, map3d]);
}
