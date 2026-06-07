import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pipeline/import-pois", () => ({
  importPOIsToProject: vi.fn(),
}));

vi.mock("@/lib/utils/fetch-poi-photos", () => ({
  fetchAndCachePOIPhotos: vi.fn(),
}));

import { importPOIsToProject } from "@/lib/pipeline/import-pois";
import { fetchAndCachePOIPhotos } from "@/lib/utils/fetch-poi-photos";
import { enrichReportPois } from "./enrich-report-pois";

const SUPABASE_URL = "https://test.supabase.co";
const SERVICE_KEY = "test-service-key";
const GOOGLE_KEY = "test-google-key";

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const set = (key: string, fallback: string) => {
    if (key in overrides && overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key] ?? fallback;
    }
  };
  set("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
  set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
  set("GOOGLE_PLACES_API_KEY", GOOGLE_KEY);
}

describe("enrichReportPois — Unit 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
  });

  const BASE_OPTIONS = {
    projectId: "placy-demo_vikhammer-strand",
    lat: 63.41,
    lng: 10.77,
    radiusMeters: 2500,
  };

  it("happy path: discovery + foto kjøres og returnerer aggregert resultat", async () => {
    (importPOIsToProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      total: 25, new: 20, updated: 5, byCategory: { restaurant: 8, cafe: 5 },
    });
    (fetchAndCachePOIPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
      updated: 18, skipped: 5, failed: 0, errors: [],
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(result.google.total).toBe(25);
    expect(result.photos.updated).toBe(18);
    expect(result.warnings).toHaveLength(0);
  });

  it("advarsel når < 10 kommersielle POI-er funnet", async () => {
    (importPOIsToProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      total: 7, new: 7, updated: 0, byCategory: {},
    });
    (fetchAndCachePOIPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
      updated: 5, skipped: 0, failed: 0, errors: [],
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(result.warnings.some((w) => w.includes("7 kommersielle"))).toBe(true);
  });

  it("foto-batch feiler for én POI → advarsel, de andre fortsetter", async () => {
    (importPOIsToProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      total: 20, new: 15, updated: 5, byCategory: {},
    });
    (fetchAndCachePOIPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
      updated: 17, skipped: 1, failed: 2, errors: ["Photo fetch failed for X"],
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(result.photos.failed).toBe(2);
    expect(result.warnings.some((w) => w.includes("2 POI-er fikk ikke foto"))).toBe(true);
  });

  it("revalidatePath-feil fra importPOIsToProject ignoreres (CLI-kontekst)", async () => {
    (importPOIsToProject as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("revalidatePath is not available in this context")
    );
    (fetchAndCachePOIPhotos as ReturnType<typeof vi.fn>).mockResolvedValue({
      updated: 0, skipped: 0, failed: 0, errors: [],
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    // Skal ikke kaste, men advare
    expect(result.warnings.some((w) => w.includes("revalidatePath"))).toBe(true);
    // Google-tall settes til 0 (ingen data fra kastet import)
    expect(result.google.total).toBe(0);
  });

  it("manglende GOOGLE_PLACES_API_KEY → advarsel, ingen foto-henting", async () => {
    setEnv({ GOOGLE_PLACES_API_KEY: undefined });
    (importPOIsToProject as ReturnType<typeof vi.fn>).mockResolvedValue({
      total: 15, new: 10, updated: 5, byCategory: {},
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(fetchAndCachePOIPhotos).not.toHaveBeenCalled();
    expect(result.warnings.some((w) => w.includes("GOOGLE_PLACES_API_KEY"))).toBe(true);
  });
});
