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

// Lesestien bruker nå service-role-klienten (createServerClient) etter at
// anon-SELECT på v2 ble trukket tilbake (migrasjon 077). Mocken returnerer den
// samme scriptbare schema-chainen.
const mockClient = {
  schema: vi.fn(() => ({ from: vi.fn((table: string) => chain(table)) })),
};

vi.mock("./client", () => ({
  isSupabaseConfigured: () => true,
  createServerClient: vi.fn(() => mockClient),
}));

import {
  getProductFromSupabaseV2,
  transformPOI,
  parsePoiGroundingOrLog,
} from "./v2-queries";
import type { DbPoi } from "./types";

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
  it("data-server bruker KUN v2-stien i getProductAsync (public-legacy døde ved cutover)", () => {
    const src = readFileSync(join(process.cwd(), "lib", "data-server.ts"), "utf8");
    expect(src).toContain("getProductFromSupabaseV2(customer, projectSlug, productType)");
    expect(src).not.toMatch(/from ["']\.\/supabase\/queries["']/);
    expect(src).not.toMatch(/\bgetProductFromSupabase\b(?!V2)/);
  });

  it("v2-stien bruker ingen nested PostgREST-select (v2 mangler FK-metadata)", () => {
    const src = readFileSync(join(process.cwd(), "lib", "supabase", "v2-queries.ts"), "utf8");
    expect(src).not.toMatch(/select\(\s*`[^`]*\(/); // ingen `tabell(...)`-joins
  });
});

// ---------------------------------------------------------------------------
// Per-POI grounding (migrasjon 084) + gallery_images-mappingen
// ---------------------------------------------------------------------------

const GENERATED_GROUNDING = {
  provider: "gemini-search-grounding",
  narrative: "Parken ligger langs elva og har amfi, skulpturer og et kvernhus.",
  sources: [
    {
      title: "Kilde",
      url: "https://trondheim.kommune.no/muustroparken",
      redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/x",
      domain: "trondheim.kommune.no",
    },
  ],
  searchEntryPointHtml: '<div class="chip">søk</div>',
  searchQueries: ["Muustrøparken"],
  model: "gemini-2.5-flash",
  fetchedAt: "2026-08-12T10:00:00.000Z",
  qualityGate: { passed: true, sourceCount: 1, charCount: 63 },
};

const CURATED_GROUNDING = {
  narrative: "Nabolagets grønne pustehull.",
  curatedAt: "2026-08-12T12:00:00.000Z",
};

function dbPoi(overrides: Record<string, unknown> = {}) {
  return poiRow("p1", overrides) as unknown as DbPoi;
}

describe("parsePoiGroundingOrLog", () => {
  it("null/undefined → undefined uten feil-log", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parsePoiGroundingOrLog(null, "p1")).toBeUndefined();
    expect(parsePoiGroundingOrLog(undefined, "p1")).toBeUndefined();
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("gyldig grounding parses gjennom", () => {
    const parsed = parsePoiGroundingOrLog(
      { poiGroundingVersion: 1, generated: GENERATED_GROUNDING },
      "p1"
    );
    expect(parsed?.generated?.narrative).toContain("kvernhus");
  });

  it("ødelagt generated forkastes ALENE — curated overlever, og feilen logges med POI-ID", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const brokenGenerated: Record<string, unknown> = { ...GENERATED_GROUNDING };
    delete brokenGenerated.searchEntryPointHtml;

    const parsed = parsePoiGroundingOrLog(
      {
        poiGroundingVersion: 1,
        generated: brokenGenerated,
        curated: CURATED_GROUNDING,
      },
      "google-ChIJe2pnuSJibUYRqz4D6mc_JdM"
    );

    expect(parsed).toBeDefined();
    expect(parsed!.generated).toBeUndefined();
    expect(parsed!.curated?.narrative).toBe("Nabolagets grønne pustehull.");
    expect(errSpy).toHaveBeenCalledWith(
      "[poi-grounding] generated-laget forkastet",
      expect.objectContaining({ poiId: "google-ChIJe2pnuSJibUYRqz4D6mc_JdM" })
    );
    errSpy.mockRestore();
  });

  it("ukjent poiGroundingVersion → utelates helt, feil logges (versjon-bump-kontrakten)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const parsed = parsePoiGroundingOrLog(
      { poiGroundingVersion: 2, generated: GENERATED_GROUNDING },
      "entur-NSR-StopPlace-271"
    );
    expect(parsed).toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith(
      "[poi-grounding] Zod-parse feilet — grounding utelatt",
      expect.objectContaining({ poiId: "entur-NSR-StopPlace-271" })
    );
    errSpy.mockRestore();
  });

  it("søppel-verdi (streng i stedet for objekt) → undefined, ingen kast", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parsePoiGroundingOrLog("ikke et objekt", "p1")).toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("transformPOI — nye kolonner", () => {
  it("mapper grounding fra DB-raden", () => {
    const poi = transformPOI(
      dbPoi({ grounding: { poiGroundingVersion: 1, generated: GENERATED_GROUNDING } }),
      undefined
    );
    expect(poi.grounding?.generated?.qualityGate.passed).toBe(true);
  });

  it("mapper gallery_images → galleryImages (hullet Utforsk-modalen avdekket)", () => {
    const poi = transformPOI(
      dbPoi({ gallery_images: ["https://lh3.googleusercontent.com/a", "https://lh3.googleusercontent.com/b"] }),
      undefined
    );
    expect(poi.galleryImages).toEqual([
      "https://lh3.googleusercontent.com/a",
      "https://lh3.googleusercontent.com/b",
    ]);
  });

  it("POI uten grounding og uten bilder gir undefined på begge (fravær ≠ tom)", () => {
    const poi = transformPOI(dbPoi(), undefined);
    expect(poi.grounding).toBeUndefined();
    expect(poi.galleryImages).toBeUndefined();
  });

  it("heterogene POI-IDer passerer uendret gjennom (regresjonsvern mot .uuid()-fellen)", () => {
    for (const id of [
      "google-ChIJe2pnuSJibUYRqz4D6mc_JdM",
      "entur-NSR-StopPlace-271",
      "3f8c1a90-1111-4222-8333-444455556666",
    ]) {
      const poi = transformPOI(
        poiRow(id, {
          grounding: { poiGroundingVersion: 1, generated: GENERATED_GROUNDING },
        }) as unknown as DbPoi,
        undefined
      );
      expect(poi.id).toBe(id);
      expect(poi.grounding?.generated).toBeDefined();
    }
  });
});

describe("grounding gjennom hele lesestien", () => {
  it("getProductFromSupabaseV2 returnerer POI-er med validert grounding og bilder", async () => {
    enqueue("projects", { data: PROJECT_ROW, error: null });
    enqueue("products", { data: PRODUCT_ROW, error: null });
    enqueue("project_pois", { data: [{ poi_id: "a", travel_times: null }], error: null });
    enqueue("product_pois", { data: [{ poi_id: "a", featured: false, sort_order: 1 }], error: null });
    enqueue("pois", {
      data: [
        poiRow("a", {
          grounding: {
            poiGroundingVersion: 1,
            generated: GENERATED_GROUNDING,
            curated: CURATED_GROUNDING,
          },
          gallery_images: ["https://lh3.googleusercontent.com/a"],
        }),
      ],
      error: null,
    });
    enqueue("categories", { data: [CAT_ROW], error: null });
    enqueue("product_categories", { data: [], error: null });

    const project = await getProductFromSupabaseV2("intern", "pilot", "report");
    const poi = project!.pois[0];

    expect(poi.grounding?.generated?.searchEntryPointHtml).toBe('<div class="chip">søk</div>');
    expect(poi.grounding?.curated?.narrative).toBe("Nabolagets grønne pustehull.");
    expect(poi.galleryImages).toHaveLength(1);
  });
});
