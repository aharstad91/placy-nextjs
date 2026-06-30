import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useRouteData } from "./use-route-data";
import type { POI } from "@/lib/types";

/**
 * Kontrakt-vakter for r11.5 (PRD 11 Unit 5): use-route-data ble portet
 * nær-verbatim. Maskinfester: debounce 200ms, AbortController, Zod max-500-coords
 * DoS-guard, AbortError svelget stille, PII-fri feil-logging, og board-kontekst-docstring.
 */

const PROJECT_CENTER = { lat: 63.4, lng: 10.4 };

function makePOI(id = "poi-1", lat = 63.41, lng = 10.41): POI {
  return {
    id,
    name: "Test POI",
    coordinates: { lat, lng },
    category: "cafe",
    description: "",
    tags: [],
    images: [],
  } as unknown as POI;
}

function validDirectionsResponse(coords: [number, number][] = [[10.4, 63.4], [10.41, 63.41]]) {
  return {
    geometry: { type: "LineString", coordinates: coords },
    duration: 5,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC3 — debounce 200ms
// ---------------------------------------------------------------------------

describe("useRouteData — debounce 200ms (AC3)", () => {
  it("kaller ikke fetch umiddelbart, men etter 200ms", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn(async () => ({
      ok: true,
      json: async () => validDirectionsResponse(),
    }));
    vi.stubGlobal("fetch", fetchFn as unknown as typeof fetch);

    renderHook(() => useRouteData(makePOI(), PROJECT_CENTER));

    expect(fetchFn).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(201); });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// AC3 — Zod max-500-coords DoS-guard
// ---------------------------------------------------------------------------

describe("useRouteData — Zod DoS-guard (AC3)", () => {
  it("setter error (ikke data) ved >500 koordinater i respons", async () => {
    vi.useFakeTimers();
    const over500 = Array.from({ length: 501 }, (_, i) => [10 + i * 0.001, 63 + i * 0.001] as [number, number]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ geometry: { type: "LineString", coordinates: over500 }, duration: 10 }),
      })) as unknown as typeof fetch,
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const { result } = renderHook(() => useRouteData(makePOI(), PROJECT_CENTER));
    // runAllTimersAsync advances the debounce timer AND flushes the promise chain
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toMatch(/invalid/i);

    vi.useRealTimers();
  });

  it("godtar nøyaktig 500 koordinater", async () => {
    vi.useFakeTimers();
    const exactly500 = Array.from({ length: 500 }, (_, i) => [10 + i * 0.001, 63 + i * 0.001] as [number, number]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ geometry: { type: "LineString", coordinates: exactly500 }, duration: 8 }),
      })) as unknown as typeof fetch,
    );

    const { result } = renderHook(() => useRouteData(makePOI(), PROJECT_CENTER));
    await act(async () => { await vi.runAllTimersAsync(); });

    expect(result.current.data?.coordinates).toHaveLength(500);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// AC3 — AbortError svelget stille
// ---------------------------------------------------------------------------

describe("useRouteData — AbortError svelget (AC3)", () => {
  it("setter ikke error-state ved AbortError", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, opts: RequestInit) => {
        const controller = opts?.signal as AbortSignal;
        return new Promise((_, reject) => {
          if (controller?.aborted) {
            const err = new DOMException("aborted", "AbortError");
            reject(err);
          }
          controller?.addEventListener("abort", () => {
            const err = new DOMException("aborted", "AbortError");
            reject(err);
          });
        });
      }) as unknown as typeof fetch,
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const poi1 = makePOI("poi-1", 63.41, 10.41);
    const poi2 = makePOI("poi-2", 63.42, 10.42);

    const { result, rerender } = renderHook(
      ({ poi }) => useRouteData(poi, PROJECT_CENTER),
      { initialProps: { poi: poi1 } },
    );

    await act(async () => { vi.advanceTimersByTime(100); });
    // Bytt POI før debounce utløser — avbryter forrige fetch
    rerender({ poi: poi2 });
    await act(async () => { vi.advanceTimersByTime(201); });

    // AbortError skal ikke sette error
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// AC3 — happy path: data settes korrekt
// ---------------------------------------------------------------------------

describe("useRouteData — happy path (AC3)", () => {
  it("returnerer koordinater (lat/lng) og travelMinutes ved gyldig respons", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => validDirectionsResponse([[10.4, 63.4], [10.41, 63.41]]),
      })) as unknown as typeof fetch,
    );

    const { result } = renderHook(() => useRouteData(makePOI(), PROJECT_CENTER));
    await act(async () => { await vi.runAllTimersAsync(); });

    // Mapbox-svar er [lng, lat]; hook konverterer til {lat, lng}
    expect(result.current.data?.coordinates[0]).toEqual({ lat: 63.4, lng: 10.4 });
    expect(result.current.data?.travelMinutes).toBe(5);
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });

  it("nullstiller data+error når activePOI settes til null", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => validDirectionsResponse(),
      })) as unknown as typeof fetch,
    );

    const { result, rerender } = renderHook(
      ({ poi }: { poi: POI | null }) => useRouteData(poi, PROJECT_CENTER),
      { initialProps: { poi: makePOI() as POI | null } },
    );
    await act(async () => { await vi.runAllTimersAsync(); });
    expect(result.current.data).not.toBeNull();

    rerender({ poi: null });
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// AC4 — UnifiedMapModal-referansen er fjernet fra docstring
// ---------------------------------------------------------------------------

describe("use-route-data source-vakt — ingen UnifiedMapModal-referanse (AC4)", () => {
  const src = readFileSync(
    join(process.cwd(), "lib", "map", "use-route-data.ts"),
    "utf8",
  );

  it("docstring nevner ikke UnifiedMapModal", () => {
    expect(src).not.toContain("UnifiedMapModal");
  });

  it("docstring nevner board-kontekst", () => {
    expect(src).toContain("board");
  });
});
