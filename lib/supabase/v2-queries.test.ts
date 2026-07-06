import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Eksekverings-tester for v2-lesestien (cutover-fase A):
 *   - full komposisjon (split-queries → Project-form legacy-stien har)
 *   - travel_times → POI.travelTime (MINUTTER-kontrakten, bead 2nj read-side)
 *   - trust-gate, featured, product_categories-vs-avledning
 *   - miss/feil → null (legacy-fallback) med logging (r01.6 AC4)
 */

// Scriptbar chainable v2-klient. Hver from(tabell) leverer neste svar fra køen.
type QueryResult = { data: unknown; error: { message: string } | null };

const queues = new Map<string, QueryResult[]>();

function enqueue(table: string, result: QueryResult) {
  if (!queues.has(table)) queues.set(table, []);
  queues.get(table)!.push(result);
}

function nextResult(table: string): QueryResult {
  const q = queues.get(table);
  if (!q || q.length === 0) {
    throw new Error(`Uventet query mot ${table} — ingen kø-oppføring`);
  }
  return q.shift()!;
}

function chain(table: string) {
  const result = () => nextResult(table);
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of ["select", "eq", "in", "order"]) {
    builder[m] = vi.fn(self);
  }
  builder.maybeSingle = vi.fn(async () => result());
  // Await-bar uten maybeSingle (thenable)
  builder.then = (resolve: (r: QueryResult) => void) => resolve(result());
  return builder;
}

vi.mock("./client", () => ({
  supabase: {
    schema: vi.fn(() => ({ from: vi.fn((table: string) => chain(table)) })),
  },
  isSupabaseConfigured: () => true,
  createServerClient: vi.fn(),
}));

import { getProductFromSupabaseV2 } from "./v2-queries";

const PROJECT_ROW = {
  id: "proj-1",
  customer_id: "intern",
  url_slug: "pilot",
  name: "Pilotprosjekt",
  center_lat: 63.43,
  center_lng: 10.4,
  has_3d_addon: true,
  theme: { primary: "#112233" },
  homepage_url: null,
  venue_type: "residential",
  tags: ["pilot"],
  default_product: "report",
  version: 1,
  created_at: "c",
  updated_at: "u",
};

const PRODUCT_ROW = {
  id: "prod-1",
  project_id: "proj-1",
  product_type: "report",
  config: { reportConfig: { themes: [{ id: "t1" }] } },
  story_title: "Velkommen",
  story_intro_text: "Intro",
  story_hero_images: ["/a.jpg"],
  version: 1,
  created_at: "c",
  updated_at: "u",
};

function poiRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `POI ${id}`,
    lat: 63.431,
    lng: 10.41,
    category_id: "cat-1",
    trust_score: null,
    trust_flags: [],
    address: null,
    description: null,
    ...overrides,
  };
}

const CAT_ROW = { id: "cat-1", name: "Kafé", icon: "Coffee", color: "#aa5500" };

beforeEach(() => {
  queues.clear();
  vi.clearAllMocks();
});

describe("getProductFromSupabaseV2 — komposisjon", () => {
  it("bygger Project-formen: config→reportConfig, travel_times→travelTime (minutter), featured, kategorier", async () => {
    enqueue("projects", { data: PROJECT_ROW, error: null });
    enqueue("products", { data: PRODUCT_ROW, error: null });
    enqueue("project_pois", {
      data: [
        { poi_id: "a", travel_times: { walk: 7 } },
        { poi_id: "b", travel_times: null },
      ],
      error: null,
    });
    enqueue("product_pois", {
      data: [
        { poi_id: "a", featured: true, sort_order: 1 },
        { poi_id: "b", featured: false, sort_order: 2 },
      ],
      error: null,
    });
    enqueue("pois", { data: [poiRow("a"), poiRow("b")], error: null });
    enqueue("categories", { data: [CAT_ROW], error: null });
    enqueue("product_categories", {
      data: [{ category_id: "cat-1", display_order: 1 }],
      error: null,
    });

    const project = await getProductFromSupabaseV2("intern", "pilot", "report");

    expect(project).not.toBeNull();
    expect(project!.id).toBe("prod-1");
    expect(project!.name).toBe("Pilotprosjekt");
    expect(project!.has3dAddon).toBe(true);
    expect(project!.reportConfig).toEqual({ themes: [{ id: "t1" }] });
    expect(project!.story.title).toBe("Velkommen");
    expect(project!.story.sections).toEqual([]);

    expect(project!.pois).toHaveLength(2);
    const a = project!.pois.find((p) => p.id === "a")!;
    const b = project!.pois.find((p) => p.id === "b")!;
    expect(a.travelTime).toEqual({ walk: 7, bike: undefined, car: undefined });
    expect(a.featured).toBe(true);
    expect(b.travelTime).toBeUndefined();
    expect(b.featured).toBeUndefined();
    expect(a.category.name).toBe("Kafé");

    expect(project!.categories).toEqual([
      { id: "cat-1", name: "Kafé", icon: "Coffee", color: "#aa5500" },
    ]);
  });

  it("trust-gaten filtrerer: score under terskel skjules, null vises", async () => {
    enqueue("projects", { data: PROJECT_ROW, error: null });
    enqueue("products", { data: PRODUCT_ROW, error: null });
    enqueue("project_pois", { data: [], error: null });
    enqueue("product_pois", {
      data: [
        { poi_id: "trusted", featured: false, sort_order: 1 },
        { poi_id: "untrusted", featured: false, sort_order: 2 },
        { poi_id: "unscored", featured: false, sort_order: 3 },
      ],
      error: null,
    });
    enqueue("pois", {
      data: [
        poiRow("trusted", { trust_score: 0.9 }),
        poiRow("untrusted", { trust_score: 0.2 }),
        poiRow("unscored", { trust_score: null }),
      ],
      error: null,
    });
    enqueue("categories", { data: [CAT_ROW], error: null });
    enqueue("product_categories", { data: [], error: null });

    const project = await getProductFromSupabaseV2("intern", "pilot", "report");
    expect(project!.pois.map((p) => p.id).sort()).toEqual(["trusted", "unscored"]);
  });

  it("tom product_categories → kategorier avledes fra POI-ene", async () => {
    enqueue("projects", { data: PROJECT_ROW, error: null });
    enqueue("products", { data: PRODUCT_ROW, error: null });
    enqueue("project_pois", { data: [], error: null });
    enqueue("product_pois", { data: [{ poi_id: "a", featured: false, sort_order: 1 }], error: null });
    enqueue("pois", { data: [poiRow("a")], error: null });
    enqueue("categories", { data: [CAT_ROW], error: null });
    enqueue("product_categories", { data: [], error: null });

    const project = await getProductFromSupabaseV2("intern", "pilot", "report");
    expect(project!.categories.map((c) => c.id)).toEqual(["cat-1"]);
  });
});

describe("getProductFromSupabaseV2 — miss/feil → null (legacy-fallback)", () => {
  it("prosjekt finnes ikke i v2 → null uten flere queries", async () => {
    enqueue("projects", { data: null, error: null });
    const project = await getProductFromSupabaseV2("intern", "finnes-ikke", "report");
    expect(project).toBeNull();
    expect(queues.get("products") ?? []).toHaveLength(0);
  });

  it("DB-feil → null + console.error (r01.6 AC4: aldri stille svelging)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    enqueue("projects", { data: null, error: { message: "boom" } });
    const project = await getProductFromSupabaseV2("intern", "pilot", "report");
    expect(project).toBeNull();
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("projects-oppslag feilet"),
      "boom"
    );
    errSpy.mockRestore();
  });

  it("produkt-type finnes ikke → null", async () => {
    enqueue("projects", { data: PROJECT_ROW, error: null });
    enqueue("products", { data: null, error: null });
    const project = await getProductFromSupabaseV2("intern", "pilot", "guide");
    expect(project).toBeNull();
  });
});

describe("kilde-vakter — v2-først-wiring og split-queries", () => {
  it("data-server kaller v2-stien FØR legacy-stien i getProductAsync", () => {
    const src = readFileSync(join(process.cwd(), "lib", "data-server.ts"), "utf8");
    const v2Idx = src.indexOf("getProductFromSupabaseV2(customer, projectSlug, productType)");
    const legacyIdx = src.indexOf("getProductFromSupabase(customer, projectSlug, productType)");
    expect(v2Idx).toBeGreaterThan(-1);
    expect(legacyIdx).toBeGreaterThan(-1);
    expect(v2Idx).toBeLessThan(legacyIdx);
  });

  it("v2-stien bruker ingen nested PostgREST-select (v2 mangler FK-metadata)", () => {
    const src = readFileSync(join(process.cwd(), "lib", "supabase", "v2-queries.ts"), "utf8");
    expect(src).not.toMatch(/select\(\s*`[^`]*\(/); // ingen `tabell(...)`-joins
  });
});
