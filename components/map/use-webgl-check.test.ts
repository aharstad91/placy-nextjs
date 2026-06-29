import { describe, it, expect, vi, afterEach } from "vitest";

// PRD 6 Unit 06.1 (r06.1): useWebGLCheck/isWebGLAvailable ported out of the
// deleted Map3DFallback.tsx into its own typed module (no @ts-nocheck). The
// load-bearing property is the MODULE-CACHED probe: every WebGL probe opens a
// real WebGL context and the browser allows only ~16 — so the probe must run
// ONCE per session and the result must be cached. These tests lock that in.
//
// vi.resetModules() + dynamic import gives each test a fresh module-level cache.

afterEach(() => {
  vi.restoreAllMocks();
});

/** Minimal fake gl whose lose-context extension we can assert on. */
function fakeGl(loseContext: () => void = () => {}) {
  return {
    getExtension: (name: string) =>
      name === "WEBGL_lose_context" ? { loseContext } : null,
  };
}

describe("isWebGLAvailable", () => {
  it("returns true and frees the probe context immediately when WebGL is available", async () => {
    vi.resetModules();
    const loseContext = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() => fakeGl(loseContext)) as never,
    );
    const { isWebGLAvailable } = await import("./use-webgl-check");

    expect(isWebGLAvailable()).toBe(true);
    // Probe context must be released so it does not occupy one of the ~16.
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("caches the result — probes WebGL only once across many calls", async () => {
    vi.resetModules();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((() => fakeGl()) as never);
    const { isWebGLAvailable } = await import("./use-webgl-check");

    expect(isWebGLAvailable()).toBe(true);
    const callsAfterFirst = getContext.mock.calls.length;
    expect(callsAfterFirst).toBeGreaterThan(0);

    for (let i = 0; i < 10; i++) expect(isWebGLAvailable()).toBe(true);
    // No additional probe contexts opened — the module cache served the rest.
    expect(getContext.mock.calls.length).toBe(callsAfterFirst);
  });

  it("returns false and caches it when no WebGL context can be created", async () => {
    vi.resetModules();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation((() => null) as never);
    const { isWebGLAvailable } = await import("./use-webgl-check");

    expect(isWebGLAvailable()).toBe(false);
    // Flip the probe to "available" — cached false must persist (no re-probe).
    getContext.mockImplementation((() => fakeGl()) as never);
    expect(isWebGLAvailable()).toBe(false);
  });

  it("returns false when getContext throws (no crash, cached)", async () => {
    vi.resetModules();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      (() => {
        throw new Error("context creation blew up");
      }) as never,
    );
    const { isWebGLAvailable } = await import("./use-webgl-check");

    expect(isWebGLAvailable()).toBe(false);
  });

  it("falls back to webgl when webgl2 is unavailable", async () => {
    vi.resetModules();
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockImplementation(((id: string) =>
        id === "webgl" ? fakeGl() : null) as never);
    const { isWebGLAvailable } = await import("./use-webgl-check");

    expect(isWebGLAvailable()).toBe(true);
    const ids = getContext.mock.calls.map((c) => c[0]);
    expect(ids).toContain("webgl2");
    expect(ids).toContain("webgl");
  });
});
