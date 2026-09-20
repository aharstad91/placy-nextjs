import { describe, expect, it, vi } from "vitest";
import { LiveSessionRegistry } from "@/lib/live/session-registry";

describe("LiveSessionRegistry", () => {
  it("eier flere uavhengige samtaler og rydder bare den valgte", async () => {
    const stop = vi.fn(async () => {});
    const registry = new LiveSessionRegistry({ stop, maxMs: 60_000 });
    const first = registry.reserve();
    const second = registry.reserve();
    registry.attach(first, "live_first");
    registry.attach(second, "live_second");

    await expect(registry.end(first)).resolves.toBe(true);
    expect(registry.isActive(first)).toBe(false);
    expect(registry.isActive(second)).toBe(true);
    expect(stop).toHaveBeenCalledWith("live_first");
    await registry.end(second);
  });

  it("håndhever eksplisitt samtidighetstak", () => {
    const registry = new LiveSessionRegistry({
      stop: async () => {},
      maxMs: 60_000,
      maxConcurrent: 1,
    });
    registry.reserve();
    expect(() => registry.reserve()).toThrow("kapasitetsgrensen");
  });
});
