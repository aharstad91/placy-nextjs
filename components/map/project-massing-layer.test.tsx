import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { getProjectMassing } from "@/lib/map/project-massing";
import { ProjectMassingLayer } from "./project-massing-layer";

vi.mock("react-map-gl/mapbox", () => ({
  Source: ({
    id,
    data,
    children,
  }: {
    id: string;
    data: GeoJSON.FeatureCollection;
    children: ReactNode;
  }) => (
    <div data-testid={id} data-features={data.features.length}>
      {children}
    </div>
  ),
  Layer: ({
    id,
    type,
    paint,
    minzoom,
    filter,
  }: {
    id: string;
    type: string;
    paint: Record<string, unknown>;
    minzoom?: number;
    filter?: unknown;
  }) => (
    <div
      data-testid={id}
      data-type={type}
      data-color={String(paint[`${type}-color`])}
      data-opacity={JSON.stringify(paint[`${type}-opacity`])}
      data-minzoom={String(minzoom)}
      data-filter={JSON.stringify(filter)}
    />
  ),
}));

describe("ProjectMassingLayer", () => {
  it("tegner de tre volumene i prosjektets egen farge", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    expect(
      Number(screen.getByTestId("project-massing-source").dataset.features),
    ).toBeGreaterThan(40);
    expect(screen.getByTestId("project-massing-fill").dataset.type).toBe("fill");
    expect(screen.getByTestId("project-massing-fill").dataset.color).toBe("#f6e7dc");
    expect(screen.getByTestId("project-massing-outline").dataset.type).toBe("line");
  });

  it("skiller salgsbyggene fra resten av områdeplanen", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    const context = screen.getByTestId("project-massing-context-fill");
    expect(context.dataset.color).toBe("#fbf4ee");
    expect(context.dataset.filter).toContain("context");
    expect(screen.getByTestId("project-massing-fill").dataset.filter).toContain(
      "sale",
    );
    // Bokstavene hører salgsbyggene til; kontekstvolumene har ingen navn.
    expect(screen.getByTestId("project-massing-label").dataset.filter).toContain(
      "sale",
    );
  });

  it("toner flatene inn med zoom i stedet for å ligge på i oversikten", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    // Hele feltet er noen få piksler bredt på boardets åpningszoom (~13,5).
    const fillOpacity = JSON.parse(
      screen.getByTestId("project-massing-fill").dataset.opacity!,
    ) as unknown[];
    expect(fillOpacity.slice(0, 3)).toEqual(["interpolate", ["linear"], ["zoom"]]);
    expect(fillOpacity[4]).toBe(0);
  });

  it("holder bokstavene borte til de får plass", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    expect(screen.getByTestId("project-massing-label").dataset.minzoom).toBe("15.5");
  });

  // Gatene er det som gjør at femti omriss leses som kvartaler og ikke som en
  // oppstilling i et jorde. Faller de ut av uttrekket, ser kartet fortsatt
  // riktig ut — det er bare tommere enn planen.
  it("legger gatetun og sti under byggene", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    const source = screen.getByTestId("project-surface-source");
    expect(Number(source.dataset.features)).toBeGreaterThanOrEqual(9);
    expect(screen.getByTestId("project-surface-street").dataset.color).toBe("#d8d1c7");
    expect(screen.getByTestId("project-surface-path").dataset.color).toBe("#f0f5f0");
    expect(screen.getByTestId("project-surface-street").dataset.filter).toContain(
      "street",
    );
    expect(screen.getByTestId("project-surface-path").dataset.filter).toContain(
      "path",
    );
    // Stien er lysere enn vektorkartet og forsvinner uten kant. Faller kanten
    // bort, ser laget riktig ut i koden og er borte på skjermen.
    const edge = screen.getByTestId("project-surface-path-edge");
    expect(edge.dataset.type).toBe("line");
    expect(edge.dataset.color).toBe("#cfa894");
  });

  it("toner gatene inn sammen med byggene", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    // Samme terskel som volumene. Et gatenett uten hus å høre til ville vært
    // uforståelig i oversikten.
    const opacity = JSON.parse(
      screen.getByTestId("project-surface-street").dataset.opacity!,
    ) as unknown[];
    expect(opacity[4]).toBe(0);
    expect(opacity[5]).toBe(15.4);
  });
});
