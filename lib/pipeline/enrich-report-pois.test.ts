import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pipeline/import-pois", () => ({
  importPOIsToProject: vi.fn(),
}));

import { importPOIsToProject } from "@/lib/pipeline/import-pois";
import {
  enrichReportPois,
  BOLIG_GOOGLE_CATEGORIES,
  NAERING_GOOGLE_CATEGORIES,
} from "./enrich-report-pois";

const SUPABASE_URL = "https://test.supabase.co";
const SERVICE_KEY = "test-service-key";

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
}

const importMock = importPOIsToProject as ReturnType<typeof vi.fn>;

describe("enrichReportPois — Unit 7 (foto-fase DEFERRED → Unit 4)", () => {
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

  it("AC1: kaller importPOIsToProject og returnerer aggregert google-resultat (ingen photos-ledd)", async () => {
    importMock.mockResolvedValue({
      total: 25, new: 20, updated: 5, byCategory: { restaurant: 8, cafe: 5 },
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(importMock).toHaveBeenCalledTimes(1);
    expect(result.google.total).toBe(25);
    expect(result.warnings).toHaveLength(0);
    // Foto-fasen er deferred — resultatet skal ikke ha et photos-ledd
    expect(result).not.toHaveProperty("photos");
  });

  it("AC1: default kategoriliste er BOLIG_GOOGLE_CATEGORIES (14)", async () => {
    importMock.mockResolvedValue({ total: 15, new: 15, updated: 0, byCategory: {} });

    await enrichReportPois(BASE_OPTIONS);

    expect(BOLIG_GOOGLE_CATEGORIES).toHaveLength(14);
    expect(importMock.mock.calls[0][0].categories).toEqual(BOLIG_GOOGLE_CATEGORIES);
  });

  it("AC1: næringsprofil-divergens — NAERING (13): hotel inn, shopping_mall + spa ut", async () => {
    importMock.mockResolvedValue({ total: 15, new: 15, updated: 0, byCategory: {} });

    await enrichReportPois({ ...BASE_OPTIONS, categories: NAERING_GOOGLE_CATEGORIES });

    expect(NAERING_GOOGLE_CATEGORIES).toHaveLength(13);
    expect(NAERING_GOOGLE_CATEGORIES).toContain("hotel");
    expect(NAERING_GOOGLE_CATEGORIES).not.toContain("shopping_mall");
    expect(NAERING_GOOGLE_CATEGORIES).not.toContain("spa");
    // bolig har motsatt: shopping_mall + spa inn, hotel ut
    expect(BOLIG_GOOGLE_CATEGORIES).toContain("shopping_mall");
    expect(BOLIG_GOOGLE_CATEGORIES).toContain("spa");
    expect(BOLIG_GOOGLE_CATEGORIES).not.toContain("hotel");
    expect(importMock.mock.calls[0][0].categories).toEqual(NAERING_GOOGLE_CATEGORIES);
  });

  it("AC1: advarsel når < 10 kommersielle POI-er funnet", async () => {
    importMock.mockResolvedValue({ total: 7, new: 7, updated: 0, byCategory: {} });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(result.warnings.some((w) => w.includes("7 kommersielle"))).toBe(true);
  });

  it("AC2: revalidatePath-feil fra importPOIsToProject fanges (CLI) → leser DB-antall, fortsetter", async () => {
    importMock.mockRejectedValue(
      new Error("revalidatePath is not available in this context")
    );

    const result = await enrichReportPois(BASE_OPTIONS);

    // Skal ikke kaste, men advare
    expect(result.warnings.some((w) => w.includes("revalidatePath"))).toBe(true);
    // Uten ekte Supabase-klient settes google-tall til 0 (returverdien gikk tapt i throw)
    expect(result.google.total).toBe(0);
  });

  it("AC2: ikke-revalidatePath-feil fra import → kaster (ekte feil, ikke svelg)", async () => {
    importMock.mockRejectedValue(new Error("Google Places quota exceeded"));

    await expect(enrichReportPois(BASE_OPTIONS)).rejects.toThrow(
      /Google Places import feilet/,
    );
  });

  it("AC3: manglende Supabase-env kaster tidlig (før import)", async () => {
    setEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined });

    await expect(enrichReportPois(BASE_OPTIONS)).rejects.toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    expect(importMock).not.toHaveBeenCalled();
  });
});
