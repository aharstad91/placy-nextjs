import { describe, it, expect, vi } from "vitest";
import {
  patchProductConfigWithLock,
  patchThenRevalidate,
} from "./patch-product-config";

/**
 * Eksekverings-tester for de bærende PATCH-invariantene (audit-bead whp,
 * DECISIONS-QUEUE #4). Auditens mental-mutasjoner fanges her:
 *   - «flytt revalidate FØR PATCH» → rød (call-order-assert)
 *   - «fortsett ved 0-rad-PATCH» → rød (zero-rows uten revalidate)
 * De gamle kildetekst-regex-guardene i scripts/*.contract.test.ts består
 * som billige anti-slettings-tripwires.
 */

const INPUT = {
  supabaseUrl: "https://x.supabase.co",
  supabaseKey: "service-key",
  productId: "prod-1",
  updatedAt: "2026-07-06T00:00:00+00:00",
  config: { reportConfig: { themes: [] } },
};

function fetchReturning(status: number, body: unknown) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("patchProductConfigWithLock — optimistisk lås", () => {
  it("PATCH-URL-en filtrerer på id OG updated_at (låsen)", async () => {
    const fetchImpl = fetchReturning(200, [{ id: "prod-1" }]);
    await patchProductConfigWithLock({ ...INPUT, fetchImpl });
    const [url, init] = vi.mocked(fetchImpl).mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("id=eq.prod-1");
    expect(url).toContain(
      `updated_at=eq.${encodeURIComponent("2026-07-06T00:00:00+00:00")}`
    );
    expect(init.method).toBe("PATCH");
    expect((init.headers as Record<string, string>).Prefer).toBe(
      "return=representation"
    );
  });

  it("HTTP-feil → {ok:false, reason:'http'} med status og body", async () => {
    const fetchImpl = fetchReturning(409, { message: "conflict" });
    const result = await patchProductConfigWithLock({ ...INPUT, fetchImpl });
    expect(result).toEqual({
      ok: false,
      reason: "http",
      status: 409,
      body: JSON.stringify({ message: "conflict" }),
    });
  });

  it("0 rader (concurrent write slo låsen) → {ok:false, reason:'zero-rows'}", async () => {
    const fetchImpl = fetchReturning(200, []);
    const result = await patchProductConfigWithLock({ ...INPUT, fetchImpl });
    expect(result).toEqual({ ok: false, reason: "zero-rows" });
  });

  it("suksess → {ok:true, rows}", async () => {
    const fetchImpl = fetchReturning(200, [{ id: "prod-1" }]);
    const result = await patchProductConfigWithLock({ ...INPUT, fetchImpl });
    expect(result).toEqual({ ok: true, rows: 1 });
  });
});

describe("patchThenRevalidate — sekvens-invarianten (auditens mutasjon)", () => {
  it("revalidate kalles ETTER vellykket PATCH (call-order bevist)", async () => {
    const fetchImpl = fetchReturning(200, [{ id: "prod-1" }]);
    const revalidate = vi.fn(async () => {});
    await patchThenRevalidate({ ...INPUT, fetchImpl, revalidate });

    expect(revalidate).toHaveBeenCalledTimes(1);
    const fetchOrder = vi.mocked(fetchImpl).mock.invocationCallOrder[0];
    const revalidateOrder = revalidate.mock.invocationCallOrder[0];
    expect(revalidateOrder).toBeGreaterThan(fetchOrder);
  });

  it("HTTP-feil → revalidate kalles ALDRI", async () => {
    const fetchImpl = fetchReturning(500, { message: "boom" });
    const revalidate = vi.fn(async () => {});
    const result = await patchThenRevalidate({ ...INPUT, fetchImpl, revalidate });
    expect(result.ok).toBe(false);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("0-rad-PATCH → abort UTEN revalidate (curate-narrative-invarianten)", async () => {
    const fetchImpl = fetchReturning(200, []);
    const revalidate = vi.fn(async () => {});
    const result = await patchThenRevalidate({ ...INPUT, fetchImpl, revalidate });
    expect(result).toEqual({ ok: false, reason: "zero-rows" });
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("scriptene konsumerer den delte modulen (anti-regresjon)", () => {
  it("begge scripts kaller patchThenRevalidate — ingen inline PATCH-blokk igjen", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const p of ["scripts/audio-tour-build.ts", "scripts/curate-narrative.ts"]) {
      const src = readFileSync(join(process.cwd(), p), "utf8");
      expect(src, p).toContain("patchThenRevalidate");
      expect(src, p).not.toMatch(/method: "PATCH"/);
    }
  });
});
