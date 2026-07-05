import { describe, it, expect, vi, afterEach } from "vitest";
import { runAfterResponse } from "./run-after-response";

const CTX = Symbol.for("@vercel/request-context");

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[CTX];
  vi.restoreAllMocks();
});

describe("runAfterResponse", () => {
  it("kjører tasken (detached) uten Vercel-context", async () => {
    let ran = false;
    runAfterResponse(async () => {
      ran = true;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(ran).toBe(true);
  });

  it("registrerer promiset hos Vercel-contextens waitUntil når den finnes", async () => {
    const waitUntil = vi.fn();
    (globalThis as Record<symbol, unknown>)[CTX] = {
      get: () => ({ waitUntil }),
    };
    runAfterResponse(async () => {});
    expect(waitUntil).toHaveBeenCalledTimes(1);
    expect(waitUntil.mock.calls[0][0]).toBeInstanceOf(Promise);
  });

  it("svelger task-feil med logging — kaster aldri", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      runAfterResponse(async () => {
        throw new Error("boom");
      })
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(errSpy).toHaveBeenCalled();
  });
});
