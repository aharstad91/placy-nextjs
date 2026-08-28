"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { POI } from "@/lib/types";
import {
  computeLabelPlacements,
  LABEL_GAP_X,
  type LabelCandidate,
  type LabelObstacle,
  type LabelSide,
} from "@/lib/board/label-collision";
import { isAnchorPOI } from "@/lib/board/anchor-poi";
import {
  computePinDemotions,
  type PinBlocker,
  type PinCandidate,
} from "@/lib/board/pin-declutter";
import { equivalentZoomForCamera } from "@/lib/board/camera-zoom";
import { projectLatLngToScreen } from "@/components/map/project-latlng-to-screen";
import { scaleForRange } from "@/components/map/project-pin-scale";
import { projectSitePinBlocker } from "@/components/map/ProjectSitePin";
import { DOT_SIZE, PIN_SIZE } from "@/components/map/PoiMarkerContent";
import { poiPinScaleForZoom } from "@/components/map/poi-pin-scale";
import { computeZoomTier } from "./use-board-zoom-tier";

/**
 * Markør-utglisning og label-plassering for Google Maps 3D — 3D-halvdelen av
 * den logikken 2D-kartet har hatt siden Oppdal-runden (2026-08-12).
 *
 * 2D-stien bor i `BoardMap`: den projiserer synlige markører med Mapbox' egen
 * `map.project` på `moveend`, kjører `computeLabelPlacements`, og tierer
 * markørene på `map.getZoom()`. Ingen av de tre inngangene finnes på
 * `gmp-map-3d` — det har ingen `project`, ingen `moveend` og ingen zoom. Denne
 * hooken er de tre manglende halvdelene, og bruker deretter NØYAKTIG samme rene
 * funksjoner som 2D:
 *
 *  - **Projeksjonen:** `projectLatLngToScreen` (kameraets center/heading/tilt/
 *    range/fov → skjerm-px), delt med POI-mini-popupen.
 *  - **Zoomen:** `equivalentZoomForCamera` oversetter `range` + `fov` til det
 *    Mapbox-zoomnivået som gir samme bakke-oppløsning, så `computeZoomTier` og
 *    dens terskler (13 / 16) fortsatt bor ÉTT sted.
 *  - **Ro-signalet:** trailing debounce på `gmp-camerapositionchange`.
 *
 * Utover det gjør 3D én ting 2D ikke trenger: **pin-utglisning**. Se
 * `lib/board/pin-declutter` — markørene er {@link PIN_SIZE} px og
 * skjerm-forankret, så en tett klynge blir en fargeklump lenge før teksten blir
 * problemet.
 *
 * ## Hvorfor ro og ikke hver frame
 *
 * Label-teksten ligger INNE i markørens SVG (Google rasteriserer innholdet til
 * en tekstur). Hver endring i plassering er derfor en re-rasterisering av den
 * markøren. Per frame ville det vært nøyaktig den churnen som en gang sprengte
 * WebGL-kontekstene (`docs/solutions/performance-issues/webgl-context-leak-
 * per-render-probe-20260603.md`). Vi regner derfor kun når kameraet har falt
 * til ro.
 *
 * Konsekvensen er bevisst: under bevegelse FRYSES plasseringene. Det er riktig
 * vei å bomme — labelen sitter fast i sin egen pin og følger den gjennom hele
 * bevegelsen, så det verste som skjer er at to navn overlapper et øyeblikk
 * midtveis i et drag. Alternativet (skjule labels under bevegelse) ville
 * blinket hele kartet av og på ved hver eneste panorering.
 *
 * Under en kontinuerlig drone-orbit faller kameraet aldri til ro, og
 * plasseringene blir derfor stående fra forrige stopp. Datasett-timeren under
 * er egen nettopp derfor: bytter kategori midt i orbiten, må det nye settet
 * fortsatt få en plassering selv om kamera-timeren aldri fyrer.
 */

/** Halv markør-diameter. Tallet er IMPORTERT, ikke speilet: geometrien her må
 *  være den samme disc-en som `PoiMarkerContent` faktisk tegner, ellers
 *  kolliderer vi mot en størrelse som ikke finnes på skjermen. */
const PIN_HALF = PIN_SIZE / 2;
/** Halv bredde på en demotert prikk — `PoiMarkerContent`s compact-gren, ikke
 *  reveal-lagets `BlobMarker3D` (samme tall, ulik markør). */
const DOT_HALF = DOT_SIZE / 2;
/** Markørsenter → labelens nærmeste kant, ved skala 1. Ganges med markør-skalaen
 *  i `recompute`. 2D bruker samme 16 + 8, men uten skala. */
const LABEL_OFFSET_3D = PIN_HALF + LABEL_GAP_X;
/** Høyden POI-markørene ligger på (`Marker3DItem`). Må matche, ellers
 *  projiserer vi et annet punkt enn det Google tegner markøren på. */
const POI_ALTITUDE_M = 18;
/**
 * Google forankrer marker-innhold i BUNN-MIDTEN av SVG-rammen (verifisert mot
 * prosjektmarkøren og målt på Strindfjordvegen: den projiserte y-en lander
 * konsekvent en halv markørhøyde UNDER den tegnede skiva). Det projiserte
 * punktet er altså ikke skivas senter — og det er skiva labels legger seg ved
 * siden av, og skiva som kolliderer. Vi løfter derfor y til visuelt senter før
 * geometrien regnes.
 */
const anchorToDiscCenterY = (y: number, halfHeight: number) => y - halfHeight;
/** Høyden prosjektmarkøren ligger på (`projectSite`-markøren i `map-view-3d`). */
const PROJECT_ALTITUDE_M = 30;
/** Googles dokumenterte default for `fov`. */
const DEFAULT_FOV_DEG = 35;

/**
 * Ro-vindu etter siste kamera-hendelse.
 *
 * Var 400 ms, og det var den forsinkelsen brukeren FØLTE: målt 426 ms fra siste
 * `gmp-camerapositionchange` til labelene endret seg, mot Mapbox som oppdaterer
 * i samme frame som bevegelsen slutter.
 *
 * Begrunnelsen for de 400 ms var at hver label-endring var en re-rasterisering
 * av en markør-tekstur. Den kostnaden finnes ikke lenger — labelen er en
 * tekstnode. Og selve regnestykket er billig: målt 0,29 ms for de to greedy
 * passeringene ved 465 markører, altså 1,7 % av et 16,7 ms frame-budsjett.
 *
 * Doc-en som ble sitert som belegg for de 400 ms (`webgl-context-leak-per-
 * render-probe-20260603`) sier dessuten det motsatte av det den ble brukt til:
 * alle de 180 lekkede WebGL-kontekstene kom fra `isWebGLAvailable()` som kjørte
 * per render, og INGEN fra markør-rasterisering.
 *
 * Ikke satt til 0: React-passet over ~470 memoiserte markører er ikke målt, og
 * det er det eneste her som kan spise frames. 100 ms er under det brukeren
 * merker, og lar fortsatt et drag være ett grep i stedet for tjue.
 *
 * Eksportert fordi testene måler mot den — en hardkodet 400-er i testen ble en
 * usann påstand i det dette tallet ble justert.
 */
export const CAMERA_SETTLE_MS = 100;
/**
 * Egen timer for datasett-endringer (kategori-bytte, ny aktiv POI).
 * Nullstilles IKKE av kamera-hendelser — ellers ville en kontinuerlig orbit
 * sultet den ut, og et nytt markørsett hadde stått uten plassering for alltid.
 * Den begrunnelsen består; bare tallet følger kamera-vinduet ned.
 */
const DATA_SETTLE_MS = 100;
/**
 * Hvor langt utenfor det SYNLIGE vinduet en markør får ligge og fortsatt regnes
 * med. Marginen finnes fordi en label kan stikke inn i bildet fra en pin som så
 * vidt er utenfor; alt lenger ute kan verken sees eller kollidere.
 *
 * Vinduet er ikke alltid hele elementet: på desktop dekker panelet venstre del,
 * og elementet stikker ut til høyre for vindukanten (se `visibleLeftPx` /
 * `overhangRightPx`).
 */
const OFFSCREEN_MARGIN_PX = 200;

/** Minimal kamera-flate vi leser fra Map3DElement-instansen. Alt er nullable
 *  fordi Google deriverer feltene og de kan mangle før første scene er rendret. */
interface Map3DPoseLike extends HTMLElement {
  center?: { lat: number; lng: number } | null;
  range?: number | null;
  fov?: number | null;
}

export interface LabelPlacement {
  text: string;
  side: LabelSide;
}

export interface Marker3DDeclutter {
  /** poi.id → label som skal VISES. Fraværende id = pinnen står uten navn. */
  labels: Record<string, LabelPlacement>;
  /** poi.id-er som tegnes som prikk fordi en viktigere pin eier plassen. */
  demotedIds: ReadonlySet<string>;
  /**
   * poi.id → CSS `z-index`. Nødvendig fordi Google IKKE depth-sorterer
   * DOM-markører: alle får `z-index: auto`, og rekkefølgen endres ikke når
   * kameraet snus, så to overlappende pins ville valgt vinner etter
   * mount-rekkefølge. Rangeringen er skjerm-y — i et tiltet 3D-bilde ligger det
   * nære lavere i bildet, så større y skal male oppå. Samme regel Google selv
   * bruker som tie-break i kollisjonssystemet sitt.
   */
  zIndexes: Record<string, number>;
  /**
   * Markør-størrelsen kameraet ber om, 1 = {@link PIN_SIZE}. Hører hjemme her og
   * ikke i en egen hook: den leses av SAMME kamera-avlesning som tierne og
   * kollisjonen, og den må være det samme tallet — regnet ett annet sted, ville
   * markørene kunnet tegnes større enn plassen som ble reservert for dem.
   *
   * Konsumenter: `MapView3D.markerScale` (tegner) og mini-popupens løft (som må
   * klare disc-toppen).
   */
  pinScale: number;
}

const EMPTY: Marker3DDeclutter = {
  labels: {},
  demotedIds: new Set(),
  zIndexes: {},
  pinScale: 1,
};

export interface UseMarker3DDeclutterParams {
  /** Map3DElement-instansen (castes internt), eller null før den er klar. */
  map3d: unknown | null;
  /** Markørene som faktisk er mountet (`useBoardMarkerSet.markerPOIs`). */
  pois: readonly POI[];
  /** Prosjekt-tomten — markøren der er alltid synlig og blokkerer det den dekker. */
  home: { lat: number; lng: number };
  /** Prosjektnavnet markøren viser. Bredden avhenger av det. */
  homeName: string;
  /**
   * Undertittelen markøren viser. Utelates den, brukes samme default som
   * komponenten (`PROJECT_PIN_DEFAULT_SUBTITLE`) — hindringen må reservere plass
   * til NØYAKTIG den teksten som tegnes, ellers demoterer vi POI-er mot en boks
   * som ikke finnes.
   */
  homeSubtitle?: string;
  /** Åpen POI. Kulles aldri, demoteres aldri — brukerens fokuspunkt. */
  activePOIId: string | null;
  /**
   * Skjul inline-labelen på den AKTIVE POI-en. Settes når mini-popupen står
   * åpen: den viser allerede navnet, og uten dette står navnet to ganger rett
   * over hverandre. Speiler `suppressLabel` i 2D-stien (BoardMarker).
   *
   * Plassen er fortsatt RESERVERT i kollisjonen — labelen kommer tilbake i det
   * popupen lukkes, og skal ikke måtte kjempe om plassen på nytt da.
   */
  suppressActiveLabel?: boolean;
  /**
   * Venstre kant av det SYNLIGE vinduet i elementets piksler. Desktop-panelet
   * ligger oppå kartet, så alt til venstre for denne er tegnet men usett.
   * Default 0 (mobil: elementet ER vinduet).
   */
  visibleLeftPx?: number;
  /**
   * Bredden elementet stikker ut til høyre for vinduet (se BoardMap3D-propen med
   * samme navn). Default 0.
   */
  overhangRightPx?: number;
  /**
   * Av når markørene uansett ikke er fulle ikon-pins: `compactMarkers` tegner
   * alt som prikker, og capture/intro-modusene mounter ingen markører i det
   * hele tatt. Da skal hooken tie helt.
   */
  enabled: boolean;
}

/** Laveste z-index vi deler ut. Over 0 så et manglende oppslag (som blir
 *  `z-index: auto`) alltid havner UNDER en markør vi har rangert. */
const Z_BASE = 1;
/** Den aktive POI-en eier plassen sin og skal aldri dekkes av en nabo. */
const Z_ACTIVE = 100000;

/**
 * Dybdesortering fra skjerm-y.
 *
 * Google depth-sorterer ikke DOM-markører — verifisert i browser: to markører
 * på ulik avstand fikk begge `z-index: auto`, og DOM-rekkefølgen sto stille da
 * heading ble snudd 180°. Uten dette avgjøres overlapp av mount-rekkefølge, og
 * den nærmeste pinnen kan havne bak en fjern.
 *
 * I et tiltet 3D-bilde ligger det nære LAVERE i bildet, så større y skal male
 * oppå. Det er samme regel Google selv oppgir som tie-break i kollisjons-
 * systemet sitt. Vi rangerer i stedet for å bruke y direkte, så verdiene holder
 * seg små og `sameResult`-dedupen ikke trigges av subpiksel-drift.
 */
function depthOrder(
  projected: readonly { poi: POI; y: number }[],
  activeId: string | null,
): Record<string, number> {
  const sorted = [...projected].sort(
    (a, b) => a.y - b.y || (a.poi.id < b.poi.id ? -1 : 1),
  );
  const out: Record<string, number> = {};
  sorted.forEach(({ poi }, i) => {
    out[poi.id] = poi.id === activeId ? Z_ACTIVE : Z_BASE + i;
  });
  return out;
}

function sameResult(a: Marker3DDeclutter, b: Marker3DDeclutter): boolean {
  if (a.pinScale !== b.pinScale) return false;
  if (a.demotedIds.size !== b.demotedIds.size) return false;
  for (const id of a.demotedIds) if (!b.demotedIds.has(id)) return false;
  const aKeys = Object.keys(a.labels);
  const bKeys = Object.keys(b.labels);
  if (aKeys.length !== bKeys.length) return false;
  for (const id of aKeys) {
    const x = a.labels[id];
    const y = b.labels[id];
    if (!y || x.text !== y.text || x.side !== y.side) return false;
  }
  const aZ = Object.keys(a.zIndexes);
  if (aZ.length !== Object.keys(b.zIndexes).length) return false;
  for (const id of aZ) if (a.zIndexes[id] !== b.zIndexes[id]) return false;
  return true;
}

export function useMarker3DDeclutter({
  map3d,
  pois,
  home,
  homeName,
  homeSubtitle,
  activePOIId,
  enabled,
  suppressActiveLabel = false,
  visibleLeftPx = 0,
  overhangRightPx = 0,
}: UseMarker3DDeclutterParams): Marker3DDeclutter {
  const [result, setResult] = useState<Marker3DDeclutter>(EMPTY);

  // Lytterne leser gjeldende input via ref, ellers ville de re-registrert seg
  // hver gang markørsettet endret seg — og en re-registrering midt i et drag
  // ville nullstilt ro-timeren.
  const inputRef = useRef({
    pois,
    home,
    homeName,
    homeSubtitle,
    activePOIId,
    enabled,
    suppressActiveLabel,
    visibleLeftPx,
    overhangRightPx,
  });
  inputRef.current = {
    pois,
    home,
    homeName,
    homeSubtitle,
    activePOIId,
    enabled,
    suppressActiveLabel,
    visibleLeftPx,
    overhangRightPx,
  };

  const recompute = useCallback(() => {
    const map = map3d as Map3DPoseLike | null;
    const {
      pois: items,
      home: site,
      homeName: siteName,
      homeSubtitle: siteSubtitle,
      activePOIId: activeId,
      enabled: on,
      suppressActiveLabel: hideActiveLabel,
      visibleLeftPx: windowLeft,
      overhangRightPx: windowOverhangRight,
    } = inputRef.current;
    if (!map || !on) return;

    // Kameraet er ikke lesbart ennå (Google deriverer feltene, og de mangler
    // typisk til første scene er rendret). Behold forrige resultat — et gjettet
    // tier ved mount ville blinket alle markørene gjennom en tier-overgang.
    const center = map.center;
    const range = map.range;
    if (!center || range == null) return;
    const rect = map.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const fovDeg = map.fov ?? DEFAULT_FOV_DEG;
    const zoom = equivalentZoomForCamera({
      rangeM: range,
      fovDeg,
      lat: center.lat,
      heightPx: rect.height,
    });
    if (zoom === null) return;
    const tier = computeZoomTier(zoom);
    // Markør-skalaen: samme kamera-avlesning som tieren, så det som TEGNES og
    // det som RESERVERES aldri kan komme i utakt.
    const pinScale = poiPinScaleForZoom(zoom);
    const pinHalf = PIN_HALF * pinScale;
    const dotHalf = DOT_HALF * pinScale;

    // Projeksjonen gjøres FØR tier-sjekken, fordi dybdesorteringen trengs i
    // begge grener: også et kart av bare prikker må vite hvem som ligger foran.
    const projected: { poi: POI; x: number; y: number }[] = [];
    for (const poi of items) {
      const pt = projectLatLngToScreen(
        map,
        poi.coordinates.lat,
        poi.coordinates.lng,
        POI_ALTITUDE_M,
      );
      if (!pt) continue; // bak kameraet — Google tegner den ikke
      if (
        pt.x < windowLeft - OFFSCREEN_MARGIN_PX ||
        pt.x > rect.width - windowOverhangRight + OFFSCREEN_MARGIN_PX ||
        pt.y < -OFFSCREEN_MARGIN_PX ||
        pt.y > rect.height + OFFSCREEN_MARGIN_PX
      ) {
        continue;
      }
      // y løftes til skive-senter (se anchorToDiscCenterY). Full pin her;
      // demoterte prikker justeres når utglisningen er kjent.
      projected.push({ poi, x: pt.x, y: anchorToDiscCenterY(pt.y, pinHalf) });
    }

    const zIndexes = depthOrder(projected, activeId);

    // Prikk-tier: kameraet er så langt ute at ikonene uansett ikke er lesbare.
    // Alt demoteres, ingen labels — samme svar som 2D gir under zoom 13.
    if (tier === "dot") {
      const next: Marker3DDeclutter = {
        labels: {},
        demotedIds: new Set(items.map((p) => p.id)),
        zIndexes,
        // Prikk-tieren ligger langt under vekst-rampen — men vi leser den av
        // funksjonen likevel, i stedet for å hardkode 1 her.
        pinScale,
      };
      setResult((prev) => (sameResult(prev, next) ? prev : next));
      return;
    }

    // Prosjektmarkøren som hindring. Boksen er ASYMMETRISK om disc-en fordi
    // teksten bare står til høyre — `projectSitePinBlocker` eier den geometrien
    // og forklarer hvorfor.
    const blockers: PinBlocker[] = [];
    const homePt = projectLatLngToScreen(
      map,
      site.lat,
      site.lng,
      PROJECT_ALTITUDE_M,
    );
    if (homePt) {
      const box = projectSitePinBlocker(
        siteName,
        siteSubtitle,
        scaleForRange(range),
      );
      blockers.push({
        x: homePt.x + box.dx,
        y: homePt.y + box.dy,
        halfWidth: box.halfWidth,
        halfHeight: box.halfHeight,
      });
    }

    // `Infinity` = demoteres aldri, og blokkerer som vanlig. To slags steder
    // eier plassen sin: den brukeren har åpnet, og kjøpesenteret. Det siste
    // fordi ankeret ER de seksti butikkene inni — demoteres det til prikk,
    // forsvinner hele klyngen som ett navnløst punkt, og «Sirkus Shopping»
    // står ikke lenger noe sted på kartet.
    const priorityOf = (poi: POI) =>
      poi.id === activeId || isAnchorPOI(poi)
        ? Number.POSITIVE_INFINITY
        : (poi.googleRating ?? 0);

    const pinCandidates: PinCandidate[] = projected.map(({ poi, x, y }) => ({
      id: poi.id,
      x,
      y,
      priority: priorityOf(poi),
    }));
    const demotedIds = computePinDemotions(pinCandidates, blockers);

    const labels: Record<string, LabelPlacement> = {};
    if (tier === "icon+label") {
      const candidates: LabelCandidate[] = [];
      const obstacles: LabelObstacle[] = [];
      for (const { poi, x, y } of projected) {
        const isDemoted = demotedIds.has(poi.id);
        // Markørene tegnes alltid — tekst under en nabo-pin er like uleselig
        // som tekst under tekst. Demoterte teller som den lille prikken de er,
        // og prikkas senter ligger høyere enn pinnens (samme anker, lavere SVG).
        obstacles.push({
          x,
          y: isDemoted ? y + pinHalf - dotHalf : y,
          halfSize: isDemoted ? dotHalf : pinHalf,
        });
        // En prikk bærer ikke navn: navnet ville pekt på noe som ikke lenger
        // ser ut som et sted.
        if (isDemoted) continue;
        candidates.push({
          id: poi.id,
          x,
          y,
          name: poi.name,
          priority: priorityOf(poi),
        });
      }
      for (const b of blockers) {
        obstacles.push({
          x: b.x,
          y: b.y,
          halfSize: 0,
          halfWidth: b.halfWidth,
          halfHeight: b.halfHeight,
        });
      }
      const placements = computeLabelPlacements(
        candidates,
        obstacles,
        { width: rect.width },
        { offsetX: LABEL_OFFSET_3D * pinScale, scale: pinScale },
      );
      for (const { poi } of projected) {
        const side = placements.get(poi.id);
        if (!side) continue;
        if (hideActiveLabel && poi.id === activeId) continue;
        labels[poi.id] = { text: poi.name, side };
      }
    }

    const next: Marker3DDeclutter = { labels, demotedIds, zIndexes, pinScale };
    setResult((prev) => (sameResult(prev, next) ? prev : next));
  }, [map3d]);

  const recomputeRef = useRef(recompute);
  recomputeRef.current = recompute;

  // Ro-signalet. `gmp-camerapositionchange` er ren kamera-telemetri og fyrer
  // per frame under bevegelse; `gmp-steadychange` er scenens ferdig-signal og
  // er her ANKOMSTEN — den er ofte det første øyeblikket kamera-feltene i det
  // hele tatt er lesbare. Begge nullstiller samme trailing timer.
  useEffect(() => {
    if (!map3d || !enabled) return;
    const el = map3d as HTMLElement;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        recomputeRef.current();
      }, CAMERA_SETTLE_MS);
    };
    el.addEventListener("gmp-camerapositionchange", schedule);
    el.addEventListener("gmp-steadychange", schedule);
    schedule();
    return () => {
      el.removeEventListener("gmp-camerapositionchange", schedule);
      el.removeEventListener("gmp-steadychange", schedule);
      if (timer !== null) clearTimeout(timer);
    };
  }, [map3d, enabled]);

  // Stabil nøkkel for markørsettet — identitet holder ikke, `markerPOIs`
  // memoiseres på oppstrøms-deps og kan være en ny array med samme innhold.
  const poisKey = useMemo(() => pois.map((p) => p.id).join(","), [pois]);

  // Datasett-timeren. Egen fra kamera-timeren, se doc-blokken.
  useEffect(() => {
    if (!map3d || !enabled) return;
    const timer = setTimeout(() => recomputeRef.current(), DATA_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [map3d, enabled, poisKey, activePOIId, suppressActiveLabel]);

  // Slås hooken av (compact-markører, capture, intro) skal ingen plassering bli
  // stående og gjelde for et markørsett den ikke lenger beskriver.
  useEffect(() => {
    if (enabled) return;
    setResult((prev) => (sameResult(prev, EMPTY) ? prev : EMPTY));
  }, [enabled]);

  return result;
}
