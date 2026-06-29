import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

// Delvis mock: TRUST_ENRICHMENT_FIELDS beholdes ekte, kun fetch mockes
vi.mock("@/lib/google-places/fetch-place-details", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/google-places/fetch-place-details")>();
  return { ...actual, fetchPlaceDetails: vi.fn() };
});

// Delvis mock: test stegets logikk, ikke heuristikken
vi.mock("@/lib/utils/poi-trust", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/utils/poi-trust")>();
  return { ...actual, batchValidateTrust: vi.fn() };
});

vi.mock("@/lib/supabase/mutations", () => ({
  updatePOITrustScore: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/client";
import {
  fetchPlaceDetails,
  TRUST_ENRICHMENT_FIELDS,
} from "@/lib/google-places/fetch-place-details";
import { batchValidateTrust, type TrustFlag, type TrustResult } from "@/lib/utils/poi-trust";
import { updatePOITrustScore } from "@/lib/supabase/mutations";
import { validateReportTrust } from "./validate-report-trust";
import type { POI } from "@/lib/types";

const fetchPlaceDetailsMock = vi.mocked(fetchPlaceDetails);
const batchValidateTrustMock = vi.mocked(batchValidateTrust);
const updatePOITrustScoreMock = vi.mocked(updatePOITrustScore);

// ── Mock-Supabase (buildMockSupabase-mønsteret) ──────────────────────────

interface MockRow {
  id: string;
  name: string;
  [key: string]: unknown;
}

function buildMockSupabase(opts: {
  projectPois: Array<{ poi_id: string }>;
  rows: MockRow[];
  projectPoisError?: { message: string } | null;
  /** Feil på N-te pois-SELECT (1-basert) — 2 = re-lesingen etter enrichment */
  poisReadErrorOnCall?: number;
}) {
  // Levende rad-kopier: enrichment-updates muteres inn slik at re-lesingen
  // (andre .in()-kallet) ser enrichede signaler — som ekte DB
  const rows = opts.rows.map((r) => ({ ...r }));
  const updates: Array<{ id: string; payload: Record<string, unknown> }> = [];
  let poisReadCalls = 0;

  const mock = {
    rows,
    updates,
    // v2-skrivesti (r03.6): koden gjør baseClient.schema("v2").from(...).
    schema: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === "project_pois") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: opts.projectPoisError ? null : opts.projectPois,
              error: opts.projectPoisError ?? null,
            }),
          })),
        };
      }
      if (table === "pois") {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_col: string, ids: string[]) => {
              poisReadCalls++;
              if (opts.poisReadErrorOnCall === poisReadCalls) {
                return Promise.resolve({
                  data: null,
                  error: { message: "re-read boom" },
                });
              }
              return Promise.resolve({
                data: rows.filter((r) => ids.includes(r.id)),
                error: null,
              });
            }),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            eq: vi.fn((_col: string, id: string) => {
              updates.push({ id, payload });
              const row = rows.find((r) => r.id === id);
              if (row) Object.assign(row, payload);
              return Promise.resolve({ error: null });
            }),
          })),
        };
      }
      return {};
    }),
  };
  mock.schema.mockReturnValue(mock);
  return mock;
}

function useMockSupabase(mock: ReturnType<typeof buildMockSupabase>) {
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);
}

// ── Rad-fabrikker ─────────────────────────────────────────────────────────

function googleRow(n: number, overrides: Record<string, unknown> = {}): MockRow {
  return {
    id: `google-ChIJ-${n}`,
    name: `Kafé ${n}`,
    lat: 63.43 + n * 0.001,
    lng: 10.4,
    address: null,
    category_id: "cafe",
    google_place_id: `ChIJ-${n}`,
    google_rating: 4.4,
    google_review_count: 120,
    google_website: null,
    google_business_status: null,
    google_price_level: null,
    trust_score: null,
    trust_flags: [],
    ...overrides,
  };
}

function nsrRow(): MockRow {
  return {
    id: "nsr-12345",
    name: "Ranheim skole",
    lat: 63.43,
    lng: 10.5,
    address: null,
    category_id: "skole",
    google_place_id: null,
    google_rating: null,
    google_review_count: null,
    google_website: null, // offentlig kilde — ingen website, ingen google_place_id
    google_business_status: null,
    google_price_level: null,
    trust_score: null,
    trust_flags: [],
  };
}

function supabaseFor(rows: MockRow[]) {
  return buildMockSupabase({
    projectPois: rows.map((r) => ({ poi_id: r.id })),
    rows,
  });
}

const ENRICHED_DETAILS = {
  website: "https://example.no",
  businessStatus: "OPERATIONAL",
  priceLevel: 2,
  rating: 4.4,
  reviewCount: 120,
};

function trustResultFor(pois: POI[], score = 0.8): Map<string, TrustResult> {
  return new Map(
    pois.map((p) => [
      p.id,
      { score, flags: ["website_ok"] as TrustFlag[], needsClaudeReview: false },
    ])
  );
}

// ── Tester ────────────────────────────────────────────────────────────────

describe("validateReportTrust — Unit 3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");

    fetchPlaceDetailsMock.mockResolvedValue(ENRICHED_DETAILS);
    batchValidateTrustMock.mockImplementation(async (pois) => trustResultFor(pois));
    updatePOITrustScoreMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("happy path: 10 Google-POIer uten score → enrichment + scoring, alle persisteres", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => googleRow(i + 1));
    const mock = supabaseFor(rows);
    useMockSupabase(mock);

    const result = await validateReportTrust({ projectId: "p1" });

    // Enrichment: alle 10 mangler google_website → Place Details med trust-felter
    expect(fetchPlaceDetailsMock).toHaveBeenCalledTimes(10);
    expect(fetchPlaceDetailsMock).toHaveBeenCalledWith(
      "ChIJ-1",
      "test-key",
      TRUST_ENRICHMENT_FIELDS
    );
    expect(mock.updates).toHaveLength(10);
    expect(mock.updates[0].payload).toMatchObject({
      google_website: "https://example.no",
      google_business_status: "OPERATIONAL",
    });

    // Scoring ser de enrichede signalene (re-lest fra DB)
    expect(batchValidateTrustMock).toHaveBeenCalledTimes(1);
    const scoredPois = batchValidateTrustMock.mock.calls[0][0];
    expect(scoredPois).toHaveLength(10);
    expect(scoredPois.every((p) => p.googleWebsite === "https://example.no")).toBe(true);

    // Alle persisteres
    expect(updatePOITrustScoreMock).toHaveBeenCalledTimes(10);
    expect(result.scored).toBe(10);
    expect(result.skipped).toBe(0);
    expect(result.skippedPublic).toBe(0);
    expect(result.stillNull).toEqual([]);

    // AC8: v2-skrivesti — reads via schema("v2") + scoring-write med schema:"v2"
    expect(mock.schema).toHaveBeenCalledWith("v2");
    expect(updatePOITrustScoreMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number),
      expect.any(Array),
      { schema: "v2" }
    );
  });

  it("NSR-skole uten website (ingen google_place_id) → skippes, IKKE scoret — masse-skjulings-regresjonen", async () => {
    const rows = [nsrRow(), googleRow(1)];
    useMockSupabase(supabaseFor(rows));

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.skippedPublic).toBe(1);
    expect(result.scored).toBe(1);
    // Skolen er IKKE i stillNull — null er bevisst («null = vis»)
    expect(result.stillNull).toEqual([]);

    // Aldri enrichet eller scoret
    expect(fetchPlaceDetailsMock).toHaveBeenCalledTimes(1); // kun Google-POI-en
    const scoredIds = batchValidateTrustMock.mock.calls[0][0].map((p) => p.id);
    expect(scoredIds).not.toContain("nsr-12345");
    expect(updatePOITrustScoreMock).not.toHaveBeenCalledWith(
      "nsr-12345",
      expect.anything(),
      expect.anything()
    );
  });

  it("manual_override → aldri re-scoret", async () => {
    const rows = [googleRow(1, { trust_flags: ["manual_override"] })];
    useMockSupabase(supabaseFor(rows));

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.skipped).toBe(1);
    expect(result.scored).toBe(0);
    expect(result.stillNull).toEqual([]);
    expect(fetchPlaceDetailsMock).not.toHaveBeenCalled();
    expect(batchValidateTrustMock).not.toHaveBeenCalled();
    expect(updatePOITrustScoreMock).not.toHaveBeenCalled();
  });

  it("allerede scoret POI → skippes (ingen force i pipelinen)", async () => {
    const rows = [googleRow(1, { trust_score: 0.72 }), googleRow(2)];
    useMockSupabase(supabaseFor(rows));

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.skipped).toBe(1);
    expect(result.scored).toBe(1);
    expect(updatePOITrustScoreMock).toHaveBeenCalledTimes(1);
    expect(updatePOITrustScoreMock).not.toHaveBeenCalledWith(
      "google-ChIJ-1",
      expect.anything(),
      expect.anything()
    );
  });

  it("enrichment-feil for én POI → forblir null, listes i stillNull, steget feiler ikke", async () => {
    const rows = [googleRow(1), googleRow(2), googleRow(3)];
    useMockSupabase(supabaseFor(rows));

    fetchPlaceDetailsMock.mockImplementation(async (placeId) => {
      if (placeId === "ChIJ-2") throw new Error("ETIMEDOUT");
      return ENRICHED_DETAILS;
    });

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.scored).toBe(2);
    expect(result.stillNull).toEqual(["Kafé 2"]);
    expect(result.warnings.some((w) => w.includes("Enrichment failed"))).toBe(true);

    // Den feilede POI-en scores IKKE med degraderte signaler (ville gitt 0.45)
    const scoredIds = batchValidateTrustMock.mock.calls[0][0].map((p) => p.id);
    expect(scoredIds).not.toContain("google-ChIJ-2");
    expect(updatePOITrustScoreMock).toHaveBeenCalledTimes(2);
  });

  it("GOOGLE_PLACES_API_KEY mangler → warning + skip enrichment, POIer havner i stillNull", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    const rows = [
      googleRow(1),
      googleRow(2),
      googleRow(3, { google_website: "https://har-signaler.no" }),
    ];
    useMockSupabase(supabaseFor(rows));

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.warnings.some((w) => w.includes("GOOGLE_PLACES_API_KEY"))).toBe(true);
    expect(fetchPlaceDetailsMock).not.toHaveBeenCalled();
    // De to uten signaler scores ikke; den med eksisterende website scores
    expect(result.stillNull.sort()).toEqual(["Kafé 1", "Kafé 2"]);
    expect(result.scored).toBe(1);
    const scoredIds = batchValidateTrustMock.mock.calls[0][0].map((p) => p.id);
    expect(scoredIds).toEqual(["google-ChIJ-3"]);
  });

  it("persistering feiler for én POI → den i stillNull, resten scores, steget feiler ikke", async () => {
    const rows = [googleRow(1), googleRow(2)];
    useMockSupabase(supabaseFor(rows));

    updatePOITrustScoreMock.mockImplementation(async (poiId) => {
      if (poiId === "google-ChIJ-1") throw new Error("DB write failed");
    });

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.scored).toBe(1);
    expect(result.stillNull).toEqual(["Kafé 1"]);
    expect(result.warnings.some((w) => w.includes("Trust-persistering feilet"))).toBe(true);
  });

  it("project_pois-feil → fail-soft: warning og nullresultat, ingen exception", async () => {
    const mock = buildMockSupabase({
      projectPois: [],
      rows: [],
      projectPoisError: { message: "connection refused" },
    });
    useMockSupabase(mock);

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.scored).toBe(0);
    expect(result.stillNull).toEqual([]);
    expect(result.warnings.some((w) => w.includes("connection refused"))).toBe(true);
  });

  it("re-lesing etter enrichment feiler → alle kandidater i stillNull, ingen exception", async () => {
    const rows = [googleRow(1), googleRow(2)];
    const mock = buildMockSupabase({
      projectPois: rows.map((r) => ({ poi_id: r.id })),
      rows,
      poisReadErrorOnCall: 2, // andre pois-SELECT = re-lesingen
    });
    useMockSupabase(mock);

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.scored).toBe(0);
    expect(result.stillNull.sort()).toEqual(["Kafé 1", "Kafé 2"]);
    expect(
      result.warnings.some((w) => w.includes("Re-lesing etter enrichment feilet"))
    ).toBe(true);
    expect(batchValidateTrustMock).not.toHaveBeenCalled();
    expect(updatePOITrustScoreMock).not.toHaveBeenCalled();
  });

  it("tomt project_pois-resultat (ingen feil) → scored 0 og warning, ingen exception", async () => {
    const mock = buildMockSupabase({ projectPois: [], rows: [] });
    useMockSupabase(mock);

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.scored).toBe(0);
    expect(result.stillNull).toEqual([]);
    expect(result.warnings.some((w) => w.includes("Ingen POI-er koblet"))).toBe(true);
    expect(fetchPlaceDetailsMock).not.toHaveBeenCalled();
    expect(batchValidateTrustMock).not.toHaveBeenCalled();
  });

  it("place not found (fetchPlaceDetails → null) → POI i stillNull, scores ikke med degraderte signaler", async () => {
    const rows = [googleRow(1), googleRow(2)];
    useMockSupabase(supabaseFor(rows));

    fetchPlaceDetailsMock.mockImplementation(async (placeId) => {
      if (placeId === "ChIJ-1") return null;
      return ENRICHED_DETAILS;
    });

    const result = await validateReportTrust({ projectId: "p1" });

    expect(result.scored).toBe(1);
    expect(result.stillNull).toEqual(["Kafé 1"]);
    expect(result.warnings.some((w) => w.includes("Place not found"))).toBe(true);

    // POI-en scores IKKE med null-signaler (ville gitt 0.45 og stille skjuling)
    const scoredIds = batchValidateTrustMock.mock.calls[0][0].map((p) => p.id);
    expect(scoredIds).not.toContain("google-ChIJ-1");
    expect(updatePOITrustScoreMock).toHaveBeenCalledTimes(1);
  });
});
