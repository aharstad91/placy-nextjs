import { describe, expect, it, vi } from "vitest";
const { read, cachedValues } = vi.hoisted(() => ({ read: vi.fn(), cachedValues: [] as unknown[] }));
vi.mock("@/lib/data-server", () => ({ getProductAsync: read }));
vi.mock("@/lib/supabase/translations", () => ({ getProjectTranslations: vi.fn() }));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => Promise<unknown>) => async () => {
    const value = await fn(); cachedValues.push(value); return value;
  },
}));
import { getCachedReportProduct } from "@/lib/supabase/cached-board-reads";

describe("board cache size", () => {
  it("round-trips a board larger than 2 MB while keeping the cache entry below the limit", async () => {
    const board = { id: "demo", pois: Array.from({ length: 2000 }, (_, id) => ({ id, description: "Nabolagsinformasjon. ".repeat(100) })) };
    expect(Buffer.byteLength(JSON.stringify(board))).toBeGreaterThan(2 * 1024 * 1024);
    read.mockResolvedValueOnce(board);
    expect(await getCachedReportProduct("customer", "project")).toEqual(board);
    expect(Buffer.byteLength(JSON.stringify(cachedValues.at(-1)))).toBeLessThan(2 * 1024 * 1024);
  });
  it("preserves missing-product behavior", async () => {
    read.mockResolvedValueOnce(null);
    expect(await getCachedReportProduct("customer", "missing")).toBeNull();
  });
});
