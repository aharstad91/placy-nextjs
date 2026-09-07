import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectMassing } from "@/lib/map/project-massing";
import type { Map3DInstance } from "./map-view-3d";
import { ProjectMassingLayer3D } from "./project-massing-layer-3d";

let polygonInstances: FakePolygon[] = [];

class FakePolygon {
  path: { lat: number; lng: number; altitude?: number }[] | null = null;
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
  const appended: FakePolygon[] = [];
  const map3d = {
    appended,
    append(element: FakePolygon) {
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
    const massing = getProjectMassing("wesselslokka")!;
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={massing}
      />,
    );
    await flush();

    expect(importLibrary).toHaveBeenCalledWith("maps3d");
    expect(polygonInstances.length).toBeGreaterThan(40);
    expect(map3d.appended.length).toBe(polygonInstances.length);
    // Rekkefølgen er grunnflate, så det som allerede står, så planens volumer.
    const planned = map3d.appended.slice(
      1 + (massing.standingBuildings?.length ?? 0),
    );
    const shells = planned.filter((polygon) => polygon.extruded);
    expect(shells.length).toBe(massing.buildings.length);
    const heights = new Set<number>();
    for (const polygon of shells) {
      expect(polygon.altitudeMode).toBe("relative-to-ground");
      expect(polygon.extruded).toBe(true);
      expect(polygon.path?.length).toBeGreaterThanOrEqual(3);
      const altitude = polygon.path![0].altitude!;
      expect(polygon.path?.every((point) => point.altitude === altitude)).toBe(true);
      heights.add(altitude);
      // Frostet hvit akryl, ikke grå betong: nesten hvitt fyll som slipper
      // terrenget gjennom, med skarp kant. Se SHELL_ALPHA for hvorfor lav
      // dekkevne er det som gjør dem lyse i stedet for mørke.
      expect(polygon.fillColor).toMatch(/^rgba\(255, 255, 255, 0\.9(2|5)\)$/);
      expect(polygon.strokeColor).toBeTruthy();
    }
    const fills = new Set(shells.map((polygon) => polygon.fillColor));
    expect(fills).toEqual(
      new Set(["rgba(255, 255, 255, 0.95)", "rgba(255, 255, 255, 0.92)"]),
    );
    const saleShells = shells.filter(
      (polygon) => polygon.fillColor === "rgba(255, 255, 255, 0.95)",
    );
    expect(saleShells.length).toBe(3);
    for (const polygon of saleShells) {
      expect(polygon.strokeColor).toBe("rgba(192, 127, 104, 0.95)");
    }
    // Hvert bygg står så høyt som takplanen tillater der det ligger: fra to
    // etasjer på felleshusene til åtte mot Tungasletta. Faller alt sammen til
    // én verdi, er etasjeavlesningen borte og feltet ser ut som én kake.
    const sorted = [...heights].sort((a, b) => a - b);
    expect(sorted.length).toBeGreaterThanOrEqual(5);
    expect(sorted.at(0)).toBe(7);
    expect(sorted.at(-1)).toBe(28);
  });

  it("legger planområdets grunnflate flatt på terrenget under volumene", async () => {
    const map3d = makeMap3d();
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={getProjectMassing("wesselslokka")!}
      />,
    );
    await flush();

    // Fotoflisene viser dagens parkeringsplasser der planen legger bygg. Blir
    // grunnflaten borte, står volumene oppå den gamle asfalten.
    const [ground] = polygonInstances;
    expect(ground.extruded).toBe(false);
    expect(ground.altitudeMode).toBe("clamp-to-ground");
    expect(ground.path?.length).toBeGreaterThan(20);
    expect(ground.path?.every((point) => point.altitude === undefined)).toBe(true);
    expect(ground.fillColor).toMatch(/^rgba\(107, 139, 95, 0\.8\)$/);
    expect(ground.strokeWidth).toBe(0);
    // Den skal tegnes først, ellers ligger den oppå byggene den bærer.
    expect(map3d.appended[0]).toBe(ground);
  });

  it("gir låven et volum, siden planen beholder den", async () => {
    const map3d = makeMap3d();
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={getProjectMassing("wesselslokka")!}
      />,
    );
    await flush();

    // Låven står der i dag og stikker opp gjennom grunnflaten. Uten et volum
    // blir taket hennes liggende som et fotografi mellom rene bokser.
    const laven = map3d.appended[1];
    expect(laven.extruded).toBe(true);
    expect(laven.altitudeMode).toBe("relative-to-ground");
    expect(laven.path?.every((point) => point.altitude === 11)).toBe(true);
    // Tett: gjennom et gjennomsiktig skall skinner taket hennes igjennom, og
    // da er vi like langt.
    expect(laven.fillColor).toBe("rgba(255, 255, 255, 0.98)");
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

    expect(polygonInstances.length).toBeGreaterThan(40);
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
