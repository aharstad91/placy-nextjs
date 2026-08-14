"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";
import { poiVisualIdentity } from "./marker-style";
import { BoardMapControls, type CameraMode } from "./BoardMapControls";
import { rangeToZoom, zoomToRange } from "@/lib/utils/camera-map";
import { useBoard, useActiveCategory, useAvailableTravelModes } from "./board-state";
import { BoardMarker } from "./BoardMarker";
import { useBoardZoomTier } from "./use-board-zoom-tier";
import { HomeMarker } from "./HomeMarker";
import { BoardPathLayer } from "./BoardPathLayer";
import { BoardPathMidpointMarker } from "./BoardPathMidpointMarker";
import { BoardRouteProvider } from "./board-route";
import { BoardPOILabel } from "./BoardPOILabel";
import { BoardPOIMiniPopup } from "./BoardPOIMiniPopup";
import { BoardMap3D } from "./BoardMap3D";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import type { TravelMode } from "@/lib/types";
import type { FlyCapableMap } from "./board-3d-camera-director";
import { useBoardPopupMode } from "./use-popup-mode";
import { useAudioTourPhase, useCurrentTrack } from "@/lib/stores/audio-tour-store";
import { intersectVisible } from "@/lib/event-board/marker-visibility";
import {
  computeLabelPlacements,
  type LabelCandidate,
  type LabelObstacle,
  type LabelSide,
} from "@/lib/board/label-collision";
import {
  computeFitBounds,
  rectFromCorners,
  shouldFitToFilter,
  shouldFitToProgram,
} from "./board-camera-fit";
import {
  DEFAULT_CAMERA_LOCK,
  type PendingCamera,
} from "@/components/map/motor-camera";

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/**
 * Persistent-3D-modell for WebGL-trygt 2D/3D-bytte.
 *
 * Google Map3DElement (gmp-map-3d) eksponerer IKKE sitt WebGL-canvas (ingen
 * shadow root, intet query-bart <canvas>), så vi kan ikke kalle
 * WEBGL_lose_context.loseContext() slik Mapbox gjør i map.remove(). Eneste
 * leak-frie strategi er derfor å ALDRI unmounte 3D-kartet: når prosjektet har
 * 3D-add-on er Google 3D den faste base-motoren (mountet én gang), og Mapbox
 * 2D er et sekundært overlay som mountes ved behov og frigjør konteksten sin
 * selv ved unmount. Prosjekter uten add-on kjører ren Mapbox 2D som før.
 *
 * Erstatter den gamle 4-tilstands unmount/teardown-maskinen som lekket én
 * Google-WebGL-kontekst per 3D→2D-toggle (→ "Too many active WebGL contexts"
 * → kaskade av deleteVertexArray-feil). Se docs/solutions/architecture-
 * patterns/unified-map-modal-2d-3d-toggle-20260415.md.
 */

interface Props {
  /**
   * Når true: vis 2D/3D-toggle som overlay øverst til høyre. Kobles fra
   * `Project.has3dAddon` via ReportBoardPage. Defaultes til false så
   * toggle aldri lekker til prosjekter uten add-on.
   */
  has3dAddon?: boolean;
  /**
   * Bunn-padding i piksler. Brukes for å holde markører synlige over
   * mobile bottom-sheet (BoardMobileSheet). Settes via setPadding på
   * Mapbox-instansen — påvirker ikke kamera-pan, kun tolkningen av
   * "senter" ved fremtidige fitBounds/flyTo. Default 0 (desktop).
   */
  mapPaddingBottom?: number;
  /**
   * Venstre-padding i piksler. Brukes på desktop-reels-layouten der
   * sidebaren flyter over kartets venstre kant. Holder fitBounds borte
   * fra den okkluderte regionen så alle markører lander til høyre for
   * sidebar. Default 0 (mobil + ren rapport-board uten sidebar).
   */
  mapPaddingLeft?: number;
  /** Kompakt, touch-vennlig kontroll-pille (mobil kart-sheet). Default false. */
  compactControls?: boolean;
  /**
   * Event-board-modus. Events har ingen audio-tour (tour-fitten fyrer aldri),
   * så når dette er satt rammer kartet inn HELE programmet ved første last og
   * hver gang et filter nullstilles (ro-tilstand). Default false (boligrapport
   * beholder default-senteret som før). Se den event-modus ro-fit-effekten under.
   */
  eventMode?: boolean;
  /**
   * Når false: kartet er ikke-interaktivt (historie-flate / teaser-glimt i den
   * mobile to-flate-modellen). Et gjennomsiktig pointer-events-skjold legges over
   * kart-laget så pan/zoom/drag ikke når kart-motorene — Google 3D har ingen
   * `GestureHandling.NONE`, så skjoldet er mekanismen; Mapbox-2D får i tillegg
   * `interactive={false}`. Kontroll-clusteret skjules da også. Default true.
   */
  interactive?: boolean;
  /**
   * Kollaps kart-kontrollene til ett ⚙ FAB (mobil to-flate, R11) — sendes videre
   * til BoardMapControls `collapsed`. Default false (full pille på desktop/event).
   */
  collapsedControls?: boolean;
  /**
   * Når true: kategori-POI-ene rendres som kompakte farge-prikker i stedet for
   * fulle ikon-pins (mobil story-mode-peek — sekundær flate, mindre visuell støy
   * på lite format). Sendes videre til BoardMap3D. Default false.
   */
  compactMarkers?: boolean;
  /**
   * Publiser det ikke-okkluderte kartutsnittet til BoardContext, så en liste
   * kan følge det brukeren faktisk ser (R9/R12). Registrerer også `mapCamera`-
   * API-et (snapshot/restore/fitVisible) på contexten.
   *
   * Opt-in fordi kartet da begynner å skrive til provider-state ved gest-slipp.
   * Brukes av BÅDE mobilsheeten og desktop-sidebaren (2026-08-13). Default false.
   */
  publishViewport?: boolean;
  /**
   * En bottom-sheet okkluderer kartet nedenfra og eier sin egen plassering.
   *
   * Bar tidligere på `publishViewport`, men de to er ulike ting: dette flagget
   * styrer to MOBIL-spesifikke kompromisser som desktop ikke skal arve —
   *  1. rotasjon låses (to-finger-rotasjon er en vanlig uhellsgest under pinch,
   *     og et rotert viewport har ingen ærlig akse-justert bounds), og
   *  2. `map.setPadding` hoppes over, fordi Mapbox implementerer den som
   *     `jumpTo({padding})`: med sheet-høyden som padding flyttet kartet seg
   *     synlig midt i et sheet-drag. Sheeten er konseptuelt et LAG over kartet
   *     — kartet skal ligge stille når laget vokser. Innrammingen taper
   *     ingenting, fordi `fitToVisiblePois` sender `mapPaddingBottom`
   *     eksplisitt i sitt eget padding-objekt.
   * Default false → desktop beholder Mapbox' default-rotasjon og sin
   * venstre-padding.
   */
  sheetSurface?: boolean;
}

export function BoardMap({
  has3dAddon = false,
  mapPaddingBottom = 0,
  mapPaddingLeft = 0,
  compactControls = false,
  eventMode = false,
  interactive = true,
  collapsedControls = false,
  compactMarkers = false,
  publishViewport = false,
  sheetSurface = false,
}: Props) {
  const {
    state,
    data,
    dispatch,
    subFilter,
    visiblePoiIds,
    visibleIdsSource,
    setViewportRect,
    setMapCamera,
    collectionPoiIds,
  } = useBoard();
  const activeCategory = useActiveCategory();
  const availableModes = useAvailableTravelModes();
  const popupMode = useBoardPopupMode();
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Zoom-tier styrer BoardMarker-rendering (dot/icon/icon+label). Lazy
  // useState-init i hooken leser map.getZoom() ved første render; useEffect-
  // retry plukker opp ekte verdi ved mapLoaded=true (også ved 3D→2D-toggle).
  const zoomTier = useBoardZoomTier(mapRef, mapLoaded);

  // ---- Persistent-3D + 2D-overlay ----
  // view = hvilken motor som ligger FREMST. 3D-basen forblir montert uansett
  // når add-on finnes. Default 3D når add-on finnes, ellers ren 2D.
  const [view, setView] = useState<"2d" | "3d">(has3dAddon ? "3d" : "2d");
  const [pendingCamera, setPendingCamera] = useState<PendingCamera | null>(
    null,
  );
  const mapBodyRef = useRef<HTMLDivElement | null>(null);

  // ---- Voice-over-tier ----
  // Speiler signalet i BoardMap3D: med voice-over finnes en kuratert tur å
  // guide gjennom (auto-orbit + Auto/Fri-toggel gir mening). UTEN voice-over
  // (basic-tier) er "Auto" en tom modus — `autoOrbit` er av, så kameraet bare
  // står stille. Da skjules Auto/Fri-segmentet (pillen krymper til Kart/3D).
  const hasVoiceOver = useMemo(
    () =>
      data.categories.some((c) => !!c.audio || !!c.reelsAudio) ||
      !!data.welcome ||
      !!data.home.audio ||
      !!data.outro,
    [data.categories, data.welcome, data.home.audio, data.outro],
  );

  // ---- Kameramodus (auto/fri) + recovery-hint ----
  // Løftet hit (fra BoardMap3D) så Auto/Fri + Kart/3D kan bo i ÉN felles
  // kontroll-komponent (BoardMapControls) sentrert nederst. cameraMode mates
  // ned til BoardMap3D for kamera-directoren; toggelen i BoardMapControls
  // skriver den. Recovery-hinten vises når brukeren tar over ved DRAG (auto→fri).
  // Default auto (drone-orbit) — men ?fly=1 OG basic-tier (ingen orbit) starter i
  // "free" så kamera-directoren ikke kjemper mot intro-flythrough-en og ikke
  // fryser kameraet i en tom auto-hold (board-intro-flythrough i BoardMap3D).
  const [cameraMode, setCameraMode] = useState<CameraMode>(() => {
    if (!hasVoiceOver) return "free";
    return typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("fly") === "1"
      ? "free"
      : "auto";
  });
  const [showFreeHint, setShowFreeHint] = useState(false);
  const freeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Eksplisitt toggle-klikk: sett modus + skjul hint (brukeren styrer bevisst).
  const handleCameraModeChange = useCallback((mode: CameraMode) => {
    if (freeHintTimerRef.current) clearTimeout(freeHintTimerRef.current);
    setShowFreeHint(false);
    setCameraMode(mode);
  }, []);

  // Implisitt takeover via drag i 3D-kartet (varslet fra BoardMap3D): sett fri +
  // vis en transient hint som peker tilbake til Auto.
  const handleDragTakeover = useCallback(() => {
    setCameraMode("free");
    setShowFreeHint(true);
    if (freeHintTimerRef.current) clearTimeout(freeHintTimerRef.current);
    freeHintTimerRef.current = setTimeout(() => setShowFreeHint(false), 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (freeHintTimerRef.current) clearTimeout(freeHintTimerRef.current);
    };
  }, []);

  // ---- Oppsummering ("Oppsummert"-beaten): gi kameraet til brukeren ----
  // Når outro-sporet spiller går vi fra auto til fri og viser recovery-hinten, så
  // brukeren kan utforske hele nabolaget fritt mens oppsummeringen leses (BoardMap3D
  // trekker kameraet litt ut samtidig). Når man FORLATER outro igjen (f.eks. swiper
  // tilbake til en kategori, eller spiller av på nytt) gjenopprettes auto, ellers
  // ville kategori-kameraet stå dødt i fri. wasOutroRef sikrer at vi kun rører
  // modusen på outro-overgangen — ikke ved mount (bevarer ?fly=1-start i fri).
  const currentTrack = useCurrentTrack();
  const isWelcomeBeat = currentTrack?.categoryId === "welcome";
  const isOutroBeat = currentTrack?.categoryId === "outro";
  const wasOutroRef = useRef(false);
  useEffect(() => {
    if (isOutroBeat) {
      setCameraMode("free");
      setShowFreeHint(true);
      if (freeHintTimerRef.current) clearTimeout(freeHintTimerRef.current);
      freeHintTimerRef.current = setTimeout(() => setShowFreeHint(false), 5000);
      wasOutroRef.current = true;
    } else if (wasOutroRef.current) {
      setCameraMode("auto");
      wasOutroRef.current = false;
    }
  }, [isOutroBeat]);

  // Mapbox vises som base (ikke-addon-prosjekt) eller som overlay i 2D-view.
  const showMapbox = !has3dAddon || view === "2d";

  // Markører som vises avhenger av om en KATEGORI er aktiv — ikke av fasen:
  // - ingen aktiv kategori: vis ALLE POIs på tvers av kategorier ufiltrert, hver
  //   med sin egen kategori-farge/ikon. Gir bruker overblikk over hele
  //   nabolaget. Dette gjelder også når et punkt er åpnet (phase "poi") fra
  //   overblikk: markørklikk kaprer ikke lenger kategorien (2026-08-13), så
  //   fasen er ikke lenger en gyldig proxy for «kategori finnes».
  // - aktiv kategori: kun den kategoriens pins, med sub-kategori-filter i
  //   nested faser.
  //
  // For å unngå hard 0↔1 overgang ved kategori-skifte rendres ALLE POI-er
  // alltid med stabil DOM-identitet, og synlighet styres via `isVisible`-flag
  // som BoardMarker fader via CSS-transition. Mapbox holder markør-projeksjonen
  // stabil mens fade kjører.
  //
  // Felles fargevalg på tvers av phaser: sub-kategori-fargen med tema-fargen
  // som fallback. Sub-kat differensierer f.eks. bar (lilla), bakeri (gul) og
  // restaurant (rød) innen Mat-tema.
  const markerStates = useMemo(() => {
    const baseVisible = new Set<string>();
    if (!activeCategory) {
      for (const cat of data.categories) {
        for (const p of cat.pois) baseVisible.add(p.id);
      }
    } else {
      const useFilter =
        state.phase !== "default" && subFilter.hiddenIds.size > 0;
      for (const p of activeCategory.pois) {
        if (useFilter && subFilter.hiddenIds.has(p.raw.category.id)) continue;
        baseVisible.add(p.id);
      }
    }
    // Event-board markør-filter-søm (Unit 4): intersekt med det tema/dag/tid-
    // filtrerte settet. `subFilter` (sub-kategori innen aktiv kategori) og dette
    // event-filteret KOMPONERER — en markør må passere begge for å vises. Når
    // `visiblePoiIds` er undefined (boligrapport, eller event uten aktivt filter)
    // er settet uberørt → ren phase-/kategori-synlighet som før.
    const visibleIds = intersectVisible(baseVisible, visiblePoiIds);
    return data.categories.flatMap((cat) =>
      cat.pois.map((p) => ({
        poi: p,
        // Delt derivasjon (marker-style): samme ikon/farge som listeradene for
        // dette stedet bruker. Endres den her, endres den overalt.
        ...poiVisualIdentity(p.raw, cat),
        isVisible: visibleIds.has(p.id),
        // Unit 5: event-board "Min samling"-highlight. Lagrede POIer får en egen
        // ring (BoardMarker.inCollection). Uberørt for boligrapporter (undefined).
        inCollection: collectionPoiIds?.has(p.id) ?? false,
      })),
    );
  }, [
    state.phase,
    activeCategory,
    subFilter.hiddenIds,
    data.categories,
    visiblePoiIds,
    collectionPoiIds,
  ]);

  // Synlige POI-er for kamera-fit (tour-bounds). Inkluderer ikke fade-out-
  // markører — kamera skal følge faktisk-synlig content, ikke DOM-mengden.
  const visiblePOIs = useMemo(
    () => markerStates.filter((m) => m.isVisible),
    [markerStates],
  );

  // Label-plassering med kollisjonskulling (2026-08-12): på icon+label-tier
  // projiseres synlige markører til skjerm-px; hver label prøver høyre så
  // venstre side, og skjules først når begge kolliderer — lavest Google-rating
  // taper, aktiv POI kulles aldri. Viewport-kanten teller som hindring, så
  // pins nær høyre skjermkant flipper i stedet for å rendre avkuttet.
  // Pinnen står alltid; kun teksten fjernes, og den kommer tilbake når zoom
  // gir plass. Recompute på moveend (dekker zoom) og når markørsettet/aktiv
  // POI endres — ikke per frame.
  // `Map` er skygget av react-map-gl-komponenten — bruk globalThis.Map.
  const [labelPlacements, setLabelPlacements] = useState<
    ReadonlyMap<string, LabelSide>
  >(() => new globalThis.Map());
  const recomputeLabelPlacements = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!map || zoomTier !== "icon+label") {
      setLabelPlacements((prev) =>
        prev.size === 0 ? prev : new globalThis.Map(),
      );
      return;
    }
    const candidates: LabelCandidate[] = [];
    const obstacles: LabelObstacle[] = [];
    for (const { poi } of visiblePOIs) {
      const pt = map.project([poi.coordinates.lng, poi.coordinates.lat]);
      candidates.push({
        id: poi.id,
        x: pt.x,
        y: pt.y,
        name: poi.name,
        priority:
          state.activePOIId === poi.id
            ? Number.POSITIVE_INFINITY
            : (poi.raw.googleRating ?? 0),
      });
      // Markør-sirklene tegnes alltid — tekst under en nabo-pin er like
      // uleselig som tekst under tekst. Egen sirkel blokkerer aldri egen
      // label (labelen starter utenfor sirkelkanten).
      obstacles.push({ x: pt.x, y: pt.y, halfSize: 16 });
    }
    const home = map.project([
      data.home.coordinates.lng,
      data.home.coordinates.lat,
    ]);
    obstacles.push({ x: home.x, y: home.y, halfSize: 28 });
    const next = computeLabelPlacements(candidates, obstacles, {
      width: map.getContainer().clientWidth,
    });
    setLabelPlacements((prev) =>
      prev.size === next.size &&
      [...next].every(([id, side]) => prev.get(id) === side)
        ? prev
        : next,
    );
  }, [zoomTier, visiblePOIs, state.activePOIId, data.home.coordinates]);

  useEffect(() => {
    if (!mapLoaded) return;
    recomputeLabelPlacements();
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    map.on("moveend", recomputeLabelPlacements);
    return () => {
      map.off("moveend", recomputeLabelPlacements);
    };
  }, [mapLoaded, recomputeLabelPlacements]);

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    applyIllustratedTheme(map);
    // Utsnittet leses ved å unprojisere kartets piksel-hjørner. Med bearing ≠ 0
    // er den akse-justerte konvolutten av et rotert viewport vesentlig større
    // enn det brukeren faktisk ser, og lista ville listet steder utenfor
    // skjermen. To-finger-rotasjon er dessuten en vanlig uhellsgest på telefon
    // under pinch-zoom. Vi låser derfor rotasjonen på SHEET-flaten i stedet for
    // å leve med toleransen. Gjelder kun der: desktop (som leser samme utsnitt,
    // men med mus og uten pinch), event-board og VO-flaten beholder Mapbox'
    // defaults.
    if (sheetSurface) {
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
    }
  }, [sheetSurface]);

  // Sync map-padding med sheet-høyden. `setPadding` er IKKE passiv: Mapbox
  // implementerer den som `jumpTo({ padding })`, så kameraet re-sentreres i det
  // padding-boksen endrer seg. Med en konstant padding (event-boardet) skjer det
  // én gang ved montering og synes ikke.
  //
  // På sheet-flaten er padding sheet-høyden, og da BLIR den synlig: et drag fra
  // lav til høy hvileposisjon flyttet kartet ~halve høydeforskjellen, som et
  // hopp midt i gesten. Sheeten er konseptuelt et LAG over kartet — kartet skal
  // ligge stille når laget vokser. Derfor står den flaten utenfor.
  //
  // Framingen taper ingenting på det: `fitToVisiblePois` sender allerede
  // `mapPaddingBottom` eksplisitt i sitt eget padding-objekt. Med den
  // persistente paddingen inne ble den TELT TO GANGER, som er kilden til
  // «Map cannot fit within canvas with the given bounds, padding, and/or offset».
  //
  // Desktop publiserer også utsnitt, men uten sheet: der SKAL paddingen stå
  // (`mapPaddingLeft` holder innrammingen klar av sidebaren).
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || sheetSurface) return;
    const map = mapRef.current.getMap();
    map.setPadding({
      top: 0,
      bottom: mapPaddingBottom,
      left: mapPaddingLeft,
      right: 0,
    });
  }, [mapLoaded, mapPaddingBottom, mapPaddingLeft, sheetSurface]);

  // ---- Viewport-publisering (mobil nabolagsflate, R9 2D + R12) ----
  //
  // Rektangelet regnes ut i PIKSLER og unprojiseres, ikke ved å trekke fra
  // breddegrader på `getBounds()`. `getBounds()` ignorerer paddingen satt over,
  // så «bounds minus sheet-høyden» har ingen meningsfull aritmetisk form —
  // mens `unproject([x, y])` er en ærlig skjerm→geo-projeksjon av nøyaktig de
  // pikslene sheeten IKKE dekker.
  //
  // Sheet-høyden er en PARAMETER, ikke en callback-dep: da beholder
  // `publishViewportRect` stabil identitet gjennom hele sheet-draget. Samme
  // felle som `fitToVisiblePois` allerede har (den har `mapPaddingBottom` i
  // dep-arrayet, så identiteten skifter ved hver hvileposisjon).
  const publishViewportRect = useCallback(
    (occludedBottomPx: number, userGesture = false) => {
      if (!mapRef.current) return;
      const map = mapRef.current.getMap();
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight - occludedBottomPx;
      if (w <= 0 || h <= 0) {
        // Sheeten dekker hele kartet, eller kartet har ingen målbar størrelse.
        // Ingen ærlig avlesning → degrader til «ingen scoping» (vis alt).
        // ALDRI til et tomt sett; en tom liste uten årsak leses som en bug.
        setViewportRect(null, { userGesture });
        return;
      }
      setViewportRect(
        rectFromCorners([
          map.unproject([0, 0]),
          map.unproject([w, 0]),
          map.unproject([0, h]),
          map.unproject([w, h]),
        ]),
        { userGesture },
      );
    },
    [setViewportRect],
  );

  // Initial publisering ved kart-last, og re-publisering når sheeten bytter
  // hvileposisjon (R12: hvileposisjon endrer det ikke-okkluderte området og
  // teller derfor som en scope-endring). Kamera-bevegelser publiserer IKKE
  // herfra — kun `handleMoveEnd` under, og kun for brukerinitierte gester.
  useEffect(() => {
    if (!publishViewport || !mapLoaded) return;
    publishViewportRect(mapPaddingBottom);
  }, [publishViewport, mapLoaded, mapPaddingBottom, publishViewportRect]);

  // R12: KUN brukerinitierte gester re-scoper lista. `originalEvent` bærer
  // skillet og er satt på både direkte- og inertia-stien, inkludert pinch.
  // Guarden er formulert som «publiser når den FINNES», ikke «undertrykk når
  // den mangler»: feltet er optional, og for handler-drevne bevegelser uten
  // lagret DOM-event (tastatur-pan) mangler det. Feilmodusen til den strenge
  // formen er en foreldet liste — langt tryggere enn en kamera-løkke.
  const handleMoveEnd = useCallback(
    (e: ViewStateChangeEvent) => {
      if (!publishViewport) return;
      // `ViewStateChangeEvent` er en union over alle kamera-hendelsene, og ikke
      // alle grenene deklarerer `originalEvent` — derfor `in`-narrowing, ikke
      // direkte feltoppslag.
      const gesture = "originalEvent" in e ? e.originalEvent : undefined;
      if (!gesture) return;
      publishViewportRect(mapPaddingBottom, true);
    },
    [publishViewport, mapPaddingBottom, publishViewportRect],
  );

  // Tour-mode bounding-box-fit: når audio-tour er aktiv, rekalkuler kamera
  // for hvert kategori-skifte slik at alle synlige markører (+ home) får
  // plass. Gir visuell "view changes"-feedback per spor. Utenfor tour-mode
  // holder kartet posisjonen sin (manuell pan/zoom).
  //
  // visiblePOIs lest via ref så effekten ikke re-fyrer på state.phase-skifte
  // (default→poi ved marker-klikk gir ny array-identitet selv om innholdet er
  // likt). Uten denne stabiliseringen flyttet kartet seg på hvert marker-klikk
  // mens tour kjørte — samme bug som ble fikset for 3D-versjonen.
  const tourPhase = useAudioTourPhase();
  const tourActive = tourPhase === "playing" || tourPhase === "paused";
  const visiblePOIsRef = useRef(visiblePOIs);
  visiblePOIsRef.current = visiblePOIs;

  // Felles fit-bounds-rutine for kamera-rammingen. Rammer inn de nå-synlige
  // markørene (lest via ref så vi aldri trigger på array-identitet) sammen med
  // home-koordinatene. Muterer Mapbox-instansen (fitBounds) — den unmountes
  // aldri (ingen WebGL-lekk). No-op uten markører (behold posisjon).
  // Scalar home-deps (lng/lat) holder callbacken stabil selv om koordinat-
  // objektet får ny identitet uten verdiendring.
  const homeLng = data.home.coordinates.lng;
  const homeLat = data.home.coordinates.lat;
  const fitToVisiblePois = useCallback(() => {
    if (!mapLoaded || !mapRef.current) return;
    const bounds = computeFitBounds(
      visiblePOIsRef.current.map((m) => m.poi.coordinates),
      { lng: homeLng, lat: homeLat },
    );
    if (!bounds) return; // ingen markører → behold posisjon
    mapRef.current.getMap().fitBounds([bounds.sw, bounds.ne], {
      padding: {
        top: 80,
        bottom: 80 + mapPaddingBottom,
        left: 80 + mapPaddingLeft,
        right: 80,
      },
      duration: 800,
      maxZoom: 15.5,
    });
  }, [mapLoaded, homeLng, homeLat, mapPaddingBottom, mapPaddingLeft]);

  useEffect(() => {
    if (!tourActive) return;
    fitToVisiblePois();
  }, [tourActive, activeCategory?.id, fitToVisiblePois]);

  // ---- Kamera-API for flatene over kartet (kategoriside-push, R18) ----
  // Objektet er STABILT (tom dep-array) og leser gjeldende fit-callback via en
  // ref satt hver render — ellers ville hver padding-endring gitt et nytt API,
  // ny provider-state og en re-render-runde per sheet-drag.
  const fitRef = useRef(fitToVisiblePois);
  fitRef.current = fitToVisiblePois;
  // Samme ref-triks for publiseringen og sheet-høyden, så kamera-API-et kan
  // re-publisere utsnittet uten å bli et nytt objekt per padding-endring.
  const publishRectRef = useRef(publishViewportRect);
  publishRectRef.current = publishViewportRect;
  const paddingBottomRef = useRef(mapPaddingBottom);
  paddingBottomRef.current = mapPaddingBottom;
  const cameraApi = useMemo(
    () => ({
      snapshot: () => {
        const map = mapRef.current?.getMap();
        if (!map) return null;
        const center = map.getCenter();
        return {
          lng: center.lng,
          lat: center.lat,
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        };
      },
      // `jumpTo`, ikke `easeTo`: gjenopprettingen må være SYNKRON. Tilbake fra
      // kategorisiden remonterer nabolagslista, som umiddelbart publiserer et
      // nytt utsnitt fra kameraets nåværende posisjon — leste den en
      // halvferdig animasjon, ville lista blitt scopet til et utsnitt brukeren
      // aldri så. «Nøyaktig samme utsnitt» (R18) betyr dessuten nøyaktig.
      restore: (s: {
        lng: number;
        lat: number;
        zoom: number;
        bearing: number;
        pitch: number;
      }) => {
        mapRef.current?.getMap().jumpTo({
          center: [s.lng, s.lat],
          zoom: s.zoom,
          bearing: s.bearing,
          pitch: s.pitch,
        });
      },
      fitVisible: () => {
        fitRef.current();
        // Re-publiser utsnittet ÉN gang når rammingen har landet.
        //
        // R12 undertrykker publisering for programmatiske kamerabevegelser, for
        // å hindre løkken kamera → utsnitt → liste → kamera. `fitVisible` er
        // unntaket som må gjennom: den kalles bare fra eksplisitte
        // brukerhandlinger (kategoriside-push på mobil, «Ramm inn»-knappen i
        // desktop-panelet). Uten dette flyttet kartet seg mens lista fortsatte å
        // vise det gamle utsnittet — brukeren trykket «Ramm inn» og ingenting
        // skjedde i teksten. Ingen løkke: publiseringen er én-skudds, og
        // ingenting i liste-stien kaller kameraet tilbake av seg selv.
        const map = mapRef.current?.getMap();
        if (!map) return;
        map.once("moveend", () => {
          publishRectRef.current(paddingBottomRef.current, true);
        });
      },
    }),
    [],
  );
  useEffect(() => {
    if (!publishViewport) return;
    setMapCamera(cameraApi);
    return () => setMapCamera(null);
  }, [publishViewport, cameraApi, setMapCamera]);

  // Event-board filter-fit (Unit 4): events har ingen audio-tour (tourActive er
  // alltid false), så tour-fitten over fyrer aldri. I stedet fitter vi kameraet
  // til det FILTRERTE settet hver gang `visiblePoiIds` endrer innhold — så kartet
  // zoomer til de matchende events når brukeren velger tema/dag/tid. Kun aktivt
  // når `visiblePoiIds` er definert (event-board); boligrapporter (undefined)
  // berøres ikke. Gated på !tourActive så vi aldri kjemper mot tour-fitten.
  //
  // OG gated på KILDEN til settet (`shouldFitToFilter`): nabolagsflaten avleder
  // `visiblePoiIds` fra kartutsnittet, og en fit på det settet ville flyttet
  // kameraet → nytt utsnitt → nytt sett → ny fit. Uendelig løkke. Se
  // `VisibleIdsSource` i lib/board/board-types.ts.
  //
  // Nøkkelen er en stabil join av sorterte synlige IDer (ikke Set-identiteten),
  // så effekten kun re-fyrer ved FAKTISK innholdsendring — Mapbox-instansen
  // muteres (fitBounds), den unmountes aldri (ingen WebGL-lekk, ingen remount).
  const visibleIdsKey = useMemo(
    () =>
      visiblePoiIds
        ? Array.from(visiblePoiIds).sort().join(",")
        : null,
    [visiblePoiIds],
  );
  useEffect(() => {
    if (!shouldFitToFilter({ visibleIdsKey, tourActive, visibleIdsSource }))
      return;
    fitToVisiblePois();
  }, [visibleIdsKey, tourActive, visibleIdsSource, fitToVisiblePois]);

  // Event-board ro-fit (B2/B3): events har ingen audio-tour, så tour-fitten over
  // fyrer aldri, og filter-fitten fyrer kun NÅR et filter er aktivt. Uten dette
  // åpner kartet på default-senteret (ikke rammet rundt programmet), og å NULLSTILLE
  // et filter zoomet ikke ut igjen (asymmetri: sette filter zoomet inn, fjerne det
  // beholdt posisjon). Her fitter vi til HELE programmet hver gang vi er i ro-tilstand
  // (`visibleIdsKey === null` = intet aktivt filter): i ro-tilstand er `visiblePOIs`
  // alle markørene (phase "default", ingen aktiv kategori). Effekten er one-shot per
  // ro-inngang — den re-fyrer kun når `visibleIdsKey` skifter (→ null ved nullstilling,
  // eller initielt null ved last), ALDRI per render i ro (nøkkelen står stabil null).
  // Dermed: initial fit ved last OG re-fit ved nullstilling, uten WebGL-churn.
  // Gated på `eventMode` så boligrapporter beholder default-senteret som før.
  useEffect(() => {
    if (!shouldFitToProgram({ eventMode, mapLoaded, tourActive, visibleIdsKey }))
      return;
    fitToVisiblePois();
  }, [eventMode, mapLoaded, tourActive, visibleIdsKey, fitToVisiblePois]);

  // Tidligere flyttet vi markøren inn i synlig kart-rom ved klikk (easeTo med
  // offset for å klarere 480px-sidebar). Det føltes som om kartet "rykker" på
  // hvert marker-klikk — matchet ikke 3D-modusen som holder kameraet i ro.
  // Fjernet for parity. Popup kan teoretisk overlappe sidebar hvis markøren er
  // helt i venstre kant, men det er en akseptabel kompromiss for ro-følelsen.

  // ---- Toggle-handler: lese kamera, sette pendingCamera, schedulere swap ----
  const getViewportDims = useCallback(
    (): { w: number; h: number } => {
      const el = mapBodyRef.current;
      if (el) return { w: el.clientWidth, h: el.clientHeight };
      return { w: 800, h: 600 };
    },
    [],
  );

  // ---- Kamera-bro mellom motorene ----
  // Toggelen byttet tidligere ikke bare motor, den FLYTTET deg: 3D→2D landet
  // alltid på boligen med range 900 (posituren ble aldri lest), mens 2D→3D
  // beholdt der 3D sist sto fordi instansen aldri unmountes. Asymmetrien var
  // synlig — panorer i 3D, trykk «Kart», og du står hjemme igjen.
  //
  // 3D-instansen holdes i en ref her, ikke i state: den brukes kun imperativt i
  // toggle-handleren, og en state-oppdatering ville re-rendret hele kart-treet
  // idet 3D-motoren ble klar.
  const map3dRef = useRef<Map3DInstance | null>(null);
  const handle3DReady = useCallback((m: Map3DInstance | null) => {
    map3dRef.current = m;
  }, []);

  // Modusen bor i reduceren, ikke i kart-skallet: nabolagslista og
  // instrumenteringen leser samme felt (R2).
  const handleTravelModeChange = useCallback(
    (mode: TravelMode) => dispatch({ type: "SET_TRAVEL_MODE", mode }),
    [dispatch],
  );

  const handleModeChange = useCallback(
    (mode: "2d" | "3d") => {
      if (mode === view) return;
      if (mode === "2d") {
        // 3D → 2D: mount Mapbox-overlayet der 3D-kameraet sto. 3D-basen forblir
        // montert under. `range`/`tilt` oversettes til Mapbox-zoom med samme
        // geometri toggelen den andre veien bruker (camera-map).
        //
        // Posituren tas med, men IKKE vinkelen: Mapbox lander flatt og nordvendt.
        // Nabolagsflaten slår av rotasjon med vilje (et rotert utsnitt har ingen
        // ærlig akse-justert bounds — se handleMapLoad), og en arvet pitch ville
        // dratt utsnittets øvre kant mot horisonten. Kontinuiteten som betyr noe
        // er HVOR du er, ikke hvilken vei du så.
        const { w, h } = getViewportDims();
        const map3d = map3dRef.current;
        const center = map3d?.center;
        const lat = center?.lat ?? data.home.coordinates.lat;
        const lng = center?.lng ?? data.home.coordinates.lng;
        const range = map3d?.range ?? 900;
        const tilt = map3d?.tilt ?? 0;
        setMapLoaded(false);
        setPendingCamera({
          lat,
          lng,
          zoom: rangeToZoom(range, lat, tilt, w, h),
          range,
          heading: 0,
          tilt: 0,
        });
        setView("2d");
      } else {
        // 2D → 3D: unmount Mapbox-overlayet (map.remove() frigjør WebGL-
        // konteksten). 3D-basen ligger allerede under og avdekkes momentant.
        //
        // Posisjonen må skrives IMPERATIVT hit: `defaultCenter`/`defaultRange` på
        // <Map3D> gjelder kun ved mount, og instansen mountes én gang og rives
        // aldri. `durationMillis: 0` — byttet skal være et kutt, ikke en flytur
        // brukeren ser fra feil sted.
        //
        // Kun i fri modus. I auto eier drone-directoren kameraet og re-aimer til
        // prosjektet i neste effekt uansett; å skrive her ville gitt et hopp som
        // umiddelbart ble overskrevet.
        const map3d = map3dRef.current as FlyCapableMap | null;
        const map = mapRef.current?.getMap();
        if (map3d && map && cameraMode === "free") {
          const c = map.getCenter();
          const { w, h } = getViewportDims();
          const current = map3dRef.current;
          const tilt = current?.tilt ?? DEFAULT_CAMERA_LOCK.tilt;
          map3d.flyCameraTo?.({
            endCamera: {
              center: { lat: c.lat, lng: c.lng, altitude: 0 },
              range: zoomToRange(map.getZoom(), c.lat, tilt, w, h),
              tilt,
              heading: current?.heading ?? 0,
            },
            durationMillis: 0,
          });
        }
        setView("3d");
      }
    },
    [
      view,
      cameraMode,
      getViewportDims,
      data.home.coordinates.lat,
      data.home.coordinates.lng,
    ],
  );

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground p-8 text-center text-sm">
        Mapbox-token mangler — sett NEXT_PUBLIC_MAPBOX_TOKEN i .env.local.
      </div>
    );
  }

  return (
    // Én rutekilde for begge kart-motorene: 3D-ruten, 2D-rutelinja og tids-chipen
    // leser samme svar i aktiv reisemodus i stedet for å fyre tre Directions-kall.
    <BoardRouteProvider>
      <div ref={mapBodyRef} className="absolute inset-0">
        {/* Google 3D base-motor — persistent når add-on finnes. Mountes én gang
            og rives ALDRI ned (kan ikke frigjøre Google-WebGL-konteksten
            manuelt). Mapbox-overlayet legger seg oppå når brukeren velger 2D. */}
        {has3dAddon && (
          <div className="absolute inset-0">
            <BoardMap3D
              pendingCamera={null}
              mapPaddingLeft={mapPaddingLeft}
              cameraMode={cameraMode}
              onDragTakeover={handleDragTakeover}
              compactMarkers={compactMarkers}
              // Kun den FREMSTE motoren publiserer utsnitt. I 2D-visning ligger
              // 3D-basen fortsatt montert under Mapbox-overlayet, og uten denne
              // gaten ville begge skrevet til samme state.
              publishViewport={publishViewport && view === "3d"}
              mapPaddingBottom={mapPaddingBottom}
              onMapReady={handle3DReady}
            />
          </div>
        )}

        {/* Mapbox 2D — base for ikke-addon-prosjekter, ellers et overlay i
            2D-view. Unmountes ved retur til 3D; map.remove() frigjør konteksten. */}
        {showMapbox && (
          <div className={`absolute inset-0 ${has3dAddon ? "z-[5]" : ""}`}>
            {!mapLoaded && (
              <div className="absolute inset-0 z-20 bg-[#f0ece6] animate-pulse" />
            )}
            <Map
              ref={mapRef}
              mapboxAccessToken={TOKEN}
              initialViewState={{
                longitude:
                  pendingCamera?.lng ?? data.home.coordinates.lng,
                latitude:
                  pendingCamera?.lat ?? data.home.coordinates.lat,
                zoom: pendingCamera?.zoom ?? 13.5,
                bearing: pendingCamera?.heading ?? 0,
                pitch: pendingCamera?.tilt ?? 0,
              }}
              style={{ width: "100%", height: "100%" }}
              mapStyle={MAP_STYLE_STANDARD}
              // Zoom-tak (2026-08-12): labels kommer på zoom 16 (LABEL_BREAKPOINT).
              // 18 gir to hakk inspeksjon — nok til å skille tette sentrums-
              // klynger (labels trenger separasjonen mer enn pinnene), deretter
              // er mer zoom bare tomme bygningsflater.
              maxZoom={18}
              interactive={interactive}
              onLoad={handleMapLoad}
              onMoveEnd={handleMoveEnd}
              onClick={() => {
                // Markører kaller stopPropagation i sin onClick, så denne
                // fyrer kun ved klikk på kart-bakgrunn. Lukk popup hvis åpen.
                if (state.activePOIId) dispatch({ type: "BACK_TO_DEFAULT" });
              }}
            >
              <HomeMarker
                coordinates={data.home.coordinates}
                name={data.home.name}
                onClick={() => dispatch({ type: "RESET_TO_DEFAULT" })}
              />

              {markerStates.map(({ poi, color, icon, isVisible, inCollection }) => {
                const isActive = state.activePOIId === poi.id;
                // R10c: når mini-popup viser POI-navn, undertrykk inline-label
                // for aktiv markør så vi ikke får dobbel-navn-rendering.
                // Kollisjonskulling: en label uten plassering på label-tieren
                // kolliderte på begge sider og skjules (aktiv POI kulles
                // aldri — Infinity-prioritet gir den alltid en plass).
                const placement = labelPlacements.get(poi.id);
                const suppressLabel =
                  (popupMode === "mini" && isActive) ||
                  (!isActive &&
                    zoomTier === "icon+label" &&
                    placement === undefined);
                return (
                  <BoardMarker
                    key={poi.id}
                    poi={poi}
                    color={color}
                    icon={icon}
                    isActive={isActive}
                    isVisible={isVisible}
                    inCollection={inCollection}
                    zoomTier={zoomTier}
                    suppressLabel={suppressLabel}
                    labelSide={placement ?? "right"}
                    // Ingen `categoryId`: et klikk på kartet er en i-kontekst-
                    // handling («hva er dette stedet?») og skal ikke også bytte
                    // kategori, filtrere markørsettet og drille sidebaren inn.
                    onClick={() => dispatch({ type: "OPEN_POI", id: poi.id })}
                  />
                );
              })}

              <BoardPathLayer />
              <BoardPathMidpointMarker />
              <BoardPOILabel />
              {popupMode === "mini" && state.activePOIId && <BoardPOIMiniPopup />}
            </Map>
          </div>
        )}

        {/* Ikke-interaktiv tilstand (historie-flate / teaser-glimt): gjennomsiktig
            pointer-events-skjold over begge kart-motorene. Google 3D har ingen
            GestureHandling.NONE, så dette skjoldet er den eneste måten å hindre
            pan/zoom/drag (og onDragTakeover) på den persistente 3D-instansen.
            z-10 ligger over 3D-base (z-0) og Mapbox-overlay (z-5); kontroll-
            clusteret (under) skjules uansett når !interactive. */}
        {!interactive && (
          <div
            aria-hidden
            className="absolute inset-0 z-10"
            style={{ touchAction: "none" }}
          />
        )}

        {/* Felles kontroll-cluster (Reisemåte + Auto/Fri + Kart/3D) sentrert
            nederst-midt. Bunn-midten er fri for Google-crediten (låst
            nederst-venstre) og Mapbox-attribusjonen (nederst-høyre).
            Gaten var `has3dAddon && interactive` fram til 2026-08-14. Reisemåte
            gjelder ALLE boards, så pillen monteres nå så snart kartet er den
            aktive flaten; Kart/3D-segmentet beholder sin 3D-betingelse INNE i
            komponenten, og pillen returnerer null hvis ingen segmenter er igjen. */}
        {interactive && (
          <BoardMapControls
            view={view}
            onViewChange={handleModeChange}
            showViewToggle={has3dAddon}
            travelModes={availableModes}
            travelMode={state.travelMode}
            onTravelModeChange={handleTravelModeChange}
            cameraMode={cameraMode}
            onCameraModeChange={handleCameraModeChange}
            showCameraMode={hasVoiceOver}
            showFreeHint={showFreeHint}
            controlsReady={!isWelcomeBeat}
            compact={compactControls}
            collapsed={collapsedControls}
          />
        )}
      </div>
    </BoardRouteProvider>
  );
}
