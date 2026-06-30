import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelativeDepartureTime } from "./format-time";

const NOW = new Date("2026-06-30T12:00:00Z");

function isoAt(offsetMs: number) {
  return new Date(NOW.getTime() + offsetMs).toISOString();
}

describe("formatRelativeDepartureTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'Nå' when departure is in the past", () => {
    expect(formatRelativeDepartureTime(isoAt(-60_000))).toBe("Nå");
  });

  it("returns 'Nå' when departure is exactly now", () => {
    expect(formatRelativeDepartureTime(isoAt(0))).toBe("Nå");
  });

  it("returns 'Nå' when departure is less than 30 seconds away (rounds to 0)", () => {
    expect(formatRelativeDepartureTime(isoAt(29_000))).toBe("Nå");
  });

  it("returns '1 min' when departure is exactly 1 minute away", () => {
    expect(formatRelativeDepartureTime(isoAt(60_000))).toBe("1 min");
  });

  it("returns '1 min' when departure rounds to 1 (89 seconds)", () => {
    expect(formatRelativeDepartureTime(isoAt(89_000))).toBe("1 min");
  });

  it("returns '2 min' when departure is 2 minutes away", () => {
    expect(formatRelativeDepartureTime(isoAt(2 * 60_000))).toBe("2 min");
  });

  it("returns '15 min' for a 15-minute departure", () => {
    expect(formatRelativeDepartureTime(isoAt(15 * 60_000))).toBe("15 min");
  });

  it("returns '60 min' for a 1-hour departure", () => {
    expect(formatRelativeDepartureTime(isoAt(60 * 60_000))).toBe("60 min");
  });
});
