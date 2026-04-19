import { describe, it, expect, vi } from "vitest";
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
