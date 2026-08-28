import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/pipeline/import-pois", () => ({
  importPOIsToProject: vi.fn(),
}));

vi.mock("@/lib/pipeline/discover-anchors", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pipeline/discover-anchors")>()),
  discoverAnchorsForProject: vi.fn(),
}));

import { importPOIsToProject } from "@/lib/pipeline/import-pois";
import { discoverAnchorsForProject } from "@/lib/pipeline/discover-anchors";
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
const anchorMock = discoverAnchorsForProject as ReturnType<typeof vi.fn>;

const NO_ANCHORS = {
  candidatesFound: 0,
  imported: [],
  beyondCircle: 0,
  warnings: [],
};

describe("enrichReportPois — Unit 7 (foto-fase DEFERRED → Unit 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
    anchorMock.mockResolvedValue(NO_ANCHORS);
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

  it("AC1: default kategoriliste er BOLIG_GOOGLE_CATEGORIES (58 — butikk/dagligvare-recall 2026-08-24)", async () => {
    importMock.mockResolvedValue({ total: 15, new: 15, updated: 0, byCategory: {} });

    await enrichReportPois(BASE_OPTIONS);

    expect(BOLIG_GOOGLE_CATEGORIES).toHaveLength(58);
    expect(importMock.mock.calls[0][0].categories).toEqual(BOLIG_GOOGLE_CATEGORIES);
  });

  it("AC1: næringsprofil-divergens — NAERING (16): hotel inn, shopping_mall + spa ut", async () => {
    importMock.mockResolvedValue({ total: 15, new: 15, updated: 0, byCategory: {} });

    await enrichReportPois({ ...BASE_OPTIONS, categories: NAERING_GOOGLE_CATEGORIES });

    expect(NAERING_GOOGLE_CATEGORIES).toHaveLength(16);
    expect(NAERING_GOOGLE_CATEGORIES).toContain("hotel");
    expect(NAERING_GOOGLE_CATEGORIES).not.toContain("shopping_mall");
    expect(NAERING_GOOGLE_CATEGORIES).not.toContain("spa");
    // bolig har shopping_mall + spa — og fra recall-fiksen 2026-08-12 OGSÅ hotel
    // (svigermor-spørsmålet: overnatting hører til bolig-hverdagen, datalaget)
    expect(BOLIG_GOOGLE_CATEGORIES).toContain("shopping_mall");
    expect(BOLIG_GOOGLE_CATEGORIES).toContain("spa");
    expect(BOLIG_GOOGLE_CATEGORIES).toContain("hotel");
    expect(importMock.mock.calls[0][0].categories).toEqual(NAERING_GOOGLE_CATEGORIES);
  });

  it("AC1: advarsel når < 10 kommersielle POI-er funnet", async () => {
    importMock.mockResolvedValue({ total: 7, new: 7, updated: 0, byCategory: {} });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(result.warnings.some((w) => w.includes("7 kommersielle"))).toBe(true);
  });

  it("AC2 (cache-isolasjon): importfeil kaster — ingen revalidatePath-svelging arvet", async () => {
    // import-pois rører ikke lenger revalidatePath (r03.3), så enrich har ingen
    // msg.includes("revalidatePath")-svelge-gren. Enhver importfeil får kaste.
    importMock.mockRejectedValue(new Error("Google Places quota exceeded"));
    await expect(enrichReportPois(BASE_OPTIONS)).rejects.toThrow(
      /Google Places import feilet/,
    );

    // Også en revalidatePath-formet feil skal nå KASTE (ikke svelges) — landmina er borte
    importMock.mockRejectedValue(
      new Error("revalidatePath is not available in this context"),
    );
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

describe("enrichReportPois — anker-pass utenfor prosjektsirkelen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setEnv();
    importMock.mockResolvedValue({ total: 25, new: 25, updated: 0, byCategory: {} });
    anchorMock.mockResolvedValue(NO_ANCHORS);
  });

  const BASE_OPTIONS = {
    projectId: "placy-demo_sundsoya",
    lat: 63.865218,
    lng: 11.303152,
    radiusMeters: 3000,
  };

  it("kjører anker-passet med prosjektets eget senter og radius", async () => {
    await enrichReportPois(BASE_OPTIONS);

    expect(anchorMock).toHaveBeenCalledTimes(1);
    expect(anchorMock.mock.calls[0][0]).toEqual({
      projectId: "placy-demo_sundsoya",
      lat: 63.865218,
      lng: 11.303152,
      radiusMeters: 3000,
    });
  });

  it("næringsprofilen får IKKE ankre — shopping_mall er tatt ut av den bevisst", async () => {
    await enrichReportPois({ ...BASE_OPTIONS, categories: NAERING_GOOGLE_CATEGORIES });

    expect(anchorMock).not.toHaveBeenCalled();
    const result = await enrichReportPois({
      ...BASE_OPTIONS,
      categories: NAERING_GOOGLE_CATEGORIES,
    });
    expect(result.anchors).toBeUndefined();
  });

  it("rapporterer de hentede ankrene videre til kalleren", async () => {
    anchorMock.mockResolvedValue({
      candidatesFound: 5,
      imported: [
        { id: "google-a", name: "Thon Senter Verdal", distanceMeters: 12140, beyondCircle: true },
        { id: "google-b", name: "Alti Verdal", distanceMeters: 12380, beyondCircle: true },
      ],
      beyondCircle: 2,
      warnings: [],
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(result.anchors?.candidatesFound).toBe(5);
    expect(result.anchors?.beyondCircle).toBe(2);
    expect(result.anchors?.imported.map((a) => a.name)).toEqual([
      "Thon Senter Verdal",
      "Alti Verdal",
    ]);
  });

  it("anker-warnings havner i samme kanal som resten — de forsvinner ikke", async () => {
    anchorMock.mockResolvedValue({
      ...NO_ANCHORS,
      warnings: ["⚠️  Ingen kjøpesenter funnet innen 20 km — boardet får ingen ankre"],
    });

    const result = await enrichReportPois(BASE_OPTIONS);

    expect(result.warnings.some((w) => w.includes("Ingen kjøpesenter"))).toBe(true);
  });
});
