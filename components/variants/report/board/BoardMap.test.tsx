import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { forwardRef } from "react";
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
 */

const h = vi.hoisted(() => {
  // TOKEN leses som modul-konstant ved import → må settes FØR BoardMap importeres.
  // vi.hoisted kjører før modul-imports, så env-en er på plass i tide.
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "pk.test";
  return {
    board: { value: null as unknown, activeCategory: null as unknown },
    tour: { phase: "idle" as string, currentTrack: null as unknown },
    captured: { controls: [] as Record<string, unknown>[], board3d: [] as Record<string, unknown>[] },
  };
});

vi.mock("./board-state", () => ({
  useBoard: () => h.board.value,
  useActiveCategory: () => h.board.activeCategory,
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
vi.mock("react-map-gl/mapbox", () => {
  const MapMock = forwardRef<HTMLDivElement, { children?: React.ReactNode }>(
    (props, ref) => (
      <div ref={ref} data-testid="mapbox-map">
        {props.children}
      </div>
    ),
  );
  MapMock.displayName = "MapMock";
  return { default: MapMock };
});
vi.mock("./BoardMarker", () => ({ BoardMarker: () => <div data-testid="marker" /> }));
vi.mock("./HomeMarker", () => ({ HomeMarker: () => null }));
vi.mock("./BoardPathLayer", () => ({ BoardPathLayer: () => null }));
vi.mock("./BoardPathMidpointMarker", () => ({ BoardPathMidpointMarker: () => null }));
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

function setBoard(dataOverrides: Record<string, unknown> = {}, stateOverrides: Record<string, unknown> = {}) {
  const data = makeData(dataOverrides);
  h.board.value = {
    state: { phase: "default", activeCategoryId: null, activePOIId: null, ...stateOverrides },
    data,
    dispatch: vi.fn(),
    subFilter: { hiddenIds: new Set<string>() },
    visiblePoiIds: undefined,
    collectionPoiIds: undefined,
  };
  h.board.activeCategory = null;
}

beforeEach(() => {
  h.captured.controls = [];
  h.captured.board3d = [];
  h.tour.phase = "idle";
  h.tour.currentTrack = null;
  window.history.replaceState({}, "", "/");
  setBoard();
});
afterEach(() => cleanup());

const lastControls = () => h.captured.controls.at(-1);

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

  it("skjuler kontrollene når !has3dAddon", () => {
    const { queryByTestId } = render(<BoardMap has3dAddon={false} interactive />);
    expect(queryByTestId("board-controls")).toBeNull();
  });

  it("skjuler kontrollene når !interactive", () => {
    const { queryByTestId } = render(<BoardMap has3dAddon interactive={false} />);
    expect(queryByTestId("board-controls")).toBeNull();
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

describe("BoardMap — AC5/AC6 source-guards (motor-camera-import + showMapbox-orkestrering)", () => {
  const src = readFileSync(
    join(process.cwd(), "components/variants/report/board/BoardMap.tsx"),
    "utf8",
  );

  it("AC5: PendingCamera importeres fra @/components/map/motor-camera, ingen UnifiedMapModal-ref", () => {
    expect(src).not.toContain("UnifiedMapModal");
    expect(src).toMatch(/import\s+type\s+\{\s*PendingCamera\s*\}\s+from\s+"@\/components\/map\/motor-camera"/);
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
