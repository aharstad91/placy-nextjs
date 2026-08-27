import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./poi-discovery", () => ({
  discoverGooglePlaces: vi.fn(async () => []),
  discoverEnturStops: vi.fn(async () => []),
  discoverBysykkelStations: vi.fn(async () => []),
}));

vi.mock("@/lib/supabase/mutations", () => ({
  upsertCategories: vi.fn(async () => {}),
  upsertPOIsWithEditorialPreservation: vi.fn(async () => ({
    inserted: 0,
    updated: 0,
    errors: [],
  })),
}));

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

import {
  discoverGooglePlaces,
  discoverEnturStops,
  discoverBysykkelStations,
  type DiscoveredPOI,
} from "./poi-discovery";
import {
  upsertCategories,
  upsertPOIsWithEditorialPreservation,
} from "@/lib/supabase/mutations";
import { createServerClient } from "@/lib/supabase/client";
import { importPOIsToProject, persistDiscoveredPOIs } from "./import-pois";

/**
 * Atferdstester for import-pipelinen (tidligere kun statisk kildekontrakt).
 * Fokus: kontraktene der en regresjon er STILLE — seeding-rekkefølge (samme
 * klasse som Barn & Oppvekst-bugen), trust-score-tildeling, featured-vernet
 * ved re-import, og dedup på tvers av sirkler.
 */

const CAFE_CATEGORY = { id: "cafe", name: "Kafé", icon: "Coffee", color: "#f97316" };
const BUS_CATEGORY = { id: "bus", name: "Buss", icon: "Bus", color: "#3b82f6" };

function googlePoi(id: string, over: Partial<DiscoveredPOI> = {}): DiscoveredPOI {
  return {
    id: `google-${id}`,
    name: `Kafé ${id}`,
    coordinates: { lat: 63.431, lng: 10.4 },
    category: CAFE_CATEGORY,
    googlePlaceId: id,
    googleRating: 4.4,
    googleReviewCount: 40,
    source: "google",
    ...over,
  };
}

function enturPoi(id: string): DiscoveredPOI {
  return {
    id: `entur-${id}`,
    name: `Holdeplass ${id}`,
    coordinates: { lat: 63.432, lng: 10.4 },
    category: BUS_CATEGORY,
    source: "entur",
    enturStopplaceId: id,
  };
}

/** Thenable chain-mock: alle filter-metoder returnerer seg selv, await gir {data, error}. */
function chainResult(
  data: unknown,
  error: unknown = null,
  filters?: Array<[string, string, unknown]>
) {
  const chain: Record<string, unknown> = {};
  for (const m of ["gte", "lte", "eq", "in", "select"]) {
    chain[m] = (col?: string, val?: unknown) => {
      if (filters && col !== undefined) filters.push([m, col, val]);
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data, error }).then(resolve);
  return chain;
}

interface ExistingRow {
  id: string;
  google_place_id: string | null;
  entur_stopplace_id: string | null;
  bysykkel_station_id: string | null;
}

function buildSupabase(opts: {
  existing?: ExistingRow[];
  existingError?: { message: string };
  products?: { id: string }[];
} = {}) {
  const captured = {
    projectPoisInserts: [] as unknown[],
    productPoisUpserts: [] as Array<{ rows: unknown; options: unknown }>,
    poiFilters: [] as Array<[string, string, unknown]>,
  };

  const mock = {
    schema: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === "pois") {
        return {
          select: () =>
            chainResult(
              opts.existing ?? [],
              opts.existingError ?? null,
              captured.poiFilters
            ),
        };
      }
      if (table === "project_pois") {
        return {
          select: () => chainResult([]),
          insert: vi.fn(async (rows: unknown) => {
            captured.projectPoisInserts.push(rows);
            return { error: null };
          }),
        };
      }
      if (table === "products") {
        return { select: () => chainResult(opts.products ?? []) };
      }
      if (table === "product_pois") {
        return {
          upsert: vi.fn(async (rows: unknown, options: unknown) => {
            captured.productPoisUpserts.push({ rows, options });
            return { error: null };
          }),
        };
      }
      return {};
    }),
  };
  mock.schema.mockReturnValue(mock);
  return { mock, captured };
}

const BASE_OPTIONS = {
  circles: [{ lat: 63.43, lng: 10.4, radiusMeters: 2000 }],
  categories: ["cafe"],
  projectId: "placy-demo_test",
};

describe("importPOIsToProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { mock } = buildSupabase();
    vi.mocked(createServerClient).mockReturnValue(
      mock as unknown as ReturnType<typeof createServerClient>
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("kategorier seedes FØR POI-upsert, med de unike kategoriene fra discovery (bug-klassen fra 2026-07-06 på Google-stien)", async () => {
    vi.mocked(discoverGooglePlaces).mockResolvedValue([googlePoi("a"), googlePoi("b")]);
    vi.mocked(discoverEnturStops).mockResolvedValue([enturPoi("NSR-1")]);

    await importPOIsToProject(BASE_OPTIONS);

    expect(upsertCategories).toHaveBeenCalledWith(
      [CAFE_CATEGORY, BUS_CATEGORY],
      { schema: "v2" }
    );
    const seedOrder = vi.mocked(upsertCategories).mock.invocationCallOrder[0];
    const upsertOrder = vi.mocked(upsertPOIsWithEditorialPreservation).mock
      .invocationCallOrder[0];
    expect(seedOrder).toBeLessThan(upsertOrder);
  });

  it("trust-kontrakten: transport-POI-er får trust_score 1.0, Google-POI-er null (må valideres)", async () => {
    vi.mocked(discoverGooglePlaces).mockResolvedValue([googlePoi("g1")]);
    vi.mocked(discoverEnturStops).mockResolvedValue([enturPoi("NSR-1")]);

    await importPOIsToProject(BASE_OPTIONS);

    const payload = vi.mocked(upsertPOIsWithEditorialPreservation).mock
      .calls[0][0] as Array<{ id: string; trust_score: number | null }>;
    const byId = new Map(payload.map((p) => [p.id, p.trust_score]));
    expect(byId.get("google-g1")).toBeNull();
    expect(byId.get("entur-NSR-1")).toBe(1.0);
  });

  it("eksisterende POI (match på google_place_id) gjenbruker eksisterende DB-id — ingen duplikat-rad", async () => {
    vi.mocked(discoverGooglePlaces).mockResolvedValue([googlePoi("g1")]);
    const { mock } = buildSupabase({
      existing: [
        { id: "legacy-uuid-1", google_place_id: "g1", entur_stopplace_id: null, bysykkel_station_id: null },
      ],
    });
    vi.mocked(createServerClient).mockReturnValue(
      mock as unknown as ReturnType<typeof createServerClient>
    );

    const stats = await importPOIsToProject(BASE_OPTIONS);

    const payload = vi.mocked(upsertPOIsWithEditorialPreservation).mock
      .calls[0][0] as Array<{ id: string }>;
    expect(payload.map((p) => p.id)).toEqual(["legacy-uuid-1"]);
    expect(stats.updated).toBe(1);
    expect(stats.new).toBe(0);
  });

  it("dedup-oppslag feiler → fail-soft: POI-er behandles som nye, ingen kast (dokumentert dedup-tap, AC7)", async () => {
    vi.mocked(discoverGooglePlaces).mockResolvedValue([googlePoi("g1")]);
    const { mock } = buildSupabase({ existingError: { message: "DB nede" } });
    vi.mocked(createServerClient).mockReturnValue(
      mock as unknown as ReturnType<typeof createServerClient>
    );

    const stats = await importPOIsToProject(BASE_OPTIONS);

    expect(stats.new).toBe(1);
    expect(stats.updated).toBe(0);
    // Tapet logges eksplisitt (aldri stille return [])
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("dedup")
    );
  });

  it("samme googlePlaceId i to sirkler → én POI i upsert-payloaden (cross-circle dedup)", async () => {
    vi.mocked(discoverGooglePlaces).mockResolvedValue([googlePoi("dup")]);

    await importPOIsToProject({
      ...BASE_OPTIONS,
      circles: [
        { lat: 63.43, lng: 10.4, radiusMeters: 2000 },
        { lat: 63.435, lng: 10.41, radiusMeters: 2000 },
      ],
    });

    expect(vi.mocked(discoverGooglePlaces)).toHaveBeenCalledTimes(2);
    const payload = vi.mocked(upsertPOIsWithEditorialPreservation).mock
      .calls[0][0] as Array<{ id: string }>;
    expect(payload).toHaveLength(1);
  });

  it("uten GOOGLE_PLACES_API_KEY: Google-discovery skippes STILLE, transport importeres (rapportert funn — ingen warning til kalleren)", async () => {
    // Pinner dagens oppførsel: manglende nøkkel gir board uten kommersielle
    // POI-er uten at importPOIsToProject varsler. Eneste vern nedstrøms er
    // enrichReportPois' «< 10 kommersielle»-warning (som også teller transport).
    // Endres policyen (kast/warning), skal denne testen oppdateres bevisst.
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    vi.mocked(discoverEnturStops).mockResolvedValue([enturPoi("NSR-1")]);

    const stats = await importPOIsToProject(BASE_OPTIONS);

    expect(discoverGooglePlaces).not.toHaveBeenCalled();
    expect(stats.total).toBe(1);
    expect(stats.byCategory).toEqual({ bus: 1 });
  });

  it("product_pois-linking bruker ignoreDuplicates + featured:false — re-import klobber ALDRI kuratert featured-flagg", async () => {
    vi.mocked(discoverGooglePlaces).mockResolvedValue([googlePoi("g1")]);
    const { mock, captured } = buildSupabase({ products: [{ id: "prod-1" }] });
    vi.mocked(createServerClient).mockReturnValue(
      mock as unknown as ReturnType<typeof createServerClient>
    );

    await importPOIsToProject(BASE_OPTIONS);

    expect(captured.productPoisUpserts).toHaveLength(1);
    const { rows, options } = captured.productPoisUpserts[0];
    // ignoreDuplicates: true er featured-vernet — uten det ville re-import
    // resatt featured=false på alle POI-er hydreringen har kuratert.
    expect(options).toEqual({ onConflict: "product_id,poi_id", ignoreDuplicates: true });
    expect(rows).toEqual([{ product_id: "prod-1", poi_id: "google-g1", featured: false }]);
  });

  it("stats-kontrakten: counts reflekterer DISCOVERY, ikke faktiske skriv — upsert-feil svelges med logg", async () => {
    // Pinner dagens semantikk (rapportert som funn): upsertPOIsWithEditorial-
    // Preservation kan feile uten at counts/kalleren påvirkes. En bevisst
    // endring til skriv-baserte counts skal oppdatere denne testen.
    vi.mocked(discoverGooglePlaces).mockResolvedValue([googlePoi("g1")]);
    vi.mocked(upsertPOIsWithEditorialPreservation).mockResolvedValue({
      inserted: 0,
      updated: 0,
      errors: ["Upsert feilet: DB nede"],
    });

    const stats = await importPOIsToProject(BASE_OPTIONS);

    expect(stats.total).toBe(1);
    expect(stats.new).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Upsert errors"),
      expect.anything()
    );
  });
});

/**
 * `persistDiscoveredPOIs` er halvdel to av importen, skilt ut 2026-08-27 fordi
 * anker-passet trenger den uten sirkel-søket foran. Testene her dekker det
 * eneste som er NYTT i den stien: dedup-boksen må utledes av POI-ene selv når
 * kalleren ikke har en sirkel å gi.
 */
describe("persistDiscoveredPOIs (uten sirkel-søk foran)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("utleder dedup-boksen fra POI-ene og utvider den med margin", async () => {
    const { mock, captured } = buildSupabase();
    vi.mocked(createServerClient).mockReturnValue(
      mock as unknown as ReturnType<typeof createServerClient>
    );

    await persistDiscoveredPOIs(
      [
        googlePoi("nord", { coordinates: { lat: 63.5, lng: 10.4 } }),
        googlePoi("sor", { coordinates: { lat: 63.4, lng: 10.3 } }),
      ],
      "placy-demo_test"
    );

    const bounds = Object.fromEntries(
      captured.poiFilters
        .filter(([m]) => m === "gte" || m === "lte")
        .map(([m, col, val]) => [`${m}_${col}`, val as number])
    );
    // Boksen dekker begge POI-ene ...
    expect(bounds.gte_lat).toBeLessThan(63.4);
    expect(bounds.lte_lat).toBeGreaterThan(63.5);
    // ... med en margin på ~200 m (≈0,0018°), fordi dedupen matcher på
    // google_place_id og en rad kan ha flyttet seg noen titalls meter.
    expect(63.4 - bounds.gte_lat).toBeCloseTo(200 / 111320, 5);
  });

  it("tom liste rører verken basen eller mutations", async () => {
    const { mock } = buildSupabase();
    vi.mocked(createServerClient).mockReturnValue(
      mock as unknown as ReturnType<typeof createServerClient>
    );

    const stats = await persistDiscoveredPOIs([], "placy-demo_test");

    expect(stats.total).toBe(0);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(upsertCategories).not.toHaveBeenCalled();
    expect(upsertPOIsWithEditorialPreservation).not.toHaveBeenCalled();
  });

  it("kalleren kan gi dedup-grunnlaget selv (sirkel-stien) — da slås ingenting opp", async () => {
    const { mock } = buildSupabase();
    vi.mocked(createServerClient).mockReturnValue(
      mock as unknown as ReturnType<typeof createServerClient>
    );

    const stats = await persistDiscoveredPOIs([googlePoi("g1")], "placy-demo_test", {
      existing: [
        {
          id: "legacy-uuid-1",
          google_place_id: "g1",
          entur_stopplace_id: null,
          bysykkel_station_id: null,
        },
      ],
    });

    expect(stats.updated).toBe(1);
    const payload = vi.mocked(upsertPOIsWithEditorialPreservation).mock
      .calls[0][0] as Array<{ id: string }>;
    expect(payload.map((p) => p.id)).toEqual(["legacy-uuid-1"]);
  });
});
