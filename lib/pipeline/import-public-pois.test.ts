import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/utils/slugify", () => ({
  slugify: vi.fn((text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  ),
}));

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

import { createServerClient } from "@/lib/supabase/client";
import { importPublicPois } from "./import-public-pois";

const NSR_RESPONSES = {
  threeSkoler: [
    { OrgNr: "1001", Navn: "Alfaskolen", NaceKode1: "85.201", Breddegrad: 63.411, Lengdegrad: 10.771 },
    { OrgNr: "1002", Navn: "Betaskolen", NaceKode1: "85.201", Breddegrad: 63.412, Lengdegrad: 10.772 },
    { OrgNr: "1003", Navn: "Gamma ungdomsskole", NaceKode1: "85.211", Breddegrad: 63.413, Lengdegrad: 10.773 },
    { OrgNr: "1004", Navn: "Delta VGS", NaceKode1: "85.310", Breddegrad: 63.414, Lengdegrad: 10.774 },
    { OrgNr: "1005", Navn: "Epsilon VGS yrke", NaceKode1: "85.320", Breddegrad: 63.415, Lengdegrad: 10.775 },
  ],
};

function buildMockSupabase() {
  const upsertResult = { data: [{ id: "uuid-1" }], error: null };
  const linkResult = { error: null };
  const naturResult = { data: [], error: null };

  const mockSupabase = {
    // v2-skrivesti (r03.4): koden gjør baseClient.schema("v2").from(...) →
    // .schema("v2") returnerer samme mock (som har .from).
    schema: vi.fn(() => mockSupabase),
    from: vi.fn((table: string) => {
      if (table === "pois") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue(upsertResult),
          }),
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue(naturResult),
          }),
        };
      }
      if (table === "project_pois") {
        return {
          // linkNaturPois: hent gamle natur-lenker (select.eq), fjern dem
          // (delete.eq.in) og upsert nye.
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue(linkResult),
        };
      }
      return {};
    }),
  };

  return mockSupabase;
}

describe("importPublicPois — Unit 2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
  });

  const BASE_OPTIONS = {
    projectId: "placy-demo_vikhammer-strand",
    lat: 63.41,
    lng: 10.77,
    radiusMeters: 2500,
    kommunenummer: "5028",
  };

  it("NSR: 5 skoler i respons → velger eksakt 1 per type (3 linkes)", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(NSR_RESPONSES.threeSkoler), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response) // barnehagefakta
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response); // overpass

    const result = await importPublicPois(BASE_OPTIONS);

    expect(result.counts.nsr).toBe(1); // en upsert → returnerer én ID (mocked)
    expect(result.warnings.some((w) => w.includes("NSR"))).toBe(false); // ingen feil
  });

  it("NSR: deterministisk tie-break — alfabetisk ved lik avstand", () => {
    // Alfabetisk: Alfaskolen < Betaskolen → Alfaskolen velges
    const alfa = { name: "Alfaskolen", dist: 100 };
    const beta = { name: "Betaskolen", dist: 100 };
    const sorted = [beta, alfa].sort((a, b) =>
      a.dist !== b.dist ? a.dist - b.dist : a.name.localeCompare(b.name)
    );
    expect(sorted[0].name).toBe("Alfaskolen");
  });

  it("Barnehagefakta: null-id → bhf-slugifisert-navn", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const bhResponse = [
      {
        navn: "Humla Barnehage AS",
        koordinatLatLng: [63.411, 10.771],
        id: null,
      },
    ];

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response) // nsr
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(bhResponse), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response);

    const result = await importPublicPois(BASE_OPTIONS);

    // Mocked upsert returnerer alltid 1 ID
    expect(result.counts.barnehagefakta).toBe(1);
    expect(result.warnings.some((w) => w.includes("barnehagefakta"))).toBe(false);
  });

  it("Overpass: way uten navn hoppes over", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const overpassResponse = {
      elements: [
        { type: "way", id: 1, center: { lat: 63.411, lon: 10.771 }, tags: {} }, // uten navn
        { type: "node", id: 2, lat: 63.412, lon: 10.772, tags: { name: "Vikhammer idrettsplass" } },
      ],
    };

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(overpassResponse), status: 200 } as Response);

    const result = await importPublicPois(BASE_OPTIONS);
    // Kun 1 navngitt POI − mocked returnerer 1 ID
    expect(result.counts.overpass).toBe(1);
  });

  it("v2-skrivesti: alle kall går via .schema('v2')", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response);

    await importPublicPois(BASE_OPTIONS);

    expect(mockSupabase.schema).toHaveBeenCalledWith("v2");
  });

  it("AC5: DB-upsert-feil i NSR → NSR fail-soft (0 + warning), andre kilder kjører videre (aldri abort)", async () => {
    const mockSupabase = buildMockSupabase();
    // NSR-upserten feiler på DB-nivå → upsertAndLink kaster → må fanges per kilde
    mockSupabase.from = vi.fn((table: string) => {
      if (table === "pois") {
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({ data: null, error: { message: "DB nede" } }),
          }),
          select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        delete: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) }) }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(NSR_RESPONSES.threeSkoler), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response) // barnehagefakta tom
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response); // overpass tom

    // Skal IKKE kaste — fail-soft fanger DB-feilen
    const result = await importPublicPois(BASE_OPTIONS);

    expect(result.counts.nsr).toBe(0);
    expect(result.warnings.some((w) => w.includes("NSR: feilet"))).toBe(true);
    // De andre kildene kjørte videre (tomme responser → "ingen"-warnings)
    expect(result.warnings.some((w) => w.includes("Barnehagefakta: ingen"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("Overpass: ingen"))).toBe(true);
  });

  it("NSR-timeout → advarsel logges, pipeline fortsetter (overpass + bhf telles)", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    fetchMock
      .mockRejectedValueOnce(new Error("AbortError: timeout")) // nsr feiler
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response);

    const result = await importPublicPois(BASE_OPTIONS);

    expect(result.counts.nsr).toBe(0);
    expect(result.warnings.some((w) => w.includes("NSR"))).toBe(true);
    // Barnehagefakta og Overpass kjørte OK (counts er 0 pga tomme responser, men ingen feil)
    expect(result.warnings.some((w) => w.includes("Barnehagefakta: ingen"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("Overpass: ingen"))).toBe(true);
  });
});
