import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OVERHEAD_BREAK_DEG,
  DRIFT_POLL_MS,
  headingDelta,
  hasBrokenOverhead,
  watchOverheadDrift,
} from "./overhead-drift";

describe("headingDelta — 0/360-wraparound", () => {
  it("måler korteste vei over nord (359° → 4° er 5°, ikke 355°)", () => {
    expect(headingDelta(359, 4)).toBe(5);
    expect(headingDelta(4, 359)).toBe(5);
  });

  it("er 0 for samme heading og 180 for motsatt", () => {
    expect(headingDelta(90, 90)).toBe(0);
    expect(headingDelta(0, 180)).toBe(180);
  });
});

describe("hasBrokenOverhead — terskel-predikatet (R8c)", () => {
  const start = { tilt: 0, heading: 0 };

  it("pan-jitter innenfor terskelen bryter IKKE (pillen flipper aldri på pan)", () => {
    expect(hasBrokenOverhead(start, { tilt: 3, heading: 2 })).toBe(false);
    expect(hasBrokenOverhead(start, { tilt: OVERHEAD_BREAK_DEG, heading: 0 })).toBe(false);
  });

  it("tilt over terskelen bryter", () => {
    expect(hasBrokenOverhead(start, { tilt: OVERHEAD_BREAK_DEG + 1, heading: 0 })).toBe(true);
  });

  it("rotasjon over terskelen bryter — også over nord (wraparound)", () => {
    expect(hasBrokenOverhead({ tilt: 0, heading: 358 }, { tilt: 0, heading: 4 })).toBe(true);
    expect(hasBrokenOverhead({ tilt: 0, heading: 358 }, { tilt: 0, heading: 2 })).toBe(false);
  });
});

describe("watchOverheadDrift — vakten poller og fyrer ÉN gang", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("grab uten bevegelse → ingen flip", () => {
    const map = { tilt: 0, heading: 0 };
    const onBreak = vi.fn();
    const stop = watchOverheadDrift(map, onBreak);
    vi.advanceTimersByTime(DRIFT_POLL_MS * 20);
    expect(onBreak).not.toHaveBeenCalled();
    stop();
  });

  it("tilt-drift over terskelen → onBreak én gang, vakten stopper seg selv", () => {
    const map = { tilt: 0, heading: 0 };
    const onBreak = vi.fn();
    watchOverheadDrift(map, onBreak);
    map.tilt = OVERHEAD_BREAK_DEG + 3;
    vi.advanceTimersByTime(DRIFT_POLL_MS * 5);
    expect(onBreak).toHaveBeenCalledTimes(1);
  });

  it("stopp-funksjonen avbryter vakten (pointerup/unmount)", () => {
    const map = { tilt: 0, heading: 0 };
    const onBreak = vi.fn();
    const stop = watchOverheadDrift(map, onBreak);
    stop();
    map.tilt = 45;
    vi.advanceTimersByTime(DRIFT_POLL_MS * 5);
    expect(onBreak).not.toHaveBeenCalled();
  });

  it("driften måles mot GRAB-øyeblikkets positur, ikke mot absolutt 0", () => {
    // Starter grabbet med litt residual-heading (f.eks. 1.5° fra en avbrutt
    // flyvning) skal terskelen gjelde avviket fra der, ikke fra nord.
    const map = { tilt: 0, heading: 358 };
    const onBreak = vi.fn();
    watchOverheadDrift(map, onBreak);
    map.heading = 2; // 4° over nord — innenfor terskelen fra 358
    vi.advanceTimersByTime(DRIFT_POLL_MS * 3);
    expect(onBreak).not.toHaveBeenCalled();
    map.heading = 6; // 8° fra start — brudd
    vi.advanceTimersByTime(DRIFT_POLL_MS * 3);
    expect(onBreak).toHaveBeenCalledTimes(1);
  });
});

// Wiring-invarianter (samme kilde-lesings-stil som orkestrator-suiten): selve
// lytteren lever i en React-effekt i BoardMap3D og er dyr å mounte i test.
describe("BoardMap3D — Satelitt-gest-wiring (R8c/R8d, kilde-invarianter)", () => {
  const src = readFileSync(
    join(process.cwd(), "components/variants/report/board/BoardMap3D.tsx"),
    "utf8",
  );

  it("undertrykker grab-takeoveren (auto→fri) i Satelitt — pan klobber aldri cameraMode", () => {
    // overhead-sjekken skal stå FØR cameraMode-auto-sjekken i onGrab.
    const grabIdx = src.indexOf("if (overheadRef.current)");
    const takeoverIdx = src.indexOf('if (cameraModeRef.current === "auto")');
    expect(grabIdx).toBeGreaterThan(-1);
    expect(takeoverIdx).toBeGreaterThan(grabIdx);
  });

  it("setter skipSkraaReentryRef FØR onOverheadBreak — gesten eier posituren", () => {
    const setIdx = src.indexOf("skipSkraaReentryRef.current = true");
    const breakIdx = src.indexOf("onOverheadBreakRef.current?.()");
    expect(setIdx).toBeGreaterThan(-1);
    expect(breakIdx).toBeGreaterThan(setIdx);
  });

  it("wheel starter aldri drift-vakten (zoom tilter ikke)", () => {
    expect(src).toMatch(/e\.type !== "pointerdown" && e\.type !== "touchstart"/);
  });
});
