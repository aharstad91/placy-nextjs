import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import type { CuratedGeometryFeature } from "@/lib/types";
import type { Map3DInstance } from "./map-view-3d";
import { CuratedGeometryLayer3D } from "./curated-geometry-layer-3d";

/**
 * Kuratert geometri på Google-motoren.
 *
 * Invariantene som kan svikte stille:
 *  - Linja må ha den hvite kantlinja; uten den forsvinner den mot lyse tak, og
 *    ingenting i motoren sier fra.
 *  - Planlagt må SE svakere ut enn eksisterende. Google 3D har ingen dash, så
 *    opasitet og strekbredde er hele forskjellen — går den tapt, ser leseren
 *    en plan som et faktum.
 *  - Et annet tema enn det leseren står i skal ikke konkurrere.
 *  - Elementene gjenbrukes mellom renders (WebGL-buffere lekker ved remount).
 */

let polylineInstances: FakePolyline[] = [];
let polygonInstances: FakePolygon[] = [];

class FakePolyline {
  path: { lat: number; lng: number; altitude: number }[] | null = null;
  altitudeMode: string | null = null;
  strokeColor: string | null = null;
  outerColor: string | null = null;
  strokeWidth: number | null = null;
  outerWidth: number | null = null;
  zIndex: number | null = null;
  drawsOccludedSegments = false;
  parentNode: unknown = null;
  constructor() {
    polylineInstances.push(this);
  }
  remove() {
    this.parentNode = null;
  }
}

class FakePolygon {
  path: { lat: number; lng: number }[] | null = null;
  altitudeMode: string | null = null;
  extruded = true;
  drawsOccludedSegments = false;
  fillColor: string | null = null;
  strokeColor: string | null = null;
  strokeWidth: number | null = null;
  zIndex: number | null = null;
  parentNode: unknown = null;
  constructor() {
    polygonInstances.push(this);
  }
  remove() {
    this.parentNode = null;
  }
}

function makeMap3d() {
  const appended: (FakePolyline | FakePolygon)[] = [];
  const map3d = {
    appended,
    append(element: FakePolyline | FakePolygon) {
      element.parentNode = map3d;
      appended.push(element);
    },
  };
  return map3d;
}

const FAKE_LIB = {
  Polyline3DElement: FakePolyline,
  Polygon3DElement: FakePolygon,
  AltitudeMode: {
    RELATIVE_TO_GROUND: "relative-to-ground",
    CLAMP_TO_GROUND: "clamp-to-ground",
  },
};

let importLibrary: ReturnType<typeof vi.fn>;

beforeEach(() => {
  polylineInstances = [];
  polygonInstances = [];
  importLibrary = vi.fn(async () => FAKE_LIB);
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
    await new Promise((r) => setTimeout(r));
  });
}

/** Alfa-kanalen ut av en `rgba(...)`-streng — det er der status og tema bor. */
function alphaOf(color: string | null): number {
  const match = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(color ?? "");
  if (!match) throw new Error(`ikke en rgba-farge: ${color}`);
  return Number(match[1]);
}

const THEME_PARK = "tema-park";
const THEME_KULTUR = "tema-kultur";

const LINE: CuratedGeometryFeature = {
  id: "geo-promenade",
  name: "Elvepromenaden",
  kind: "line",
  themeId: THEME_PARK,
  status: "existing",
  precision: "sourced",
  color: "#22c68d",
  coordinates: [
    [10.4104, 63.4374],
    [10.4113, 63.4383],
    [10.4135, 63.4407],
  ],
};

const AREA: CuratedGeometryFeature = {
  id: "geo-dora2",
  name: "Dora 2",
  kind: "area",
  themeId: THEME_KULTUR,
  status: "existing",
  precision: "sourced",
  color: "#a06cf5",
  coordinates: [
    [10.4167, 63.4402],
    [10.4173, 63.4408],
    [10.4162, 63.4409],
    [10.4167, 63.4402],
  ],
};

function renderLayer(
  features: CuratedGeometryFeature[],
  activeThemeId: string | null,
  map3d = makeMap3d(),
) {
  const utils = render(
    <CuratedGeometryLayer3D
      map3d={map3d as unknown as Map3DInstance}
      features={features}
      activeThemeId={activeThemeId}
    />,
  );
  return { ...utils, map3d };
}

describe("CuratedGeometryLayer3D", () => {
  it("tegner linje som polyline og flate som polygon, og legger begge i kartet", async () => {
    const { map3d } = renderLayer([AREA, LINE], THEME_PARK);
    await flush();

    expect(polylineInstances).toHaveLength(1);
    expect(polygonInstances).toHaveLength(1);
    expect(map3d.appended).toHaveLength(2);
    expect(importLibrary).toHaveBeenCalledWith("maps3d");
  });

  it("linja får hvit kantlinje og bakke-relativ høyde (lesbarhet på fotofliser)", async () => {
    renderLayer([LINE], THEME_PARK);
    await flush();

    const line = polylineInstances[0];
    expect(line.outerColor).toMatch(/^rgba\(255, 255, 255/);
    expect(line.outerWidth).toBeGreaterThan(0);
    expect(line.strokeWidth).toBeGreaterThan(0);
    expect(line.altitudeMode).toBe("relative-to-ground");
    expect(line.path![0].altitude).toBeGreaterThan(0);
    expect(line.drawsOccludedSegments).toBe(true);
  });

  it("flaten fylles i temafargen og klemmes mot terrenget, ikke ekstruderes", async () => {
    renderLayer([AREA], THEME_KULTUR);
    await flush();

    const polygon = polygonInstances[0];
    expect(polygon.fillColor).toMatch(/^rgba\(160, 108, 245/);
    expect(alphaOf(polygon.fillColor)).toBeGreaterThan(0);
    expect(polygon.strokeColor).toMatch(/^rgba\(160, 108, 245/);
    expect(polygon.altitudeMode).toBe("clamp-to-ground");
    expect(polygon.extruded).toBe(false);
  });

  // Regresjonsvakt for en feil som var USYNLIG i DOM-en: flatene lå der med
  // riktig fyll og strek, og var likevel borte i Satelitt fordi byggets eget
  // mesh i fotoflisene dekket dem. En flate klemt til terrenget ligger under
  // bygget som står på den. Uten denne testen ville neste refaktorering kunne
  // fjerne flagget igjen og «alt ser riktig ut» i både test og DevTools.
  it("flaten tegnes gjennom bygget som står på den", async () => {
    renderLayer([AREA], THEME_KULTUR);
    await flush();

    expect(polygonInstances[0].drawsOccludedSegments).toBe(true);
  });

  it("koordinatene snus fra [lng, lat] til kartets {lat, lng}", async () => {
    renderLayer([LINE], THEME_PARK);
    await flush();

    expect(polylineInstances[0].path![0].lng).toBeCloseTo(10.4104, 6);
    expect(polylineInstances[0].path![0].lat).toBeCloseTo(63.4374, 6);
  });

  it("planlagt tegnes svakere og tynnere enn eksisterende (Google 3D har ingen dash)", async () => {
    renderLayer(
      [
        LINE,
        { ...LINE, id: "geo-planlagt", status: "planned" as const },
        { ...AREA, themeId: THEME_PARK },
        {
          ...AREA,
          id: "geo-flate-planlagt",
          themeId: THEME_PARK,
          status: "planned" as const,
        },
      ],
      THEME_PARK,
    );
    await flush();

    const [existingLine, plannedLine] = polylineInstances;
    expect(alphaOf(plannedLine.strokeColor)).toBeLessThan(
      alphaOf(existingLine.strokeColor),
    );
    expect(alphaOf(plannedLine.outerColor)).toBeLessThan(
      alphaOf(existingLine.outerColor),
    );
    expect(plannedLine.strokeWidth!).toBeLessThan(existingLine.strokeWidth!);

    const [existingArea, plannedArea] = polygonInstances;
    expect(alphaOf(plannedArea.fillColor)).toBeLessThan(
      alphaOf(existingArea.fillColor),
    );
    expect(alphaOf(plannedArea.strokeColor)).toBeLessThan(
      alphaOf(existingArea.strokeColor),
    );
  });

  it("mixed tegnes som eksisterende — forløpet finnes, planen bæres av teksten", async () => {
    renderLayer(
      [LINE, { ...LINE, id: "geo-mixed", status: "mixed" as const }],
      THEME_PARK,
    );
    await flush();

    expect(alphaOf(polylineInstances[1].strokeColor)).toBeCloseTo(
      alphaOf(polylineInstances[0].strokeColor),
      6,
    );
  });

  it("omtrentlig plassering dempes ekstra", async () => {
    renderLayer(
      [
        LINE,
        { ...LINE, id: "geo-omtrentlig", precision: "approximate" as const },
      ],
      THEME_PARK,
    );
    await flush();

    expect(alphaOf(polylineInstances[1].strokeColor)).toBeLessThan(
      alphaOf(polylineInstances[0].strokeColor),
    );
  });

  it("et annet temas geometri konkurrerer ikke med det leseren står i", async () => {
    renderLayer([LINE, { ...LINE, id: "geo-annet", themeId: THEME_KULTUR }], THEME_PARK);
    await flush();

    const [aktiv, annet] = polylineInstances;
    expect(alphaOf(annet.strokeColor)).toBeLessThan(
      alphaOf(aktiv.strokeColor) * 0.25,
    );
  });

  it("områdestoppet (uten aktivt tema) viser alt dempet, men ikke borte", async () => {
    const { rerender, map3d } = renderLayer([LINE], THEME_PARK);
    await flush();
    const aktivAlfa = alphaOf(polylineInstances[0].strokeColor);

    rerender(
      <CuratedGeometryLayer3D
        map3d={map3d as unknown as Map3DInstance}
        features={[LINE]}
        activeThemeId={null}
      />,
    );
    await flush();

    const nøytralAlfa = alphaOf(polylineInstances[0].strokeColor);
    expect(nøytralAlfa).toBeLessThan(aktivAlfa);
    expect(nøytralAlfa).toBeGreaterThan(aktivAlfa * 0.25);
  });

  it("temabytte muterer eksisterende elementer og oppretter ingen nye", async () => {
    const { rerender, map3d } = renderLayer([AREA, LINE], THEME_PARK);
    await flush();
    const line = polylineInstances[0];
    const polygon = polygonInstances[0];

    rerender(
      <CuratedGeometryLayer3D
        map3d={map3d as unknown as Map3DInstance}
        features={[AREA, LINE]}
        activeThemeId={THEME_KULTUR}
      />,
    );
    await flush();

    expect(polylineInstances).toHaveLength(1);
    expect(polygonInstances).toHaveLength(1);
    expect(polylineInstances[0]).toBe(line);
    expect(polygonInstances[0]).toBe(polygon);
    // ...og kartet fikk ingen nye append-kall for de samme elementene.
    expect(map3d.appended).toHaveLength(2);
  });

  it("flatene legges i kartet før linjene, og zIndex holder dem der", async () => {
    const { map3d } = renderLayer([LINE, AREA], THEME_PARK);
    await flush();

    expect(map3d.appended[0]).toBeInstanceOf(FakePolygon);
    expect(map3d.appended[1]).toBeInstanceOf(FakePolyline);
    expect(polygonInstances[0].zIndex!).toBeLessThan(
      polylineInstances[0].zIndex!,
    );
  });

  it("geometri som faller bort tas ut av DOM-en, instansen består", async () => {
    const { rerender, map3d } = renderLayer([AREA, LINE], THEME_PARK);
    await flush();

    rerender(
      <CuratedGeometryLayer3D
        map3d={map3d as unknown as Map3DInstance}
        features={[LINE]}
        activeThemeId={THEME_PARK}
      />,
    );
    await flush();

    expect(polygonInstances).toHaveLength(1);
    expect(polygonInstances[0].parentNode).toBeNull();
    expect(polylineInstances[0].parentNode).toBe(map3d);

    // ...og tilbake igjen: samme instans, ingen ny opprettet.
    rerender(
      <CuratedGeometryLayer3D
        map3d={map3d as unknown as Map3DInstance}
        features={[AREA, LINE]}
        activeThemeId={THEME_PARK}
      />,
    );
    await flush();
    expect(polygonInstances).toHaveLength(1);
    expect(polygonInstances[0].parentNode).toBe(map3d);
  });

  it("tom liste: ingenting tegnes og ingenting feiler — et vanlig board er uendret", async () => {
    const { map3d } = renderLayer([], THEME_PARK);
    await flush();

    expect(map3d.appended).toHaveLength(0);
    expect(polylineInstances).toHaveLength(0);
    expect(polygonInstances).toHaveLength(0);
    expect(importLibrary).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("uten kart gjøres ingenting", async () => {
    render(
      <CuratedGeometryLayer3D
        map3d={null}
        features={[AREA, LINE]}
        activeThemeId={THEME_PARK}
      />,
    );
    await flush();

    expect(polylineInstances).toHaveLength(0);
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it("dobbel kjøring av effekten lager ikke to elementer per geometri", async () => {
    const map3d = makeMap3d();
    const { rerender } = renderLayer([AREA, LINE], THEME_PARK, map3d);
    // Rerender med SAMME referanser før første flush: begge effektkjøringene
    // konkurrerer om å opprette elementene, som StrictMode gjør.
    rerender(
      <CuratedGeometryLayer3D
        map3d={map3d as unknown as Map3DInstance}
        features={[AREA, LINE]}
        activeThemeId={THEME_PARK}
      />,
    );
    await flush();

    expect(polylineInstances).toHaveLength(1);
    expect(polygonInstances).toHaveLength(1);
  });

  it("en feil fra biblioteket logges og kaster ikke", async () => {
    importLibrary.mockRejectedValueOnce(new Error("maps3d utilgjengelig"));
    const { map3d } = renderLayer([AREA, LINE], THEME_PARK);
    await flush();

    expect(console.warn).toHaveBeenCalled();
    expect(map3d.appended).toHaveLength(0);
  });

  it("full unmount tar geometrien ut av DOM-en", async () => {
    const { unmount } = renderLayer([AREA, LINE], THEME_PARK);
    await flush();
    unmount();

    expect(polylineInstances[0].parentNode).toBeNull();
    expect(polygonInstances[0].parentNode).toBeNull();
  });
});
