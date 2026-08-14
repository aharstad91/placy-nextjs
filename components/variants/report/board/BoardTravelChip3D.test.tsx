import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BoardTravelChip3D } from "./BoardTravelChip3D";
import { useBoard } from "./board-state";
import { useTravelChip } from "./use-travel-chip";
import { projectLatLngToScreen } from "@/components/map/project-latlng-to-screen";
import type { Map3DInstance } from "@/components/map/map-view-3d";
import type { TravelMode } from "@/lib/types";

/**
 * Tids-chipen i 3D (R11). Samme innhold som 2D-chipen — det er hele poenget med
 * `useTravelChip` — så testene her handler om det som er UNIKT for 3D:
 * per-frame-projeksjonen, skjuling når projeksjonen feiler, og at SVG-merket i
 * rutelaget faktisk er borte (ellers står to tids-visninger samtidig).
 */

vi.mock("./board-state", () => ({ useBoard: vi.fn() }));
vi.mock("./use-travel-chip", () => ({ useTravelChip: vi.fn() }));
vi.mock("@/components/map/project-latlng-to-screen", () => ({
  projectLatLngToScreen: vi.fn(),
}));

const dispatch = vi.fn();
const MAP3D = {} as Map3DInstance;

function setChip(
  overrides: {
    visible?: boolean;
    travelMode?: TravelMode;
    modes?: TravelMode[];
    minutes?: number;
    midpoint?: { lat: number; lng: number } | null;
  } = {},
) {
  vi.mocked(useBoard).mockReturnValue({
    state: { phase: "poi", activePOIId: "poi-1" },
    dispatch,
  } as unknown as ReturnType<typeof useBoard>);
  vi.mocked(useTravelChip).mockReturnValue({
    midpoint: overrides.midpoint === undefined ? { lat: 63.42, lng: 10.51 } : overrides.midpoint,
    minutes: overrides.minutes ?? 17,
    travelMode: overrides.travelMode ?? "bike",
    travelTime: { walk: 35, bike: 17, car: 11 },
    modes: overrides.modes ?? ["walk", "bike", "car"],
    expandable: (overrides.modes ?? ["walk", "bike", "car"]).length > 1,
    routeData: null,
    visible: overrides.visible ?? true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(projectLatLngToScreen).mockReturnValue({ x: 400, y: 300 });
  // rAF synkront så én runde med projeksjon kjører uten timere.
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BoardTravelChip3D — rendering", () => {
  it("viser aktiv modus' tid", () => {
    setChip();
    const { getByRole } = render(<BoardTravelChip3D map3d={MAP3D} />);
    expect(getByRole("button", { name: "Bytt reisemåte" }).textContent).toContain("17 min");
  });

  it("rendrer ingenting uten 3D-instans (kartet er ikke lastet ennå)", () => {
    setChip();
    const { container } = render(<BoardTravelChip3D map3d={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("rendrer ingenting når chipen ikke er synlig (ingen aktiv POI)", () => {
    setChip({ visible: false });
    const { container } = render(<BoardTravelChip3D map3d={MAP3D} />);
    expect(container.firstChild).toBeNull();
  });

  it("rendrer ingenting når midtpunktet mangler (rute med under tre koordinater)", () => {
    setChip({ visible: false, midpoint: null });
    const { container } = render(<BoardTravelChip3D map3d={MAP3D} />);
    expect(container.firstChild).toBeNull();
  });
});

describe("BoardTravelChip3D — per-frame projeksjon", () => {
  it("skriver translate3d direkte til DOM og gjør chipen synlig", () => {
    setChip();
    const { getByTestId } = render(<BoardTravelChip3D map3d={MAP3D} />);
    const el = getByTestId("travel-chip-3d");

    expect(el.style.transform).toContain("translate3d(400px, 300px, 0)");
    expect(el.style.opacity).toBe("1");
  });

  it("projiserer midtpunktet på chip-altitude, ikke bakkenivå", () => {
    setChip({ midpoint: { lat: 1, lng: 2 } });
    render(<BoardTravelChip3D map3d={MAP3D} />);
    expect(projectLatLngToScreen).toHaveBeenCalledWith(MAP3D, 1, 2, 12);
  });

  it("projeksjon null (bak kameraet) → opacity 0, ingen transform-skriv", () => {
    setChip();
    vi.mocked(projectLatLngToScreen).mockReturnValue(null);
    const { getByTestId } = render(<BoardTravelChip3D map3d={MAP3D} />);
    const el = getByTestId("travel-chip-3d");

    expect(el.style.opacity).toBe("0");
    expect(el.style.transform).toBe("");
  });
});

describe("BoardTravelChip3D — utvidelse", () => {
  it("klikk åpner panelet, og modusvalg dispatcher SET_TRAVEL_MODE", () => {
    setChip();
    const { getByRole } = render(<BoardTravelChip3D map3d={MAP3D} />);
    act(() => getByRole("button", { name: "Bytt reisemåte" }).click());
    act(() => getByRole("button", { name: /Bil/ }).click());

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_TRAVEL_MODE", mode: "car" });
  });

  it("åpent panel legger seg over POI-popupen i 3D (z-30)", () => {
    setChip();
    const { getByRole, getByTestId } = render(<BoardTravelChip3D map3d={MAP3D} />);
    expect(getByTestId("travel-chip-3d").className).toContain("z-20");

    act(() => getByRole("button", { name: "Bytt reisemåte" }).click());
    expect(getByTestId("travel-chip-3d").className).toContain("z-40");
  });

  it("bare én modus → ingen veksler, chipen er ren informasjon", () => {
    setChip({ modes: ["walk"], travelMode: "walk", minutes: 35 });
    const { getByRole } = render(<BoardTravelChip3D map3d={MAP3D} />);
    const chip = getByRole("button");

    expect(chip.hasAttribute("disabled")).toBe(true);
    expect(chip.getAttribute("aria-expanded")).toBeNull();
  });

  it("klikk utenfor lukker panelet uten å endre modus", () => {
    setChip();
    const { getByRole, queryByRole } = render(<BoardTravelChip3D map3d={MAP3D} />);
    act(() => getByRole("button", { name: "Bytt reisemåte" }).click());

    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(queryByRole("button", { name: /Bil/ })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("BoardTravelChip3D — kilde-invarianter", () => {
  const src = readFileSync(
    join(process.cwd(), "components/variants/report/board/BoardTravelChip3D.tsx"),
    "utf8",
  );

  it("skriver transform direkte til DOM, ikke via setState per frame", () => {
    // setState hver frame gir dropped frames under kamera-animasjon — hele
    // grunnen til at BoardPOI3DMiniPopup gjør det samme.
    expect(src).toContain("el.style.transform");
    expect(src).toContain("translate3d");
    expect(src).toContain("requestAnimationFrame");
  });

  it("rydder opp rAF-løkken ved unmount", () => {
    expect(src).toContain("cancelAnimationFrame");
  });

  it("henter innholdet fra den delte kilden, ikke fra rutedata direkte", () => {
    expect(src).toContain("useTravelChip");
    expect(src).not.toContain("useRouteData");
  });

  it("gjenbruker modus-utvalget fra 2D i stedet for å definere et nytt", () => {
    expect(src).toContain("TravelModeSelector");
    expect(src).toContain("TRAVEL_MODE_ICONS");
  });
});
