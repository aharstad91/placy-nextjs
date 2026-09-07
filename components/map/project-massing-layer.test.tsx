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
  }: {
    id: string;
    type: string;
    paint: Record<string, unknown>;
    minzoom?: number;
  }) => (
    <div
      data-testid={id}
      data-type={type}
      data-color={String(paint[`${type}-color`])}
      data-opacity={JSON.stringify(paint[`${type}-opacity`])}
      data-minzoom={String(minzoom)}
    />
  ),
}));

describe("ProjectMassingLayer", () => {
  it("tegner de tre volumene i prosjektets egen farge", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    expect(screen.getByTestId("project-massing-source").dataset.features).toBe("3");
    expect(screen.getByTestId("project-massing-fill").dataset.type).toBe("fill");
    expect(screen.getByTestId("project-massing-fill").dataset.color).toBe("#e79bbc");
    expect(screen.getByTestId("project-massing-outline").dataset.type).toBe("line");
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
});
