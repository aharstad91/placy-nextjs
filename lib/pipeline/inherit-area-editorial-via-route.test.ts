import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inheritAreaEditorialViaRoute } from "@/lib/pipeline/inherit-area-editorial-via-route";

const OPTS = {
  projectId: "intern_lade",
  customerSlug: "intern",
  projectSlug: "lade",
  lat: 63.445,
  lng: 10.435,
};

describe("inheritAreaEditorialViaRoute", () => {
  beforeEach(() => {
    delete process.env.PROVISION_LOCAL_URL;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returnerer route-resultatet uendret ved 200", async () => {
    const routeResult = {
      skipped: false,
      areaName: "Lade",
      themesInherited: ["mat-drikke", "transport"],
      highlights: { kept: 3, dropped: [] },
      warnings: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => routeResult,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await inheritAreaEditorialViaRoute(OPTS);
    expect(result).toEqual(routeResult);
    // Treffer localhost (admin er avslått i prod)
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toBe("http://localhost:3000/api/admin/inherit-editorial");
  });

  it("fail-soft ved 403 (admin ikke aktivert) — skipped + warning, ikke kast", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) })
    );

    const result = await inheritAreaEditorialViaRoute(OPTS);
    expect(result.skipped).toBe(true);
    expect(result.themesInherited).toEqual([]);
    expect(result.warnings[0]).toMatch(/admin ikke aktivert/i);
  });

  it("fail-soft ved nettverksfeil — skipped + warning, ikke kast", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );

    const result = await inheritAreaEditorialViaRoute(OPTS);
    expect(result.skipped).toBe(true);
    expect(result.warnings[0]).toMatch(/utilgjengelig|ECONNREFUSED/i);
  });

  it("respekterer PROVISION_LOCAL_URL-overstyring", async () => {
    process.env.PROVISION_LOCAL_URL = "http://localhost:3001";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        skipped: true,
        themesInherited: [],
        highlights: { kept: 0, dropped: [] },
        warnings: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await inheritAreaEditorialViaRoute(OPTS);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://localhost:3001/api/admin/inherit-editorial"
    );
  });
});
