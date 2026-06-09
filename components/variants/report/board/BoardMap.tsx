"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { type MapRef } from "react-map-gl/mapbox";
import { MAP_STYLE_STANDARD, applyIllustratedTheme } from "@/lib/themes/map-styles";
import { mutedColor } from "@/lib/themes/muted-palette";
import { BoardMapControls, type CameraMode } from "./BoardMapControls";
import { rangeToZoom } from "@/lib/utils/camera-map";
import { useBoard, useActiveCategory } from "./board-state";
import { BoardMarker } from "./BoardMarker";
import { useBoardZoomTier } from "./use-board-zoom-tier";
import { HomeMarker } from "./HomeMarker";
import { BoardPathLayer } from "./BoardPathLayer";
import { BoardPathMidpointMarker } from "./BoardPathMidpointMarker";
import { BoardPOILabel } from "./BoardPOILabel";
import { BoardPOIMiniPopup } from "./BoardPOIMiniPopup";
import { BoardMap3D } from "./BoardMap3D";
import { useBoardPopupMode } from "./use-popup-mode";
import { useAudioTourPhase, useCurrentTrack } from "@/lib/stores/audio-tour-store";
import { intersectVisible } from "@/lib/event-board/marker-visibility";
import { computeFitBounds, shouldFitToProgram } from "./board-camera-fit";
import type { PendingCamera } from "@/components/map/UnifiedMapModal";

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
}

export function BoardMap({
  has3dAddon = false,
  mapPaddingBottom = 0,
  mapPaddingLeft = 0,
  compactControls = false,
  eventMode = false,
}: Props) {
  const { state, data, dispatch, subFilter, visiblePoiIds, collectionPoiIds } = useBoard();
  const activeCategory = useActiveCategory();
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

  // Markører som vises avhenger av phase:
  // - default + Hjem-state (ingen kategori aktiv): vis ALLE POIs på tvers av
  //   kategorier ufiltrert, hver med sin egen kategori-farge/ikon. Gir bruker
  //   overblikk over hele nabolaget før kategori-narrativet starter.
  // - default + aktiv kategori (scroll-drevet): kun den kategoriens pins.
  // - active|poi: kun aktiv kategoris POI-er, med sub-kategori-filter.
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
    if (state.phase === "default" && !activeCategory) {
      for (const cat of data.categories) {
        for (const p of cat.pois) baseVisible.add(p.id);
      }
    } else if (activeCategory) {
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
        color: mutedColor(p.raw.category.color) ?? cat.color,
        icon: p.raw.category.icon || cat.icon,
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

  const handleMapLoad = useCallback(() => {
    setMapLoaded(true);
    if (!mapRef.current) return;
    applyIllustratedTheme(mapRef.current.getMap());
  }, []);

  // Sync map-padding-bottom med BoardMobileSheet snap-stage. Påvirker ikke
  // kamera (ingen flyTo/fitBounds-trigger) — kun tolkning av "senter" for
  // fremtidige kamera-bevegelser. Mobil-sheet sender ned padding via
  // BoardScaffold; desktop sender 0.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();
    map.setPadding({
      top: 0,
      bottom: mapPaddingBottom,
      left: mapPaddingLeft,
      right: 0,
    });
  }, [mapLoaded, mapPaddingBottom, mapPaddingLeft]);

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

  // Event-board filter-fit (Unit 4): events har ingen audio-tour (tourActive er
  // alltid false), så tour-fitten over fyrer aldri. I stedet fitter vi kameraet
  // til det FILTRERTE settet hver gang `visiblePoiIds` endrer innhold — så kartet
  // zoomer til de matchende events når brukeren velger tema/dag/tid. Kun aktivt
  // når `visiblePoiIds` er definert (event-board); boligrapporter (undefined)
  // berøres ikke. Gated på !tourActive så vi aldri kjemper mot tour-fitten.
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
    if (visibleIdsKey === null) return; // ro-tilstand / boligrapport — ro-fitten under eier kameraet
    if (tourActive) return; // tour-fitten eier kameraet hvis aktiv
    fitToVisiblePois();
  }, [visibleIdsKey, tourActive, fitToVisiblePois]);

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

  const handleModeChange = useCallback(
    (mode: "2d" | "3d") => {
      if (mode === view) return;
      if (mode === "2d") {
        // 3D → 2D: mount Mapbox-overlayet. BoardMap3D eier 3D-kamera-instansen
        // internt, så vi har ikke kameraet her — Mapbox lander på prosjekt-
        // senter (kjent, grei posisjon). 3D-basen forblir montert under.
        const { w, h } = getViewportDims();
        const fallbackZoom = rangeToZoom(
          900,
          data.home.coordinates.lat,
          0,
          w,
          h,
        );
        setMapLoaded(false);
        setPendingCamera({
          lat: data.home.coordinates.lat,
          lng: data.home.coordinates.lng,
          zoom: fallbackZoom,
          range: 900,
          heading: 0,
          tilt: 0,
        });
        setView("2d");
      } else {
        // 2D → 3D: unmount Mapbox-overlayet (map.remove() frigjør WebGL-
        // konteksten). 3D-basen ligger allerede under og avdekkes momentant.
        setView("3d");
      }
    },
    [view, getViewportDims, data.home.coordinates.lat, data.home.coordinates.lng],
  );

  if (!TOKEN) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground p-8 text-center text-sm">
        Mapbox-token mangler — sett NEXT_PUBLIC_MAPBOX_TOKEN i .env.local.
      </div>
    );
  }

  return (
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
            onLoad={handleMapLoad}
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
              const suppressLabel = popupMode === "mini" && isActive;
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
                  onClick={() =>
                    dispatch({
                      type: "OPEN_POI",
                      id: poi.id,
                      categoryId: poi.categoryId,
                    })
                  }
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

      {/* Felles kontroll-cluster (Auto/Fri + Kart/3D) sentrert nederst-midt —
          kun når 3D-add-on er kjøpt. Bunn-midten er fri for Google-crediten
          (låst nederst-venstre) og Mapbox-attribusjonen (nederst-høyre). */}
      {has3dAddon && (
        <BoardMapControls
          view={view}
          onViewChange={handleModeChange}
          cameraMode={cameraMode}
          onCameraModeChange={handleCameraModeChange}
          showCameraMode={hasVoiceOver}
          showFreeHint={showFreeHint}
          controlsReady={!isWelcomeBeat}
          compact={compactControls}
        />
      )}
    </div>
  );
}
