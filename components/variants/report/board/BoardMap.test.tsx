import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { forwardRef, useEffect, useImperativeHandle } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Unit 09.3 — invariant-låsende tester for BoardMap skall-wrapperen.
 * PRD 9 eier HELE fila + mount-orkestreringen rundt 3D-motoren. Disse testene
 * låser de strukturelle kontraktene tsc/lint IKKE fanger (en refactor kan ellers
 * stille koble showCameraMode til tier, unmounte 3D-basen ved 2D-toggle, eller
 * slippe pointer-skjoldet):
 *  AC1: BoardMap3D mountes på has3dAddon og rives ALDRI ned (persistent-mount).
 *  AC2: view/cameraMode eid av skallet (?fly=1-default); hasVoiceOver datadrevet.
 *  AC3: BoardMapControls betinget has3dAddon && interactive, showCameraMode datadrevet.
 *  AC4: pointer-events-skjold ved !interactive.
 *  AC5/AC6: PendingCamera fra motor-camera (ikke UnifiedMapModal), useBoard/
 *           audio-tour-selectors, showMapbox-orkestrering (source-guard).
 *
 * Mobil nabolagsflate Unit 1 (2026-08-03) utvider suiten med kamera-løkke-gaten
 * og viewport-publiseringen. Det krevde at Mapbox-mocken ble EKTE: den gamle
 * bare-`forwardRef`-diven kalte aldri `onLoad` og eksponerte ingen `getMap()`,
 * så `mapLoaded` forble false og BÅDE `fitToVisiblePois` og padding-effekten
 * early-returnerte. En feedback-loop-test mot den mocken ville vært grønn fra
 * dag én — uten å bevise noe. Mocken nedenfor flipper `mapLoaded` via `onLoad`
 * og gir spies for fitBounds/setPadding/unproject/getCanvas/dragRotate.
 */

const h = vi.hoisted(() => {
  // TOKEN leses som modul-konstant ved import → må settes FØR BoardMap importeres.
  // vi.hoisted kjører før modul-imports, så env-en er på plass i tide.
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";
  return {
    board: {
      value: null as unknown,
      activeCategory: null as unknown,
      availableTravelModes: ["walk", "bike", "car"] as string[],
    },
    tour: { phase: "idle" as string, currentTrack: null as unknown },
    captured: {
      controls: [] as Record<string, unknown>[],
      board3d: [] as Record<string, unknown>[],
      mapProps: [] as Record<string, unknown>[],
      // Markør-props per render. Synlighet MÅ leses her og ikke som antall
      // DOM-noder: markørene beholder DOM-identitet og fader via `isVisible`,
      // så en node-telling er uendret selv når filtreringen virker.
      markers: [] as Record<string, unknown>[],
    },
    // Settes i beforeEach — Mapbox-instansen mocken returnerer fra getMap().
    mapbox: { instance: null as unknown },
  };
});

/** Piksel→geo for mocken: x vokser østover, y vokser sørover. Lineær, så
 *  testene kan regne ut forventet rektangel eksakt. */
const MOCK_VIEWPORT = { w: 390, h: 800 };
const px2lng = (x: number) => 10.3 + x * 0.0001;
const px2lat = (y: number) => 63.5 - y * 0.0001;

function makeMapInstance() {
  return {
    fitBounds: vi.fn(),
    setPadding: vi.fn(),
    getBounds: vi.fn(),
    unproject: vi.fn(([x, y]: [number, number]) => ({
      lng: px2lng(x),
      lat: px2lat(y),
    })),
    getCanvas: vi.fn(() => ({
      clientWidth: MOCK_VIEWPORT.w,
      clientHeight: MOCK_VIEWPORT.h,
    })),
    on: vi.fn(),
    off: vi.fn(),
    dragRotate: { disable: vi.fn(), enable: vi.fn() },
    touchZoomRotate: { disableRotation: vi.fn(), enableRotation: vi.fn() },
  };
}
type MockMapInstance = ReturnType<typeof makeMapInstance>;
const mapInstance = () => h.mapbox.instance as MockMapInstance;

vi.mock("./board-state", () => ({
  useBoard: () => h.board.value,
  useActiveCategory: () => h.board.activeCategory,
  useAvailableTravelModes: () => h.board.availableTravelModes,
}));
vi.mock("@/lib/stores/audio-tour-store", () => ({
  useAudioTourPhase: () => h.tour.phase,
  useCurrentTrack: () => h.tour.currentTrack,
}));
vi.mock("./BoardMap3D", () => ({
  BoardMap3D: (props: Record<string, unknown>) => {
    h.captured.board3d.push(props);
    return <div data-testid="board-3d" />;
  },
}));
vi.mock("./BoardMapControls", () => ({
  BoardMapControls: (props: Record<string, unknown>) => {
    h.captured.controls.push(props);
    return <div data-testid="board-controls" />;
  },
}));
vi.mock("@/lib/themes/map-styles", () => ({
  MAP_STYLE_STANDARD: "mapbox://styles/test",
  applyIllustratedTheme: vi.fn(),
}));
vi.mock("react-map-gl/mapbox", () => {
  // Ekte MapRef-form: `getMap()` gir spy-instansen, og `onLoad` fyrer ved mount
  // så `mapLoaded` flippes (uten det early-returnerer alle kamera-effektene og
  // testene måler ingenting).
  const MapMock = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    h.captured.mapProps.push(props);
    useImperativeHandle(ref, () => ({ getMap: () => h.mapbox.instance }), []);
    const onLoad = props.onLoad as ((e: unknown) => void) | undefined;
    useEffect(() => {
      onLoad?.({ type: "load" });
      // Én gang per mount — onLoad-identiteten skal ikke re-fyre lasten.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div data-testid="mapbox-map">{props.children as React.ReactNode}</div>
    );
  });
  MapMock.displayName = "MapMock";
  return { default: MapMock };
});
vi.mock("./BoardMarker", () => ({
  BoardMarker: (props: Record<string, unknown>) => {
    h.captured.markers.push(props);
    return <div data-testid="marker" />;
  },
}));
vi.mock("./HomeMarker", () => ({ HomeMarker: () => null }));
vi.mock("./BoardPathLayer", () => ({ BoardPathLayer: () => null }));
vi.mock("./BoardPathMidpointMarker", () => ({ BoardPathMidpointMarker: () => null }));
// Rutekilden er gjennomsiktig her: den fyrer et Directions-kall og hører til
// board-route-testene, ikke til BoardMaps kamera- og markør-oppførsel.
vi.mock("./board-route", () => ({
  BoardRouteProvider: ({ children }: { children: React.ReactNode }) => children,
  useBoardRoute: () => ({ data: null, error: null }),
}));
vi.mock("./BoardPOILabel", () => ({ BoardPOILabel: () => null }));
vi.mock("./BoardPOIMiniPopup", () => ({ BoardPOIMiniPopup: () => null }));
vi.mock("./use-board-zoom-tier", () => ({ useBoardZoomTier: () => "icon" }));
vi.mock("./use-popup-mode", () => ({ useBoardPopupMode: () => "label" }));

import { BoardMap } from "./BoardMap";

type AudioTrack = { url: string; manus: string };
const track: AudioTrack = { url: "/a.mp3", manus: "Hør her." };

function makePoi(id: string, catId = "restaurant") {
  return {
    id,
    coordinates: { lat: 63.43, lng: 10.4 },
    categoryId: "mat",
    raw: { category: { id: catId, color: "#cc3300", icon: "Utensils" } },
  };
}

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    projectSlug: "stasjonskvartalet",
    home: { name: "Hjem", coordinates: { lat: 63.43, lng: 10.4 }, address: "Gata 1" },
    categories: [
      { id: "mat", label: "Mat", lead: "", body: "", icon: "Utensils", color: "#cc3300", pois: [makePoi("p1")], topRankedPois: [] },
    ],
    poisById: new Map(),
    audioTourEnabled: false,
    welcome: undefined,
    outro: undefined,
    ...overrides,
  };
}

function setBoard(
  dataOverrides: Record<string, unknown> = {},
  stateOverrides: Record<string, unknown> = {},
  ctxOverrides: Record<string, unknown> = {},
) {
  const data = makeData(dataOverrides);
  h.board.value = {
    state: { phase: "default", activeCategoryId: null, activePOIId: null, ...stateOverrides },
    data,
    dispatch: vi.fn(),
    subFilter: { hiddenIds: new Set<string>() },
    visiblePoiIds: undefined,
    visibleIdsSource: null,
    collectionPoiIds: undefined,
    viewportRect: null,
    setViewportRect: vi.fn(),
    viewportGestures: 0,
    setViewportPoiIds: vi.fn(),
    mapCamera: null,
    setMapCamera: vi.fn(),
    ...ctxOverrides,
  };
  h.board.activeCategory = null;
}

beforeEach(() => {
  h.captured.controls = [];
  h.captured.board3d = [];
  h.captured.mapProps = [];
  h.captured.markers = [];
  h.mapbox.instance = makeMapInstance();
  h.tour.phase = "idle";
  h.tour.currentTrack = null;
  window.history.replaceState({}, "", "/");
  setBoard();
});
afterEach(() => cleanup());

const lastControls = () => h.captured.controls.at(-1);
/** Synlighet per POI-id, lest av markør-propsene (siste render vinner). */
function visibilityByPoi(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const props of h.captured.markers) {
    const poi = props.poi as { id: string };
    out[poi.id] = props.isVisible as boolean;
  }
  return out;
}
const lastMapProps = () => h.captured.mapProps.at(-1)!;
const boardCtx = () => h.board.value as Record<string, unknown>;
/** Simuler et Mapbox `moveend`. `originalEvent` satt = brukerinitiert gest. */
function fireMoveEnd(originalEvent: object | undefined) {
  const onMoveEnd = lastMapProps().onMoveEnd as
    | ((e: { type: string; originalEvent?: object }) => void)
    | undefined;
  act(() => {
    onMoveEnd?.({ type: "moveend", originalEvent });
  });
}

describe("BoardMap — AC1 persistent 3D-mount", () => {
  it("monterer BoardMap3D når has3dAddon=true", () => {
    const { getByTestId } = render(<BoardMap has3dAddon />);
    expect(getByTestId("board-3d")).toBeTruthy();
  });

  it("monterer IKKE BoardMap3D når has3dAddon=false (ren Mapbox-2D)", () => {
    const { queryByTestId, getByTestId } = render(<BoardMap has3dAddon={false} />);
    expect(queryByTestId("board-3d")).toBeNull();
    expect(getByTestId("mapbox-map")).toBeTruthy();
  });

  it("river ALDRI 3D-basen ned ved 3D→2D-toggle — Mapbox legges OPPÅ den persistente 3D-basen", () => {
    const { getByTestId, queryByTestId } = render(<BoardMap has3dAddon />);
    // Default 3D-view: 3D-base montert, Mapbox-overlay skjult (showMapbox=false).
    expect(getByTestId("board-3d")).toBeTruthy();
    expect(queryByTestId("mapbox-map")).toBeNull();
    // Brukeren bytter til 2D via kontrollene.
    act(() => {
      (lastControls()!.onViewChange as (m: "2d" | "3d") => void)("2d");
    });
    // 3D-basen er FORTSATT montert (persistent), nå med Mapbox-overlayet oppå.
    expect(getByTestId("board-3d")).toBeTruthy();
    expect(getByTestId("mapbox-map")).toBeTruthy();
  });
});

describe("BoardMap — Satelitt-view (sat) i skallet", () => {
  it("veksling til 'sat' holder Mapbox-overlayet nede (Google-motoren er front)", () => {
    const { getByTestId, queryByTestId } = render(<BoardMap has3dAddon />);
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("sat");
    });
    expect(lastControls()!.view).toBe("sat");
    expect(getByTestId("board-3d")).toBeTruthy();
    expect(queryByTestId("mapbox-map")).toBeNull();
  });

  it("sat → 2d monterer Mapbox-overlayet; 3D-basen består (persistent)", () => {
    const { getByTestId } = render(<BoardMap has3dAddon />);
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("sat");
    });
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("2d");
    });
    expect(lastControls()!.view).toBe("2d");
    expect(getByTestId("board-3d")).toBeTruthy();
    expect(getByTestId("mapbox-map")).toBeTruthy();
  });

  it("klikk på aktivt segment er no-op (R9) — view-referansen står", () => {
    render(<BoardMap has3dAddon />);
    const before = lastControls()!.view;
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)(before as string);
    });
    expect(lastControls()!.view).toBe(before);
  });

  it("publishViewport/isFront på 3D-basen gjelder i BÅDE sat og 3d (view !== '2d')", () => {
    render(<BoardMap has3dAddon publishViewport />);
    expect(h.captured.board3d.at(-1)!.isFront).toBe(true);
    expect(h.captured.board3d.at(-1)!.publishViewport).toBe(true);
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("sat");
    });
    expect(h.captured.board3d.at(-1)!.isFront).toBe(true);
    expect(h.captured.board3d.at(-1)!.publishViewport).toBe(true);
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("2d");
    });
    expect(h.captured.board3d.at(-1)!.isFront).toBe(false);
    expect(h.captured.board3d.at(-1)!.publishViewport).toBe(false);
  });
});

describe("BoardMap — drift-flip fra Satelitt (R8c/R8d)", () => {
  it("onOverheadBreak flipper view til 3d OG setter fri kameramodus (speiler Auto→Fri)", () => {
    setBoard({ welcome: track }); // VO-board: default auto
    render(<BoardMap has3dAddon />);
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("sat");
    });
    expect(lastControls()!.cameraMode).toBe("auto"); // sat-inngang rører ikke modusen

    act(() => {
      (h.captured.board3d.at(-1)!.onOverheadBreak as () => void)();
    });
    expect(lastControls()!.view).toBe("3d");
    expect(lastControls()!.cameraMode).toBe("free");
    expect(lastControls()!.showFreeHint).toBe(true);
  });

  it("segment-klikk sat→3d bevarer cameraMode (auto gjenopptas — R8d)", () => {
    setBoard({ welcome: track });
    render(<BoardMap has3dAddon />);
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("sat");
    });
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("3d");
    });
    expect(lastControls()!.cameraMode).toBe("auto");
  });

  it("overhead-propen på 3D-basen følger view", () => {
    render(<BoardMap has3dAddon />);
    expect(h.captured.board3d.at(-1)!.overhead).toBe(false);
    act(() => {
      (lastControls()!.onViewChange as (m: string) => void)("sat");
    });
    expect(h.captured.board3d.at(-1)!.overhead).toBe(true);
  });
});

describe("BoardMap — AC2 view/cameraMode eid av skallet + datadrevet hasVoiceOver", () => {
  it("default cameraMode=auto når voice-over finnes og ?fly ikke satt", () => {
    setBoard({ categories: [{ id: "mat", label: "Mat", lead: "", body: "", icon: "Utensils", color: "#cc3300", pois: [makePoi("p1")], topRankedPois: [], audio: track }] });
    render(<BoardMap has3dAddon />);
    expect(lastControls()!.cameraMode).toBe("auto");
  });

  it("default cameraMode=free på basic-tier (ingen voice-over) — auto er en tom modus", () => {
    setBoard(); // ingen audio/welcome/outro/home.audio
    render(<BoardMap has3dAddon />);
    expect(lastControls()!.cameraMode).toBe("free");
  });

  it("?fly=1 starter i free selv med voice-over (ikke kjempe mot intro-flythrough)", () => {
    window.history.replaceState({}, "", "/?fly=1");
    setBoard({ welcome: track });
    render(<BoardMap has3dAddon />);
    expect(lastControls()!.cameraMode).toBe("free");
  });

  it("cameraMode mates ned til BoardMap3D (skallet eier den, ikke motoren)", () => {
    setBoard({ outro: track });
    render(<BoardMap has3dAddon />);
    expect(h.captured.board3d.at(-1)!.cameraMode).toBe("auto");
  });
});

describe("BoardMap — AC3 BoardMapControls betinget + showCameraMode datadrevet", () => {
  it("mounter kontrollene når has3dAddon && interactive", () => {
    const { getByTestId } = render(<BoardMap has3dAddon interactive />);
    expect(getByTestId("board-controls")).toBeTruthy();
  });

  // ENDRET 2026-08-14: gaten var `has3dAddon && interactive`, så pillen fantes
  // bare på boards med 3D-tillegg. Reisemåte-velgeren gjelder ALLE boards, og
  // ville derfor vært usynlig på nøyaktig de boardsene som trenger den mest
  // (suburbane adresser uten 3D). Kart/3D-segmentet er nå betinget INNE i
  // komponenten via `showViewToggle`.
  it("mounter kontrollene også uten 3D-tillegg — men uten Kart/3D-segmentet", () => {
    const { getByTestId } = render(<BoardMap has3dAddon={false} interactive />);
    expect(getByTestId("board-controls")).toBeTruthy();
    expect(lastControls()!.showViewToggle).toBe(false);
  });

  it("showViewToggle=true når 3D-tillegget finnes", () => {
    render(<BoardMap has3dAddon interactive />);
    expect(lastControls()!.showViewToggle).toBe(true);
  });

  it("skjuler kontrollene når !interactive", () => {
    const { queryByTestId } = render(<BoardMap has3dAddon interactive={false} />);
    expect(queryByTestId("board-controls")).toBeNull();
  });

  it("mater reisemodusene og aktiv modus ned til kontrollene", () => {
    setBoard({}, { travelMode: "bike" });
    render(<BoardMap has3dAddon={false} interactive />);
    expect(lastControls()!.travelModes).toEqual(["walk", "bike", "car"]);
    expect(lastControls()!.travelMode).toBe("bike");
  });

  it("showCameraMode=true når en kategori har audio (datadrevet, ikke tier)", () => {
    setBoard({ categories: [{ id: "mat", label: "Mat", lead: "", body: "", icon: "Utensils", color: "#cc3300", pois: [makePoi("p1")], topRankedPois: [], reelsAudio: track }] });
    render(<BoardMap has3dAddon />);
    expect(lastControls()!.showCameraMode).toBe(true);
  });

  it("showCameraMode=false når ingen kategori/welcome/outro/home har audio", () => {
    setBoard();
    render(<BoardMap has3dAddon />);
    expect(lastControls()!.showCameraMode).toBe(false);
  });
});

describe("BoardMap — AC4 pointer-events-skjold ved !interactive", () => {
  const shieldOf = (container: HTMLElement) =>
    Array.from(container.querySelectorAll("div")).find(
      (d) => d.getAttribute("aria-hidden") === "true" && d.style.touchAction === "none",
    );

  it("legger skjoldet over kart-motorene når interactive=false", () => {
    const { container } = render(<BoardMap has3dAddon interactive={false} />);
    const shield = shieldOf(container);
    expect(shield).toBeTruthy();
    expect(shield!.className).toContain("z-10");
  });

  it("ingen skjold når interactive=true", () => {
    const { container } = render(<BoardMap has3dAddon interactive />);
    expect(shieldOf(container)).toBeUndefined();
  });
});

/** To POI-er i én kategori — nok til at et filtrert sett faktisk kan endre seg. */
const twoPoiData = () => ({
  categories: [
    {
      id: "mat",
      label: "Mat",
      lead: "",
      body: "",
      icon: "Utensils",
      color: "#cc3300",
      pois: [makePoi("p1"), makePoi("p2")],
      topRankedPois: [],
    },
  ],
});

describe("BoardMap — Unit 1: kamera-løkke-gaten (viewport-scope vs. event-filter)", () => {
  it("viewport-modus: nytt visiblePoiIds-sett flytter ALDRI kameraet", () => {
    // Uten gaten: panorer → nytt sett → refit → nye bounds → nytt sett. Løkke.
    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set(["p1"]),
      visibleIdsSource: "viewport-scope",
    });
    const { rerender } = render(<BoardMap />);
    mapInstance().fitBounds.mockClear();

    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set(["p1", "p2"]),
      visibleIdsSource: "viewport-scope",
    });
    rerender(<BoardMap />);

    expect(mapInstance().fitBounds).not.toHaveBeenCalled();
  });

  it("event-modus: nytt filtrert sett rammer kameraet inn som før (Kulturnatt-regresjon)", () => {
    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set(["p1"]),
      visibleIdsSource: "event-filter",
    });
    const { rerender } = render(<BoardMap eventMode />);
    mapInstance().fitBounds.mockClear();

    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set(["p1", "p2"]),
      visibleIdsSource: "event-filter",
    });
    rerender(<BoardMap eventMode />);

    expect(mapInstance().fitBounds).toHaveBeenCalledTimes(1);
  });

  it("nytt Set med IDENTISK innhold re-fyrer ikke fitten (nøkkel, ikke identitet)", () => {
    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set(["p1"]),
      visibleIdsSource: "event-filter",
    });
    const { rerender } = render(<BoardMap eventMode />);
    mapInstance().fitBounds.mockClear();

    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set(["p1"]),
      visibleIdsSource: "event-filter",
    });
    rerender(<BoardMap eventMode />);

    expect(mapInstance().fitBounds).not.toHaveBeenCalled();
  });

  it("tomt viewport-sett: kameraet står stille (ingen 'zoom til ingenting')", () => {
    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set<string>(),
      visibleIdsSource: "viewport-scope",
    });
    render(<BoardMap />);
    expect(mapInstance().fitBounds).not.toHaveBeenCalled();
  });

  it("tour aktiv + viewport-modus: tour-fitten eier kameraet, ingen dobbelt-fit", () => {
    h.tour.phase = "playing";
    setBoard(twoPoiData(), {}, {
      visiblePoiIds: new Set(["p1"]),
      visibleIdsSource: "viewport-scope",
    });
    render(<BoardMap />);
    expect(mapInstance().fitBounds).toHaveBeenCalledTimes(1);
  });
});

describe("BoardMap — Unit 1: viewport-publisering (R9 2D, R12)", () => {
  const setRectSpy = () => boardCtx().setViewportRect as ReturnType<typeof vi.fn>;
  const lastRect = () =>
    setRectSpy().mock.calls.at(-1)![0] as {
      west: number;
      south: number;
      east: number;
      north: number;
    };

  it("publiserer én gang når kartet lastes, så lista ikke er tom ved ankomst", () => {
    render(<BoardMap publishViewport />);
    expect(setRectSpy()).toHaveBeenCalledTimes(1);
  });

  it("brukerinitiert pan publiserer det ikke-okkluderte rektangelet", () => {
    render(<BoardMap publishViewport />);
    setRectSpy().mockClear();

    fireMoveEnd({ type: "touchend" });

    expect(setRectSpy()).toHaveBeenCalledTimes(1);
    const rect = lastRect();
    expect(rect.west).toBeCloseTo(px2lng(0), 9);
    expect(rect.east).toBeCloseTo(px2lng(MOCK_VIEWPORT.w), 9);
    expect(rect.north).toBeCloseTo(px2lat(0), 9);
    expect(rect.south).toBeCloseTo(px2lat(MOCK_VIEWPORT.h), 9);
  });

  it("sheet-høyden trekkes fra i PIKSLER (unproject), ikke ved bounds-aritmetikk", () => {
    render(<BoardMap publishViewport mapPaddingBottom={200} />);
    setRectSpy().mockClear();
    mapInstance().unproject.mockClear();

    fireMoveEnd({ type: "touchend" });

    // getBounds() ignorerer paddingen — derfor unprojiseres piksel-hjørnene.
    expect(mapInstance().getBounds).not.toHaveBeenCalled();
    expect(mapInstance().unproject).toHaveBeenCalledWith([0, 0]);
    expect(mapInstance().unproject).toHaveBeenCalledWith([MOCK_VIEWPORT.w, 600]);
    expect(lastRect().south).toBeCloseTo(px2lat(600), 9);
  });

  it("programmatisk kamerabevegelse (ingen originalEvent) publiserer ikke (R12)", () => {
    render(<BoardMap publishViewport />);
    setRectSpy().mockClear();

    fireMoveEnd(undefined);

    expect(setRectSpy()).not.toHaveBeenCalled();
  });

  it("endret sheet-høyde re-publiserer — hvileposisjon er en scope-endring (R12)", () => {
    const { rerender } = render(<BoardMap publishViewport mapPaddingBottom={100} />);
    setRectSpy().mockClear();

    rerender(<BoardMap publishViewport mapPaddingBottom={300} />);

    expect(setRectSpy()).toHaveBeenCalledTimes(1);
    expect(lastRect().south).toBeCloseTo(px2lat(MOCK_VIEWPORT.h - 300), 9);
  });

  it("flytter ALDRI kameraet når sheeten endrer høyde", () => {
    // `map.setPadding()` er `jumpTo({ padding })` i Mapbox — den re-sentrerer
    // kameraet umiddelbart. Med sheet-høyden som padding ga et drag fra bunn
    // til topp et synlig hopp i kartet midt i gesten. Sheeten er et LAG over
    // kartet; kartet skal ligge stille når laget vokser.
    const { rerender } = render(
      <BoardMap publishViewport sheetSurface mapPaddingBottom={100} />,
    );
    rerender(<BoardMap publishViewport sheetSurface mapPaddingBottom={600} />);

    expect(mapInstance().setPadding).not.toHaveBeenCalled();
  });

  it("beholder paddingen på desktop selv om utsnittet publiseres", () => {
    // 2026-08-13: desktop-sidebaren leser samme utsnitt som mobilsheeten, men
    // ingen sheet okkluderer kartet nedenfra. `mapPaddingLeft` må da fortsatt
    // settes, ellers rammes kategorien inn UNDER sidekolonnen.
    render(<BoardMap publishViewport mapPaddingLeft={16} />);

    expect(mapInstance().setPadding).toHaveBeenCalledWith(
      expect.objectContaining({ left: 16 }),
    );
  });

  it("beholder persistent padding på flater uten viewport-publisering", () => {
    // Event-boardet sender en KONSTANT padding, så re-sentreringen skjer én
    // gang ved montering og er usynlig. Der er padding fortsatt riktig verktøy.
    render(<BoardMap mapPaddingBottom={240} />);

    expect(mapInstance().setPadding).toHaveBeenCalledWith(
      expect.objectContaining({ bottom: 240 }),
    );
  });

  it("merker gest-publiseringen, men ikke last og sheet-høyde", () => {
    // Hintet (R28) og en senere «tilbake til boligen»-affordans må kunne skille
    // «brukeren tok i kartet» fra «layouten flyttet seg». Skillet kan ikke
    // utledes av rektangelet alene: en ny sheet-høyde endrer sørkanten uten at
    // brukeren har rørt kartet, og et hint som forsvant av seg selv ville aldri
    // blitt sett.
    const { rerender } = render(<BoardMap publishViewport mapPaddingBottom={100} />);
    expect(setRectSpy().mock.calls.at(-1)![1]).toEqual({ userGesture: false });

    rerender(<BoardMap publishViewport mapPaddingBottom={300} />);
    expect(setRectSpy().mock.calls.at(-1)![1]).toEqual({ userGesture: false });

    fireMoveEnd({ type: "touchend" });
    expect(setRectSpy().mock.calls.at(-1)![1]).toEqual({ userGesture: true });
  });

  it("publiserer ikke i det hele tatt når flaten ikke ber om det", () => {
    render(<BoardMap />);
    setRectSpy().mockClear();
    fireMoveEnd({ type: "touchend" });
    expect(setRectSpy()).not.toHaveBeenCalled();
  });

  it("låser bearing på SHEET-flaten — akse-justert rektangel uten toleranse", () => {
    render(<BoardMap publishViewport sheetSurface />);
    expect(mapInstance().dragRotate.disable).toHaveBeenCalled();
    expect(mapInstance().touchZoomRotate.disableRotation).toHaveBeenCalled();
  });

  it("rører ikke rotasjonen på event-flaten (verken publisering eller sheet)", () => {
    render(<BoardMap />);
    expect(mapInstance().dragRotate.disable).not.toHaveBeenCalled();
    expect(mapInstance().touchZoomRotate.disableRotation).not.toHaveBeenCalled();
  });

  it("rører ikke rotasjonen på desktop, som publiserer UTEN sheet", () => {
    // Rotasjonslåsen er et mobil-kompromiss (to-finger-rotasjon er en uhellsgest
    // under pinch). Den fulgte tidligere med publiseringen; desktop skal beholde
    // Mapbox' defaults selv om utsnittet publiseres.
    render(<BoardMap publishViewport />);
    expect(mapInstance().dragRotate.disable).not.toHaveBeenCalled();
    expect(mapInstance().touchZoomRotate.disableRotation).not.toHaveBeenCalled();
  });

  it("registrerer kamera-API-et kun på den publiserende flaten (kategoriside-push)", () => {
    const register = boardCtx().setMapCamera as ReturnType<typeof vi.fn>;
    const { unmount } = render(<BoardMap publishViewport />);
    const api = register.mock.calls.at(-1)![0];
    expect(typeof api.snapshot).toBe("function");
    expect(typeof api.restore).toBe("function");
    expect(typeof api.fitVisible).toBe("function");
    unmount();
    // Avregistreres ved unmount så en død motor aldri kan flytte kameraet.
    expect(register).toHaveBeenLastCalledWith(null);
  });

  it("registrerer IKKE kamera-API-et på desktop/event", () => {
    render(<BoardMap />);
    expect(boardCtx().setMapCamera).not.toHaveBeenCalled();
  });

  it("kamera-API-et beholder identitet gjennom sheet-drag (ingen re-registrering)", () => {
    // Ville identiteten skiftet med paddingen, ville hver hvileposisjon gitt ny
    // provider-state og en ekstra render-runde midt i en gest.
    const register = boardCtx().setMapCamera as ReturnType<typeof vi.fn>;
    const { rerender } = render(<BoardMap publishViewport mapPaddingBottom={100} />);
    const first = register.mock.calls.at(-1)![0];
    rerender(<BoardMap publishViewport mapPaddingBottom={300} />);
    expect(register.mock.calls.at(-1)![0]).toBe(first);
    expect(register).toHaveBeenCalledTimes(1);
  });
});

describe("BoardMap — AC5/AC6 source-guards (motor-camera-import + showMapbox-orkestrering)", () => {
  const src = readFileSync(
    join(process.cwd(), "components/variants/report/board/BoardMap.tsx"),
    "utf8",
  );

  it("AC5: PendingCamera importeres fra @/components/map/motor-camera, ingen UnifiedMapModal-ref", () => {
    expect(src).not.toContain("UnifiedMapModal");
    // Provenienskravet, ikke import-formen: `type` kan stå på setningen eller
    // inline på spesifikatoren (sistnevnte når verdier hentes fra samme modul).
    expect(src).toMatch(
      /import\s+(?:type\s+)?\{[^}]*\btype\s+PendingCamera\b[^}]*\}\s+from\s+"@\/components\/map\/motor-camera"|import\s+type\s+\{[^}]*\bPendingCamera\b[^}]*\}\s+from\s+"@\/components\/map\/motor-camera"/,
    );
  });

  it("AC6: useBoard fra board-state + audio-tour-store via selectors", () => {
    expect(src).toMatch(/from\s+"\.\/board-state"/);
    expect(src).toMatch(/useAudioTourPhase,\s*useCurrentTrack/);
  });

  it("AC6: showMapbox-orkestreringen (!has3dAddon || view === \"2d\") eies av denne unit", () => {
    expect(src).toMatch(/const showMapbox = !has3dAddon \|\| view === "2d";/);
  });

  it("AC7: ingen reportTier-referanse i skallet", () => {
    expect(src).not.toContain("reportTier");
  });
});

describe("markørsynlighet — markørklikk kaprer ikke kategorien (2026-08-13)", () => {
  /**
   * Synligheten leses av `BoardMarker`-propsene, ALDRI som antall DOM-noder:
   * markørene beholder DOM-identitet på tvers av filter-skifter og fader via
   * `isVisible`, så en node-telling ser uendret ut selv når filtreringen virker
   * (dokumentert felle i `placy-basic-tier-drill-in-20260608`).
   */
  const twoCategories = {
    categories: [
      {
        id: "mat",
        label: "Mat",
        lead: "",
        body: "",
        icon: "Utensils",
        color: "#cc3300",
        pois: [makePoi("p-mat")],
        topRankedPois: [],
      },
      {
        id: "natur",
        label: "Natur",
        lead: "",
        body: "",
        icon: "Trees",
        color: "#22c55e",
        pois: [makePoi("p-natur", "park")],
        topRankedPois: [],
      },
    ],
  };

  it("åpen POI uten aktiv kategori → ALLE markører er fortsatt synlige", () => {
    setBoard(twoCategories, { phase: "poi", activePOIId: "p-mat" });
    render(<BoardMap has3dAddon={false} />);
    expect(visibilityByPoi()).toEqual({ "p-mat": true, "p-natur": true });
  });

  it("overblikk (ingen kategori, ingen POI) → alle synlige", () => {
    setBoard(twoCategories);
    render(<BoardMap has3dAddon={false} />);
    expect(visibilityByPoi()).toEqual({ "p-mat": true, "p-natur": true });
  });

  it("aktiv kategori → kun kategoriens markører synlige (uendret oppførsel)", () => {
    setBoard(twoCategories, { phase: "active", activeCategoryId: "mat" });
    h.board.activeCategory = twoCategories.categories[0];
    render(<BoardMap has3dAddon={false} />);
    expect(visibilityByPoi()).toEqual({ "p-mat": true, "p-natur": false });
  });

  it("aktiv kategori + åpen POI → fortsatt kun kategoriens markører", () => {
    setBoard(twoCategories, {
      phase: "poi",
      activeCategoryId: "mat",
      activePOIId: "p-mat",
    });
    h.board.activeCategory = twoCategories.categories[0];
    render(<BoardMap has3dAddon={false} />);
    expect(visibilityByPoi()).toEqual({ "p-mat": true, "p-natur": false });
  });

  // REGRESJON 2026-08-14: chipen forsvant når man klikket den. Kart-klikket
  // leste chip-klikket som et bakgrunnsklikk og dispatchet BACK_TO_DEFAULT →
  // punktet lukket seg → chipen unmountet under fingeren.
  //
  // Chipen kan IKKE bruke markørenes stopPropagation-vei: den har interaktivt
  // innhold (modus-panelet), og et stoppet event ville aldri nådd Reacts
  // delegerte handlere. Den merkes med `data-travel-chip` og filtreres i
  // kart-klikket i stedet.
  describe("kart-klikk lukker punktet — men ikke fra tids-chipen", () => {
    const clickMapWith = (target: HTMLElement) => {
      const onClick = h.captured.mapProps.at(-1)!.onClick as (e: {
        originalEvent: { target: HTMLElement };
      }) => void;
      act(() => onClick({ originalEvent: { target } }));
    };

    it("klikk på kart-bakgrunn lukker et åpent punkt", () => {
      setBoard(twoCategories, { activePOIId: "p-natur" });
      render(<BoardMap has3dAddon={false} />);
      const dispatch = boardCtx().dispatch as ReturnType<typeof vi.fn>;

      clickMapWith(document.createElement("canvas"));

      expect(dispatch).toHaveBeenCalledWith({ type: "BACK_TO_DEFAULT" });
    });

    it("klikk INNE i tids-chipen lukker IKKE punktet", () => {
      setBoard(twoCategories, { activePOIId: "p-natur" });
      render(<BoardMap has3dAddon={false} />);
      const dispatch = boardCtx().dispatch as ReturnType<typeof vi.fn>;

      const chip = document.createElement("div");
      chip.setAttribute("data-travel-chip", "");
      const knapp = document.createElement("button");
      chip.appendChild(knapp);
      document.body.appendChild(chip);

      // Klikk på en knapp DYPT inne i chipen, ikke på wrapperen selv — det er
      // det ekte tilfellet (modus-rad eller selve chip-knappen).
      clickMapWith(knapp);

      expect(dispatch).not.toHaveBeenCalledWith({ type: "BACK_TO_DEFAULT" });
      document.body.removeChild(chip);
    });

    it("uten åpent punkt er kart-klikk en no-op", () => {
      setBoard(twoCategories);
      render(<BoardMap has3dAddon={false} />);
      const dispatch = boardCtx().dispatch as ReturnType<typeof vi.fn>;

      clickMapWith(document.createElement("canvas"));

      expect(dispatch).not.toHaveBeenCalledWith({ type: "BACK_TO_DEFAULT" });
    });
  });

  it("markør-onClick dispatcher OPEN_POI UTEN categoryId", () => {
    setBoard(twoCategories);
    render(<BoardMap has3dAddon={false} />);
    const dispatch = boardCtx().dispatch as ReturnType<typeof vi.fn>;
    const marker = h.captured.markers.find(
      (p) => (p.poi as { id: string }).id === "p-natur",
    )!;
    act(() => {
      (marker.onClick as () => void)();
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "OPEN_POI", id: "p-natur" });
  });
});
