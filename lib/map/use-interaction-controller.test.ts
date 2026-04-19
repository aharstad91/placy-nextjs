import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInteractionController } from "./use-interaction-controller";

// Minimal map shape the controller calls: stop() + flyTo()
function createMockMap() {
  return {
    stop: vi.fn(),
    flyTo: vi.fn(),
  };
}

function createMockElement(): HTMLElement {
  const el = document.createElement("div");
  el.scrollIntoView = vi.fn();
  return el;
}

describe("useInteractionController", () => {
  let rafCallbacks: FrameRequestCallback[] = [];
  let originalRAF: typeof window.requestAnimationFrame;

  beforeEach(() => {
    rafCallbacks = [];
    originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }) as typeof window.requestAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
  });

  function flushRAF() {
    const callbacks = rafCallbacks.slice();
    rafCallbacks = [];
    callbacks.forEach((cb) => cb(performance.now()));
  }

  it("flyTo triggers map.flyTo when current token wins the race", () => {
    const map = createMockMap();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => map as never,
        () => null,
        () => poi,
      ),
    );

    act(() => {
      result.current.flyTo("poi-1");
    });
    flushRAF();

    expect(map.stop).toHaveBeenCalledTimes(1);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [poi.lng, poi.lat], duration: 400 }),
    );
  });

  it("flyTo superseded call is cancelled — only latest runs", () => {
    const map = createMockMap();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => map as never,
        () => null,
        () => poi,
      ),
    );

    act(() => {
      result.current.flyTo("poi-1");
      result.current.flyTo("poi-2");
      result.current.flyTo("poi-3");
    });
    flushRAF();

    // stop() called per invocation, flyTo() only for the last token
    expect(map.stop).toHaveBeenCalledTimes(3);
    expect(map.flyTo).toHaveBeenCalledTimes(1);
  });

  it("scrollCardIntoView respects the latest scroll token only", () => {
    const el1 = createMockElement();
    const el2 = createMockElement();
    const cards = new Map<string, HTMLElement>([
      ["a", el1],
      ["b", el2],
    ]);
    const { result } = renderHook(() =>
      useInteractionController(
        () => null,
        (id) => cards.get(id) ?? null,
        () => null,
      ),
    );

    act(() => {
      result.current.scrollCardIntoView("a", { behavior: "instant" });
      result.current.scrollCardIntoView("b", { behavior: "instant" });
    });
    flushRAF();

    expect(el1.scrollIntoView).not.toHaveBeenCalled();
    expect(el2.scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("cancelAll prevents queued flyTo from executing", () => {
    const map = createMockMap();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => map as never,
        () => null,
        () => poi,
      ),
    );

    act(() => {
      result.current.flyTo("poi-1");
      result.current.cancelAll();
    });
    flushRAF();

    // Called at least once (from cancelAll, possibly from flyTo too)
    expect(map.stop).toHaveBeenCalled();
    expect(map.flyTo).not.toHaveBeenCalled();
  });

  it("flyTo with animate:false uses duration 0 (instant)", () => {
    const map = createMockMap();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => map as never,
        () => null,
        () => poi,
      ),
    );

    act(() => {
      result.current.flyTo("poi-1", { animate: false });
    });
    flushRAF();

    expect(map.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ duration: 0 }),
    );
  });

  it("flyTo silently aborts when map is null (mode-switch guard)", () => {
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => null,
        () => null,
        () => poi,
      ),
    );

    // Should not throw
    act(() => {
      result.current.flyTo("poi-1");
    });
    expect(() => flushRAF()).not.toThrow();
  });

  it("flyTo silently aborts when POI is missing", () => {
    const map = createMockMap();
    const { result } = renderHook(() =>
      useInteractionController(
        () => map as never,
        () => null,
        () => null,
      ),
    );

    act(() => {
      result.current.flyTo("missing-id");
    });
    flushRAF();

    expect(map.flyTo).not.toHaveBeenCalled();
  });
});
