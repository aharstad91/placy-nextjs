"use client";

import { useCallback, useEffect, useRef } from "react";
import { rectFromCamera } from "./board-camera-fit";
import { isMarker3DTarget } from "@/components/map/marker-3d-selectors";
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
 *  - **Ro-signalet:** når kameraet har sluttet å bevege seg (se under).
 *  - **Avlesningen:** `center` + `range` + `heading` + `fov` er properties på
 *    elementet, og `rectFromCamera` gjør dem om til det samme `ViewportRect`
 *    2D-stien publiserer. Alt nedstrøms — lista, markør-snittet, kategorisiden —
 *    er derfor uendret.
 *
 * ## Hvorfor ro-signalet IKKE er `gmp-steadychange`
 *
 * `steadychange` er ikke Googles «kameraet stoppet» — Googles egen typedoc sier
 * «all rendering for the current scene has completed». Den venter altså på at
 * 3D-flisene er lastet OG tegnet. Målt på Wesselsløkka-boardet lander den
 * 590–950 ms etter at kameraet faktisk sto stille, også over fliser som
 * allerede var lastet. Mot Mapbox' `moveend`, som fyrer i samme frame som
 * bevegelsen slutter, ga det en liste som følte seg et helt sekund bakpå.
 *
 * `gmp-camerapositionchange` er derimot ren kamera-telemetri: den fyrer per
 * frame under bevegelse, og siste event lander ~10 ms FØR kameraet står stille.
 * Ro er derfor «ingen ny kamera-hendelse på en stund» — en trailing debounce.
 *
 * Vinduet er adaptivt, ikke fast: på en normal telefon kommer hendelsene hvert
 * ~10 ms (maks 21 ms målt), men på en strupet enhet (6× CPU) spres de til
 * ~140 ms median / 225 ms maks. Et fast vindu måtte enten vært tregt for alle
 * eller fyrt midt i draget på de svakeste telefonene — der ekstra list-rendring
 * koster mest. Terskelen settes derfor til {@link SETTLE_GAP_FACTOR} × den
 * treigeste av de siste hendelses-lukene, klemt mellom {@link MIN_SETTLE_MS} og
 * {@link MAX_SETTLE_MS}. Målt ende-til-ende, fra kameraet står stille til lista
 * er oppdatert i DOM: ~110 ms med `steadychange` byttet ut, mot 640–780 ms før.
 *
 * `steadychange` beholdes som TO ting den faktisk er god til: ankomst-signalet
 * (kamera-feltene er sjelden lesbare ved mount), og en backstop hvis et grep
 * mot formodning ikke skulle produsere kamera-hendelser i det hele tatt. Den
 * publiserer aldri når fast-stien alt har landet grepet — gest-telleren står
 * utenfor verdi-dedupen i `setViewportRect` og ville ellers telt dobbelt.
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
 * Ankomsten publiserer alltid, uansett gest: kamera-feltene deriveres av Google
 * og er typisk ikke lesbare ennå ved mount, så det er den avlesningen som
 * faktisk lander det initielle scopet.
 */

/** Googles dokumenterte default for `fov` når den ikke er satt eksplisitt. */
const DEFAULT_FOV_DEG = 35;

/** Korteste ro-vindu. Gulv, ikke normaltilstand — den adaptive termen ligger
 *  over den i praksis. Eksportert fordi testene måler mot den; en hardkodet
 *  50-er i testen ville blitt en usann påstand i det denne justeres. */
export const MIN_SETTLE_MS = 50;
/** Lengste ro-vindu. Et tak, ikke en forventning: selv en strupet enhet skal
 *  aldri komme dårligere ut enn `steadychange` ville gitt. */
export const MAX_SETTLE_MS = 500;
/**
 * Hvor mange ganger den treigeste luka vi venter før vi kaller det ro.
 *
 * Vi biaser bevisst KORT. De to feilmodusene er ikke symmetriske: et for langt
 * vindu er nøyaktig den forsinkelsen dette skal fjerne, mens et for kort vindu
 * bare publiserer et gyldig mellomliggende utsnitt — og luke-målingen retter
 * seg selv med én gang etterpå. 2,5 × den treigeste av de siste fire lukene
 * (målt maks 21 ms på en normal telefon) lander ~52 ms.
 */
export const SETTLE_GAP_FACTOR = 2.5;
/** Antall luker vi holder på. Nok til å jevne ut ett enkelt hakk, kort nok til
 *  å følge med når enheten friskner til midt i et drag. */
const GAP_WINDOW = 4;

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
  /** Satt ved kart-grep, nullstilt idet grepet er publisert. Skiller «fast-
   *  stien har landet dette» fra «ingen har publisert det ennå», og er derfor
   *  det backstop-en i `steadychange` spør om. */
  const gestureUnpublishedRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventAtRef = useRef<number | null>(null);
  const gapsRef = useRef<number[]>([]);

  /** Publiser + bokfør. Stabil identitet (rører kun refs), så lytterne under
   *  kan holde på den uten å re-registrere seg. */
  const commit = useCallback((userGesture: boolean) => {
    if (!publishRef.current(userGesture)) return;
    publishedRef.current = true;
    if (userGesture) gestureUnpublishedRef.current = false;
  }, []);

  // Brukergrepet (R12). Marker-tapp er innholds-interaksjon og filtreres bort.
  useEffect(() => {
    if (!enabled || !map3d) return;
    const el = map3d as HTMLElement;
    const onGrab = (e: Event) => {
      if (isMarker3DTarget(e.target)) return;
      userDrivenRef.current = true;
      gestureUnpublishedRef.current = true;
      // Glem NÅR forrige hendelse kom, men behold HVOR TETT de kom: pausen
      // siden forrige gest er ikke en luke og ville blåst opp ro-vinduet, mens
      // takten er en egenskap ved enheten og gjelder fortsatt. Uten det ville
      // hvert eneste drag på en treg telefon startet med å gjette for kort.
      lastEventAtRef.current = null;
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

  // Ro-signalet: siste kamera-hendelse + adaptiv debounce. Se doc-blokken over.
  useEffect(() => {
    if (!enabled || !map3d) return;
    const el = map3d as HTMLElement;

    /** 3× den treigeste av de siste lukene, klemt til [MIN, MAX]. */
    const settleDelay = () => {
      const gaps = gapsRef.current;
      if (gaps.length === 0) return MIN_SETTLE_MS;
      const slowest = Math.max(...gaps);
      return Math.min(
        MAX_SETTLE_MS,
        Math.max(MIN_SETTLE_MS, slowest * SETTLE_GAP_FACTOR),
      );
    };

    const onCameraChange = () => {
      // Programmatisk bevegelse etter at scopet er landet — drone-orbit,
      // POI-innflyvning, kategori-fit. R12: de re-scoper ikke, og skal heller
      // ikke få lov til å forurense luke-målingen.
      if (!userDrivenRef.current && publishedRef.current) return;

      const now = performance.now();
      const prev = lastEventAtRef.current;
      lastEventAtRef.current = now;
      if (prev !== null) {
        const gaps = gapsRef.current;
        gaps.push(now - prev);
        if (gaps.length > GAP_WINDOW) gaps.shift();
      }

      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        commit(userDrivenRef.current);
      }, settleDelay());
    };

    el.addEventListener("gmp-camerapositionchange", onCameraChange);
    return () => {
      el.removeEventListener("gmp-camerapositionchange", onCameraChange);
      if (settleTimerRef.current !== null) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
    };
  }, [enabled, map3d, commit]);

  // Ankomst + backstop. `steadychange` er scenens ferdig-signal, ikke kameraets
  // — den er for treg til å drive lista, men den er det eneste signalet som
  // kommer når kamera-feltene endelig BLIR lesbare uten at kameraet har flyttet
  // seg. Den fyrer også hvis et grep mot formodning ikke ga kamera-hendelser.
  useEffect(() => {
    if (!enabled || !map3d) return;
    const el = map3d as HTMLElement;
    const onSteady = (e: Event) => {
      // Hendelsen fyrer i BEGGE retninger; `isSteady: false` er «bevegelse
      // startet» og skal ikke publisere noe.
      if ((e as Event & { isSteady?: boolean }).isSteady === false) return;
      // Alt landet: verken ankomst eller et upublisert grep står igjen.
      if (publishedRef.current && !gestureUnpublishedRef.current) return;
      commit(userDrivenRef.current);
    };
    el.addEventListener("gmp-steadychange", onSteady);
    return () => el.removeEventListener("gmp-steadychange", onSteady);
  }, [enabled, map3d, commit]);

  // Initiell publisering, og re-publisering når sheeten endrer høyde: en ny
  // hvileposisjon endrer det ikke-okkluderte området og teller som en
  // scope-endring (R12). Speiler effekten på 2D-stien i `BoardMap`.
  useEffect(() => {
    if (!enabled || !map3d) return;
    commit(false);
  }, [enabled, map3d, occludedBottomPx, commit]);

  // Nullstill sporingen når 3D slutter å være fremste motor (eller instansen
  // byttes). Uten dette ville en retur til 3D arvet «brukeren eier kameraet»
  // fra forrige økt, og drone-orbiten kunne re-scopet lista uten at noen tok i
  // kartet. Egen effekt så en endring i sheet-høyden ikke nullstiller noe.
  useEffect(() => {
    if (!enabled) return;
    return () => {
      userDrivenRef.current = false;
      publishedRef.current = false;
      gestureUnpublishedRef.current = false;
      lastEventAtRef.current = null;
      gapsRef.current = [];
    };
  }, [enabled, map3d]);
}
