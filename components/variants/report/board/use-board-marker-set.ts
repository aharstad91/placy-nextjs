import { useMemo } from "react";
import type { POI } from "@/lib/types";
import type { RevealItem } from "@/components/map/RevealLayer3D";
import { getDistanceMeters } from "@/lib/map-utils";
import {
  computeSpreadRadiusM,
  orbitRangeForSpread,
  ORBIT_RANGE,
} from "./board-3d-camera-director";
import { selectBlobPOIs, selectFlyoverBlobs } from "./blob-pois";
import { toDisplayPOI } from "./board-data";
import type { BoardCategory, BoardData } from "./board-data";
import type { BoardPhase } from "./board-state";
import type { EstablishingPathConfig } from "./board-establishing-flythrough";

/**
 * Markørsett-seleksjon for det 3D-baserte board-kartet (ekstrahert fra
 * `BoardMap3D` i Unit 06.7). Ren selektor-logikk + en tynn hook som memoiserer
 * den med identiske dependency-arrays som originalen.
 *
 * Render-nivå-pin-drop for `?film=1`/`?fly=1`/establishing (`markerPOIs → []`)
 * bor her som en REN beslutning — pins fjernes ALDRI via DOM utenfra
 * (removeChild-race på en node React fortsatt eier).
 */

/** Antall «blob»-prikker (nærmeste POI-er) som tegnes inn under velkommen-
 *  flyover-en. Mange små farge-prikker formidler bredden i nabolaget («se hvor
 *  mye som ligger rundt deg»); kaskaden komprimeres adaptivt så alle rekker inn
 *  innenfor velkommen-beaten (se RevealLayer3D). Slice-es mot antall tilgjengelige
 *  POI-er, så et høyt tall ≈ «hele nabolaget». */
const BLOB_LIMIT = 120;

/** Establishing-droneturen (rett linje): hvor nær flylinja en POI må ligge for å
 *  tegnes inn som sirkelpunkt (meter til siden for ruta), og maks antall. Bred nok
 *  korridor til å føles rikt, men fortsatt «nær flyvningen». */
const FLYOVER_CORRIDOR_M = 750;
const FLYOVER_BLOB_LIMIT = 160;

/** Antall vanlige «legend»-pins per kategori på velkommen + oppsummering: de
 *  NÆRMESTE POI-ene per kategori vises med ikon + farge, som et lesbart holdepunkt
 *  for hva blob-prikkene representerer. Nærmeste (pois er distanse-sortert) så
 *  legend-pinnene ligger i blob-klyngen, ikke langt unna. */
const LEGEND_PER_CATEGORY = 3;

/**
 * Har prosjektet voice-over (reels-lyd)? Da finnes en guidet tur som driller
 * inn per kategori, og overblikket holdes rent med et kuratert anker-sett
 * (top-3 score-rangert per kategori, ~18–21 stk). UTEN voice-over finnes ingen
 * tur å drille med, så hele nabolaget vises samtidig (alle POI-er) — kartet
 * blir da selve verdien i overblikks-state.
 *
 * Data-drevet (VO-innhold finnes), IKKE tier-gating (PRD 6 §9 Beslutning #5).
 * Speiler `pickPlayableAudio`-seleksjonen, ikke `reportTier`.
 */
export function computeHasVoiceOver(data: BoardData): boolean {
  return (
    data.categories.some((c) => !!c.audio || !!c.reelsAudio) ||
    !!data.welcome ||
    !!data.home.audio ||
    !!data.outro
  );
}

/**
 * Oversikts-sett. Brukes når ingen kategori spiller (intro/home/outro/megler).
 * Med voice-over: kuratert ankersett (top-3 score-rangert per kategori, ~18–21
 * stk, IKKE distanse-sortert). Uten voice-over: hele nabolaget. Kategoriene er
 * disjunkte, så ingen duplikater.
 */
export function selectOverviewPOIs(
  categories: BoardCategory[],
  hasVoiceOver: boolean,
): POI[] {
  return hasVoiceOver
    ? categories.flatMap((c) => c.topRankedPois.slice(0, 3).map(toDisplayPOI))
    : categories.flatMap((c) => c.pois.map(toDisplayPOI));
}

/**
 * Hele nabolaget: alle POI-er på tvers av kategoriene, deduplikert (samme sted
 * kan ligge i flere kategorier — beholder første forekomst). Brukt på Nabolaget-
 * beaten (isHomeBeat) så kartet viser ALT vi har, ikke bare ankersettet.
 */
export function selectAllPOIs(categories: BoardCategory[]): POI[] {
  const seen = new Set<string>();
  const result: POI[] = [];
  for (const c of categories) {
    for (const p of c.pois) {
      if (seen.has(p.raw.id)) continue;
      seen.add(p.raw.id);
      result.push(toDisplayPOI(p));
    }
  }
  return result;
}

/**
 * Legend-pins: nærmeste POI per kategori (pois er distanse-sortert → [0] er
 * nærmest). Vises som vanlige pins (ikon + farge) på velkommen + oppsummering
 * så blob-prikkene får et lesbart holdepunkt. Ligger i blob-klyngen nær hjemmet.
 */
export function selectLegendPOIs(categories: BoardCategory[]): POI[] {
  return categories.flatMap((c) =>
    c.pois.slice(0, LEGEND_PER_CATEGORY).map(toDisplayPOI),
  );
}

export interface MarkerSelectionInput {
  filmMode: boolean;
  flyMode: boolean;
  establishingMode: boolean;
  activeCategory: BoardCategory | null;
  statePhase: BoardPhase;
  hiddenIds: Set<string>;
  isWelcomeBeat: boolean;
  isHomeBeat: boolean;
  isOutroBeat: boolean;
  basicIntroActive: boolean;
  hasVoiceOver: boolean;
  overviewPOIs: POI[];
  allPOIs: POI[];
}

/**
 * Markørsettet som faktisk mountes. Når en kategori spiller: kun den kategoriens
 * POI-er (sub-filtrert). Ellers: det kuraterte ankersettet. Capture/establishing
 * gir et helt rent kart (`[]`) — reveal-kaskaden eier markørene da.
 */
export function selectMarkerPOIs(input: MarkerSelectionInput): POI[] {
  const {
    filmMode,
    flyMode,
    establishingMode,
    activeCategory,
    statePhase,
    hiddenIds,
    isWelcomeBeat,
    isHomeBeat,
    isOutroBeat,
    basicIntroActive,
    hasVoiceOver,
    overviewPOIs,
    allPOIs,
  } = input;
  // Capture (?film=1 / ?fly=1) + establishing-shot: helt rent kart, ingen
  // statiske pins (reveal-kaskaden eier markørene under establishing).
  if (filmMode || flyMode || establishingMode) return [];
  // Kategori-valg vinner alltid (også hvis et reveal-vindu fortsatt teller ned).
  if (activeCategory) {
    const useFilter = statePhase !== "default" && hiddenIds.size > 0;
    const result: POI[] = [];
    for (const p of activeCategory.pois) {
      if (useFilter && hiddenIds.has(p.raw.category.id)) continue;
      result.push(toDisplayPOI(p));
    }
    return result;
  }
  // Velkommen-beat (audio): reveal-kaskaden eier markørene → ingen statiske.
  if (isWelcomeBeat) return [];
  // Nabolaget + Oppsummering → hele nabolaget (alle POI, fulle markører).
  if (isHomeBeat || isOutroBeat) return allPOIs;
  // Basic-tier (uten voice-over): markør-koreografi gated på OM intro-en
  // faktisk kjører NÅ (basicIntroActive) — ikke på den lokale introFlyPhase.
  // MENS basic-intro-en flyr holdes kartet rent (reveal-kaskaden eier markørene
  // og tegner dem inn under "running"). Når intro-en IKKE er aktiv — ferdig,
  // AVBRUTT ved navigasjon (klikk på kategori/"Hele nabolaget" midt i flyturen),
  // eller aldri kjørt — vises HELE overblikket umiddelbart som vanlige markører,
  // uten noen intro. (Den gamle `introFlyPhase === "done"`-gaten etterlot kartet
  // tomt + reveal-kaskaden hengende hvis en avbrutt fly frøs fasen på "running".)
  if (!hasVoiceOver) {
    return basicIntroActive ? [] : overviewPOIs;
  }
  // Audio-tier idle / megler → ankersettet.
  return overviewPOIs;
}

export interface RevealSelectionInput {
  establishingMode: boolean;
  establishingShot: EstablishingPathConfig | undefined;
  home: { lat: number; lng: number };
  categories: BoardCategory[];
  legendPOIs: POI[];
  legendIds: Set<string>;
}

/**
 * Reveal-sett (velkommen + oppsummering): legend-pins (nærmeste per kategori,
 * vist som fulle pins) + blobs (de nærmeste POI-ene som farge-prikker, legend
 * ekskludert så vi ikke får prikk-under-ikon). Slått sammen og DISTANSE-sortert
 * (nærmest først) så pins og prikker animeres inn på lik linje i én kaskade.
 */
export function selectRevealItems(input: RevealSelectionInput): RevealItem[] {
  const { establishingMode, establishingShot, home, categories, legendPOIs, legendIds } =
    input;
  // Establishing-dronetur (rett linje): sirkelpunktene nær flylinja, sortert i
  // FLY-OVER-orden (`at` = posisjon langs linja). RevealLayer3D positional-modus
  // tegner dem inn i takt med at kameraet passerer dem. Ingen legend-pins her —
  // ren strøm av små sirkelpunkter, som Andreas ba om.
  if (establishingMode && establishingShot) {
    const wps = establishingShot.waypoints;
    const start = wps[0];
    const end = wps[wps.length - 1];
    return selectFlyoverBlobs(
      start,
      end,
      categories,
      FLYOVER_CORRIDOR_M,
      FLYOVER_BLOB_LIMIT,
    ).map((f) => ({ kind: "blob" as const, poi: f.poi, at: f.at }));
  }
  const blobs = selectBlobPOIs(home, categories, BLOB_LIMIT, legendIds);
  const items: { item: RevealItem; dist: number }[] = [
    ...legendPOIs.map((poi) => ({
      item: { kind: "pin" as const, poi },
      dist: getDistanceMeters(home, poi.coordinates),
    })),
    ...blobs.map((poi) => ({
      item: { kind: "blob" as const, poi },
      dist: getDistanceMeters(home, poi.coordinates),
    })),
  ];
  items.sort((a, b) => a.dist - b.dist);
  return items.map((i) => i.item);
}

export interface UseBoardMarkerSetParams {
  data: BoardData;
  statePhase: BoardPhase;
  hiddenIds: Set<string>;
  activeCategory: BoardCategory | null;
  filmMode: boolean;
  flyMode: boolean;
  establishingMode: boolean;
  establishingShot: EstablishingPathConfig | undefined;
  isWelcomeBeat: boolean;
  isHomeBeat: boolean;
  isOutroBeat: boolean;
  basicIntroActive: boolean;
}

export interface BoardMarkerSet {
  markerPOIs: POI[];
  revealItems: RevealItem[];
  revealWindowMs: number | undefined;
  hasVoiceOver: boolean;
  orbitRange: number;
}

/**
 * Hook: memoiserer markørsett-seleksjonen for `BoardMap3D`. Eksponerer også
 * `hasVoiceOver` + `orbitRange` så orchestratoren kan mate dem inn i
 * kamera-directoren (autoOrbit + hvile-range) OG flythrough-en (basic-intro
 * lander på orbitRange) — det samme `hasVoiceOver`-signalet styrer BÅDE
 * markørsettet OG autoOrbit (data-drevet, ikke tier — PRD 6 §9 #5).
 */
export function useBoardMarkerSet({
  data,
  statePhase,
  hiddenIds,
  activeCategory,
  filmMode,
  flyMode,
  establishingMode,
  establishingShot,
  isWelcomeBeat,
  isHomeBeat,
  isOutroBeat,
  basicIntroActive,
}: UseBoardMarkerSetParams): BoardMarkerSet {
  const hasVoiceOver = useMemo(
    () => computeHasVoiceOver(data),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identiske deps som originalen
    [data.categories, data.welcome, data.home.audio, data.outro],
  );

  const overviewPOIs = useMemo(
    () => selectOverviewPOIs(data.categories, hasVoiceOver),
    [data.categories, hasVoiceOver],
  );

  const allPOIs = useMemo<POI[]>(
    () => selectAllPOIs(data.categories),
    [data.categories],
  );

  // Nabolags-spredning → hvile-/intro-range. Måler hvor spredt punktene faktisk
  // ligger rundt objektet og skalerer zoom-en deretter: få spredte punkter
  // (forstad) → trekk kameraet ut, mange tette (urbant) → zoom inn. Kun i basic-
  // tier (uten voice-over); voice-over-prosjekter beholder den tunede 650-orbiten.
  const spreadRadiusM = useMemo(
    () =>
      computeSpreadRadiusM(
        data.home.coordinates,
        allPOIs.map((p) => p.coordinates),
      ),
    [data.home.coordinates, allPOIs],
  );
  const orbitRange = useMemo(
    () => (hasVoiceOver ? ORBIT_RANGE : orbitRangeForSpread(spreadRadiusM)),
    [hasVoiceOver, spreadRadiusM],
  );

  const legendPOIs = useMemo<POI[]>(
    () => selectLegendPOIs(data.categories),
    [data.categories],
  );
  const legendIds = useMemo(
    () => new Set(legendPOIs.map((p) => p.id)),
    [legendPOIs],
  );

  const markerPOIs = useMemo<POI[]>(
    () =>
      selectMarkerPOIs({
        filmMode,
        flyMode,
        establishingMode,
        activeCategory,
        statePhase,
        hiddenIds,
        isWelcomeBeat,
        isHomeBeat,
        isOutroBeat,
        basicIntroActive,
        hasVoiceOver,
        overviewPOIs,
        allPOIs,
      }),
    [
      filmMode,
      flyMode,
      establishingMode,
      isWelcomeBeat,
      isOutroBeat,
      basicIntroActive,
      hasVoiceOver,
      activeCategory,
      statePhase,
      hiddenIds,
      overviewPOIs,
      isHomeBeat,
      allPOIs,
    ],
  );

  const revealItems = useMemo<RevealItem[]>(
    () =>
      selectRevealItems({
        establishingMode,
        establishingShot,
        home: data.home.coordinates,
        categories: data.categories,
        legendPOIs,
        legendIds,
      }),
    [
      establishingMode,
      establishingShot,
      data.home.coordinates,
      data.categories,
      legendPOIs,
      legendIds,
    ],
  );

  // Establishing-kaskaden spenner over (nesten) hele flyturen så sirkelpunktene
  // tegnes inn i takt med kryssingen — ikke i et komprimert «poff» på starten.
  const revealWindowMs = useMemo(
    () =>
      establishingMode && establishingShot
        ? Math.round(establishingShot.durationMs * 0.9)
        : undefined,
    [establishingMode, establishingShot],
  );

  return { markerPOIs, revealItems, revealWindowMs, hasVoiceOver, orbitRange };
}
