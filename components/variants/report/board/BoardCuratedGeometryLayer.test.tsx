import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { BoardCuratedGeometryLayer } from "./BoardCuratedGeometryLayer";
import { useBoard } from "./board-state";
import type { CuratedGeometryFeature } from "@/lib/types";

/**
 * Kuratert geometri i Mapbox-visningen.
 *
 * Vekten ligger på det som kan svikte stille og som ingen ser før på et møte:
 * at en flate faktisk blir et lukket polygon, at det PLANLAGTE havner i det
 * stiplede laget (feil her gjør et forslag til et ferdig anlegg), og at et
 * board uten geometri ikke tegner noe som helst.
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
      data-geojson={JSON.stringify(data)}
    >
      {children}
    </div>
  ),
  Layer: ({
    id,
    paint,
    filter,
    layout,
  }: {
    id: string;
    paint: Record<string, unknown>;
    filter?: unknown;
    layout?: Record<string, unknown>;
  }) => (
    <div
      data-testid={id}
      data-dash={JSON.stringify(paint["line-dasharray"] ?? null)}
      data-opacity={JSON.stringify(
        paint["line-opacity"] ?? paint["fill-opacity"] ?? null,
      )}
      data-color={JSON.stringify(
        paint["line-color"] ?? paint["fill-color"] ?? null,
      )}
      data-filter={JSON.stringify(filter)}
      data-cap={String(layout?.["line-cap"] ?? "")}
    />
  ),
}));

vi.mock("./board-state", () => ({ useBoard: vi.fn() }));

const LINE: CuratedGeometryFeature = {
  id: "geo-line",
  name: "Elvepromenaden",
  kind: "line",
  themeId: "tema-park",
  status: "mixed",
  precision: "sourced",
  coordinates: [
    [10.41, 63.437],
    [10.411, 63.438],
    [10.412, 63.439],
  ],
};

/** Lukket ring, slik `CuratedGeometryFeature` krever den. */
const AREA: CuratedGeometryFeature = {
  id: "geo-area",
  name: "Dora 2",
  kind: "area",
  themeId: "tema-kultur",
  status: "existing",
  precision: "sourced",
  coordinates: [
    [10.416, 63.44],
    [10.417, 63.44],
    [10.417, 63.441],
    [10.416, 63.441],
    [10.416, 63.44],
  ],
};

const PLANNED_LINE: CuratedGeometryFeature = {
  id: "geo-planned",
  name: "Planlagt forlengelse",
  kind: "line",
  themeId: "tema-park",
  status: "planned",
  precision: "approximate",
  coordinates: [
    [10.413, 63.44],
    [10.414, 63.441],
  ],
};

function setup(
  features: CuratedGeometryFeature[],
  activeThemeId: string | null = "tema-park",
) {
  vi.mocked(useBoard).mockReturnValue({
    data: {
      categories: [
        { id: "tema-park", color: "#2f855a" },
        { id: "tema-kultur", color: "#b7791f" },
      ],
    },
  } as unknown as ReturnType<typeof useBoard>);

  return render(
    <BoardCuratedGeometryLayer
      features={features}
      activeThemeId={activeThemeId}
    />,
  );
}

function geojsonOf(el: HTMLElement): GeoJSON.FeatureCollection {
  return JSON.parse(el.getAttribute("data-geojson")!);
}

/**
 * Minimal filter-evaluator for de to formene laget bruker
 * (`["==" | "!=", ["get", key], value]`). Uten den ville testen bare sammenlignet
 * uttrykk med seg selv; med den svarer den på det som faktisk betyr noe —
 * havner denne featuren i dette laget?
 */
function passesFilter(
  filter: unknown,
  properties: GeoJSON.GeoJsonProperties,
): boolean {
  const [op, getter, value] = filter as [
    string,
    ["get", string],
    string | number,
  ];
  const actual = properties?.[getter[1]];
  return op === "==" ? actual === value : actual !== value;
}

function featureOf(collection: GeoJSON.FeatureCollection, id: string) {
  const found = collection.features.find((f) => f.properties?.id === id);
  if (!found) throw new Error(`fant ingen feature med id ${id}`);
  return found;
}

describe("BoardCuratedGeometryLayer", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => cleanup());

  it("tegner en linje som LineString, med koordinatene urørt", () => {
    const { getByTestId } = setup([LINE]);
    const feature = featureOf(geojsonOf(getByTestId("source")), "geo-line");
    expect(feature.geometry.type).toBe("LineString");
    // [lng, lat] inn = [lng, lat] ut. En snudd rekkefølge her hadde sendt
    // Elvepromenaden til Antarktis uten å feile noe sted.
    expect((feature.geometry as GeoJSON.LineString).coordinates).toEqual(
      LINE.coordinates,
    );
  });

  it("tegner en flate som Polygon med lukket ring", () => {
    const { getByTestId } = setup([AREA]);
    const feature = featureOf(geojsonOf(getByTestId("source")), "geo-area");
    expect(feature.geometry.type).toBe("Polygon");
    const ring = (feature.geometry as GeoJSON.Polygon).coordinates[0];
    expect(ring).toEqual(AREA.coordinates);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("lukker en ring som kom inn åpen, i stedet for å tegne noe udefinert", () => {
    const open: CuratedGeometryFeature = {
      ...AREA,
      coordinates: AREA.coordinates.slice(0, -1),
    };
    const { getByTestId } = setup([open]);
    const ring = (
      featureOf(geojsonOf(getByTestId("source")), "geo-area")
        .geometry as GeoJSON.Polygon
    ).coordinates[0];
    expect(ring).toHaveLength(AREA.coordinates.length);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it("planlagt havner i det stiplede laget, eksisterende i det hele", () => {
    const { getByTestId } = setup([LINE, AREA, PLANNED_LINE]);
    const collection = geojsonOf(getByTestId("source"));
    const solid = getByTestId("board-curated-geometry-line");
    const dashed = getByTestId("board-curated-geometry-line-planned");

    // Bare det planlagte laget har et prikkmønster — og mønsteret kan ikke være
    // data-drevet i Mapbox, som er nettopp derfor det er to lag.
    expect(JSON.parse(dashed.getAttribute("data-dash")!)).not.toBeNull();
    expect(JSON.parse(solid.getAttribute("data-dash")!)).toBeNull();

    const solidFilter = JSON.parse(solid.getAttribute("data-filter")!);
    const dashedFilter = JSON.parse(dashed.getAttribute("data-filter")!);

    for (const id of ["geo-line", "geo-area"]) {
      const props = featureOf(collection, id).properties;
      expect(passesFilter(solidFilter, props)).toBe(true);
      expect(passesFilter(dashedFilter, props)).toBe(false);
    }

    const planned = featureOf(collection, "geo-planned").properties;
    expect(passesFilter(dashedFilter, planned)).toBe(true);
    expect(passesFilter(solidFilter, planned)).toBe(false);
  });

  it("fyller BARE flatene — en linje har ingen innside", () => {
    const { getByTestId } = setup([LINE, AREA]);
    const collection = geojsonOf(getByTestId("source"));
    const fillFilter = JSON.parse(
      getByTestId("board-curated-geometry-fill").getAttribute("data-filter")!,
    );
    expect(
      passesFilter(fillFilter, featureOf(collection, "geo-area").properties),
    ).toBe(true);
    expect(
      passesFilter(fillFilter, featureOf(collection, "geo-line").properties),
    ).toBe(false);
  });

  it("arver temaets farge, og lar feature-fargen overstyre den", () => {
    const custom: CuratedGeometryFeature = { ...LINE, id: "geo-egen", color: "#123456" };
    const { getByTestId } = setup([LINE, custom]);
    const collection = geojsonOf(getByTestId("source"));
    expect(featureOf(collection, "geo-line").properties?.color).toBe("#2f855a");
    expect(featureOf(collection, "geo-egen").properties?.color).toBe("#123456");
    // Paint leser fargen fra featuren, ikke fra en konstant.
    expect(
      JSON.parse(
        getByTestId("board-curated-geometry-line").getAttribute("data-color")!,
      ),
    ).toEqual(["get", "color"]);
  });

  it("demper en omtrentlig plassering under en kildebelagt", () => {
    const { getByTestId } = setup([LINE, PLANNED_LINE]);
    const collection = geojsonOf(getByTestId("source"));
    expect(
      Number(featureOf(collection, "geo-planned").properties?.lineOpacity),
    ).toBeLessThan(Number(featureOf(collection, "geo-line").properties?.lineOpacity));
  });

  it("gir planlagt fyll mindre vekt enn eksisterende fyll", () => {
    const plannedArea: CuratedGeometryFeature = {
      ...AREA,
      id: "geo-area-planlagt",
      status: "planned",
    };
    const { getByTestId } = setup([AREA, plannedArea]);
    const collection = geojsonOf(getByTestId("source"));
    expect(
      Number(featureOf(collection, "geo-area-planlagt").properties?.fillOpacity),
    ).toBeLessThan(
      Number(featureOf(collection, "geo-area").properties?.fillOpacity),
    );
  });

  it("fremhever det aktive temaet og demper de andre", () => {
    const { getByTestId } = setup([LINE, AREA], "tema-park");
    const opacity = JSON.parse(
      getByTestId("board-curated-geometry-line").getAttribute("data-opacity")!,
    );
    // ["*", ["get","lineOpacity"], ["case", ["==",["get","themeId"],aktivt], 1, dempet]]
    const weight = opacity[2];
    expect(weight[0]).toBe("case");
    expect(weight[1]).toEqual(["==", ["get", "themeId"], "tema-park"]);
    expect(weight[2]).toBe(1);
    expect(Number(weight[3])).toBeLessThan(1);
  });

  it("områdestoppet (null) demper ALT like mye — ingen leses som valgt", () => {
    const { getByTestId } = setup([LINE, AREA], null);
    for (const layer of [
      "board-curated-geometry-fill",
      "board-curated-geometry-line",
      "board-curated-geometry-line-planned",
    ]) {
      const opacity = JSON.parse(getByTestId(layer).getAttribute("data-opacity")!);
      // Ingen case-gren: én konstant vekt for hele laget.
      expect(typeof opacity[2]).toBe("number");
      expect(opacity[2]).toBeLessThan(1);
    }
  });

  it("tegner ingenting uten geometri — boardet er da uendret", () => {
    const { queryByTestId } = setup([]);
    expect(queryByTestId("source")).toBeNull();
  });

  it("hopper over geometri som ikke kan tegnes, uten å felle laget", () => {
    const stump: CuratedGeometryFeature = {
      ...LINE,
      id: "geo-stump",
      coordinates: [[10.41, 63.437]],
    };
    const { getByTestId } = setup([LINE, stump]);
    const collection = geojsonOf(getByTestId("source"));
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties?.id).toBe("geo-line");
  });
});
