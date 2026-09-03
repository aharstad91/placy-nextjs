import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import type { ContourRing } from "@/lib/board/contour-geometry";
import type { Map3DInstance } from "./map-view-3d";
import { ContourLayer3D } from "./contour-layer-3d";

/**
 * Rekkevidde-konturene på Google-motoren.
 *
 * Invariantene som kan svikte stille:
 *  - Ett element per RING, ikke per kontur (MultiPolygon ville ellers blitt
 *    tegnet delvis, uten feilmelding).
 *  - Poolen gjenbrukes ved modusbytte: koordinater muteres, ingen nye instanser.
 *  - Av = ut av DOM-en, instansene består (3D-motoren kan ikke frigjøre
 *    WebGL-konteksten sin).
 *  - StrictMode-dobbeltkjøring bygger ikke poolen dobbelt opp.
 */

let polylineInstances: FakePolyline[] = [];

class FakePolyline {
  options: Record<string, unknown>;
  path: { lat: number; lng: number; altitude: number }[] | null = null;
  strokeWidth = 0;
  parentNode: unknown = null;
  removeCalls = 0;
  constructor(opts: Record<string, unknown>) {
    this.options = opts;
    polylineInstances.push(this);
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
    append(el: { parentNode: unknown }) {
      el.parentNode = map3d;
      appended.push(el);
    },
  };
  return map3d;
}

const FAKE_LIB = {
  Polyline3DElement: FakePolyline,
  AltitudeMode: { RELATIVE_TO_GROUND: "rel" },
};

let importLibrary: ReturnType<typeof vi.fn>;

beforeEach(() => {
  polylineInstances = [];
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

function square(offset: number): [number, number][] {
  return [
    [10.4 - offset, 63.4 - offset],
    [10.4 + offset, 63.4 - offset],
    [10.4 + offset, 63.4 + offset],
    [10.4 - offset, 63.4 + offset],
    [10.4 - offset, 63.4 - offset],
  ];
}

const THREE_RINGS: ContourRing[] = [
  { minutes: "5", outer: square(0.004), holes: [] },
  { minutes: "10", outer: square(0.008), holes: [] },
  { minutes: "15", outer: square(0.012), holes: [] },
];

describe("ContourLayer3D", () => {
  it("oppretter én linje per ring og legger dem i kartet", async () => {
    const map3d = makeMap3d();
    render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();

    expect(polylineInstances).toHaveLength(3);
    expect(map3d.appended).toHaveLength(3);
    expect(importLibrary).toHaveBeenCalledWith("maps3d");
  });

  it("bruker lys kantlinje og bakke-relativ høyde (lesbarhet på fotorealistiske fliser)", async () => {
    const map3d = makeMap3d();
    render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();

    const opts = polylineInstances[0].options;
    expect(opts.outerColor).toBeTruthy();
    expect(opts.outerWidth).toBeGreaterThan(0);
    expect(opts.altitudeMode).toBe("rel");
    expect(polylineInstances[0].path![0].altitude).toBeGreaterThan(0);
  });

  it("gir innerste kontur bredest strek og de ytre tynnere (R5)", async () => {
    const map3d = makeMap3d();
    render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();

    const widths = polylineInstances.map((p) => p.strokeWidth);
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[1]).toBeGreaterThan(widths[2]);
  });

  it("tegner ÉN linje per flate i en MultiPolygon-kontur", async () => {
    const map3d = makeMap3d();
    const rings: ContourRing[] = [
      ...THREE_RINGS,
      { minutes: "15", outer: square(0.02), holes: [] },
    ];
    render(<ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={rings} />);
    await flush();

    expect(polylineInstances).toHaveLength(4);
  });

  it("tegner hull som egne ringer — uten fyll er hullet en ekte grense", async () => {
    const map3d = makeMap3d();
    const rings: ContourRing[] = [
      { minutes: "10", outer: square(0.008), holes: [square(0.002)] },
    ];
    render(<ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={rings} />);
    await flush();

    expect(polylineInstances).toHaveLength(2);
  });

  it("modusbytte muterer koordinatene og oppretter ingen nye instanser", async () => {
    const map3d = makeMap3d();
    const { rerender } = render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();
    const before = polylineInstances.length;
    const firstCoords = polylineInstances[0].path;

    const bikeRings: ContourRing[] = [
      { minutes: "5", outer: square(0.01), holes: [] },
      { minutes: "10", outer: square(0.02), holes: [] },
      { minutes: "15", outer: square(0.03), holes: [] },
    ];
    rerender(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={bikeRings} />,
    );
    await flush();

    expect(polylineInstances).toHaveLength(before);
    expect(polylineInstances[0].path).not.toBe(firstCoords);
    expect(polylineInstances[0].path![0].lng).toBeCloseTo(10.39, 6);
  });

  it("av: linjene ut av DOM-en, instansene består", async () => {
    const map3d = makeMap3d();
    const { rerender } = render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();

    rerender(<ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={[]} />);
    await flush();

    expect(polylineInstances).toHaveLength(3);
    expect(polylineInstances.every((p) => p.parentNode === null)).toBe(true);

    // ...og på igjen: samme instanser tilbake i DOM-en, ingen nye opprettet.
    rerender(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();
    expect(polylineInstances).toHaveLength(3);
    expect(polylineInstances.every((p) => p.parentNode === map3d)).toBe(true);
  });

  it("et mindre sett tar overtallige linjer ut av DOM-en uten å rive dem", async () => {
    const map3d = makeMap3d();
    const { rerender } = render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();

    rerender(
      <ContourLayer3D
        map3d={map3d as unknown as Map3DInstance}
        rings={[THREE_RINGS[0]]}
      />,
    );
    await flush();

    expect(polylineInstances).toHaveLength(3);
    expect(polylineInstances[0].parentNode).toBe(map3d);
    expect(polylineInstances[1].parentNode).toBeNull();
    expect(polylineInstances[2].parentNode).toBeNull();
  });

  it("AE4: tom liste gir ingen linjer i DOM-en og ingen feil", async () => {
    const map3d = makeMap3d();
    render(<ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={[]} />);
    await flush();

    expect(map3d.appended).toHaveLength(0);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("uten kart gjøres ingenting", async () => {
    render(<ContourLayer3D map3d={null} rings={THREE_RINGS} />);
    await flush();
    expect(polylineInstances).toHaveLength(0);
    expect(importLibrary).not.toHaveBeenCalled();
  });

  it("dobbel kjøring av effekten bygger ikke poolen dobbelt opp", async () => {
    const map3d = makeMap3d();
    const { rerender } = render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    // Rerender med SAMME referanse før første flush: begge effektkjøringene
    // konkurrerer om å fylle poolen, som StrictMode gjør.
    rerender(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();

    expect(polylineInstances).toHaveLength(3);
  });

  it("en feil fra biblioteket logges og kaster ikke", async () => {
    importLibrary.mockRejectedValueOnce(new Error("maps3d utilgjengelig"));
    const map3d = makeMap3d();
    render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();

    expect(console.warn).toHaveBeenCalled();
    expect(map3d.appended).toHaveLength(0);
  });

  it("full unmount tar linjene ut av DOM-en", async () => {
    const map3d = makeMap3d();
    const { unmount } = render(
      <ContourLayer3D map3d={map3d as unknown as Map3DInstance} rings={THREE_RINGS} />,
    );
    await flush();
    unmount();

    expect(polylineInstances.every((p) => p.parentNode === null)).toBe(true);
  });
});
