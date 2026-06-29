import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, cleanup, act } from "@testing-library/react";
import type { RouteData } from "@/lib/map/use-route-data";
import type { Map3DInstance } from "./map-view-3d";
import { RouteLayer3D } from "./route-layer-3d";

/**
 * Invariant-låsende tester for Unit 06.6 (rute-lag). Komponenten er en
 * verbatim-port — testene VERIFISERER de fire AC-ene mot drift, de endrer
 * ikke produksjonskode:
 *  AC1: ÉN langlevet Polyline3DElement per map3d; path MUTERES, ikke remount.
 *  AC2: StrictMode-cancelled-flagg + cleanup-effekter + importLibrary(maps3d).
 *  AC3: gangtid-badge via Marker3DInteractiveElement + inline buildBadgeSVG.
 *  AC4: ingen statisk tung Google-Maps-import (lazy-grense holdt).
 */

// ── Fakes for Google Maps 3D imperative-API ──────────────────────────────
let polylineInstances: FakePolyline[] = [];
let markerInstances: FakeMarker[] = [];

class FakePolyline {
  options: Record<string, unknown>;
  path: { lat: number; lng: number; altitude: number }[] | null = null;
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

class FakeMarker {
  position: { lat: number; lng: number; altitude: number };
  altitudeMode: unknown;
  parentNode: unknown = null;
  template: HTMLTemplateElement | null = null;
  removeCalls = 0;
  constructor(opts: { position: FakeMarker["position"]; altitudeMode: unknown }) {
    this.position = opts.position;
    this.altitudeMode = opts.altitudeMode;
    markerInstances.push(this);
  }
  append(tpl: HTMLTemplateElement) {
    this.template = tpl;
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
  Marker3DInteractiveElement: FakeMarker,
  AltitudeMode: { RELATIVE_TO_GROUND: "rel" },
};

let importLibrary: ReturnType<typeof vi.fn>;

beforeEach(() => {
  polylineInstances = [];
  markerInstances = [];
  importLibrary = vi.fn(async () => FAKE_LIB);
  vi.stubGlobal("google", { maps: { importLibrary } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Tøm mikrotask-køen så den asynkrone IIFE-en i effektene fullfører. */
async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r));
  });
}

function route(
  coords: { lat: number; lng: number }[],
  travelMinutes: number,
): RouteData {
  return { coordinates: coords, travelMinutes };
}

const A = route(
  [
    { lat: 1, lng: 1 },
    { lat: 2, lng: 2 },
    { lat: 3, lng: 3 },
  ],
  5,
);
const B = route(
  [
    { lat: 4, lng: 4 },
    { lat: 5, lng: 5 },
    { lat: 6, lng: 6 },
    { lat: 7, lng: 7 },
  ],
  9,
);

function mount(map3d: unknown, routeData: RouteData | null) {
  return render(
    <RouteLayer3D
      map3d={map3d as Map3DInstance}
      routeData={routeData}
    />,
  );
}

describe("RouteLayer3D — AC1 én langlevet polyline, path muteres", () => {
  it("konstruerer ÉN polyline, setter path m/ altitude 3, appender til map3d", async () => {
    const map3d = makeMap3d();
    mount(map3d, A);
    await flush();

    expect(polylineInstances).toHaveLength(1);
    const pl = polylineInstances[0];
    expect(pl.path).toEqual([
      { lat: 1, lng: 1, altitude: 3 },
      { lat: 2, lng: 2, altitude: 3 },
      { lat: 3, lng: 3, altitude: 3 },
    ]);
    // path settes FØR append (én append, parentNode = map3d).
    expect(map3d.appended).toContain(pl);
    expect(pl.parentNode).toBe(map3d);
    // Konstruktør-opsjoner = stroke/outer-konstantene + RELATIVE_TO_GROUND.
    expect(pl.options).toMatchObject({
      strokeColor: "#3B82F6",
      outerColor: "#FFFFFF",
      strokeWidth: 10,
      outerWidth: 0.4,
      altitudeMode: "rel",
      drawsOccludedSegments: true,
    });
  });

  it("muterer path på routeData-bytte UTEN å remounte (samme instans, ingen re-append)", async () => {
    const map3d = makeMap3d();
    const { rerender } = mount(map3d, A);
    await flush();
    const first = polylineInstances[0];

    rerender(
      <RouteLayer3D map3d={map3d as unknown as Map3DInstance} routeData={B} />,
    );
    await flush();

    // INGEN ny instans (ingen GPU-buffer-leak), samme ref, path mutert til B.
    expect(polylineInstances).toHaveLength(1);
    expect(polylineInstances[0]).toBe(first);
    expect(first.path).toEqual([
      { lat: 4, lng: 4, altitude: 3 },
      { lat: 5, lng: 5, altitude: 3 },
      { lat: 6, lng: 6, altitude: 3 },
      { lat: 7, lng: 7, altitude: 3 },
    ]);
    // parentNode allerede satt → polylinen appendes KUN én gang (badge
    // rebuildes separat per AC3, men polylinen forblir samme node i DOM).
    expect(map3d.appended.filter((x) => x === first)).toHaveLength(1);
  });

  it("tom/null routeData fjerner polyline fra DOM men beholder instansen for re-append", async () => {
    const map3d = makeMap3d();
    const { rerender } = mount(map3d, A);
    await flush();
    const pl = polylineInstances[0];

    // → tom path
    rerender(
      <RouteLayer3D
        map3d={map3d as unknown as Map3DInstance}
        routeData={route([], 0)}
      />,
    );
    await flush();
    expect(pl.removeCalls).toBeGreaterThanOrEqual(1);
    expect(pl.parentNode).toBeNull();

    // → ny data igjen: SAMME instans (ikke ny konstruksjon), re-appendes.
    rerender(
      <RouteLayer3D map3d={map3d as unknown as Map3DInstance} routeData={B} />,
    );
    await flush();
    expect(polylineInstances).toHaveLength(1);
    expect(polylineInstances[0]).toBe(pl);
    expect(pl.parentNode).toBe(map3d);
  });
});

describe("RouteLayer3D — AC2 StrictMode-race + cleanup + importLibrary", () => {
  it("kaller importLibrary('maps3d') (lazy runtime-import)", async () => {
    const map3d = makeMap3d();
    mount(map3d, A);
    await flush();
    expect(importLibrary).toHaveBeenCalledWith("maps3d");
  });

  it("cancelled-flagg: unmount FØR importLibrary resolver → ingen append (race-vern)", async () => {
    // Deferred importLibrary vi kontrollerer manuelt.
    let resolveLib: (v: typeof FAKE_LIB) => void = () => {};
    const pending = new Promise<typeof FAKE_LIB>((r) => {
      resolveLib = r;
    });
    importLibrary.mockImplementation(() => pending);

    const map3d = makeMap3d();
    const { unmount } = mount(map3d, A);
    // importLibrary er kalt, men IIFE-en venter på resolve.
    unmount();
    resolveLib(FAKE_LIB);
    await flush();

    // cancelled=true ETTER await → returnerer før konstruksjon/append.
    expect(polylineInstances).toHaveLength(0);
    expect(markerInstances).toHaveLength(0);
    expect(map3d.appended).toHaveLength(0);
  });

  it("full unmount fjerner BÅDE polyline OG badge fra DOM (de to unmount-cleanupene)", async () => {
    const map3d = makeMap3d();
    const { unmount } = mount(map3d, A);
    await flush();
    const pl = polylineInstances[0];
    const badge = markerInstances[0];
    expect(pl.parentNode).toBe(map3d);
    expect(badge.parentNode).toBe(map3d);

    unmount();

    expect(pl.removeCalls).toBeGreaterThanOrEqual(1);
    expect(pl.parentNode).toBeNull();
    expect(badge.removeCalls).toBeGreaterThanOrEqual(1);
    expect(badge.parentNode).toBeNull();
  });

  it("ref nullstilles ved unmount → ny mount konstruerer en NY polyline", async () => {
    const map3d = makeMap3d();
    const { unmount } = mount(map3d, A);
    await flush();
    expect(polylineInstances).toHaveLength(1);
    unmount();

    const map3dB = makeMap3d();
    mount(map3dB, A);
    await flush();
    // Fersk instans (ikke gjenbruk av ref-en fra forrige mount).
    expect(polylineInstances).toHaveLength(2);
  });
});

describe("RouteLayer3D — AC3 gangtid-badge via Marker3DInteractiveElement", () => {
  it("plasserer badge på path-midtpunkt (alt 12) m/ inline SVG og avrundede minutter", async () => {
    const map3d = makeMap3d();
    mount(map3d, route(A.coordinates as { lat: number; lng: number }[], 7.6));
    await flush();

    expect(markerInstances).toHaveLength(1);
    const m = markerInstances[0];
    // pathMidpoint([A,B,C]) → midt-elementet (index 1).
    expect(m.position).toMatchObject({ lat: 2, lng: 2, altitude: 12 });
    expect(m.altitudeMode).toBe("rel");
    expect(m.parentNode).toBe(map3d);
    // Template = inline SVG-badge fra buildBadgeSVG; 7.6 → "8 min".
    expect(m.template).not.toBeNull();
    const html = m.template!.innerHTML;
    expect(html.toLowerCase()).toContain("svg");
    expect(html).toContain("8 min");
  });

  it("path <3 koordinater → pathMidpoint null → INGEN badge (polyline rendres likevel)", async () => {
    const map3d = makeMap3d();
    mount(
      map3d,
      route(
        [
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
        ],
        4,
      ),
    );
    await flush();
    expect(markerInstances).toHaveLength(0);
    // polylinen krever ikke ≥3 punkter — den skal fortsatt rendres.
    expect(polylineInstances).toHaveLength(1);
  });

  it("rebygger badge ved routeData-bytte (posisjon read-only): gammel fjernes, ny m/ nye minutter", async () => {
    const map3d = makeMap3d();
    const { rerender } = mount(map3d, A);
    await flush();
    expect(markerInstances).toHaveLength(1);
    const old = markerInstances[0];
    expect(old.template!.innerHTML).toContain("5 min");

    rerender(
      <RouteLayer3D map3d={map3d as unknown as Map3DInstance} routeData={B} />,
    );
    await flush();

    expect(old.removeCalls).toBeGreaterThanOrEqual(1);
    expect(markerInstances).toHaveLength(2);
    expect(markerInstances[1].template!.innerHTML).toContain("9 min");
  });
});

describe("RouteLayer3D — AC4 lazy-grense (kilde-vakt)", () => {
  const src = readFileSync(
    join(process.cwd(), "components/map/route-layer-3d.tsx"),
    "utf8",
  );

  it("har INGEN statisk tung Google-Maps-/Mapbox-import (holdes ute av 2D-bundle)", () => {
    expect(src).not.toMatch(/from\s+["']@vis\.gl\/react-google-maps["']/);
    expect(src).not.toMatch(/from\s+["']@googlemaps\//);
    expect(src).not.toMatch(/from\s+["'][^"']*mapbox/);
  });

  it("bruker runtime importLibrary('maps3d') i stedet for statisk import", () => {
    expect(src).toMatch(/importLibrary\(\s*"maps3d"/);
  });

  it("Map3DInstance importeres KUN som type (ingen runtime-bundle-trekk av map-view-3d)", () => {
    expect(src).toMatch(
      /import type \{[^}]*Map3DInstance[^}]*\} from "\.\/map-view-3d"/,
    );
  });
});
