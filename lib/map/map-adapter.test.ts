import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Map as MapboxMap } from "mapbox-gl";
import { mapboxAdapter, google3dAdapter, type GoogleMap3D } from "./map-adapter";

// --- Mapbox mock ---
function createMapboxMock(): MapboxMap & {
  stop: ReturnType<typeof vi.fn>;
  flyTo: ReturnType<typeof vi.fn>;
} {
  return {
    stop: vi.fn(),
    flyTo: vi.fn(),
  } as unknown as MapboxMap & {
    stop: ReturnType<typeof vi.fn>;
    flyTo: ReturnType<typeof vi.fn>;
  };
}

// --- Google 3D mock ---
type Map3DMock = GoogleMap3D & {
  flyCameraTo: ReturnType<typeof vi.fn>;
  stopCameraAnimation?: ReturnType<typeof vi.fn>;
};

function createGoogle3DMock(
  overrides: Partial<{
    tilt: number;
    heading: number;
    range: number;
    centerAltitude: number;
    withStop: boolean;
  }> = {},
): Map3DMock {
  const stopCameraAnimation = overrides.withStop !== false ? vi.fn() : undefined;
  return {
    flyCameraTo: vi.fn(),
    ...(stopCameraAnimation ? { stopCameraAnimation } : {}),
    tilt: overrides.tilt ?? 45,
    heading: overrides.heading ?? 90,
    range: overrides.range ?? 900,
    center: {
      lat: 63.4,
      lng: 10.4,
      altitude: overrides.centerAltitude ?? 0,
    },
  } as unknown as Map3DMock;
}

describe("mapboxAdapter", () => {
  it("flyTo konverterer {lat, lng} til [lng, lat] for Mapbox", () => {
    const map = createMapboxMock();
    const adapter = mapboxAdapter(map);
    adapter.flyTo({ lat: 63.4, lng: 10.4 });
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [10.4, 63.4],
        duration: 400,
        essential: true,
      }),
    );
  });

  it("flyTo respekterer animate:false → duration 0", () => {
    const map = createMapboxMock();
    const adapter = mapboxAdapter(map);
    adapter.flyTo({ lat: 63.4, lng: 10.4 }, { animate: false });
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 0 }),
    );
  });

  it("flyTo respekterer durationMs override", () => {
    const map = createMapboxMock();
    const adapter = mapboxAdapter(map);
    adapter.flyTo({ lat: 63.4, lng: 10.4 }, { durationMs: 1200 });
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 1200 }),
    );
  });

  it("stop kaller map.stop()", () => {
    const map = createMapboxMock();
    const adapter = mapboxAdapter(map);
    adapter.stop();
    expect(map.stop).toHaveBeenCalledTimes(1);
  });

  it("ignorerer altitude (2D)", () => {
    const map = createMapboxMock();
    const adapter = mapboxAdapter(map);
    adapter.flyTo({ lat: 63.4, lng: 10.4, altitude: 100 });
    // Mapbox-payload har ingen altitude — bare center + duration + essential
    const call = map.flyTo.mock.calls[0]?.[0];
    expect(call).not.toHaveProperty("altitude");
  });
});

describe("google3dAdapter", () => {
  it("flyTo bevarer eksisterende tilt, heading og range", () => {
    const map3d = createGoogle3DMock({
      tilt: 65,
      heading: 180,
      range: 1500,
    });
    const adapter = google3dAdapter(map3d);
    adapter.flyTo({ lat: 63.5, lng: 10.5 });

    expect(map3d.flyCameraTo).toHaveBeenCalledWith(
      expect.objectContaining({
        endCamera: expect.objectContaining({
          tilt: 65,
          heading: 180,
          range: 1500,
        }),
        durationMillis: 400,
      }),
    );
  });

  it("flyTo bruker target.altitude når gitt, fallback til center.altitude", () => {
    const map3d = createGoogle3DMock({ centerAltitude: 42 });
    const adapter = google3dAdapter(map3d);

    // Uten target.altitude → bruker current center.altitude
    adapter.flyTo({ lat: 63.5, lng: 10.5 });
    expect(map3d.flyCameraTo).toHaveBeenCalledWith(
      expect.objectContaining({
        endCamera: expect.objectContaining({
          center: expect.objectContaining({ altitude: 42 }),
        }),
      }),
    );

    // Med target.altitude → bruker target-verdien
    adapter.flyTo({ lat: 63.5, lng: 10.5, altitude: 100 });
    expect(map3d.flyCameraTo).toHaveBeenLastCalledWith(
      expect.objectContaining({
        endCamera: expect.objectContaining({
          center: expect.objectContaining({ altitude: 100 }),
        }),
      }),
    );
  });

  it("flyTo respekterer animate:false → durationMillis 0", () => {
    const map3d = createGoogle3DMock();
    const adapter = google3dAdapter(map3d);
    adapter.flyTo({ lat: 63.5, lng: 10.5 }, { animate: false });
    expect(map3d.flyCameraTo).toHaveBeenCalledWith(
      expect.objectContaining({ durationMillis: 0 }),
    );
  });

  it("stop kaller stopCameraAnimation når tilgjengelig", () => {
    const map3d = createGoogle3DMock();
    const adapter = google3dAdapter(map3d);
    adapter.stop();
    expect(map3d.stopCameraAnimation).toHaveBeenCalledTimes(1);
  });

  it("stop er no-op når stopCameraAnimation mangler (feature-detection)", () => {
    const map3d = createGoogle3DMock({ withStop: false });
    const adapter = google3dAdapter(map3d);
    // Should not throw
    expect(() => adapter.stop()).not.toThrow();
  });

  it("konverterer {lat, lng} til Google sin center-form", () => {
    const map3d = createGoogle3DMock();
    const adapter = google3dAdapter(map3d);
    adapter.flyTo({ lat: 63.4, lng: 10.4 });
    expect(map3d.flyCameraTo).toHaveBeenCalledWith(
      expect.objectContaining({
        endCamera: expect.objectContaining({
          center: expect.objectContaining({ lat: 63.4, lng: 10.4 }),
        }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Unit 06.5 — board-facade-grense (AC4)
//
// map-adapter.ts er reference-only og dør med scroll-modalen (UnifiedMapModal).
// Boardets cancel/flyTo går via useBoard3DCamera (token-kansellering), IKKE via
// map-adapter. AC4: "map-adapter.ts har INGEN board-konsument etter porten."
// Source-nivå-vakt mot drift — leser filene via process.cwd() fordi
// import.meta.url-fil-URLer kaster under jsdom-env (memory-gotcha).
// ---------------------------------------------------------------------------
describe("Unit 06.5 — board-facade-grense (AC4)", () => {
  const boardDir = join(process.cwd(), "components/variants/report/board");
  const boardFiles = readdirSync(boardDir).filter(
    (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes(".test."),
  );

  it("ingen board-fil importerer map-adapter (boardet bruker useBoard3DCamera)", () => {
    const offenders = boardFiles.filter((f) =>
      /from\s*["'][^"']*map\/map-adapter["']/.test(
        readFileSync(join(boardDir, f), "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("BoardMap3D bruker useBoard3DCamera som cancel/flyTo-fasade", () => {
    const src = readFileSync(join(boardDir, "BoardMap3D.tsx"), "utf8");
    expect(src).toMatch(
      /import\s*\{[^}]*\buseBoard3DCamera\b[^}]*\}\s*from\s*["']\.\/use-board-3d-camera["']/,
    );
  });
});

// ---------------------------------------------------------------------------
// Unit 06.5 — mapboxAdapter-cut er CUTOVER-DEFERRED (AC3)
//
// AC3 ber om at mapboxAdapter-grenen FJERNES. Den er cutover-koblet: eneste
// gjenværende konsument er den reference-only scroll-modalen (UnifiedMapModal),
// som AC4 eksplisitt sier skal FORLATES urørt til cutover (PendingCamera-typen
// re-hjemles i Unit 7 først — PRD 06 §filtabell, l.119). UnifiedMapModal er
// dessuten LIVE-rendret (ReportThemeSection/ReportOverviewMap) og type-checket
// (tsconfig **/*.tsx), så å kutte mapboxAdapter nå bryter tsc. Denne sentinelen
// låser koblingen: når UnifiedMapModal mister mapboxAdapter-bruken ved cutover,
// feiler testen → signal om at AC3-kuttet nå kan fullføres.
// ---------------------------------------------------------------------------
describe("mapboxAdapter — cutover-deferred cut (AC3)", () => {
  it("konsumeres fortsatt av reference-only UnifiedMapModal (kuttet utsatt til cutover)", () => {
    const src = readFileSync(
      join(process.cwd(), "components/map/UnifiedMapModal.tsx"),
      "utf8",
    );
    expect(src).toMatch(/\bmapboxAdapter\b/);
  });

  it("google3dAdapter er den bevarte cancel/flyTo-fasaden (tilt/heading/range)", () => {
    // AC3-delen som ER innfridd nå: google3dAdapter bevarer 3D-posituren.
    const map3d = createGoogle3DMock({ tilt: 70, heading: 30, range: 800 });
    google3dAdapter(map3d).flyTo({ lat: 63.5, lng: 10.5 });
    expect(map3d.flyCameraTo.mock.calls[0][0].endCamera).toMatchObject({
      tilt: 70,
      heading: 30,
      range: 800,
    });
  });
});
