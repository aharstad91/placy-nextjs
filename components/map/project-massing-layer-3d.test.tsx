import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getProjectMassing,
  type ProjectMassing,
} from "@/lib/map/project-massing";
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

let flattenerInstances: FakeFlattener[] = [];

/** Googles flattener stryker dagens trær og hus innenfor omrisset. Den er ny i
 *  motoren, så laget må klare seg uten den — derfor er den ikke med i standard-
 *  mocken; testene som gjelder den slår den på selv. */
class FakeFlattener {
  path: { lat: number; lng: number }[] | null = null;
  parentNode: unknown = null;

  constructor() {
    flattenerInstances.push(this);
  }

  remove() {
    this.parentNode = null;
  }
}

function withFlattener() {
  importLibrary.mockImplementation(async () => ({
    Polygon3DElement: FakePolygon,
    FlattenerElement: FakeFlattener,
    AltitudeMode: {
      RELATIVE_TO_GROUND: "relative-to-ground",
      CLAMP_TO_GROUND: "clamp-to-ground",
    },
  }));
}

let importLibrary: ReturnType<typeof vi.fn>;

beforeEach(() => {
  polygonInstances = [];
  flattenerInstances = [];
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

/** Grunnflate + gatetun + sti. Alt dette ligger flatt på terrenget og tegnes
 *  før noe reiser seg, så volumene i testene under starter etter det. */
function flatCount(massing: ProjectMassing) {
  return 1 + (massing.siteStreets?.length ?? 0) + (massing.sitePaths?.length ?? 0);
}

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
    // Rekkefølgen er de flate flatene, så det som allerede står, så volumene.
    const planned = map3d.appended.slice(
      flatCount(massing) + (massing.standingBuildings?.length ?? 0),
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

  it("tegner gatetun og sti flatt oppå grunnflaten", async () => {
    const map3d = makeMap3d();
    const massing = getProjectMassing("wesselslokka")!;
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={massing}
      />,
    );
    await flush();

    // Første er grunnflaten; så gatene, så stien. Uten dem står volumene i et
    // jorde, og planen leser ikke som et nabolag.
    const flat = map3d.appended.slice(1, flatCount(massing));
    expect(flat.length).toBe(
      massing.siteStreets!.length + massing.sitePaths!.length,
    );
    for (const polygon of flat) {
      expect(polygon.extruded).toBe(false);
      expect(polygon.altitudeMode).toBe("clamp-to-ground");
      expect(polygon.path?.every((point) => point.altitude === undefined)).toBe(true);
      expect(polygon.strokeWidth).toBe(0);
    }
    // Nesten tette: slipper det grønne gjennom, får asfalten grønnskjær og
    // forsvinner i jordet den ligger på.
    const streets = flat.slice(0, massing.siteStreets!.length);
    const paths = flat.slice(massing.siteStreets!.length);
    expect(new Set(streets.map((polygon) => polygon.fillColor))).toEqual(
      new Set(["rgba(216, 209, 199, 0.95)"]),
    );
    expect(new Set(paths.map((polygon) => polygon.fillColor))).toEqual(
      new Set(["rgba(240, 245, 240, 0.95)"]),
    );
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
    const massing = getProjectMassing("wesselslokka")!;
    const laven = map3d.appended[flatCount(massing)];
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

  it("stryker dagens trær og hus innenfor planområdet", async () => {
    withFlattener();
    const map3d = makeMap3d();
    const massing = getProjectMassing("wesselslokka")!;
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={massing}
      />,
    );
    await flush();

    expect(flattenerInstances.length).toBe(1);
    const flattener = flattenerInstances[0];
    // Samme omriss som grunnflaten: det som blir strøket er nøyaktig det
    // grønne teppet dekker, ikke en meter mer.
    expect(flattener.path?.length).toBe(massing.siteGround!.length);
    expect(flattener.path![0]).toEqual({
      lng: massing.siteGround![0][0],
      lat: massing.siteGround![0][1],
    });
    // Først av alt — flatingen er underlaget de andre flatene legger seg på.
    expect(map3d.appended[0]).toBe(flattener as unknown as FakePolygon);
    expect(flattener.parentNode).toBe(map3d);
  });

  it("tegner de samme volumene med og uten flatter i motoren", async () => {
    const map3d = makeMap3d();
    const massing = getProjectMassing("wesselslokka")!;
    render(
      <ProjectMassingLayer3D
        map3d={map3d as unknown as Map3DInstance}
        massing={massing}
      />,
    );
    await flush();
    const withoutFlattener = polygonInstances.length;

    cleanup();
    polygonInstances = [];
    flattenerInstances = [];
    withFlattener();
    const next = makeMap3d();
    render(
      <ProjectMassingLayer3D
        map3d={next as unknown as Map3DInstance}
        massing={massing}
      />,
    );
    await flush();

    expect(polygonInstances.length).toBe(withoutFlattener);
    expect(next.appended.length).toBe(withoutFlattener + 1);
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
