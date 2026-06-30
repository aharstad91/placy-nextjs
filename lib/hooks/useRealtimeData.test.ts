import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useRealtimeData } from "./useRealtimeData";
import type { RealtimePOI } from "./useRealtimeData";
import { join } from "path";
import { readFileSync } from "fs";

const POI: RealtimePOI = {
  id: "poi-1",
  enturStopplaceId: "NSR:StopPlace:41742",
  bysykkelStationId: "YBR:Station:69",
  hyreStationId: "hyre-42",
};

const POI_NO_TRANSPORT: RealtimePOI = { id: "poi-no-transport" };

const ENTUR_RESPONSE = {
  stopPlace: { name: "Trondheim S" },
  quays: [
    {
      departures: [
        {
          departureTime: "2026-06-30T12:00:00",
          isRealtime: true,
          destination: "Lerkendal",
          lineCode: "5",
          transportMode: "bus",
          lineColor: "#FF0000",
        },
      ],
    },
  ],
  departures: [],
};

const BYSYKKEL_RESPONSE = {
  availableBikes: 3,
  availableDocks: 7,
  isOpen: true,
  name: "Nedre Elvehavn",
};

const HYRE_RESPONSE = {
  stationName: "Byhavn",
  numVehiclesAvailable: 2,
};

function makeFetch(overrides?: Partial<Record<"entur" | "bysykkel" | "hyre", Response | null>>) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/entur")) {
      const override = overrides?.entur;
      if (override === null) return Promise.reject(new Error("Network error"));
      if (override) return Promise.resolve(override);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ENTUR_RESPONSE) });
    }
    if (url.includes("/api/bysykkel")) {
      const override = overrides?.bysykkel;
      if (override === null) return Promise.reject(new Error("Network error"));
      if (override) return Promise.resolve(override);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(BYSYKKEL_RESPONSE) });
    }
    if (url.includes("/api/hyre")) {
      const override = overrides?.hyre;
      if (override === null) return Promise.reject(new Error("Network error"));
      if (override) return Promise.resolve(override);
      return Promise.resolve({ ok: true, json: () => Promise.resolve(HYRE_RESPONSE) });
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Initial state ─────────────────────────────────────────────────────────────

describe("useRealtimeData — initial state", () => {
  it("null poi → returns initial state without fetching", () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRealtimeData(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.lastUpdated).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("poi with no transport IDs → returns initial state without fetching", () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRealtimeData(POI_NO_TRANSPORT));

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Promise.allSettled partial-error tolerance (AC1) ─────────────────────────

describe("useRealtimeData — Promise.allSettled partial-error tolerance (AC1)", () => {
  it("all sources succeed → data populated, no error", async () => {
    vi.stubGlobal("fetch", makeFetch());

    const { result } = renderHook(() => useRealtimeData(POI));

    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull(), { timeout: 3000 });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.entur?.stopName).toBe("Trondheim S");
    expect(result.current.entur?.departures).toHaveLength(1);
    expect(result.current.bysykkel?.availableBikes).toBe(3);
    expect(result.current.hyre?.stationName).toBe("Byhavn");
  });

  it("one source rejects → error set, other sources still populated (AC1)", async () => {
    vi.stubGlobal("fetch", makeFetch({ entur: null }));

    const { result } = renderHook(() => useRealtimeData(POI));

    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull(), { timeout: 3000 });

    expect(result.current.error).toBe("Noe sanntidsdata er utilgjengelig");
    expect(result.current.entur).toBeUndefined();
    expect(result.current.bysykkel?.availableBikes).toBe(3);
    expect(result.current.hyre?.stationName).toBe("Byhavn");
    expect(result.current.loading).toBe(false);
  });

  it("!response.ok → source treated as rejected → error set (AC5)", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ bysykkel: { ok: false, json: () => Promise.resolve({}) } as Response })
    );

    const { result } = renderHook(() => useRealtimeData(POI));

    await waitFor(() => expect(result.current.lastUpdated).not.toBeNull(), { timeout: 3000 });

    expect(result.current.error).toBe("Noe sanntidsdata er utilgjengelig");
    expect(result.current.bysykkel).toBeUndefined();
    expect(result.current.entur?.stopName).toBe("Trondheim S");
  });
});

// ─── AbortController + setInterval (AC2) ──────────────────────────────────────

describe("useRealtimeData — AbortController + setInterval (AC2)", () => {
  it("setInterval fires at 60s → second fetch call made", async () => {
    vi.useFakeTimers();
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);

    renderHook(() => useRealtimeData(POI));

    // Flush initial fetchData — advance by 0ms to drain microtasks
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const callsAfterFirst = fetchMock.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    // Advance exactly 60s → interval fires once
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it("loading suppressed on poll — no loading=true flip after first data (AC2)", async () => {
    vi.useFakeTimers();
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useRealtimeData(POI));

    // Complete first fetch
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(result.current.lastUpdated).not.toBeNull();
    expect(result.current.loading).toBe(false);

    // Advance 60s → poll fires; loading must NOT flip to true at any point
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    // After poll completes, loading is still false
    expect(result.current.loading).toBe(false);
    expect(result.current.lastUpdated).not.toBeNull();
  });

  it("unmount → clearInterval stops polling", async () => {
    vi.useFakeTimers();
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = renderHook(() => useRealtimeData(POI));

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const callsAfterFirst = fetchMock.mock.calls.length;
    unmount();

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });

    // No additional calls after unmount
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("POI switch → AbortController.abort() called + new fetch issued", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);

    const poi1: RealtimePOI = { id: "poi-1", enturStopplaceId: "NSR:StopPlace:1" };
    const poi2: RealtimePOI = { id: "poi-2", enturStopplaceId: "NSR:StopPlace:2" };

    const abortSpy = vi.spyOn(AbortController.prototype, "abort");

    const { rerender } = renderHook(({ poi }: { poi: RealtimePOI }) => useRealtimeData(poi), {
      initialProps: { poi: poi1 },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled(), { timeout: 3000 });

    const callsBeforeSwitch = fetchMock.mock.calls.length;

    await act(async () => { rerender({ poi: poi2 }); });

    expect(abortSpy).toHaveBeenCalled();

    await waitFor(
      () => expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeSwitch),
      { timeout: 3000 }
    );

    const lastUrl = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0] as string;
    expect(lastUrl).toContain("NSR:StopPlace:2");
  });
});

// ─── Source guards (AC3) ───────────────────────────────────────────────────────

describe("useRealtimeData — source guard (AC3)", () => {
  it("no supabase CLIENT imports in hook — only /api proxy calls", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/hooks/useRealtimeData.ts"),
      "utf-8"
    );
    // Only check for actual import statements, not comment mentions
    expect(source).not.toMatch(/^import.*supabase/im);
    expect(source).not.toMatch(/from ['"]@supabase/);
    expect(source).not.toMatch(/from ['"]@\/lib\/supabase/);
    expect(source).toMatch(/\/api\/entur/);
    expect(source).toMatch(/\/api\/bysykkel/);
    expect(source).toMatch(/\/api\/hyre/);
  });

  it("architecture affirmation comment is present in source", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/hooks/useRealtimeData.ts"),
      "utf-8"
    );
    expect(source).toMatch(/ARCHITECTURE AFFIRMATION/);
    expect(source).toMatch(/proxy routes/);
  });
});
