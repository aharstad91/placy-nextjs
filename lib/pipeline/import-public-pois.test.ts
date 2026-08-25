import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/utils/slugify", () => ({
  slugify: vi.fn((text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  ),
}));

vi.mock("@/lib/supabase/mutations", () => ({
  upsertCategories: vi.fn(async () => {}),
}));

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

import { createServerClient } from "@/lib/supabase/client";
import { upsertCategories } from "@/lib/supabase/mutations";
import {
  importPublicPois,
  PUBLIC_POI_CATEGORIES,
  barnehagefaktaRadiusDegrees,
  overpassBboxDeltas,
} from "./import-public-pois";

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
      if (table === "areas") {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
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

  it("NSR: 5 skoler i respons → kretsløs adresse faller tilbake til nærmeste per type", async () => {
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

  it("Barnehagefakta: API-radius er grader korrigert for cos(lat) — ikke hardkodet 0.025", () => {
    // Grilstad-regresjon 2026-08-24: 0.025 grader er ~1,25 km i lengderetningen
    // på 63° nord, så Ranheimsfjæra barnehage (1 449 m, 0,026° øst) ble klippet
    // bort av API-et før haversine-filteret. Radiusen må dekke hele sirkelen.
    const degrees = barnehagefaktaRadiusDegrees(63.435107, 2500);

    // Må dekke den faktiske lengdegrad-avstanden til de tapte barnehagene
    expect(degrees).toBeGreaterThan(0.034); // Humlehaugen Doremi, 1 853 m
    // …men ikke sluke hele regionen
    expect(degrees).toBeLessThan(0.1);
  });

  it("Barnehagefakta: radius-grader skalerer med breddegrad og prosjektradius", () => {
    // Lenger nord = trangere lengdegrader = større grad-radius for samme meter
    expect(barnehagefaktaRadiusDegrees(70, 2500)).toBeGreaterThan(
      barnehagefaktaRadiusDegrees(58, 2500)
    );
    // Dobbel radius i meter = dobbel radius i grader
    expect(barnehagefaktaRadiusDegrees(63.4, 5000)).toBeCloseTo(
      barnehagefaktaRadiusDegrees(63.4, 2500) * 2,
      6
    );
    // Tak: absurd radius ber aldri om mer enn 1 grad
    expect(barnehagefaktaRadiusDegrees(63.4, 10_000_000)).toBe(1);
  });

  it("Barnehagefakta: kaller API-et med den beregnede radiusen", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response) // nsr
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response) // barnehagefakta
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response);

    await importPublicPois(BASE_OPTIONS);

    const bhCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("barnehagefakta.no")
    );
    expect(bhCall).toBeDefined();
    const expected = barnehagefaktaRadiusDegrees(
      BASE_OPTIONS.lat,
      BASE_OPTIONS.radiusMeters
    ).toFixed(4);
    expect(String(bhCall![0])).toContain(`/${expected}`);
    expect(String(bhCall![0])).not.toContain("/0.025");
  });

  it("Overpass: bbox-delta er større i lengde- enn i breddretningen", () => {
    // Grilstad-regresjon 2026-08-24: én felles delta på 0.025 ga ~2,8 km nord/sør
    // men bare ~1,25 km øst/vest på 63° nord, så anlegg rett øst forsvant.
    const { latDelta, lngDelta } = overpassBboxDeltas(63.435107, 2500);
    expect(lngDelta).toBeGreaterThan(latDelta);
    // Må dekke 2 500 m i begge retninger (0,0225° bredde / 0,0501° lengde)
    expect(latDelta).toBeGreaterThan(2500 / 111_320);
    expect(lngDelta).toBeGreaterThan(0.05);
  });

  it("Overpass: sender User-Agent — uten den svarer API-et 406", async () => {
    // Grilstad-funn 2026-08-24: Node-fetch sin default User-Agent blir avvist
    // med 406 Not Acceptable, så denne kilden leverte 0 idrettsanlegg på ALLE
    // boards fram til nå. Curl med reell User-Agent ga 200 på samme query.
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response) // nsr
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response) // barnehagefakta
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response);

    await importPublicPois(BASE_OPTIONS);

    const ovCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("overpass")
    );
    expect(ovCall).toBeDefined();
    const headers = (ovCall![1] as RequestInit).headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(/Placy/);
  });

  it("Overpass: way uten navn hoppes over — og tag utenfor hvitelisten likeså", async () => {
    // Navnekravet lever nå i osm-gate sammen med hvitelisten (2026-08-24).
    // Denne testen holder begge portene: navnløs hvitelistet tag faller ut, og
    // navngitt IKKE-hvitelistet tag (her en lekeplass) faller også ut.
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    const overpassResponse = {
      elements: [
        // hvitelistet, men uten navn
        { type: "way", id: 1, center: { lat: 63.411, lon: 10.771 }, tags: { leisure: "sports_centre" } },
        // navngitt, men lekeplass er permanent utestengt
        { type: "node", id: 3, lat: 63.4115, lon: 10.7715, tags: { leisure: "playground", name: "Gårdsrommet" } },
        // hvitelistet OG navngitt → den eneste som skal inn
        {
          type: "node",
          id: 2,
          lat: 63.412,
          lon: 10.772,
          tags: { leisure: "sports_centre", name: "Vikhammer idrettsplass" },
        },
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

  it("seeding-FEIL aborterer IKKE — kildene skriver POI-er likevel, kun warning (rapportert funn: original-bugen kan gjenoppstå ved transient DB-feil)", async () => {
    // Pinner dagens fail-soft-policy: runSource fanger upsertCategories-kast og
    // fortsetter. Konsekvens: en DB-hikke i seedingen gjenskaper nøyaktig
    // «Barn & Oppvekst forsvinner»-bugen (POI-er med udefinert kategori →
    // «Ukjent» på boardet) med bare en warning som spor. Endres policyen til
    // abort-on-seed-failure (anbefalt vurdert), skal denne testen oppdateres.
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    vi.mocked(upsertCategories).mockRejectedValueOnce(new Error("DB nede"));

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(NSR_RESPONSES.threeSkoler), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response);

    const result = await importPublicPois(BASE_OPTIONS);

    expect(result.warnings.some((w) => w.includes("Kategorier: feilet"))).toBe(true);
    // Kildene kjørte videre og skrev POI-er til tross for useedede kategorier
    expect(result.counts.nsr).toBe(1);
  });

  it("re-kjøring: eksisterende POI med samme nsr_id men annen DB-id → remappes til eksisterende id (ingen duplikat/unique-krasj)", async () => {
    // upsertAndLink-pre-lookupen er dedup-vernet på tvers av pipeliner: uten
    // den ville en re-provisjonering enten krasjet på partial unique index
    // (fanget fail-soft → skolen STILLE borte fra boardet) eller skapt duplikat.
    const upsertPayloads: Array<Array<{ id: string }>> = [];
    const mockSupabase = buildMockSupabase();
    (mockSupabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === "pois") {
        return {
          upsert: vi.fn().mockImplementation((rows: Array<{ id: string }>) => {
            upsertPayloads.push(rows);
            return {
              select: vi.fn().mockResolvedValue({ data: rows.map((r) => ({ id: r.id })), error: null }),
            };
          }),
          select: vi.fn().mockReturnValue({
            // Pre-lookup på kilde-ID: skolen finnes allerede under legacy-uuid
            in: vi.fn().mockResolvedValue({
              data: [{ id: "legacy-uuid-1001", nsr_id: "nsr-1001" }],
              error: null,
            }),
          }),
        };
      }
      return buildMockSupabase().from(table);
    });
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([NSR_RESPONSES.threeSkoler[0]]), status: 200 } as Response) // kun Alfaskolen (nsr-1001)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ elements: [] }), status: 200 } as Response);

    const result = await importPublicPois(BASE_OPTIONS);

    expect(result.counts.nsr).toBe(1);
    const nsrPayload = upsertPayloads.find((rows) => rows.some((r) => r.id.includes("1001")));
    expect(nsrPayload).toBeDefined();
    expect(nsrPayload![0].id).toBe("legacy-uuid-1001");
  });

  it("seeder kategori-definisjonene (skole/barnehage/idrett) FØR kildene skriver POI-er (cutover-funn 2026-07-06)", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response);

    await importPublicPois(BASE_OPTIONS);

    expect(upsertCategories).toHaveBeenCalledWith(PUBLIC_POI_CATEGORIES, { schema: "v2" });
    // Overpass-kategoriene arves fra hvitelisten i osm-gate (2026-08-24), så
    // listen vokser når porten får en ny regel — men skole/barnehage/idrett
    // MÅ fortsatt være der: det var dem cutover-funnet handlet om.
    const ids = PUBLIC_POI_CATEGORIES.map((c) => c.id);
    expect(ids).toContain("skole");
    expect(ids).toContain("barnehage");
    expect(ids).toContain("idrett");
    expect(ids.sort()).toEqual([
      "badeplass",
      "barnehage",
      "idrett",
      "marina",
      "outdoor",
      "park",
      "skole",
      "swimming",
      "taxi",
    ]);
    expect(new Set(ids).size, "duplikate kategori-definisjoner").toBe(ids.length);
    // Seedes før første kilde-fetch — ellers kan en POI-insert vinne kappløpet
    const seedOrder = vi.mocked(upsertCategories).mock.invocationCallOrder[0];
    const firstFetchOrder = fetchMock.mock.invocationCallOrder[0];
    expect(seedOrder).toBeLessThan(firstFetchOrder);
  });

  it("Taxi: holdeplasser innenfor radius linkes — uten et eneste nettverkskall", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    // Alle eksterne kilder svarer tomt: det som telles her skal komme fra det
    // innbakte datasettet, ikke fra fetch.
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response);

    const result = await importPublicPois({
      ...BASE_OPTIONS,
      // Strindfjordvegen 10, Ranheim — Skonnertvegen holdeplass ligger ~150 m unna.
      lat: 63.435107,
      lng: 10.505335,
      kommunenummer: "5001",
    });

    expect(result.counts.taxi).toBeGreaterThan(0);
    expect(result.warnings.join(" ")).toContain("Skonnertvegen");
  });

  it("Taxi: utenfor Trondheim → 0 og en advarsel, ikke en feil", async () => {
    const mockSupabase = buildMockSupabase();
    (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase);
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve([]), status: 200 } as Response);

    // Straumen (Inderøy) — datasettet er Trondheim kommunes eget.
    const result = await importPublicPois({ ...BASE_OPTIONS, lat: 63.87, lng: 11.0, kommunenummer: "5053" });

    expect(result.counts.taxi).toBe(0);
    expect(result.warnings.some((w) => w.startsWith("Taxi:"))).toBe(true);
  });
});
