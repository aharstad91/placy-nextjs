"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MARKER_3D_ATTR } from "./marker-3d-selectors";
import type { Map3DInstance } from "./map-view-3d";

/**
 * Googles HTML-markør (`<gmp-marker>` / `<gmp-marker-interactive>`) som
 * React-komponent.
 *
 * ## Hvorfor denne finnes
 *
 * `Marker3DElement` rasteriserer innholdet sitt til en 3D-tekstur med ~én
 * teksel per CSS-piksel, og skalerer teksturen opp med skjermens pikselforhold.
 * På en telefon med DPR 3 blir 10 px label-tekst en 1×-bitmap blåst 3× opp —
 * synlig uskarp. Målt: `sizePreserved` ga 0 endrede piksler (så Googles
 * avstands-skalering var ikke årsaken), mens samme SVG deklarert 3× stor ble
 * tegnet 3× større OG skarp. Oppløsningen følger altså SVG-ens deklarerte
 * px-størrelse, ikke skjermens, og ingen innstilling kan gjøre tekst skarp så
 * lenge den ligger i teksturen.
 *
 * `MarkerElement` er ekte DOM: nettleserens tekst-motor tegner på skjermens
 * egen oppløsning, og Google skriver bare `transform` på vertselementet
 * (verifisert: `translate(-50%, -100%) translate(Xpx, Ypx)` med
 * `will-change: transform`, oppdatert hvert 8.–11. ms under kamerabevegelse).
 * Den er GA i vanlig kanal — ingen `v=alpha` — og `@types/google.maps` 3.64.0
 * typer den allerede.
 *
 * ## Hvorfor egen wrapper
 *
 * `@vis.gl/react-google-maps` 1.8.3 har ingen. Deres egen er merget i main
 * (PR #1009, nytt `/3d`-subpath) men ikke publisert — release-PR-en står åpen.
 * Vi venter ikke på deres kadens; migrering dit blir en ren import-bytte.
 *
 * ## Invarianter
 *
 * - **Barn av `gmp-map-3d`, aldri en søsken-overlay.** `FLY_CLEAN`-steget i
 *   `scripts/capture-3d-flythrough.mjs` setter `display: none` på alle SØSKEN av
 *   kartelementet oppover hele ancestor-kjeden. Et overlay ville vært usynlig i
 *   hver eneste fangede film; lys-DOM-barn overlever, fordi løkken bare rører
 *   søsken.
 * - **Elementet bytter ALDRI tagnavn i sin levetid.** Et typebytte unmounter
 *   elementet, og Google fortsetter å tegne den fjernede markørens tekstur —
 *   dokumentert i `docs/solutions/ui-bugs/google-maps-3d-marker-template-swap-
 *   spokelser-20260823.md`, der en klynge som skulle bli 2 pins + 6 prikker
 *   rendret som 8 fulle pins. `interactive` leses derfor ÉN gang, ved opprettelse.
 * - **Ankeret settes ikke.** Googles defaults (`anchorLeft: -50%`,
 *   `anchorTop: -100%`) er verifisert identiske med `Marker3DElement`s
 *   bunn-midt-forankring, så `anchorToDiscCenterY` i kollisjonskullingen og
 *   mini-popupens −28 px står uendret riktig. MERK at `-50%` er halve ELEMENTETS
 *   boks: legger du en label i innholdets flyt, flytter ankeret seg og markøren
 *   vandrer bort fra punktet sitt. Innholdet må holde boksen kvadratisk.
 * - **Ingen fallback til `Marker3DElement`.** Maps-JS-kanalen er upinnet, så
 *   mangler `MarkerElement` bailer laget stille. To markørgenerasjoner samtidig
 *   er både spøkelses-risiko og ukjent tegne-rekkefølge.
 *
 * ## Klikk
 *
 * Barna ligger i light DOM via portal, så React-handlere inne i markøren virker
 * — for første gang. Det er nettopp derfor denne komponenten eksponerer BARE
 * `gmp-click`: begge stier samtidig ville utløst POI-valget to ganger. `gmp-click`
 * er også stien de tre `isMarker3DTarget`-gatene og bakgrunns-lukkingen i
 * `BoardMap3D` alt er bygget rundt.
 */

export interface DomMarker3DProps {
  /** Map3DElement-instansen, eller null før den er klar. */
  map3d: Map3DInstance | null;
  lat: number;
  lng: number;
  /** Meter over bakken (`RELATIVE_TO_GROUND`). */
  altitude: number;
  /**
   * Tegne-rekkefølge. Google depth-sorterer IKKE DOM-markører — alle får
   * `z-index: auto`, og rekkefølgen endres ikke når kameraet snus, så
   * overlapp ville avgjorts av mount-rekkefølge. Mat inn kamera-avstand.
   */
  zIndex?: number;
  /** Rollover- og skjermleser-tekst. */
  title?: string;
  /**
   * Klikk-handler. Avgjør tagnavnet ved opprettelse: satt → interaktiv markør.
   * Endres den fra satt til usatt senere, beholdes elementet (se invarianter) —
   * bare handleren slutter å fyre.
   */
  onClick?: () => void;
  children: React.ReactNode;
}

/** Minimal flate vi trenger fra markør-instansen. */
interface MarkerLike extends HTMLElement {
  position: { lat: number; lng: number; altitude: number } | unknown;
  altitudeMode: unknown;
  title: string;
}

export function DomMarker3D({
  map3d,
  lat,
  lng,
  altitude,
  zIndex,
  title,
  onClick,
  children,
}: DomMarker3DProps) {
  const markerRef = useRef<MarkerLike | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  /** Lest via ref så en ny handler-identitet ikke re-oppretter elementet. */
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  /** Tagnavnet låses ved opprettelse — se invarianter. */
  const interactiveRef = useRef(onClick !== undefined);

  // Opprett markøren og append den som barn av kartet. Én instans per mount.
  useEffect(() => {
    if (!map3d) return;
    let cancelled = false;

    (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          "maps3d",
        )) as google.maps.Maps3DLibrary;
        if (cancelled) return;

        const Ctor = interactiveRef.current
          ? lib.MarkerInteractiveElement
          : lib.MarkerElement;
        // Upinnet Maps-JS-kanal: mangler HTML-markøren, tier vi. Ingen fallback
        // til den rasteriserte typen — se invarianter.
        if (typeof Ctor !== "function") {
          console.warn(
            "[DomMarker3D] MarkerElement finnes ikke i denne Maps-versjonen",
          );
          return;
        }

        // Double-check etter async pause (StrictMode kjører effekten to ganger).
        if (markerRef.current || cancelled) return;

        const marker = new Ctor() as unknown as MarkerLike;
        marker.setAttribute(MARKER_3D_ATTR, "");
        marker.altitudeMode = lib.AltitudeMode.RELATIVE_TO_GROUND;
        markerRef.current = marker;
        map3d.append(marker);
        setHost(marker);
      } catch (err) {
        if (!cancelled) console.warn("[DomMarker3D] mount feilet:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map3d]);

  // Posisjon. Feltene kopieres ETT FOR ETT: `LatLngAltitude` har gettere, så en
  // spread gir et objekt uten verdier og Google svarer med InvalidValueError.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.position = { lat, lng, altitude };
  }, [host, lat, lng, altitude]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.title = title ?? "";
  }, [host, title]);

  // Tegne-rekkefølge. CSS, ikke en Google-prop — `MarkerElement` har ingen
  // `zIndex`, men dokumenterer at CSS `z-index` styrer hvem som dekker hvem.
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.style.zIndex = zIndex === undefined ? "" : String(Math.round(zIndex));
  }, [host, zIndex]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !interactiveRef.current) return;
    const handler = () => onClickRef.current?.();
    marker.addEventListener("gmp-click", handler);
    return () => marker.removeEventListener("gmp-click", handler);
  }, [host]);

  // Full unmount: ta elementet ut av DOM og nullstill refen, så neste mount
  // lager en ny instans i stedet for å gjenbruke en løsrevet node.
  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, []);

  // Barna i light DOM. Ingen <template>, ingen cloneNode — det er nettopp
  // template-klonringen i den rasteriserte stien som gjorde teksten til en
  // tekstur og React-handlere døde.
  return host ? createPortal(children, host) : null;
}
