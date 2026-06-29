import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/client";
import { hydrateReport } from "./hydrate-report";

const CENTER = { lat: 63.41, lng: 10.77 };

interface TestPoi {
  id: string;
  category_id: string;
  lat: number;
  lng: number;
  google_rating: number | null;
  google_review_count: number | null;
}
// Lager en POI ~500m nord for sentrum — innenfor 1500m
const NEAR_POI: TestPoi = { id: "poi-near", category_id: "restaurant", lat: 63.415, lng: 10.77, google_rating: 4.5, google_review_count: 100 };
// POI ~1600m unna — utenfor FEATURED_MAX_DISTANCE_M
const FAR_POI: TestPoi = { id: "poi-far", category_id: "restaurant", lat: 63.425, lng: 10.77, google_rating: 4.8, google_review_count: 200 };
// Skole (institusjonell) — bruker default 4.0 / 10
const SKOLE_POI: TestPoi = { id: "poi-skole", category_id: "skole", lat: 63.412, lng: 10.77, google_rating: null, google_review_count: null };
// Ikke-UUID POI-ID
const BUS_POI: TestPoi = { id: "bus-dronningens-gate", category_id: "bus", lat: 63.411, lng: 10.77, google_rating: null, google_review_count: null };

function buildMockSupabase(poiList = [NEAR_POI, FAR_POI]) {
  const projectPoisData = poiList.map((p) => ({ poi_id: p.id }));

  const mock = {
    // v2-skrivesti (r03.6): koden gjør baseClient.schema("v2").from(...).
    schema: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === "project_pois") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: projectPoisData, error: null }),
          }),
        };
      }
      if (table === "product_pois") {
        return {
          // Ren re-hydrering: delete → insert, deretter ÉN batch-update for
          // featured: .update({featured:true}).eq("product_id").in("poi_id", ids)
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      if (table === "pois") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: poiList, error: null }),
          }),
        };
      }
      if (table === "product_categories") {
        return {
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return {};
    }),
  };
  mock.schema.mockReturnValue(mock);
  return mock;
}

describe("hydrateReport — Unit 4", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const BASE_OPTIONS = {
    projectId: "placy-demo_vikhammer-strand",
    productId: "product-uuid",
    centerLat: CENTER.lat,
    centerLng: CENTER.lng,
  };

  it("happy path: 60 POI-er → product_pois linkes, featured markeres, categories populeres", async () => {
    const mockSupabase = buildMockSupabase([NEAR_POI]);
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await hydrateReport(BASE_OPTIONS);

    expect(result.productPoisLinked).toBe(1);
    expect(result.warnings.some((w) => w.includes("0 av 0"))).toBe(false);
    // AC4: NEAR_POI (innenfor 1500m) markeres featured via ÉN batch-update
    expect(result.featuredMarked).toBe(1);
    // AC8: v2-skrivesti
    expect(mockSupabase.schema).toHaveBeenCalledWith("v2");
  });

  it("POI langt unna (>1500m) featured IKKE — høy rating til tross", async () => {
    const mockSupabase = buildMockSupabase([FAR_POI]);
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await hydrateReport(BASE_OPTIONS);

    // FAR_POI er utenfor 1500m → featuredMarked=0
    expect(result.featuredMarked).toBe(0);
    expect(result.productPoisLinked).toBe(1);
  });

  it("POI med heterogen id (bus-...) scores og linkes uten valideringsfeil", async () => {
    const mockSupabase = buildMockSupabase([BUS_POI]);
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await hydrateReport(BASE_OPTIONS);

    expect(result.productPoisLinked).toBe(1);
    expect(result.warnings.some((w) => w.includes("feil"))).toBe(false);
  });

  it("institusjonell POI (skole): bruker default rating 4.0/10 for scoring", async () => {
    const mockSupabase = buildMockSupabase([SKOLE_POI]);
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await hydrateReport(BASE_OPTIONS);

    // Skolen er ~200m unna → innenfor 1500m → featured markeres
    expect(result.featuredMarked).toBe(1);
  });

  it("ingen POI-er koblet → returner 0-tall og advarsel", async () => {
    const mockSupabase = buildMockSupabase([]);
    // Override project_pois.select → tom liste
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "project_pois") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      return buildMockSupabase().from(table);
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const result = await hydrateReport(BASE_OPTIONS);

    expect(result.productPoisLinked).toBe(0);
    expect(result.featuredMarked).toBe(0);
    expect(result.warnings.some((w) => w.includes("Ingen POI-er"))).toBe(true);
  });
});
