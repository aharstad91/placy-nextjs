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
  }: {
    id: string;
    type: string;
    paint: Record<string, unknown>;
  }) => (
    <div
      data-testid={id}
      data-type={type}
      data-color={String(paint[`${type}-color`])}
      data-opacity={String(paint[`${type}-opacity`])}
    />
  ),
}));

describe("ProjectMassingLayer", () => {
  it("tegner tre transparente flater med en egen kontur", () => {
    render(<ProjectMassingLayer massing={getProjectMassing("wesselslokka")!} />);

    expect(screen.getByTestId("project-massing-source").dataset.features).toBe("4");
    expect(screen.getByTestId("project-massing-street").dataset.type).toBe("fill");
    expect(screen.getByTestId("project-massing-fill").dataset.type).toBe("fill");
    expect(screen.getByTestId("project-massing-fill").dataset.opacity).not.toBe("1");
    expect(screen.getByTestId("project-massing-outline").dataset.type).toBe("line");
  });
});
