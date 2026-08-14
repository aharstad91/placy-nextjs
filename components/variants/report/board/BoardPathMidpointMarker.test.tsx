import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { BoardPathMidpointMarker } from "./BoardPathMidpointMarker";
import { useBoard, useActivePOI, useAvailableTravelModes } from "./board-state";
import { useBoardRoute } from "./board-route";
import type { TravelMode } from "@/lib/types";

/**
 * Tids-chipen på ruta — den ene av to innganger til modusvalget (R5, R12).
 *
 * Mapbox `<Marker>` er mocket til en ren div: chipens oppførsel handler om
 * tilstand og treffområde, ikke om projeksjon (som Mapbox eier og som allerede
 * er dekket av kart-testene).
 */

vi.mock("react-map-gl/mapbox", () => ({
  Marker: ({ children }: { children: ReactNode }) => <div data-testid="marker">{children}</div>,
}));
vi.mock("./board-state", () => ({
  useBoard: vi.fn(),
  useActivePOI: vi.fn(),
  useAvailableTravelModes: vi.fn(),
}));
vi.mock("./board-route", () => ({ useBoardRoute: vi.fn() }));

const dispatch = vi.fn();

/** Rute med tre koordinater — `pathMidpoint` krever minst tre. */
const ROUTE = {
  coordinates: [
    { lat: 63.42, lng: 10.51 },
    { lat: 63.425, lng: 10.515 },
    { lat: 63.43, lng: 10.52 },
  ],
  travelMinutes: 12,
};

function setup(
  overrides: {
    phase?: string;
    travelMode?: TravelMode;
    modes?: TravelMode[];
    travelTime?: Partial<Record<TravelMode, number>>;
    route?: typeof ROUTE | null;
  } = {},
) {
  vi.mocked(useBoard).mockReturnValue({
    state: {
      phase: overrides.phase ?? "poi",
      activePOIId: "poi-1",
      travelMode: overrides.travelMode ?? "walk",
    },
    dispatch,
  } as unknown as ReturnType<typeof useBoard>);
  vi.mocked(useActivePOI).mockReturnValue({
    raw: { travelTime: overrides.travelTime ?? { walk: 35, bike: 17, car: 11 } },
  } as unknown as ReturnType<typeof useActivePOI>);
  vi.mocked(useAvailableTravelModes).mockReturnValue(
    overrides.modes ?? ["walk", "bike", "car"],
  );
  vi.mocked(useBoardRoute).mockReturnValue({
    data: overrides.route === undefined ? ROUTE : overrides.route,
    error: null,
  });
  return render(<BoardPathMidpointMarker />);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("BoardPathMidpointMarker — kollapset chip", () => {
  it("viser den PRECOMPUTEDE tiden for aktiv modus, ikke rutens varighet", () => {
    // Rutens travelMinutes er 12; precomputet gangtid er 35. Chipen og
    // nabolagslista må vise samme tall for samme punkt i samme modus.
    const { getByRole } = setup({ travelMode: "walk" });
    expect(getByRole("button").textContent).toContain("35 min");
  });

  it("bytter tall når modusen bytter", () => {
    const { getByRole } = setup({ travelMode: "bike" });
    expect(getByRole("button").textContent).toContain("17 min");
  });

  it("faller tilbake på rutens varighet når punktet mangler verdi for modusen", () => {
    const { getByRole } = setup({ travelMode: "car", travelTime: { walk: 35 } });
    expect(getByRole("button").textContent).toContain("12 min");
  });

  it("rendrer ingenting utenfor poi-fasen", () => {
    const { container } = setup({ phase: "default" });
    expect(container.firstChild).toBeNull();
  });

  it("rendrer ingenting uten rutedata", () => {
    const { container } = setup({ route: null });
    expect(container.firstChild).toBeNull();
  });

  it("rendrer ingenting når ruta har under tre koordinater (intet midtpunkt)", () => {
    const { container } = setup({
      route: { coordinates: ROUTE.coordinates.slice(0, 2), travelMinutes: 4 },
    });
    expect(container.firstChild).toBeNull();
  });
});

describe("BoardPathMidpointMarker — utvidelse (R5)", () => {
  it("klikk åpner panelet med alle tre tidene", () => {
    const { getByRole, getAllByRole } = setup();
    act(() => getByRole("button", { name: "Bytt reisemåte" }).click());

    expect(getAllByRole("button").map((b) => b.textContent)).toContain("Sykkel17 min");
  });

  it("klikk på en modus setter modusen og lukker panelet", () => {
    const { getByRole, queryByRole } = setup();
    act(() => getByRole("button", { name: "Bytt reisemåte" }).click());
    act(() => getByRole("button", { name: /Sykkel/ }).click());

    expect(dispatch).toHaveBeenCalledWith({ type: "SET_TRAVEL_MODE", mode: "bike" });
    expect(queryByRole("button", { name: /Sykkel/ })).toBeNull();
  });

  it("aria-expanded følger tilstanden", () => {
    const { getByRole } = setup();
    const chip = getByRole("button", { name: "Bytt reisemåte" });
    expect(chip.getAttribute("aria-expanded")).toBe("false");
    act(() => chip.click());
    expect(chip.getAttribute("aria-expanded")).toBe("true");
  });

  it("klikk utenfor lukker panelet uten å endre modus", () => {
    const { getByRole, queryByRole } = setup();
    act(() => getByRole("button", { name: "Bytt reisemåte" }).click());

    act(() => {
      document.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });

    expect(queryByRole("button", { name: /Sykkel/ })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("R12: panelet ligger absolutt plassert, så chipen flytter seg ikke når det åpnes", () => {
    const { getByRole, container } = setup();
    act(() => getByRole("button", { name: "Bytt reisemåte" }).click());

    const panel = container.querySelector(".absolute");
    expect(panel).toBeTruthy();
    // Foldretningen er én av de to — hvilken avgjøres av plass ved åpning.
    expect(
      panel!.className.includes("bottom-full") || panel!.className.includes("top-full"),
    ).toBe(true);
  });
});

describe("BoardPathMidpointMarker — R6: board uten flere modus", () => {
  it("bare gangtid → chipen er ikke klikkbar og har ingen chevron", () => {
    const { getByRole } = setup({ modes: ["walk"] });
    const chip = getByRole("button");

    expect(chip.getAttribute("aria-expanded")).toBeNull();
    expect(chip.hasAttribute("disabled")).toBe(true);
    expect(chip.className).toContain("cursor-default");
  });

  it("bare gangtid → klikk gjør ingenting", () => {
    const { getByRole } = setup({ modes: ["walk"] });
    act(() => getByRole("button").click());
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("flere modus → chipen tar imot klikk (pointer-events-auto på chipen selv)", () => {
    // Wrapperen er pointer-events-none så et markørklikk nær rutens midtpunkt
    // treffer markøren, ikke chipen. Treffområdet ligger på chipen.
    const { getByRole } = setup();
    expect(getByRole("button", { name: "Bytt reisemåte" }).className).toContain(
      "pointer-events-auto",
    );
  });
});
