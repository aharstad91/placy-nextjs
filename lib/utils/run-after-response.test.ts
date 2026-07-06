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

  it("delegerer til stabil after() fra next/server (Next 16) — fallback kun utenfor request-scope", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "lib", "utils", "run-after-response.ts"),
      "utf8"
    );
    expect(src).toContain('import { after } from "next/server"');
    expect(src).toContain("after(run)");
  });
});
