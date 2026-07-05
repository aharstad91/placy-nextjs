import { describe, it, expect, vi, afterEach } from "vitest";
import { createRateLimiter, getClientIp } from "./rate-limit";

/**
 * Enhetstester for den delte rate-limit-kjernen (bead 3uc, Fable-audit P1):
 * fixed window per IP, reset etter vindu, IP-isolasjon, minne-sveip ved tak,
 * og x-forwarded-for-parsing.
 */

afterEach(() => {
  vi.useRealTimers();
});

describe("createRateLimiter — fixed window per IP", () => {
  it("tillater nøyaktig `limit` kall og avviser det neste", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(false);
    expect(limiter.check("1.1.1.1")).toBe(false);
  });

  it("nullstiller telleren når vinduet har utløpt", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(false);

    vi.advanceTimersByTime(60_000);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(false);
  });

  it("teller per IP — én IP over grensen struper ikke andre", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.check("1.1.1.1")).toBe(true);
    expect(limiter.check("1.1.1.1")).toBe(false);
    expect(limiter.check("2.2.2.2")).toBe(true);
  });

  it("uavhengige limiter-instanser deler ikke tellere", () => {
    const a = createRateLimiter({ limit: 1, windowMs: 60_000 });
    const b = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(a.check("1.1.1.1")).toBe(true);
    expect(a.check("1.1.1.1")).toBe(false);
    expect(b.check("1.1.1.1")).toBe(true);
  });

  it("sveiper utløpte entries ved IP-taket (rullerende-IP-misbruk vokser ikke minnet)", () => {
    vi.useFakeTimers();
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    for (let i = 0; i < 10_000; i++) {
      limiter.check(`10.0.${Math.floor(i / 256)}.${i % 256}`);
    }
    // Ved taket, med utløpte vinduer, skal nye IP-er fortsatt slippe gjennom
    // (sveipen rydder plass) — og en allerede-strupet fersk IP forblir strupet.
    vi.advanceTimersByTime(60_000);
    expect(limiter.check("203.0.113.1")).toBe(true);
    expect(limiter.check("203.0.113.1")).toBe(false);
    expect(limiter.check("203.0.113.2")).toBe(true);
  });
});

describe("getClientIp — x-forwarded-for-parsing", () => {
  it("bruker første hop i komma-separert liste, trimmet", () => {
    const headers = new Headers({
      "x-forwarded-for": " 203.0.113.7 , 10.0.0.1, 10.0.0.2",
    });
    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("faller tilbake til 'unknown' uten header", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });

  it("faller tilbake til 'unknown' ved tom header", () => {
    expect(getClientIp(new Headers({ "x-forwarded-for": "" }))).toBe("unknown");
  });
});
