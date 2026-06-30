/**
 * Tests for r08.6 — moat read-path port (v2.place_knowledge + v2.pois).
 *
 * Focus: moat-IP boundary guards (display_ready-gate, trust-gate, injection-guard,
 * sourceUrl isSafeUrl-filter, error logging) and v2-schema targeting.
 * Consumer-gap is source-level verified (AC5).
 *
 * Dead-on-arrival note: these functions serve legacy SEO routes only (app/(public)/).
 * Port is justified solely as moat-IP boundary preservation, not live functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { readFileSync } from "fs";
import { execSync } from "child_process";

// Mock createPublicClient before importing the module under test
vi.mock("@/lib/supabase/public-client", () => ({
  createPublicClient: vi.fn(),
}));

import { createPublicClient } from "@/lib/supabase/public-client";
import {
  getPlaceKnowledge,
  getPlaceKnowledgeBatch,
  getAreaKnowledge,
  getHighlightPOIs,
  getCuratedPOIs,
} from "./public-queries";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

/** Build a chainable Supabase mock for v2.place_knowledge */
function buildPlaceKnowledgeMock(overrides: {
  rows?: Record<string, unknown>[];
  error?: { message: string } | null;
}) {
  const error = overrides.error ?? null;
  const rows = overrides.rows ?? [];

  function makeChain(currentRows: Record<string, unknown>[]) {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      then: (resolve: (v: { data: Record<string, unknown>[] | null; error: typeof error }) => void) =>
        resolve(error ? { data: null, error } : { data: currentRows, error: null }),
    };
    return chain;
  }

  const fromMock = vi.fn(() => makeChain(rows));
  const schemaMock = vi.fn(() => ({ from: fromMock }));

  return {
    schema: schemaMock,
    from: vi.fn(), // top-level .from never called for moat fns
  };
}

/** Build a mock that supports separate pois + categories from-calls */
function buildPoisMock(overrides: {
  pois?: Record<string, unknown>[];
  categories?: Record<string, unknown>[];
  poisError?: { message: string } | null;
  catError?: { message: string } | null;
}) {
  const poisError = overrides.poisError ?? null;
  const catError = overrides.catError ?? null;
  const poisRows = overrides.pois ?? [];
  const catRows = overrides.categories ?? [];

  function makePoiChain() {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      or: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      then: (resolve: (v: { data: typeof poisRows | null; error: typeof poisError }) => void) =>
        resolve(poisError ? { data: null, error: poisError } : { data: poisRows, error: null }),
    };
    return chain;
  }

  function makeCatChain() {
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      in: vi.fn(() => chain),
      then: (resolve: (v: { data: typeof catRows | null; error: typeof catError }) => void) =>
        resolve(catError ? { data: null, error: catError } : { data: catRows, error: null }),
    };
    return chain;
  }

  const fromMock = vi.fn((table: string) => {
    if (table === "pois") return makePoiChain();
    if (table === "categories") return makeCatChain();
    throw new Error(`Unexpected table in test: ${table}`);
  });
  const schemaMock = vi.fn(() => ({ from: fromMock }));

  return { schema: schemaMock, from: vi.fn() };
}

// ──────────────────────────────────────────────
// AC5 consumer-gap (source-level guard)
// ──────────────────────────────────────────────

describe("AC5 — consumer-gap source-level guard", () => {
  it("getPlaceKnowledge/Batch/getAreaKnowledge har INGEN konsumenter i components/", () => {
    const componentsDir = join(process.cwd(), "components");
    const src = readFileSync(join(process.cwd(), "lib", "public-queries.ts"), "utf8");
    const fns = ["getPlaceKnowledge", "getPlaceKnowledgeBatch", "getAreaKnowledge"];

    // Verify functions exist in source
    for (const fn of fns) {
      expect(src).toContain(`export async function ${fn}`);
    }

    // components/ should not import these functions
    try {
      const result = execSync(
        `grep -rl "getPlaceKnowledge\\|getAreaKnowledge" "${componentsDir}"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
      expect(result).toBe(""); // empty = no matches
    } catch {
      // grep exits non-zero when no matches found — that's the expected case
    }
  });

  it("getHighlightPOIs/getCuratedPOIs har INGEN konsumenter i components/", () => {
    const componentsDir = join(process.cwd(), "components");
    try {
      const result = execSync(
        `grep -rl "getHighlightPOIs\\|getCuratedPOIs" "${componentsDir}"`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
      ).trim();
      expect(result).toBe("");
    } catch {
      // grep exits non-zero when no matches — expected
    }
  });
});

// ──────────────────────────────────────────────
// AC1 — v2.place_knowledge targeting
// ──────────────────────────────────────────────

describe("AC1 — v2.place_knowledge targeting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getPlaceKnowledge bruker .schema('v2') og .from('place_knowledge')", async () => {
    const mock = buildPlaceKnowledgeMock({ rows: [] });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await getPlaceKnowledge("poi-123");

    expect(mock.schema).toHaveBeenCalledWith("v2");
    const v2from = mock.schema.mock.results[0].value.from;
    expect(v2from).toHaveBeenCalledWith("place_knowledge");
  });

  it("getPlaceKnowledgeBatch bruker .schema('v2') og .from('place_knowledge')", async () => {
    const mock = buildPlaceKnowledgeMock({ rows: [] });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await getPlaceKnowledgeBatch(["poi-1", "poi-2"]);

    expect(mock.schema).toHaveBeenCalledWith("v2");
    const v2from = mock.schema.mock.results[0].value.from;
    expect(v2from).toHaveBeenCalledWith("place_knowledge");
  });

  it("getAreaKnowledge bruker .schema('v2') og .from('place_knowledge')", async () => {
    const mock = buildPlaceKnowledgeMock({ rows: [] });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await getAreaKnowledge("area-abc");

    expect(mock.schema).toHaveBeenCalledWith("v2");
    const v2from = mock.schema.mock.results[0].value.from;
    expect(v2from).toHaveBeenCalledWith("place_knowledge");
  });

  it("getPlaceKnowledgeBatch returnerer {} umiddelbart ved tom liste", async () => {
    const mock = buildPlaceKnowledgeMock({});
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledgeBatch([]);
    expect(result).toEqual({});
    expect(mock.schema).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// AC2 — v2.pois targeting + trust-gate
// ──────────────────────────────────────────────

describe("AC2 — v2.pois targeting + trust-gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getHighlightPOIs bruker .schema('v2') og .from('pois')", async () => {
    const mock = buildPoisMock({ pois: [], categories: [] });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await getHighlightPOIs("area-x");

    expect(mock.schema).toHaveBeenCalledWith("v2");
    const v2from = mock.schema.mock.results[0].value.from;
    expect(v2from).toHaveBeenCalledWith("pois");
  });

  it("getCuratedPOIs bruker .schema('v2') og .from('pois')", async () => {
    const mock = buildPoisMock({ pois: [], categories: [] });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    await getCuratedPOIs("area-x", {});

    expect(mock.schema).toHaveBeenCalledWith("v2");
    const v2from = mock.schema.mock.results[0].value.from;
    expect(v2from).toHaveBeenCalledWith("pois");
  });

  it("getHighlightPOIs returnerer POIs med korrekt kategori fra to-query join", async () => {
    const poiRow = {
      id: "poi-1",
      name: "Kafe Bliss",
      lat: 63.43,
      lng: 10.4,
      address: "Elvegata 1",
      category_id: "cafe",
      description: null,
      featured_image: null,
      gallery_images: null,
      google_place_id: null,
      google_rating: 4.5,
      google_review_count: 100,
      google_maps_url: null,
      editorial_hook: "Hjemkokt",
      local_insight: null,
      poi_tier: 1,
      tier_reason: null,
      is_chain: false,
      is_local_gem: true,
      google_website: null,
      google_phone: null,
      opening_hours_json: null,
      facebook_url: null,
    };
    const catRow = { id: "cafe", name: "Kaféer", icon: "coffee", color: "#c00" };

    const mock = buildPoisMock({ pois: [poiRow], categories: [catRow] });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getHighlightPOIs("area-x");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("poi-1");
    expect(result[0].category.name).toBe("Kaféer");
    expect(result[0].category.icon).toBe("coffee");
  });

  it("getCuratedPOIs filtrerer ut POIs uten kjent kategori", async () => {
    const poisRows = [
      { id: "p1", name: "A", lat: 1, lng: 1, category_id: "known", poi_tier: 1 },
      { id: "p2", name: "B", lat: 1, lng: 1, category_id: "unknown", poi_tier: 1 },
    ];
    const catRows = [{ id: "known", name: "Known", icon: "k", color: "#f00" }];

    const mock = buildPoisMock({ pois: poisRows, categories: catRows });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getCuratedPOIs("area-x", {});
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });
});

// ──────────────────────────────────────────────
// AC3 — injection-guard + id as TEXT
// ──────────────────────────────────────────────

describe("AC3 — SLUG_PATTERN injection-guard (source-level)", () => {
  it("SLUG_PATTERN er definert og brukt i public-queries.ts", () => {
    const src = readFileSync(join(process.cwd(), "lib", "public-queries.ts"), "utf8");
    expect(src).toContain("SLUG_PATTERN");
    expect(src).toContain("isValidSlug");
  });

  it("id-feltet i transformPlaceKnowledge hentes direkte (row.id, ikke UUID-parse)", () => {
    const src = readFileSync(join(process.cwd(), "lib", "public-queries.ts"), "utf8");
    // Ensure there's no UUID regex applied to place_knowledge.id
    expect(src).not.toMatch(/place_knowledge.*uuid/i);
    // Ensure row.id is used directly
    expect(src).toContain("id: row.id");
  });
});

// ──────────────────────────────────────────────
// AC4 — error handling: console.error BEFORE return
// ──────────────────────────────────────────────

describe("AC4 — hardened error handling", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("getPlaceKnowledge kaller console.error og returnerer [] ved DB-feil", async () => {
    const mock = buildPlaceKnowledgeMock({ error: { message: "connection refused" } });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledge("poi-123");

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("getPlaceKnowledge");
  });

  it("getPlaceKnowledgeBatch kaller console.error og returnerer {} ved DB-feil", async () => {
    const mock = buildPlaceKnowledgeMock({ error: { message: "timeout" } });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledgeBatch(["poi-1"]);

    expect(result).toEqual({});
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("getPlaceKnowledgeBatch");
  });

  it("getAreaKnowledge kaller console.error og returnerer [] ved DB-feil", async () => {
    const mock = buildPlaceKnowledgeMock({ error: { message: "row level security" } });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getAreaKnowledge("area-1");

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("getAreaKnowledge");
  });

  it("getHighlightPOIs kaller console.error og returnerer [] ved pois-feil", async () => {
    const mock = buildPoisMock({ poisError: { message: "perm denied" } });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getHighlightPOIs("area-x");

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("getHighlightPOIs");
  });

  it("getCuratedPOIs kaller console.error og returnerer [] ved pois-feil", async () => {
    const mock = buildPoisMock({ poisError: { message: "network error" } });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getCuratedPOIs("area-x", {});

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("getCuratedPOIs");
  });

  it("returnerer [] / {} stille når client er null (ingen error-log)", async () => {
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(null);

    expect(await getPlaceKnowledge("x")).toEqual([]);
    expect(await getPlaceKnowledgeBatch(["x"])).toEqual({});
    expect(await getAreaKnowledge("x")).toEqual([]);
    expect(await getHighlightPOIs("x")).toEqual([]);
    expect(await getCuratedPOIs("x", {})).toEqual([]);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// AC1 — sourceUrl isSafeUrl-guard (transform test)
// ──────────────────────────────────────────────

describe("AC1 — transformPlaceKnowledge sourceUrl guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeKnowledgeRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "pk-1",
      poi_id: "poi-1",
      area_id: null,
      topic: "history",
      fact_text: "Ranheim ble grunnlagt i 1907.",
      fact_text_en: null,
      structured_data: null,
      confidence: "verified",
      source_url: overrides.source_url ?? null,
      source_name: overrides.source_name ?? null,
      sort_order: 0,
      display_ready: true,
      verified_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      ...overrides,
    };
  }

  it("trygg HTTPS-URL bevares", async () => {
    const rows = [makeKnowledgeRow({ source_url: "https://example.com/ranheim" })];
    const mock = buildPlaceKnowledgeMock({ rows });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledge("poi-1");

    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBe("https://example.com/ranheim");
  });

  it("javascript:-URL strippes (isSafeUrl-guard)", async () => {
    const rows = [makeKnowledgeRow({ source_url: "javascript:alert(1)" })];
    const mock = buildPlaceKnowledgeMock({ rows });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledge("poi-1");

    expect(result).toHaveLength(1);
    expect(result[0].sourceUrl).toBeUndefined();
  });

  it("null source_url → undefined i output", async () => {
    const rows = [makeKnowledgeRow({ source_url: null })];
    const mock = buildPlaceKnowledgeMock({ rows });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledge("poi-1");
    expect(result[0].sourceUrl).toBeUndefined();
  });

  it("sort_order null → 0 i output", async () => {
    const rows = [makeKnowledgeRow({ sort_order: null })];
    const mock = buildPlaceKnowledgeMock({ rows });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledge("poi-1");
    expect(result[0].sortOrder).toBe(0);
  });

  it("getPlaceKnowledgeBatch grupperer korrekt per poi_id", async () => {
    const rows = [
      makeKnowledgeRow({ id: "pk-1", poi_id: "poi-a" }),
      makeKnowledgeRow({ id: "pk-2", poi_id: "poi-b" }),
      makeKnowledgeRow({ id: "pk-3", poi_id: "poi-a" }),
    ];
    const mock = buildPlaceKnowledgeMock({ rows });
    (createPublicClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);

    const result = await getPlaceKnowledgeBatch(["poi-a", "poi-b"]);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result["poi-a"]).toHaveLength(2);
    expect(result["poi-b"]).toHaveLength(1);
  });
});
