"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useEngagement } from "@/lib/instrumentation/engagement-scope";
import type { BoardCategory, BoardPOI, BoardPOIId } from "../board-data";
import { useBoard } from "../board-state";
import { storyEmphasis, storyPicks, type StoryEmphasis } from "./story-model";

/**
 * Omvisningens tilstand — «meglerens utvalg som guidet rekkefølge».
 *
 * Portert fra prototypen `04-fortelling-i-boardet` (2026-08-26). Modellen bor i
 * `story-model.ts` (rent, testbart); her ligger tilstanden, kamerabevegelsene og
 * broen til board-reduceren.
 *
 * ## Hvorfor en egen provider og ikke lokal state i flaten
 *
 * Omvisningen eier tre ting som lever i ULIKE subtrær: innholdsflaten (sheeten
 * på mobil, sidekolonnen på desktop), kameraet (`mapCamera` på BoardContext) og
 * markørenes vekt (`BoardMap`). Lokal state i flaten kunne ikke nådd de to
 * siste. Provideren ligger derfor rundt hele board-treet.
 *
 * ## Hvorfor den ikke setter `activeCategoryId`
 *
 * Et stopp ER en kategori, så det ligger nær å velge den. Men `markerStates`
 * snevrer da markørsettet inn til kategorien, og resten av nabolaget forsvinner.
 * Omvisningen vil ha det motsatte: tre nivåer samtidig (se `storyEmphasis`) —
 * de tre navngitte stedene bærer scenen, kategorien rundt viser at dekningen
 * finnes, og resten ligger igjen som tekstur. Vekten går derfor gjennom
 * `emphasisOf`, aldri gjennom kategori-valget.
 */

/** Stoppets tre svarformer. Spørsmålet står OVER dem: stoppet ER spørsmålet, og
 *  fanene er de tre måtene det besvares — i ord, i steder, i spørsmål og svar. */
export type StoryPane = "about" | "places" | "faq";

/** Trykk på et sted gjør to ting: teksten åpner seg og kartet flyr dit. Skjer de
 *  samtidig, konkurrerer de om samme blikk. Teksten er det fingeren tok på, så
 *  den går først — kartet følger etter når bevegelsen i flaten er ferdig. */
const CAMERA_DELAY_MS = 420;

/** Kameraet ut igjen ved «Avslutt»: hele nabolaget, som når boardet åpnes. */
const EXIT_ZOOM = 14.4;

/**
 * Områdets plass i rekkefølgen: FØR første kategori.
 *
 * −1 og ikke 0, fordi `stops` fortsatt ER kategoriene. Området er ikke en
 * kategori — det er stedet kategoriene ligger i — og alt som leser `stop` skal
 * få `null` der, ikke et syntetisk tema med tomme lister. Med en slik attrapp
 * ville kartets vekting dempet hele nabolaget til tekstur og 3D-kameraet rammet
 * inn ingenting.
 */
export const AREA_STEP = -1;

interface StoryTourApi {
  /** Boardet har stopp å vise. false → ingen play-knapp, ingen omvisning. */
  available: boolean;
  /** Omvisningen kjører. */
  on: boolean;
  /** Stoppene i rekkefølge — én per kategori. Området er IKKE med: det er
   *  `AREA_STEP`, og raden legger det først selv. */
  stops: BoardCategory[];
  /** Gjeldende stopp, eller null når omvisningen er av ELLER står på området. */
  stop: BoardCategory | null;
  /** Omvisningen står på området selv (rekkefølgens første brikke). Kartet skal
   *  da se ut som et overblikk: ingen vekting, klikkbare pinner. */
  onArea: boolean;
  step: number;
  pane: StoryPane;
  /** Stoppets tre navngitte steder (meglerens utvalg, ellers de nærmeste målte). */
  picks: BoardPOI[];
  /** IDene til de tre — stjernen i stedslista leser denne. */
  pickedIds: ReadonlySet<string>;
  /** Åpner et sted uten å kunne lukke det: brukt av stedsnavn i FAQ-svar, der
   *  et andre trykk skal vise stedet igjen, ikke skjule det. */
  showPlace: (poi: BoardPOI) => void;
  isPlaceOpen: (poiId: string) => boolean;
  /** Starter omvisningen. `at` er der den skal begynne: `AREA_STEP` når flaten
   *  ER omvisningen (desktop-kolonnen ankommer på overblikket), 0 når noen
   *  trykker play og skal inn i fortellingen. */
  begin: (at?: number) => void;
  end: () => void;
  goto: (step: number) => void;
  showPane: (pane: StoryPane) => void;
  togglePlace: (poi: BoardPOI) => void;
  /** Markørens vekt, eller null når omvisningen er av ELLER står på området
   *  (kartet er da urørt — området ER overblikket). */
  emphasisOf: (poiId: string, categoryId: string) => StoryEmphasis | null;
}

const StoryTourContext = createContext<StoryTourApi | null>(null);

export function StoryTourProvider({ children }: { children: ReactNode }) {
  const { data, state, dispatch, mapCamera } = useBoard();
  const engagement = useEngagement();
  const travelMode = state.travelMode;

  const stops = data.categories;
  const [tour, setTour] = useState<{ step: number; pane: StoryPane } | null>(
    null,
  );
  /* Åpne steder lukkes ALDRI av seg selv. Leste du to steder, skal begge kunne
     stå åpne — derfor en mengde, ikke én id. Auto-lukking var i tillegg halve
     hoppingen i flaten: hvert trykk lukket ett felt og åpnet et annet, så
     flaten både krympet og vokste i samme bevegelse.

     FAQ-svarene har ingen tilsvarende mengde her: `FAQSection` eier sin egen
     åpne-tilstand, og provideren bar lenge et parallelt `openFaqIds` som ingen
     leste (slettet 2026-08-27). */
  const [openPoiIds, setOpenPoiIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const on = tour !== null;
  const step = tour?.step ?? 0;
  const pane = tour?.pane ?? "about";
  const onArea = on && step === AREA_STEP;
  const stop = on && !onArea ? (stops[step] ?? null) : null;

  const picks = useMemo(
    () => (stop ? storyPicks(stop, travelMode) : []),
    [stop, travelMode],
  );
  const pickedIds = useMemo(
    () => new Set(picks.map((p) => String(p.id))),
    [picks],
  );

  // ---- kamera ----
  const cameraRef = useRef(mapCamera);
  cameraRef.current = mapCamera;
  const flyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelFly = useCallback(() => {
    if (flyTimerRef.current !== null) clearTimeout(flyTimerRef.current);
    flyTimerRef.current = null;
  }, []);
  useEffect(() => cancelFly, [cancelFly]);

  /**
   * Rammen legges rundt boligen + stoppets tre steder, ikke rundt hele
   * kategorien: da er de navngitte punktene lesbare, mens de øvrige ligger
   * rundt som dempet tekstur.
   *
   * Fyrer én gang per stopp, og én gang når du kommer TILBAKE fra stedsfanen.
   * Stedsfanen rammer nemlig ikke inn noe: lista der ER kartutsnittet, så et
   * kamera som strammer seg inn idet fanen åpnes bestemmer sitt eget innhold —
   * rammen om de tre ville etterlatt en liste på tre steder, og sett ut som om
   * kategorien ikke hadde mer.
   */
  const frameKeyRef = useRef<string | null>(null);
  const frameKey = on
    ? `${step}:${pane === "places" ? "list" : "story"}`
    : null;
  const homeCoords = data.home.coordinates;
  useEffect(() => {
    if (frameKey === null) {
      frameKeyRef.current = null;
      return;
    }
    if (frameKeyRef.current === frameKey) return;
    // Første nøkkel etter at omvisningen slo seg på er ANKOMSTEN, ikke et valg
    // brukeren gjorde. Det skillet trengs bare av områdestoppet under.
    const arriving = frameKeyRef.current === null;
    frameKeyRef.current = frameKey;
    if (pane === "places") return;
    if (step === AREA_STEP) {
      // Området ER overblikket, så rammen er den samme som «Avslutt» ga:
      // boligen med hele nabolaget rundt. Men ikke ved ankomst — der eier
      // splash-en og intro-flyturen kameraet, og en flytur herfra ville krysset
      // den bevegelsen i det panelet gled inn.
      if (!arriving) {
        cameraRef.current?.flyToPoint(homeCoords, {
          minZoom: EXIT_ZOOM,
          durationMs: 900,
        });
      }
      return;
    }
    if (picks.length === 0) return;
    cameraRef.current?.fitCoordinates(picks.map((p) => p.coordinates));
  }, [frameKey, homeCoords, pane, picks, step]);

  // ---- handlinger ----
  const clearOpen = useCallback(() => setOpenPoiIds(new Set()), []);

  const emitStop = useCallback(
    (category: BoardCategory | undefined) => {
      if (!category) return;
      engagement.emit("category_opened", {
        payload: { category_id: category.id },
      });
    },
    [engagement],
  );

  const begin = useCallback(
    (at: number = 0) => {
      cancelFly();
      clearOpen();
      // Omvisningen begynner uten et åpent punkt og uten en valgt kategori:
      // flaten er stoppet, ikke indeksen.
      dispatch({ type: "RESET_TO_DEFAULT" });
      setTour({ step: at, pane: "about" });
      // `stops[AREA_STEP]` er undefined, og emitStop er en no-op da: området er
      // ikke en kategori, og skal ikke telle som et kategori-åpning-signal.
      emitStop(stops[at]);
    },
    [cancelFly, clearOpen, dispatch, emitStop, stops],
  );

  const end = useCallback(() => {
    cancelFly();
    clearOpen();
    setTour(null);
    dispatch({ type: "RESET_TO_DEFAULT" });
    // Nå er tettheten det du utforsker, ikke det første du må tolke.
    cameraRef.current?.flyToPoint(data.home.coordinates, {
      minZoom: EXIT_ZOOM,
      durationMs: 900,
    });
  }, [cancelFly, clearOpen, data.home.coordinates, dispatch]);

  const goto = useCallback(
    (next: number) => {
      const clamped = Math.max(AREA_STEP, Math.min(stops.length - 1, next));
      cancelFly();
      clearOpen(); // nytt stopp, nytt utvalg — ikke en lukking brukeren merker
      // Brukeren tok over: en pågående basic-intro-flytur (9 s) skal ikke
      // fortsette å skrive kameraet mens panelet står på et annet stopp.
      // `BACK_TO_DEFAULT` alene BEHOLDER `introPlaying`; indeksens
      // `SELECT_CATEGORY` nullstilte det, og raden er nå den eneste
      // navigasjonen på desktop.
      dispatch({ type: "END_INTRO" });
      dispatch({ type: "BACK_TO_DEFAULT" });
      setTour({ step: clamped, pane: "about" }); // stoppet begynner med spørsmålet
      emitStop(stops[clamped]);
    },
    [cancelFly, clearOpen, dispatch, emitStop, stops],
  );

  const showPane = useCallback((next: StoryPane) => {
    setTour((prev) => {
      if (!prev || prev.pane === next) return prev;
      return { ...prev, pane: next };
    });
  }, []);

  const showPlace = useCallback(
    (poi: BoardPOI) => {
      setOpenPoiIds((prev) => {
        if (prev.has(String(poi.id))) return prev;
        const nextSet = new Set(prev);
        nextSet.add(String(poi.id));
        return nextSet;
      });
      cancelFly();
      // `source: "story"` undertrykker POI-modalen på mobil: stedets egne ord
      // åpner seg i raden, og en 85vh-modal over den ville vært den
      // kompleksiteten omvisningen fjerner. Kartet flyr likevel.
      dispatch({
        type: "OPEN_POI",
        id: poi.id as BoardPOIId,
        source: "story",
      });
      engagement.emit("poi_clicked", {
        poiId: String(poi.id),
        payload: { category_id: poi.categoryId },
      });
      flyTimerRef.current = setTimeout(() => {
        flyTimerRef.current = null;
        // `holdFrame`: stoppets ramme står, og kameraet rører seg bare hvis
        // stedet ligger utenfor bildet. Uten den zoomet et rad-klikk inn til
        // gulvet og sentrerte punktet — fra en oversiktsramme leste det som et
        // rykk, og de to andre stedene i stoppet forsvant ut av kartet.
        cameraRef.current?.flyToPoint(poi.coordinates, { holdFrame: true });
      }, CAMERA_DELAY_MS);
    },
    [cancelFly, dispatch, engagement],
  );

  const togglePlace = useCallback(
    (poi: BoardPOI) => {
      if (!openPoiIds.has(String(poi.id))) {
        showPlace(poi);
        return;
      }
      setOpenPoiIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.delete(String(poi.id));
        return nextSet;
      });
      cancelFly();
      // Lukker du et felt, blir kameraet stående — å fly tilbake på en lukking
      // er en bevegelse du ikke ba om. Punktet slippes likevel, så markørens
      // navn og rutelinja følger det du har åpent.
      if (state.activePOIId === poi.id) dispatch({ type: "BACK_TO_DEFAULT" });
    },
    [cancelFly, dispatch, openPoiIds, showPlace, state.activePOIId],
  );

  const isPlaceOpen = useCallback(
    (poiId: string) => openPoiIds.has(String(poiId)),
    [openPoiIds],
  );
  const emphasisOf = useCallback(
    (poiId: string, categoryId: string) =>
      stop ? storyEmphasis(poiId, categoryId, stop.id, pickedIds) : null,
    [pickedIds, stop],
  );

  const value = useMemo<StoryTourApi>(
    () => ({
      available: stops.length > 0,
      on,
      stops,
      stop,
      onArea,
      step,
      pane,
      picks,
      pickedIds,
      isPlaceOpen,
      begin,
      end,
      goto,
      showPane,
      showPlace,
      togglePlace,
      emphasisOf,
    }),
    [
      begin,
      emphasisOf,
      end,
      goto,
      isPlaceOpen,
      on,
      onArea,
      pane,
      pickedIds,
      picks,
      showPane,
      showPlace,
      step,
      stop,
      stops,
      togglePlace,
    ],
  );

  return (
    <StoryTourContext.Provider value={value}>
      {children}
    </StoryTourContext.Provider>
  );
}

/** Omvisningen, i flatene som eier den. Kaster utenfor provideren — de flatene
 *  finnes bare inne i board-treet. */
export function useStoryTour(): StoryTourApi {
  const ctx = useContext(StoryTourContext);
  if (!ctx) {
    throw new Error("useStoryTour må brukes inne i en StoryTourProvider");
  }
  return ctx;
}

/** Omvisningen for delte komponenter som også lever UTENFOR board-treet
 *  (`BoardMap` monteres bl.a. av event-flaten). `null` = ingen omvisning. */
export function useStoryTourOptional(): StoryTourApi | null {
  return useContext(StoryTourContext);
}
