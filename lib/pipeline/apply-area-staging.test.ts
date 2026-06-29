import { describe, it, expect, vi } from "vitest";

import {
  applyAreaStaging,
  fetchAreaRow,
  mergeEditorial,
  writeAreaStaging,
  type AreaRow,
  type AreaStagingDeps,
} from "./apply-area-staging";
import type { AreaStaging } from "./area-staging";

// ── Fixtures ────────────────────────────────────────────────────────────────

const BOUNDARY: AreaStaging["boundary"] = {
  type: "Polygon",
  coordinates: [
    [
      [10.0, 63.0],
      [10.1, 63.0],
      [10.1, 63.1],
      [10.0, 63.1],
      [10.0, 63.0],
    ],
  ],
};

function staging(overrides: Partial<AreaStaging> = {}): AreaStaging {
  return {
    areaId: "ranheim",
    boundary: BOUNDARY,
    report_editorial: {
      "mat-drikke": { body: "Ny mat-tekst", highlightCandidates: ["google-ChIJ-1"] },
      transport: { body: "Ny transport-tekst", highlightCandidates: [] },
    },
    ...overrides,
  };
}

const META: NonNullable<AreaStaging["meta"]> = {
  name_no: "Ranheim",
  name_en: "Ranheim",
  slug_no: "ranheim",
  slug_en: "ranheim",
  center_lat: 63.42,
  center_lng: 10.52,
  level: "strok",
};

function existingRow(report_editorial: Record<string, unknown> | null): AreaRow {
  return {
    id: "ranheim",
    name_no: "Ranheim",
    level: "strok",
    center_lat: 63.42,
    center_lng: 10.52,
    boundary: { type: "Polygon", coordinates: [] },
    report_editorial,
  };
}

interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown> | null;
}

/**
 * Bygger en injiserbar fetch-mock. `responder` returnerer en delvis Response
 * per kall; standard er en tom 200 med `[]` (overstyres per test).
 */
function makeFetch(
  responder: (call: RecordedCall) => { ok?: boolean; status?: number; rows?: unknown } = () => ({})
) {
  const calls: RecordedCall[] = [];
  const fetchFn = vi.fn(async (input: unknown, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as Record<string, unknown>)
        : null;
    const call: RecordedCall = {
      url: String(input),
      method: init?.method ?? "GET",
      headers,
      body,
    };
    calls.push(call);
    const r = responder(call);
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: async () => r.rows ?? [],
      text: async () => "boom",
    };
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, calls };
}

function deps(fetchFn: typeof fetch): AreaStagingDeps {
  return { supabaseUrl: "https://x.supabase.co", serviceKey: "svc-key-123", fetchFn };
}

// ── AC1/AC4: fetchAreaRow (GET, Accept-Profile: v2, header-auth) ─────────────

describe("fetchAreaRow", () => {
  it("GET-er v2.areas med Accept-Profile: v2 og service-key i header (aldri URL)", async () => {
    const { fetchFn, calls } = makeFetch(() => ({ rows: [existingRow({})] }));
    const row = await fetchAreaRow("ranheim", deps(fetchFn));

    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.method).toBe("GET");
    expect(c.headers["Accept-Profile"]).toBe("v2");
    expect(c.headers.apikey).toBe("svc-key-123");
    expect(c.headers.Authorization).toBe("Bearer svc-key-123");
    // AC4: service-key ALDRI i URL
    expect(c.url).not.toContain("svc-key-123");
    expect(c.url).toContain("/rest/v1/areas?id=eq.ranheim");
    expect(row?.id).toBe("ranheim");
  });

  it("returnerer null når ingen rad finnes", async () => {
    const { fetchFn } = makeFetch(() => ({ rows: [] }));
    expect(await fetchAreaRow("mangler", deps(fetchFn))).toBeNull();
  });

  it("kaster ved !ok (read-feil bobler opp til kall-stedet)", async () => {
    const { fetchFn } = makeFetch(() => ({ ok: false, status: 500 }));
    await expect(fetchAreaRow("ranheim", deps(fetchFn))).rejects.toThrow(/GET areas feilet/);
  });
});

// ── mergeEditorial: ren spread-merge ─────────────────────────────────────────

describe("mergeEditorial", () => {
  it("beholder eksisterende temaer, overskriver dem staging har", () => {
    const existing = { "mat-drikke": { body: "GAMMEL" }, "barn-oppvekst": { body: "BEHOLDT" } };
    const merged = mergeEditorial(existing, staging());
    // staging overskriver mat-drikke + legger til transport; barn-oppvekst beholdes
    expect((merged["mat-drikke"] as { body: string }).body).toBe("Ny mat-tekst");
    expect((merged["barn-oppvekst"] as { body: string }).body).toBe("BEHOLDT");
    expect(merged.transport).toBeDefined();
  });

  it("null/undefined eksisterende → kun staging", () => {
    expect(Object.keys(mergeEditorial(null, staging())).sort()).toEqual([
      "mat-drikke",
      "transport",
    ]);
    expect(Object.keys(mergeEditorial(undefined, staging())).sort()).toEqual([
      "mat-drikke",
      "transport",
    ]);
  });
});

// ── AC1/AC6: INSERT-gren (ingen eksisterende rad) ────────────────────────────

describe("writeAreaStaging — INSERT-gren", () => {
  it("POST-er ny rad med meta + boundary + report_editorial og Content-Profile: v2", async () => {
    const { fetchFn, calls } = makeFetch(() => ({ rows: [{ id: "ranheim" }] }));
    const res = await writeAreaStaging(staging({ meta: META }), null, deps(fetchFn));

    expect(res).toEqual({
      ok: true,
      mode: "create",
      areaId: "ranheim",
      themesWritten: 2,
    });
    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.method).toBe("POST");
    expect(c.url).toBe("https://x.supabase.co/rest/v1/areas");
    expect(c.headers["Content-Profile"]).toBe("v2");
    expect(c.headers.apikey).toBe("svc-key-123");
    expect(c.headers.Authorization).toBe("Bearer svc-key-123");
    expect(c.headers.Prefer).toBe("return=representation");
    // body: identitetsfelt fra meta + boundary + report_editorial direkte
    expect(c.body).toMatchObject({
      id: "ranheim",
      name_no: "Ranheim",
      name_en: "Ranheim",
      slug_no: "ranheim",
      slug_en: "ranheim",
      level: "strok",
      center_lat: 63.42,
      center_lng: 10.52,
      boundary: BOUNDARY,
    });
    expect((c.body?.report_editorial as Record<string, unknown>)["mat-drikke"]).toBeDefined();
  });

  it("inkluderer valgfrie felt (zoom_level/parent_id/postal_codes) kun når satt", async () => {
    const withOpt = makeFetch(() => ({ rows: [{ id: "ranheim" }] }));
    await writeAreaStaging(
      staging({ meta: { ...META, zoom_level: 14, parent_id: "trondheim", postal_codes: ["7053"] } }),
      null,
      deps(withOpt.fetchFn)
    );
    expect(withOpt.calls[0].body).toMatchObject({
      zoom_level: 14,
      parent_id: "trondheim",
      postal_codes: ["7053"],
    });

    const without = makeFetch(() => ({ rows: [{ id: "ranheim" }] }));
    await writeAreaStaging(staging({ meta: META }), null, deps(without.fetchFn));
    expect(without.calls[0].body).not.toHaveProperty("zoom_level");
    expect(without.calls[0].body).not.toHaveProperty("parent_id");
    expect(without.calls[0].body).not.toHaveProperty("postal_codes");
  });

  it("create uten meta → ok:false-feil, INGEN write utføres", async () => {
    const { fetchFn, calls } = makeFetch();
    const res = await writeAreaStaging(staging({ meta: undefined }), null, deps(fetchFn));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/mangler 'meta'-blokk/);
    expect(calls).toHaveLength(0);
  });

  it("INSERT !ok → ok:false", async () => {
    const { fetchFn } = makeFetch(() => ({ ok: false, status: 409 }));
    const res = await writeAreaStaging(staging({ meta: META }), null, deps(fetchFn));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/INSERT feilet: 409/);
  });

  it("INSERT 0 rader → ok:false", async () => {
    const { fetchFn } = makeFetch(() => ({ rows: [] }));
    const res = await writeAreaStaging(staging({ meta: META }), null, deps(fetchFn));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/INSERT returnerte 0 rader/);
  });
});

// ── AC1/AC2/AC6: PATCH-merge-gren (eksisterende rad) ─────────────────────────

describe("writeAreaStaging — PATCH-merge-gren", () => {
  it("spread-merger editorial (beholder ikke-staging-temaer), setter boundary, Content-Profile: v2, meta ignorert", async () => {
    const { fetchFn, calls } = makeFetch(() => ({ rows: [{ id: "ranheim" }] }));
    const row = existingRow({
      "mat-drikke": { body: "GAMMEL mat" },
      "barn-oppvekst": { body: "BEHOLDT — ikke i staging" },
    });
    // staging har meta — skal IKKE påvirke en eksisterende rad
    const res = await writeAreaStaging(staging({ meta: META }), row, deps(fetchFn));

    expect(res).toEqual({
      ok: true,
      mode: "update",
      areaId: "ranheim",
      // mat-drikke (overskrevet) + transport (ny) + barn-oppvekst (beholdt) = 3
      themesWritten: 3,
    });
    expect(calls).toHaveLength(1);
    const c = calls[0];
    expect(c.method).toBe("PATCH");
    expect(c.url).toBe("https://x.supabase.co/rest/v1/areas?id=eq.ranheim");
    expect(c.headers["Content-Profile"]).toBe("v2");
    expect(c.headers.apikey).toBe("svc-key-123");
    expect(c.url).not.toContain("svc-key-123");

    const editorial = c.body?.report_editorial as Record<string, { body: string }>;
    expect(editorial["mat-drikke"].body).toBe("Ny mat-tekst"); // overskrevet
    expect(editorial["barn-oppvekst"].body).toBe("BEHOLDT — ikke i staging"); // beholdt
    expect(editorial.transport).toBeDefined(); // ny
    expect(c.body?.boundary).toEqual(BOUNDARY); // staging-boundary
    // meta-feltene skal IKKE være i PATCH-body (identitet endres aldri)
    expect(c.body).not.toHaveProperty("name_no");
    expect(c.body).not.toHaveProperty("id");
  });

  it("PATCH !ok → ok:false", async () => {
    const { fetchFn } = makeFetch(() => ({ ok: false, status: 500 }));
    const res = await writeAreaStaging(staging(), existingRow({}), deps(fetchFn));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/PATCH feilet: 500/);
  });

  it("PATCH 0 rader → ok:false (areas mangler updated_at — ingen optimistisk lås, men 0-rad er fortsatt feil)", async () => {
    const { fetchFn } = makeFetch(() => ({ rows: [] }));
    const res = await writeAreaStaging(staging(), existingRow({}), deps(fetchFn));
    expect(res.ok).toBe(false);
    expect(res.ok === false && res.error).toMatch(/PATCH traff 0 rader/);
  });
});

// ── applyAreaStaging: GET → write (PRD-15-overflatens bekvemmelighet) ────────

describe("applyAreaStaging", () => {
  it("GET tom → INSERT (create) når meta finnes", async () => {
    const { fetchFn, calls } = makeFetch((call) =>
      call.method === "GET" ? { rows: [] } : { rows: [{ id: "ranheim" }] }
    );
    const res = await applyAreaStaging(staging({ meta: META }), deps(fetchFn));
    expect(res.ok && res.mode).toBe("create");
    expect(calls.map((c) => c.method)).toEqual(["GET", "POST"]);
    expect(calls[0].headers["Accept-Profile"]).toBe("v2");
  });

  it("GET treffer rad → PATCH (update)", async () => {
    const { fetchFn, calls } = makeFetch((call) =>
      call.method === "GET"
        ? { rows: [existingRow({ "barn-oppvekst": { body: "x" } })] }
        : { rows: [{ id: "ranheim" }] }
    );
    const res = await applyAreaStaging(staging(), deps(fetchFn));
    expect(res.ok && res.mode).toBe("update");
    expect(calls.map((c) => c.method)).toEqual(["GET", "PATCH"]);
  });
});
