import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { BoardPathLayer } from "./BoardPathLayer";
import { useBoard, useActivePOI, useActivePOICategory } from "./board-state";
import { useBoardRoute } from "./board-route";
import type { TravelMode } from "@/lib/types";

/**
 * Rutelinja, med vekt på fade-styringen (R10).
 *
 * REGRESJON 2026-08-14: et modusbytte faded ut linja umiddelbart, mens den nye
 * først kunne tegnes når Directions svarte. Kartet sto derfor tomt gjennom hele
 * hentingen — og fikk fade-inn ikke fyrt, sto linja usynlig helt til leseren
 * klikket punktet på nytt. Modusbytte skal BEHOLDE den gamle linja: den går til
 * samme punkt, bare en annen vei, så den er sann til den nye ankommer.
 */

vi.mock("react-map-gl/mapbox", () => ({
  Source: ({ children, data }: { children: ReactNode; data: GeoJSON.FeatureCollection }) => (
    <div data-testid="source" data-features={String(data.features.length)}>
      {children}
    </div>
  ),
  Layer: ({ id, paint }: { id: string; paint: Record<string, unknown> }) => (
    <div data-testid={id} data-opacity={String(paint["line-opacity"])} />
  ),
}));
vi.mock("./board-state", () => ({
  useBoard: vi.fn(),
  useActivePOI: vi.fn(),
  useActivePOICategory: vi.fn(),
}));
vi.mock("./board-route", () => ({ useBoardRoute: vi.fn() }));

const RUTE_A = {
  coordinates: [
    { lat: 63.42, lng: 10.51 },
    { lat: 63.425, lng: 10.515 },
    { lat: 63.43, lng: 10.52 },
  ],
  travelMinutes: 11,
};
/** Annen geometri — som en biltrasé mot samme punkt. */
const RUTE_B = {
  coordinates: [
    { lat: 63.42, lng: 10.51 },
    { lat: 63.421, lng: 10.518 },
    { lat: 63.43, lng: 10.52 },
  ],
  travelMinutes: 5,
};

function setup(
  o: { poiId?: string; travelMode?: TravelMode; route?: typeof RUTE_A | null } = {},
) {
  vi.mocked(useBoard).mockReturnValue({
    state: {
      phase: "poi",
      activePOIId: o.poiId ?? "poi-1",
      travelMode: o.travelMode ?? "walk",
    },
  } as unknown as ReturnType<typeof useBoard>);
  vi.mocked(useActivePOI).mockReturnValue({ id: "poi-1" } as ReturnType<typeof useActivePOI>);
  vi.mocked(useActivePOICategory).mockReturnValue({ color: "#c33" } as ReturnType<
    typeof useActivePOICategory
  >);
  vi.mocked(useBoardRoute).mockReturnValue({
    data: o.route === undefined ? RUTE_A : o.route,
    error: null,
  });
}

const opacityOf = (q: { queryByTestId: (id: string) => HTMLElement | null }) =>
  q.queryByTestId("board-path-line")?.getAttribute("data-opacity");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("BoardPathLayer — fade ved modusbytte", () => {
  it("fader inn når rutedata er klar", () => {
    setup();
    const q = render(<BoardPathLayer />);
    expect(opacityOf(q)).toBe("0");

    act(() => vi.advanceTimersByTime(60));
    expect(opacityOf(q)).toBe("1");
  });

  it("modusbytte fader IKKE ut den gamle linja mens den nye hentes", () => {
    setup({ travelMode: "walk" });
    const q = render(<BoardPathLayer />);
    act(() => vi.advanceTimersByTime(60));
    expect(opacityOf(q)).toBe("1");

    // Modusen byttes; rutedata er ennå den gamle (fetchen er underveis).
    setup({ travelMode: "car", route: RUTE_A });
    q.rerender(<BoardPathLayer />);

    // Den gamle linja går til SAMME punkt — den skal stå til den nye ankommer.
    expect(opacityOf(q)).toBe("1");
    expect(q.queryByTestId("source")?.getAttribute("data-features")).toBe("1");
  });

  it("ny geometri for samme punkt bytter linja uten å bli usynlig", () => {
    setup({ travelMode: "walk" });
    const q = render(<BoardPathLayer />);
    act(() => vi.advanceTimersByTime(60));

    setup({ travelMode: "car", route: RUTE_B });
    q.rerender(<BoardPathLayer />);
    act(() => vi.advanceTimersByTime(60));

    expect(opacityOf(q)).toBe("1");
    expect(q.queryByTestId("source")?.getAttribute("data-features")).toBe("1");
  });

  it("POI-bytte fader FORTSATT ut — den gamle linja peker til et annet sted", () => {
    setup({ poiId: "poi-1" });
    const q = render(<BoardPathLayer />);
    act(() => vi.advanceTimersByTime(60));
    expect(opacityOf(q)).toBe("1");

    setup({ poiId: "poi-2" });
    q.rerender(<BoardPathLayer />);

    expect(opacityOf(q)).toBe("0");
  });

  it("uten rutedata rendres ingen linje", () => {
    setup({ route: null });
    const q = render(<BoardPathLayer />);
    expect(q.queryByTestId("board-path-line")).toBeNull();
  });

  it("rute med under to koordinater rendres ikke", () => {
    setup({ route: { coordinates: [{ lat: 63.42, lng: 10.51 }], travelMinutes: 2 } });
    const q = render(<BoardPathLayer />);
    expect(q.queryByTestId("board-path-line")).toBeNull();
  });
});
