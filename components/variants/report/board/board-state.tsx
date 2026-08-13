"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { BoardCategoryId, BoardPOIId, BoardData } from "./board-data";
import { findBoardCategoryOf, findBoardPOI } from "./board-data";
import type {
  MapCameraApi,
  VisibleIdsSource,
  ViewportRect,
} from "@/lib/board/board-types";
import { intersectVisible } from "@/lib/event-board/marker-visibility";
import {
  useSubCategoryFilter,
  type SubCategoryFilterApi,
} from "./use-sub-category-filter";

export type BoardPhase = "default" | "active" | "poi";

export interface BoardState {
  phase: BoardPhase;
  activeCategoryId: BoardCategoryId | null;
  activePOIId: BoardPOIId | null;
  /**
   * Basic-tier (uten voice-over): den auto-genererte intro-flythrough-en kjører
   * nå og EIER kameraet. Settes av «Utforsk nabolaget»-klikket (ingen welcome-
   * beat å henge den på når prosjektet mangler reels-lyd), og nullstilles når
   * flyturen lander (END_INTRO) eller brukeren navigerer (kategori/POI/reset).
   */
  introPlaying: boolean;
}

/**
 * Source-discriminator (Unit 0 spike, full version in Unit 2): identifies *who*
 * triggered the dispatch so subscribers can avoid feedback loops. For the spike,
 * "scroll", "rail", "index", and "audio" sources keep `phase: "default"`
 * (continuous-scroll narrative — audio playback should drive the scroll-panel,
 * not open legacy BoardDetailPanel). Omitted source retains the legacy
 * "active" transition for mobile and any unmigrated callers.
 *
 * ÅPENT Q7 (r05.3): diskriminatoren er selv-deklarert spike-arv
 * (CARRY-OVER-MANIFEST.md:254 «kan forenkles»), MEN den bærer en live
 * feedback-loop-guard som PRD 9 avhenger av — portet VERBATIM, IKKE forenklet.
 * Eventuell forenkling avklares i Q7, ikke her.
 */
export type SelectCategorySource = "scroll" | "rail" | "index" | "audio";

export type BoardAction =
  | { type: "SELECT_CATEGORY"; id: BoardCategoryId; source?: SelectCategorySource }
  | { type: "OPEN_POI"; id: BoardPOIId; categoryId?: BoardCategoryId }
  | { type: "BACK_TO_ACTIVE" }
  | { type: "BACK_TO_DEFAULT" }
  | { type: "RESET_TO_DEFAULT" }
  | { type: "START_INTRO" }
  | { type: "END_INTRO" };

export const initialBoardState: BoardState = {
  phase: "default",
  activeCategoryId: null,
  activePOIId: null,
  introPlaying: false,
};

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "SELECT_CATEGORY": {
      // Spike: scroll-tracking, rail clicks, and audio-tour-sync stay in
      // "default" phase so BoardScrollPanel keeps rendering. Only legacy
      // callers without an explicit source (mobile category-grid) trigger
      // the "active" transition.
      const stayInDefault =
        action.source === "scroll" ||
        action.source === "rail" ||
        action.source === "index" ||
        action.source === "audio";
      return {
        phase: stayInDefault ? "default" : "active",
        activeCategoryId: action.id,
        activePOIId: null,
        // Navigasjon avbryter en pågående basic-intro (brukeren tok over).
        introPlaying: false,
      };
    }

    // Åpner et punkt. Actionen EIER IKKE kategorien (2026-08-13): et markørklikk
    // skal bare vise stedet, ikke filtrere kartet og bytte sidebar-innhold på én
    // gest. `categoryId` beholdes som valgfritt felt for kallesteder som bevisst
    // etablerer kategori-kontekst (event-panelets liste, «Verdt å merke seg»),
    // men kategorien nullstilles ALDRI — nivå-2-panelet en highlight-chip ble
    // klikket fra ville da lukket seg under brukeren.
    case "OPEN_POI":
      return {
        phase: "poi",
        activeCategoryId: action.categoryId ?? state.activeCategoryId,
        activePOIId: action.id,
        introPlaying: false,
      };

    case "BACK_TO_ACTIVE":
      if (!state.activeCategoryId) {
        return initialBoardState;
      }
      return {
        ...state,
        phase: "active",
        activePOIId: null,
      };

    case "BACK_TO_DEFAULT":
      // Lukke POI-overlay: tilbake til scroll-narrativ-fasen men behold
      // activeCategoryId så scroll-posisjon og audio-tour-state forblir
      // konsistent. activePOIId nullstilles fordi POI-overlay er borte.
      return {
        ...state,
        phase: "default",
        activePOIId: null,
      };

    case "RESET_TO_DEFAULT":
      return initialBoardState;

    case "START_INTRO":
      return { ...state, introPlaying: true };

    case "END_INTRO":
      return { ...state, introPlaying: false };

    default:
      return state;
  }
}

interface BoardContextValue {
  state: BoardState;
  dispatch: Dispatch<BoardAction>;
  data: BoardData;
  subFilter: SubCategoryFilterApi;
  /**
   * Event-board markør-filter-søm (Unit 4): POI-IDer som er synlige etter
   * tema/dag/tid-filtrering. Når satt intersekter `BoardMap` den inn i
   * markør-synligheten (∩ `markerStates.visibleIds`) og kamera-fitter på det
   * filtrerte settet. `undefined` (boligrapport / event uten aktivt filter)
   * → ingen markør-begrensning, ren phase-/kategori-drevet synlighet som før.
   *
   * Holdes som container-nivå state (ikke en reducer-action): filteret er
   * derivert fra Zustand-kompass-state + raw-POIene, ikke en del av board-ets
   * navigasjons-state. Reduseren forblir uendret.
   *
   * Fra og med den mobile nabolagsflaten har settet TO mulige kilder — se
   * `visibleIdsSource`, som avgjør om kameraet får fitte på det.
   */
  visiblePoiIds?: Set<string>;
  /**
   * HVOR `visiblePoiIds` kommer fra. `null` når intet sett er aktivt.
   * `"viewport-scope"` vinner alltid når nabolagsflaten scoper, også hvis et
   * event-filter skulle være aktivt samtidig — kamera-fitten må aldri fyre på
   * et sett som er avledet av kameraet selv (se `shouldFitToFilter`).
   */
  visibleIdsSource: VisibleIdsSource | null;
  /**
   * Nabolagsflaten (mobil, boards uten VO): POI-IDene som ligger i det
   * ikke-okkluderte kartutsnittet. `null` = ingen viewport-scoping (desktop,
   * event, VO-flate — og degraderings-tilstanden «kartet kunne ikke leses, vis
   * alt»).
   *
   * Setteren finnes fordi kanalen går NEDENFRA OG OPP: sheeten som utleder
   * settet lever inne i provideren, mens `visiblePoiIds`-propen settes av
   * `ReportReelsPage` utenfor. Provider-lokal state er den eneste veien fra
   * subtreet til markør-synligheten uten å tre state gjennom `ResponsiveLayout`.
   */
  setViewportPoiIds: (ids: Set<string> | null) => void;
  /**
   * Sist publiserte ikke-okkluderte kart-rektangel, eller `null` når kartet
   * ikke publiserer (eller ennå ikke har lastet). Skrives av `BoardMap` ved
   * brukerinitiert gest-slipp og ved endret sheet-høyde; leses av
   * nabolagslista. `null` betyr «ingen scoping» → vis alt, ALDRI tom liste.
   */
  viewportRect: ViewportRect | null;
  /**
   * Se `viewportRect`. Verdi-deduplisert, så identiske rektangler er no-op.
   * `meta.userGesture` skiller en panorering/zoom fra en re-publisering utløst
   * av layout — se `viewportGestures`.
   */
  setViewportRect: (
    rect: ViewportRect | null,
    meta?: { userGesture?: boolean },
  ) => void;
  /**
   * Antall brukerinitierte KART-gester siden montering. Teller opp ved hver
   * gest-slipp, også når utsnittet endte der det startet.
   *
   * Finnes fordi rektangelet ikke kan svare på spørsmålet «har brukeren tatt i
   * kartet?». `map.setPadding()` re-sentrerer kameraet i det paddede området,
   * så når sheeten flyttes endres BÅDE `south` og `north` — en rektangel-diff
   * leser altså et sheet-drag som en panorering. Kilden må derfor følge med
   * verdien, ikke utledes av den.
   */
  viewportGestures: number;
  /**
   * Kamera-handlingene den monterte kart-motoren tilbyr. `null` når ingen motor
   * har registrert seg (desktop, event, VO-flaten — de trenger dem ikke).
   * Registreres av `BoardMap`; brukes av kategorisidens push/tilbake, som må
   * lagre og gjenopprette utsnittet eksakt (R18).
   */
  mapCamera: MapCameraApi | null;
  /** Se `mapCamera`. Kalles av kart-motoren ved mount/unmount. */
  setMapCamera: (api: MapCameraApi | null) => void;
  /**
   * Event-board "Min samling"-søm (Unit 5): POI-IDer brukeren har lagret i sin
   * samling (eller som er rehydrert fra en delt `?c=`-lenke). Når satt highlighter
   * `BoardMarker` disse med en egen "collection"-ring så de skiller seg ut på
   * kartet — uavhengig av `visiblePoiIds` (et lagret event er fortsatt highlightet
   * når et tema/dag/tid-filter er aktivt). `undefined` (boligrapport) → ingen
   * collection-highlight. Container-nivå state, derivert fra `collection-store`.
   */
  collectionPoiIds?: Set<string>;
}

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
  data,
  visiblePoiIds,
  collectionPoiIds,
  children,
}: {
  data: BoardData;
  /** Se `BoardContextValue.visiblePoiIds`. */
  visiblePoiIds?: Set<string>;
  /** Se `BoardContextValue.collectionPoiIds`. */
  collectionPoiIds?: Set<string>;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(boardReducer, initialBoardState);
  const subFilter = useSubCategoryFilter(state.activeCategoryId);

  // ---- Viewport-scoping (mobil nabolagsflate) ----
  // Provider-lokal state fordi kanalen går nedenfra og opp: BoardMap publiserer
  // rektangelet, sheeten utleder POI-settet, og BoardMap leser settet tilbake
  // som markør-filter. Alle tre lever i dette subtreet.
  const [viewportRect, setViewportRectState] = useState<ViewportRect | null>(null);
  const [viewportPoiIds, setViewportPoiIds] = useState<Set<string> | null>(null);
  const [mapCamera, setMapCamera] = useState<MapCameraApi | null>(null);
  const [viewportGestures, setViewportGestures] = useState(0);

  // Verdi-dedup: kartet republiserer ved hver gest-slipp, og et identisk
  // rektangel skal ikke re-rendre subtreet (sheeten re-rendrer i gest-frekvens
  // — ingenting på kart-stien tåler unødig arbeid). Gest-telleren står UTENFOR
  // dedupen: en panorering som endte der den startet er fortsatt en gest.
  const setViewportRect = useCallback((
    rect: ViewportRect | null,
    meta?: { userGesture?: boolean },
  ) => {
    if (meta?.userGesture) setViewportGestures((n) => n + 1);
    setViewportRectState((prev) => {
      if (prev === rect) return prev;
      if (
        prev &&
        rect &&
        prev.west === rect.west &&
        prev.south === rect.south &&
        prev.east === rect.east &&
        prev.north === rect.north
      ) {
        return prev;
      }
      return rect;
    });
  }, []);

  // Komponering av de to kildene. Viewport-scopet vinner diskriminatoren når
  // det er satt — selv om et event-filter også skulle være aktivt — fordi
  // kamera-fitten aldri må fyre på et kamera-avledet sett. Settene selv
  // komponerer som snitt (en markør må passere begge).
  const { effectiveVisiblePoiIds, visibleIdsSource } = useMemo(() => {
    if (!viewportPoiIds) {
      return {
        effectiveVisiblePoiIds: visiblePoiIds,
        visibleIdsSource: (visiblePoiIds ? "event-filter" : null) as
          | VisibleIdsSource
          | null,
      };
    }
    return {
      effectiveVisiblePoiIds: intersectVisible(viewportPoiIds, visiblePoiIds),
      visibleIdsSource: "viewport-scope" as VisibleIdsSource,
    };
  }, [viewportPoiIds, visiblePoiIds]);

  // Skjuler brukeren sub-kategorien den åpne POI-en tilhører, lukkes POI-en.
  // Gaten står på `hiddenIds`, ikke på `activeCategoryId`: et markørklikk kan nå
  // åpne et punkt uten å velge kategori (2026-08-13), og sub-filteret er tomt så
  // lenge ingen kategori er aktiv — da er dette en no-op av seg selv.
  useEffect(() => {
    if (!state.activePOIId || subFilter.hiddenIds.size === 0) return;
    const poi = findBoardPOI(data.categories, state.activePOIId);
    if (!poi) return;
    if (subFilter.hiddenIds.has(poi.raw.category.id)) {
      dispatch({ type: "BACK_TO_ACTIVE" });
    }
  }, [subFilter.hiddenIds, state.activePOIId, data.categories]);

  return (
    <BoardContext.Provider
      value={{
        state,
        dispatch,
        data,
        subFilter,
        visiblePoiIds: effectiveVisiblePoiIds,
        visibleIdsSource,
        setViewportPoiIds,
        viewportRect,
        setViewportRect,
        viewportGestures,
        mapCamera,
        setMapCamera,
        collectionPoiIds,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}

export function useBoard() {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard må brukes inne i en BoardProvider");
  }
  return ctx;
}

export function useActiveCategory() {
  const { state, data } = useBoard();
  if (!state.activeCategoryId) return null;
  return data.categories.find((c) => c.id === state.activeCategoryId) ?? null;
}

/**
 * Board-versjonen av useActivePOI (r05.3). MERK navnekollisjon: dette er DISTINKT
 * fra Explorer-storens `useActivePOI` (lib/store.ts:46) — board-laget driver POI-
 * seleksjon via denne Context-reduceren, ikke Explorer-Zustand-storen. Importer
 * fra board-state, ikke @/lib/store, i board-komponenter.
 *
 * Oppslaget går på tvers av alle kategorier, IKKE inne i den aktive. Et
 * markørklikk skal kunne åpne et punkt uten å velge kategorien det ligger i
 * (2026-08-13), og den gamle derivasjonen via `useActiveCategory()` returnerte
 * da null — hvorpå popup, rutelinje, label og 3D-kamerafly forsvant stille.
 */
export function useActivePOI() {
  const { state, data } = useBoard();
  return findBoardPOI(data.categories, state.activePOIId);
}

/** Kategorien den aktive POI-en hører til — uavhengig av `activeCategoryId`.
 *  Gir presentasjonen (rutelinjens farge) kategori-identitet uten å kreve at
 *  kategorien er valgt. */
export function useActivePOICategory() {
  const { data } = useBoard();
  const poi = useActivePOI();
  return findBoardCategoryOf(data.categories, poi);
}

export function useFilteredActiveCategory() {
  const cat = useActiveCategory();
  const { subFilter } = useBoard();
  if (!cat) return null;
  if (subFilter.hiddenIds.size === 0) return cat;
  return {
    ...cat,
    pois: cat.pois.filter((p) => !subFilter.hiddenIds.has(p.raw.category.id)),
  };
}
