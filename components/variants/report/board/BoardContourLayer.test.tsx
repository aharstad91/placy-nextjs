import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { BoardContourLayer } from "./BoardContourLayer";
import { useBoard } from "./board-state";
import { useContourLabelsVisible } from "./use-board-zoom-tier";
import type { IsochroneContours, IsochroneSet, TravelMode } from "@/lib/types";

/**
 * Rekkevidde-konturene i Mapbox-visningen.
 *
 * Vekten ligger på gatene som kan svikte stille: av/på, en reisemåte uten
 * konturer (AE4), etikett-terskelen (AE8), og at et modusbytte bytter DATA
 * under samme kilde-id i stedet for å montere laget om.
 */

vi.mock("react-map-gl/mapbox", () => ({
  Source: ({
    id,
    children,
    data,
  }: {
    id: string;
    children: ReactNode;
    data: GeoJSON.FeatureCollection;
  }) => (
    <div
      data-testid="source"
      data-source-id={id}
      data-features={String(data.features.length)}
      data-contours={data.features.map((f) => f.properties!.contour).join(",")}
    >
      {children}
    </div>
  ),
  Layer: ({
    id,
    paint,
    filter,
  }: {
    id: string;
    paint: Record<string, unknown>;
    filter?: unknown;
  }) => (
    <div
      data-testid={id}
      data-width={String(paint["line-width"])}
      data-opacity={String(paint["line-opacity"])}
      data-dash={JSON.stringify(paint["line-dasharray"])}
      data-fill={paint["fill-color"] === undefined ? "none" : "some"}
      data-filter={JSON.stringify(filter)}
    />
  ),
  Marker: ({ children, latitude }: { children: ReactNode; latitude: number }) => (
    <div data-testid="contour-label" data-lat={String(latitude)}>
      {children}
    </div>
  ),
}));

vi.mock("./board-state", () => ({ useBoard: vi.fn() }));
vi.mock("./use-board-zoom-tier", () => ({ useContourLabelsVisible: vi.fn() }));

function square(offset: number) {
  return [
    [10.4 - offset, 63.4 - offset],
    [10.4 + offset, 63.4 - offset],
    [10.4 + offset, 63.4 + offset],
    [10.4 - offset, 63.4 + offset],
    [10.4 - offset, 63.4 - offset],
  ];
}

const contours = {
  "5": { type: "Polygon", coordinates: [square(0.004)] },
  "10": { type: "Polygon", coordinates: [square(0.008)] },
  "15": { type: "Polygon", coordinates: [square(0.012)] },
} as unknown as IsochroneContours;

function setup(options: {
  showContours: boolean;
  travelMode?: TravelMode;
  byMode?: IsochroneSet["byMode"];
  labelsVisible?: boolean;
}) {
  const isochrones =
    options.byMode === undefined
      ? undefined
      : ({
          isochronesVersion: 1,
          fetchedAt: "2026-09-03T00:00:00.000Z",
          byMode: options.byMode,
        } as IsochroneSet);

  vi.mocked(useBoard).mockReturnValue({
    state: { showContours: options.showContours, travelMode: options.travelMode ?? "walk" },
    data: { isochrones },
  } as unknown as ReturnType<typeof useBoard>);
  vi.mocked(useContourLabelsVisible).mockReturnValue(options.labelsVisible ?? true);

  const mapRef = { current: null };
  return render(<BoardContourLayer mapRef={mapRef} mapLoaded />);
}

describe("BoardContourLayer", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("tegner tre prikkede linjer for aktiv reisemåte", () => {
    const { getByTestId } = setup({ showContours: true, byMode: { walk: contours } });
    expect(getByTestId("source").getAttribute("data-contours")).toBe("5,10,15");
    for (const minutes of [5, 10, 15]) {
      const layer = getByTestId(`board-contour-${minutes}`);
      expect(layer.getAttribute("data-dash")).not.toBe("undefined");
      expect(JSON.parse(layer.getAttribute("data-filter")!)).toEqual([
        "==",
        ["get", "contour"],
        minutes,
      ]);
    }
  });

  it("tegner INGEN fyll — bare linjer (R5)", () => {
    const { getByTestId } = setup({ showContours: true, byMode: { walk: contours } });
    for (const minutes of [5, 10, 15]) {
      expect(getByTestId(`board-contour-${minutes}`).getAttribute("data-fill")).toBe("none");
    }
  });

  it("gjør den innerste tydeligst og de ytre svakere (R5)", () => {
    const { getByTestId } = setup({ showContours: true, byMode: { walk: contours } });
    const opacity = (m: number) =>
      Number(getByTestId(`board-contour-${m}`).getAttribute("data-opacity"));
    expect(opacity(5)).toBeGreaterThan(opacity(10));
    expect(opacity(10)).toBeGreaterThan(opacity(15));
  });

  it("tegner ingenting når konturene er av", () => {
    const { queryByTestId } = setup({ showContours: false, byMode: { walk: contours } });
    expect(queryByTestId("source")).toBeNull();
  });

  it("AE4: en reisemåte uten konturer gir ingenting, uten feil", () => {
    const { queryByTestId } = setup({
      showContours: true,
      travelMode: "bike",
      byMode: { walk: contours },
    });
    expect(queryByTestId("source")).toBeNull();
  });

  it("tegner ingenting når settet mangler helt", () => {
    const { queryByTestId } = setup({ showContours: true });
    expect(queryByTestId("source")).toBeNull();
  });

  it("gir én etikett per kontur, plassert nordover fra boligen (R7)", () => {
    const { getAllByTestId } = setup({ showContours: true, byMode: { walk: contours } });
    const labels = getAllByTestId("contour-label");
    expect(labels).toHaveLength(3);
    expect(labels.map((l) => l.textContent)).toEqual(["5 min", "10 min", "15 min"]);
    const lats = labels.map((l) => Number(l.getAttribute("data-lat")));
    expect(lats[0]).toBeLessThan(lats[1]);
    expect(lats[1]).toBeLessThan(lats[2]);
  });

  it("AE8: under etikett-grensen forsvinner etikettene, linjene består", () => {
    const { queryAllByTestId, getByTestId } = setup({
      showContours: true,
      byMode: { walk: contours },
      labelsVisible: false,
    });
    expect(queryAllByTestId("contour-label")).toHaveLength(0);
    expect(getByTestId("board-contour-5")).toBeTruthy();
  });

  it("modusbytte bytter data under SAMME kilde-id — ingen remontering", () => {
    const { getByTestId, rerender } = setup({
      showContours: true,
      travelMode: "walk",
      byMode: { walk: contours, car: contours },
    });
    const sourceId = getByTestId("source").getAttribute("data-source-id");

    vi.mocked(useBoard).mockReturnValue({
      state: { showContours: true, travelMode: "car" },
      data: {
        isochrones: {
          isochronesVersion: 1,
          fetchedAt: "2026-09-03T00:00:00.000Z",
          byMode: { walk: contours, car: contours },
        },
      },
    } as unknown as ReturnType<typeof useBoard>);
    rerender(<BoardContourLayer mapRef={{ current: null }} mapLoaded />);

    expect(getByTestId("source").getAttribute("data-source-id")).toBe(sourceId);
    expect(getByTestId("source").getAttribute("data-features")).toBe("3");
  });

  it("tegner alle flatene i en MultiPolygon-kontur", () => {
    const multi = {
      ...contours,
      "15": { type: "MultiPolygon", coordinates: [[square(0.012)], [square(0.02)]] },
    } as unknown as IsochroneContours;
    const { getByTestId } = setup({ showContours: true, byMode: { walk: multi } });
    expect(getByTestId("source").getAttribute("data-features")).toBe("4");
    expect(getByTestId("source").getAttribute("data-contours")).toBe("5,10,15,15");
  });
});
