import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInteractionController } from "./use-interaction-controller";
import type { MapAdapter } from "./map-adapter";

// Minimal adapter shape the controller calls: stop() + flyTo()
function createMockAdapter(): MapAdapter & {
  stop: ReturnType<typeof vi.fn>;
  flyTo: ReturnType<typeof vi.fn>;
} {
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

  it("flyTo triggers adapter.flyTo when current token wins the race", () => {
    const adapter = createMockAdapter();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => adapter,
        () => null,
        () => poi,
      ),
    );

    act(() => {
      result.current.flyTo("poi-1");
    });
    flushRAF();

    expect(adapter.stop).toHaveBeenCalledTimes(1);
    expect(adapter.flyTo).toHaveBeenCalledTimes(1);
    expect(adapter.flyTo).toHaveBeenCalledWith(
      { lat: poi.lat, lng: poi.lng },
      expect.objectContaining({ animate: undefined }),
    );
  });

  it("flyTo superseded call is cancelled — only latest runs", () => {
    const adapter = createMockAdapter();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => adapter,
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
    expect(adapter.stop).toHaveBeenCalledTimes(3);
    expect(adapter.flyTo).toHaveBeenCalledTimes(1);
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
    const adapter = createMockAdapter();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => adapter,
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
    expect(adapter.stop).toHaveBeenCalled();
    expect(adapter.flyTo).not.toHaveBeenCalled();
  });

  it("flyTo with animate:false forwards animate option to adapter", () => {
    const adapter = createMockAdapter();
    const poi = { lat: 63.4, lng: 10.4 };
    const { result } = renderHook(() =>
      useInteractionController(
        () => adapter,
        () => null,
        () => poi,
      ),
    );

    act(() => {
      result.current.flyTo("poi-1", { animate: false });
    });
    flushRAF();

    expect(adapter.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ lat: poi.lat, lng: poi.lng }),
      expect.objectContaining({ animate: false }),
    );
  });

  it("flyTo silently aborts when adapter is null (mode-switch guard)", () => {
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
    const adapter = createMockAdapter();
    const { result } = renderHook(() =>
      useInteractionController(
        () => adapter,
        () => null,
        () => null,
      ),
    );

    act(() => {
      result.current.flyTo("missing-id");
    });
    flushRAF();

    expect(adapter.flyTo).not.toHaveBeenCalled();
  });

  // --- Mode-switch race (ny fra deepen) ---
  // Simulerer: flyTo(poiA) starter på adapterA. Før rAF-guard resolver,
  // bytter mapMode slik at getAdapter() returnerer adapterB. Etter
  // flushRAF skal IKKE adapterA.flyTo kalles (token-invalidation via
  // stop() + nytt flyTo). Dette fanger regresjoner der useInteractionController
  // lekker flyTo til en unmounted/byttet motor.
  it("mode-switch under pending flyTo: previous adapter sees no flyTo", () => {
    const adapterA = createMockAdapter();
    const adapterB = createMockAdapter();
    const poi = { lat: 63.4, lng: 10.4 };
    let active: MapAdapter = adapterA;

    const { result } = renderHook(() =>
      useInteractionController(
        () => active,
        () => null,
        () => poi,
      ),
    );

    // Start fly på adapterA
    act(() => {
      result.current.flyTo("poi-1");
    });
    // Simulér mode-switch: ny adapter + ny flyTo (token-bump canceller gammel)
    act(() => {
      active = adapterB;
      result.current.flyTo("poi-2");
    });
    flushRAF();

    // AdapterA skal aldri ha fått flyTo — kun den nye vinneren flyr
    expect(adapterA.flyTo).not.toHaveBeenCalled();
    expect(adapterB.flyTo).toHaveBeenCalledTimes(1);
  });
});
