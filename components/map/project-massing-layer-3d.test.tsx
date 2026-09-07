import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectMassing } from "@/lib/map/project-massing";
import type { Map3DInstance } from "./map-view-3d";
import { ProjectMassingLayer3D } from "./project-massing-layer-3d";

let polygonInstances: FakePolygon[] = [];

class FakePolygon {
  path: { lat: number; lng: number; altitude: number }[] | null = null;
  altitudeMode: string | null = null;
  extruded = false;
  fillColor: string | null = null;
  strokeColor: string | null = null;
  strokeWidth: number | null = null;
  drawsOccludedSegments = true;
  parentNode: unknown = null;
  removeCalls = 0;

  constructor() {
    polygonInstances.push(this);
  }

  remove() {
    this.removeCalls++;
    this.parentNode = null;
  }
}

function makeMap3d() {
  const appended: unknown[] = [];
  const map3d = {
    appended,
    append(element: { parentNode: unknown }) {
      element.parentNode = map3d;
      appended.push(element);
    },
  };
  return map3d;
}

let importLibrary: ReturnType<typeof vi.fn>;

beforeEach(() => {
  polygonInstances = [];
  importLibrary = vi.fn(async () => ({
    Polygon3DElement: FakePolygon,
    AltitudeMode: { RELATIVE_TO_GROUND: "relative-to-ground", CLAMP_TO_GROUND: "clamp-to-ground" },
  }));
  vi.stubGlobal("google", { maps: { importLibrary } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve));
  });
}

describe("ProjectMassingLayer3D", () => {
  it("ekstruderer ett halvtransparent, bakke-relativt skall per bygg", async () => {
    const map3d = makeMap3d();
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={getProjectMassing("wesselslokka")!}
      />,
    );
    await flush();

    expect(importLibrary).toHaveBeenCalledWith("maps3d");
    expect(polygonInstances).toHaveLength(3);
    expect(map3d.appended).toHaveLength(3);
    for (const polygon of polygonInstances) {
      expect(polygon.altitudeMode).toBe("relative-to-ground");
      expect(polygon.extruded).toBe(true);
      expect(polygon.path).toHaveLength(4);
      expect(polygon.path?.every((point) => point.altitude === 14)).toBe(true);
      expect(polygon.fillColor).toContain("rgba");
      expect(polygon.strokeColor).toBeTruthy();
    }
  });

  it("tar volumene ut og inn igjen uten å opprette nye WebGL-elementer", async () => {
    const map3d = makeMap3d();
    const massing = getProjectMassing("wesselslokka")!;
    const { rerender } = render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={massing}
      />,
    );
    await flush();

    rerender(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={null}
      />,
    );
    expect(polygonInstances.every((polygon) => polygon.parentNode === null)).toBe(true);

    rerender(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={massing}
      />,
    );
    await flush();

    expect(polygonInstances).toHaveLength(3);
    expect(polygonInstances.every((polygon) => polygon.parentNode === map3d)).toBe(
      true,
    );
  });

  it("uten kart importeres ingenting", async () => {
    render(
      <ProjectMassingLayer3D
        map3d={null}
        massing={getProjectMassing("wesselslokka")!}
      />,
    );
    await flush();

    expect(importLibrary).not.toHaveBeenCalled();
    expect(polygonInstances).toHaveLength(0);
  });

  it("rydder alle polygoner ved full unmount", async () => {
    const map3d = makeMap3d();
    const { unmount } = render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={getProjectMassing("wesselslokka")!}
      />,
    );
    await flush();
    unmount();

    expect(polygonInstances.every((polygon) => polygon.parentNode === null)).toBe(true);
  });

  it("logger bibliotekfeil uten å kaste", async () => {
    importLibrary.mockRejectedValueOnce(new Error("maps3d utilgjengelig"));
    const map3d = makeMap3d();
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={getProjectMassing("wesselslokka")!}
      />,
    );
    await flush();

    expect(console.warn).toHaveBeenCalled();
    expect(map3d.appended).toHaveLength(0);
  });
});
