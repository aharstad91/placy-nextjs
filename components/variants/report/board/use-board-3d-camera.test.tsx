import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBoard3DCamera } from "./use-board-3d-camera";
import { CUT_FADE_MS, CUT_SETTLE_MS } from "./board-3d-camera-director";
import type { CategoryCameraConfig } from "@/lib/types";

const poseA = { lat: 63.43, lng: 10.39, range: 500, tilt: 60, heading: 200 };
const poseB = { lat: 63.432, lng: 10.395, range: 450, tilt: 62, heading: 240 };
const config: CategoryCameraConfig = { a: poseA, b: poseB };

function makeMap() {
  return {
    flyCameraTo: vi.fn(),
    flyCameraAround: vi.fn(),
    stopCameraAnimation: vi.fn(),
  };
}

type Props = Parameters<typeof useBoard3DCamera>[0];
const props = (map: unknown, overrides: Partial<Props> = {}): Props => ({
  map3dInstance: map,
  cameraMode: "auto",
  home: { lat: 63.435, lng: 10.398 },
  activePOI: null,
  activeCategoryId: "mat-drikke",
  categoryConfig: config,
  audioDurationMs: 20000,
  audioPaused: false,
  reducedMotion: false,
  ...overrides,
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useBoard3DCamera — cut-transition", () => {
  it("kjører fade → instant hopp til A → settle → fade ut + A→B", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map),
    });

    // Cut starter: overlay synlig, hopp ennå ikke fyrt (venter på fade-in).
    expect(result.current.cutVisible).toBe(true);
    expect(map.flyCameraTo).not.toHaveBeenCalled();

    // Etter fade-in: instant hopp til A (durationMillis 0), fortsatt svart.
    act(() => vi.advanceTimersByTime(CUT_FADE_MS));
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    expect(map.flyCameraTo.mock.calls[0][0].durationMillis).toBe(0);
    expect(map.flyCameraTo.mock.calls[0][0].endCamera.center.lat).toBe(poseA.lat);
    expect(result.current.cutVisible).toBe(true);

    // Etter settle: fade tilbake + start A→B over voice-over-lengden.
    act(() => vi.advanceTimersByTime(CUT_SETTLE_MS));
    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).toHaveBeenCalledTimes(2);
    expect(map.flyCameraTo.mock.calls[1][0].endCamera.center.lat).toBe(poseB.lat);
    expect(map.flyCameraTo.mock.calls[1][0].durationMillis).toBe(20000);
  });

  it("kategori-skifte i settle-vinduet kansellerer gammel A→B (token-guard)", () => {
    const map = makeMap();
    const { result, rerender } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { activeCategoryId: "mat-drikke" }),
    });

    act(() => vi.advanceTimersByTime(CUT_FADE_MS)); // gammelt hopp til A fyrt
    map.flyCameraTo.mockClear();

    // Bytt kategori MENS vi er i settle-vinduet → ny intent, token bumpes,
    // gammel settle-timer (→ gammel A→B mot poseB) ryddes.
    const poseA2 = { ...poseA, lat: 63.5 };
    const poseB2 = { ...poseB, lat: 63.433 };
    act(() =>
      rerender(
        props(map, {
          activeCategoryId: "transport",
          categoryConfig: { a: poseA2, b: poseB2 },
        }),
      ),
    );

    // Kjør HELE den nye cut-en (fade + settle).
    act(() => vi.advanceTimersByTime(CUT_FADE_MS + CUT_SETTLE_MS));

    // Kun den nye sekvensens to kall skal finnes: hopp til A2 + A→B til B2.
    // Den GAMLE A→B-en (mot poseB) skal aldri ha fyrt.
    const targets = map.flyCameraTo.mock.calls.map((c) => c[0].endCamera.center.lat);
    expect(targets).toEqual([poseA2.lat, poseB2.lat]);
    expect(targets).not.toContain(poseB.lat); // ingen stale A→B
    expect(result.current.cutVisible).toBe(false);
  });

  it("redusert bevegelse: instant hopp til A, ingen cut-overlay, ingen A→B", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { reducedMotion: true }),
    });

    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1);
    expect(map.flyCameraTo.mock.calls[0][0].durationMillis).toBe(0);

    act(() => vi.advanceTimersByTime(CUT_FADE_MS + CUT_SETTLE_MS));
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1); // ingen videre bevegelse
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });

  it("pauset audio fryser bevegelsen (ingen fly-kall, ingen cut)", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { audioPaused: true }),
    });

    expect(result.current.cutVisible).toBe(false);
    act(() => vi.advanceTimersByTime(CUT_FADE_MS + CUT_SETTLE_MS));
    expect(map.flyCameraTo).not.toHaveBeenCalled();
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });

  it("A-only config: cut → orbit ved A (ingen B-fly)", () => {
    const map = makeMap();
    renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { categoryConfig: { a: poseA } }),
    });

    act(() => vi.advanceTimersByTime(CUT_FADE_MS)); // hopp til A
    act(() => vi.advanceTimersByTime(CUT_SETTLE_MS)); // settle → startMove
    expect(map.flyCameraAround).toHaveBeenCalledTimes(1);
    expect(map.flyCameraAround.mock.calls[0][0].camera.center.lat).toBe(poseA.lat);
  });
});

describe("useBoard3DCamera — orbit/free uten config", () => {
  it("ingen config → orbit-fallback (fly inn + orbit), ingen cut-overlay", () => {
    const map = makeMap();
    const { result } = renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { categoryConfig: undefined }),
    });

    expect(result.current.cutVisible).toBe(false);
    expect(map.flyCameraTo).toHaveBeenCalledTimes(1); // fly inn til orbit-hero
    act(() => vi.advanceTimersByTime(2000));
    expect(map.flyCameraAround).toHaveBeenCalledTimes(1); // orbit startet
  });

  it("free-modus → stopper, ingen fly", () => {
    const map = makeMap();
    renderHook((p: Props) => useBoard3DCamera(p), {
      initialProps: props(map, { cameraMode: "free", categoryConfig: undefined }),
    });
    expect(map.stopCameraAnimation).toHaveBeenCalled();
    expect(map.flyCameraTo).not.toHaveBeenCalled();
    expect(map.flyCameraAround).not.toHaveBeenCalled();
  });
});
