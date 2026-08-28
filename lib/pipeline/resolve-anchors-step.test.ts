import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@/lib/supabase/client";
import { resolveProjectAnchors, buildAnchorSummary } from "./resolve-anchors-step";
import fixture from "@/lib/board/__fixtures__/anchor-membership.fixture.json";

const SIRKUS = "google-ChIJVZdRQJoxbUYRTcToJ4smjeM";
const LADE_ARENA = fixture.malls.find((m) => m.name === "Lade Arena")!.id;

// ── Mock-Supabase (buildMockSupabase-mønsteret fra validate-report-trust) ──

interface MockRow {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  category_id: string | null;
  contained_in_ids?: string[] | null;
  parent_poi_id?: string | null;
  anchor_summary?: string | null;
  entur_stopplace_id?: string | null;
  bysykkel_station_id?: string | null;
  poi_metadata?: Record<string, unknown> | null;
}

function buildMockSupabase(opts: {
  rows: MockRow[];
  categories?: Array<{ id: string; name: string }>;
  projectPoisError?: { message: string } | null;
  poiUpdateError?: { message: string } | null;
}) {
  const rows = opts.rows.map((r) => ({
    contained_in_ids: null,
    parent_poi_id: null,
    entur_stopplace_id: null,
    bysykkel_station_id: null,
    poi_metadata: null,
    ...r,
  }));
  const updates: Array<{ ids: string[]; payload: Record<string, unknown> }> = [];

  const applyUpdate = (ids: string[], payload: Record<string, unknown>) => {
    if (opts.poiUpdateError) return { error: opts.poiUpdateError };
    updates.push({ ids, payload });
    for (const row of rows) {
      if (ids.includes(row.id)) Object.assign(row, payload);
    }
    return { error: null };
  };

  const mock = {
    rows,
    updates,
    schema: vi.fn(),
    from: vi.fn((table: string) => {
      if (table === "project_pois") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: opts.projectPoisError ? null : rows.map((r) => ({ poi_id: r.id })),
              error: opts.projectPoisError ?? null,
            }),
          })),
        };
      }
      if (table === "categories") {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_c: string, ids: string[]) =>
              Promise.resolve({
                data: (opts.categories ?? []).filter((c) => ids.includes(c.id)),
                error: null,
              })
            ),
          })),
        };
      }
      if (table === "pois") {
        return {
          select: vi.fn(() => ({
            in: vi.fn((_c: string, ids: string[]) =>
              Promise.resolve({
                data: rows.filter((r) => ids.includes(r.id)).map((r) => ({ ...r })),
                error: null,
              })
            ),
          })),
          update: vi.fn((payload: Record<string, unknown>) => ({
            in: vi.fn((_c: string, ids: string[]) =>
              Promise.resolve(applyUpdate(ids, payload))
            ),
            eq: vi.fn((_c: string, id: string) =>
              Promise.resolve(applyUpdate([id], payload))
            ),
          })),
        };
      }
      return {};
    }),
  };
  mock.schema.mockReturnValue(mock);
  return mock;
}

function useMock(mock: ReturnType<typeof buildMockSupabase>) {
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue(mock);
}

/** De 533 ekte POI-ene på Strindfjordvegen 10, på databaseradens form. */
function boardRows(extra: MockRow[] = []): MockRow[] {
  const rows: MockRow[] = fixture.board.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    category_id: p.categoryId,
  }));
  return [...rows, ...extra];
}

const CATEGORIES = [
  { id: "butikk", name: "Butikk" },
  { id: "supermarket", name: "Dagligvare" },
  { id: "cafe", name: "Kafé" },
  { id: "restaurant", name: "Restaurant" },
  { id: "pharmacy", name: "Apotek" },
  { id: "haircare", name: "Frisør" },
  { id: "bank", name: "Bank" },
  { id: "liquor_store", name: "Vinmonopol" },
  { id: "bakery", name: "Bakeri" },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildAnchorSummary", () => {
  it("skriver samme form som 057/058 skrev for hånd", () => {
    expect(
      buildAnchorSummary([
        "Dagligvare", "Dagligvare", "Dagligvare",
        "Apotek", "Apotek",
        "Frisør",
        "Vinmonopol",
      ])
    ).toBe("Dagligvare, apotek, frisør og vinmonopol");
  });

  it("bryter uavgjort alfabetisk, ikke på rekkefølgen den fikk dem i", () => {
    // Alle med ett medlem hver: rekkefølgen må ikke avhenge av radrekkefølgen
    // i basen, ellers endrer setningen seg av seg selv mellom kjøringer.
    expect(buildAnchorSummary(["Dagligvare", "Apotek", "Frisør"])).toBe(
      "Apotek, dagligvare og frisør"
    );
  });

  it("sier «og mer» når det er flere kategorier enn den nevner", () => {
    const s = buildAnchorSummary([
      "Butikk", "Butikk", "Butikk",
      "Kafé", "Kafé",
      "Restaurant",
      "Apotek",
      "Frisør",
      "Bakeri",
    ]);
    expect(s).toBe("Butikk, kafé, apotek, bakeri, frisør og mer");
  });

  it("sorterer på antall, ikke på rekkefølgen den fikk dem i", () => {
    const a = buildAnchorSummary(["Kafé", "Butikk", "Butikk"]);
    const b = buildAnchorSummary(["Butikk", "Kafé", "Butikk"]);
    expect(a).toBe(b);
    expect(a).toBe("Butikk og kafé");
  });

  it("tåler én kategori og ingen", () => {
    expect(buildAnchorSummary(["Butikk"])).toBe("Butikk");
    expect(buildAnchorSummary([])).toBe("");
  });
});

describe("resolveProjectAnchors — Strindfjordvegen 10 (ekte pool)", () => {
  it("finner de fem sentrene og lenker medlemmene deres", async () => {
    const mock = buildMockSupabase({ rows: boardRows(), categories: CATEGORIES });
    useMock(mock);

    const result = await resolveProjectAnchors({ projectId: "p1" });

    expect(result.warnings).toEqual([]);
    // FIRE, ikke fem. City Lade (Haakon VIIs gt. 9) er et `shopping_mall` hos
    // Google midt mellom Lade Arena og Hangaren, men det ligger ikke i denne
    // poolen — discoveryen importerte det aldri. Steget kan bare forankre
    // sentre som faktisk finnes i basen; å hente dem uavhengig av
    // prosjektsirkelen er Unit 3.
    const names = result.anchors.map((a) => a.name).sort();
    expect(names).toEqual([
      "Grilstad mall",
      "Hangaren Lade",
      "Lade Arena",
      "Sirkus Shopping",
    ]);

    const sirkus = result.anchors.find((a) => a.id === SIRKUS)!;
    expect(sirkus.memberCount).toBeGreaterThanOrEqual(50);
    expect(sirkus.summary).toMatch(/^Butikk/);

    // Summen av medlemmer = radene som faktisk fikk parent_poi_id i basen.
    const totalMembers = result.anchors.reduce((n, a) => n + a.memberCount, 0);
    const linked = mock.rows.filter((r) => r.parent_poi_id !== null);
    expect(linked.length).toBe(totalMembers);
    expect(result.membersLinked).toBe(totalMembers);
  });

  it("skriver anchor_summary og angre-taggen på ankeret, ikke på medlemmene", async () => {
    const mock = buildMockSupabase({ rows: boardRows(), categories: CATEGORIES });
    useMock(mock);
    await resolveProjectAnchors({ projectId: "p1" });

    const sirkus = mock.rows.find((r) => r.id === SIRKUS)!;
    expect(sirkus.anchor_summary).toBeTruthy();
    expect(sirkus.poi_metadata).toMatchObject({
      anchor_resolution: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(sirkus.parent_poi_id).toBeNull();

    const medlem = mock.rows.find((r) => r.parent_poi_id === SIRKUS)!;
    expect(medlem.anchor_summary).toBeUndefined();
    expect(medlem.poi_metadata).toBeNull();
  });

  it("rapporterer kandidater som falt på realitets-gaten", async () => {
    const mock = buildMockSupabase({ rows: boardRows(), categories: CATEGORIES });
    useMock(mock);
    const result = await resolveProjectAnchors({ projectId: "p1" });
    // `category_id = shopping` er forurenset i prod; disse to samler medlemmer
    // uten å nå terskelen, og skal være synlige i loggen.
    const names = result.rejected.map((r) => r.name);
    expect(names).toContain("Falkenborgvegen 3");
    for (const r of result.rejected) expect(r.memberCount).toBeLessThan(4);
  });

  it("er idempotent — andre kjøring skriver ingenting", async () => {
    const rows = boardRows();
    const mock = buildMockSupabase({ rows, categories: CATEGORIES });
    useMock(mock);
    const first = await resolveProjectAnchors({ projectId: "p1" });

    // Andre kjøring mot databasen slik den ble etter den første.
    const mock2 = buildMockSupabase({ rows: mock.rows, categories: CATEGORIES });
    useMock(mock2);
    const second = await resolveProjectAnchors({ projectId: "p1" });

    expect(second.membersLinked).toBe(0);
    expect(second.membersUnlinked).toBe(0);
    expect(second.anchors.map((a) => a.memberCount)).toEqual(
      first.anchors.map((a) => a.memberCount)
    );
  });
});

describe("resolveProjectAnchors — tørrkjøring", () => {
  /**
   * En tørrkjøring som lyver er verre enn ingen tørrkjøring: den er
   * beslutningsgrunnlaget for en irreversibel backfill mot prod. Disse to
   * testene binder de to halvdelene — ingen rad røres, og tallene er de samme
   * som en ekte kjøring ville gitt.
   */
  it("skriver INGENTING", async () => {
    const mock = buildMockSupabase({ rows: boardRows(), categories: CATEGORIES });
    useMock(mock);

    const result = await resolveProjectAnchors({ projectId: "p1", dryRun: true });

    expect(result.anchors.length).toBeGreaterThan(0);
    expect(mock.updates).toEqual([]);
    expect(mock.rows.every((r) => r.parent_poi_id === null)).toBe(true);
    expect(mock.rows.every((r) => !r.anchor_summary)).toBe(true);
  });

  it("gir NØYAKTIG samme rapport som en ekte kjøring", async () => {
    const dryMock = buildMockSupabase({ rows: boardRows(), categories: CATEGORIES });
    useMock(dryMock);
    const dry = await resolveProjectAnchors({ projectId: "p1", dryRun: true });

    const wetMock = buildMockSupabase({ rows: boardRows(), categories: CATEGORIES });
    useMock(wetMock);
    const wet = await resolveProjectAnchors({ projectId: "p1" });

    expect(dry.anchors).toEqual(wet.anchors);
    expect(dry.membersLinked).toBe(wet.membersLinked);
    expect(dry.membersUnlinked).toBe(wet.membersUnlinked);
    expect(dry.rejected).toEqual(wet.rejected);
    expect(dry.transportExcluded).toBe(wet.transportExcluded);
    expect(dry.warnings).toEqual(wet.warnings);
  });

  it("teller lenker som VILLE blitt ryddet uten å rydde dem", async () => {
    // En POI som peker på et anker vi vurderer, men som ikke lenger er medlem.
    const rows = boardRows().map((r) =>
      r.id === "utenfor-1" ? { ...r, parent_poi_id: SIRKUS } : r,
    );
    const withStale = [
      ...rows,
      {
        id: "utdatert-medlem",
        name: "Flyttet butikk",
        address: "Et helt annet sted 99, Trondheim",
        lat: 63.5,
        lng: 10.9,
        category_id: "butikk",
        parent_poi_id: SIRKUS,
      },
    ];
    const mock = buildMockSupabase({ rows: withStale, categories: CATEGORIES });
    useMock(mock);

    const result = await resolveProjectAnchors({ projectId: "p1", dryRun: true });

    expect(result.membersUnlinked).toBeGreaterThan(0);
    expect(mock.rows.find((r) => r.id === "utdatert-medlem")!.parent_poi_id).toBe(SIRKUS);
  });
});

describe("resolveProjectAnchors — hva som IKKE blir medlem", () => {
  it("holder holdeplasser og bysykkel utenfor selv når de står i inngangen", async () => {
    const sirkus = fixture.malls.find((m) => m.id === SIRKUS)!;
    const mock = buildMockSupabase({
      rows: boardRows([
        {
          id: "entur-NSR-StopPlace-1",
          name: "Sirkus Shopping holdeplass",
          address: "Falkenborgvegen 1, Trondheim",
          lat: sirkus.lat,
          lng: sirkus.lng,
          category_id: "transport",
          entur_stopplace_id: "NSR:StopPlace:1",
        },
        {
          id: "bysykkel-99",
          name: "Sirkus bysykkel",
          address: "Falkenborgvegen 1, Trondheim",
          lat: sirkus.lat,
          lng: sirkus.lng,
          category_id: "bysykkel",
          bysykkel_station_id: "99",
        },
      ]),
      categories: CATEGORIES,
    });
    useMock(mock);

    const result = await resolveProjectAnchors({ projectId: "p1" });
    expect(result.transportExcluded).toBe(2);
    expect(mock.rows.find((r) => r.id === "entur-NSR-StopPlace-1")!.parent_poi_id).toBeNull();
    expect(mock.rows.find((r) => r.id === "bysykkel-99")!.parent_poi_id).toBeNull();
  });

  it("gjør ingenting når det ikke finnes et kjøpesenter i radiusen", async () => {
    const rows = boardRows().filter((r) => r.category_id !== "shopping");
    const mock = buildMockSupabase({ rows, categories: CATEGORIES });
    useMock(mock);

    const result = await resolveProjectAnchors({ projectId: "p1" });
    expect(result.anchors).toEqual([]);
    expect(mock.updates).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe("resolveProjectAnchors — den delte poolen", () => {
  it("rører ikke en lenke til et anker dette prosjektet ikke så", async () => {
    // POI-en peker på et senter utenfor prosjektets radius. Vi har ikke
    // grunnlag for å dømme den, og skal la den stå.
    const rows = boardRows();
    const fremmed = rows.find((r) => r.category_id === "cafe")!;
    fremmed.parent_poi_id = "google-ET-SENTER-LANGT-UNNA";

    const mock = buildMockSupabase({ rows, categories: CATEGORIES });
    useMock(mock);
    const result = await resolveProjectAnchors({ projectId: "p1" });

    expect(mock.rows.find((r) => r.id === fremmed.id)!.parent_poi_id).toBe(
      "google-ET-SENTER-LANGT-UNNA"
    );
    expect(result.membersUnlinked).toBe(0);
  });

  it("river en lenke til et anker vi VURDERTE og som ikke lenger holder", async () => {
    // Et sted 3 km fra alle sentrene, som feilaktig peker på Lade Arena —
    // slik en tidligere kjøring med løsere terskler kunne ha satt det.
    const mock = buildMockSupabase({
      rows: boardRows([
        {
          id: "google-FEILLENKET",
          name: "Kafé langt unna",
          address: "Ingen senter-veg 1, Trondheim",
          lat: 63.47,
          lng: 10.52,
          category_id: "cafe",
          parent_poi_id: LADE_ARENA,
        },
      ]),
      categories: CATEGORIES,
    });
    useMock(mock);
    const result = await resolveProjectAnchors({ projectId: "p1" });

    expect(mock.rows.find((r) => r.id === "google-FEILLENKET")!.parent_poi_id).toBeNull();
    expect(result.membersUnlinked).toBe(1);
  });

  it("river IKKE lenkene til et senter dette boardet avviser, men som er anker et annet sted", async () => {
    // Olavskvartalet-tilfellet, målt i backfillen 2026-08-28: senteret oppløses
    // til fire medlemmer fra Ferjemannsveien og to fra Teknostallen 2 km unna,
    // fordi ≥4 måles mot DETTE boardets POI-utvalg. Rev vi på avvisning, ville
    // rekkefølgen på prosjektene avgjort hvor stort ankeret ble.
    const rows = boardRows([
      {
        id: "google-NABOSENTER",
        name: "Nabosenteret",
        address: "Nabovegen 1, Trondheim",
        lat: 63.47,
        lng: 10.52,
        category_id: "shopping",
        anchor_summary: "Butikk, apotek og frisør",
      },
      {
        id: "google-NABOBUTIKK",
        name: "Butikk i Nabosenteret",
        address: "Nabovegen 1, Trondheim",
        lat: 63.4701,
        lng: 10.5201,
        category_id: "butikk",
        parent_poi_id: "google-NABOSENTER",
      },
    ]);

    const mock = buildMockSupabase({ rows, categories: CATEGORIES });
    useMock(mock);
    const result = await resolveProjectAnchors({ projectId: "p1" });

    // Ett medlem er under terskelen — senteret avvises på dette boardet.
    expect(result.anchors.map((a) => a.id)).not.toContain("google-NABOSENTER");
    expect(mock.rows.find((r) => r.id === "google-NABOBUTIKK")!.parent_poi_id).toBe(
      "google-NABOSENTER"
    );
    expect(mock.rows.find((r) => r.id === "google-NABOSENTER")!.anchor_summary).toBe(
      "Butikk, apotek og frisør"
    );
  });

  it("river lenken når bygget ikke er anker noe sted", async () => {
    // Valentinlyst-tilfellet: 057/058 satte lenkene for hånd, migrasjon 074
    // mistet `anchor_summary`, og oppløsningen finner ikke fire medlemmer.
    // Lenken peker da på et senter som ikke finnes som destinasjon.
    const rows = boardRows([
      {
        id: "google-DØDT-SENTER",
        name: "Dødt senter",
        address: "Tomvegen 1, Trondheim",
        lat: 63.47,
        lng: 10.52,
        category_id: "shopping",
        anchor_summary: null,
      },
      {
        id: "google-FORELDRELØS",
        name: "Butikk uten anker",
        address: "Tomvegen 1, Trondheim",
        lat: 63.4701,
        lng: 10.5201,
        category_id: "butikk",
        parent_poi_id: "google-DØDT-SENTER",
      },
    ]);

    const mock = buildMockSupabase({ rows, categories: CATEGORIES });
    useMock(mock);
    const result = await resolveProjectAnchors({ projectId: "p1" });

    expect(mock.rows.find((r) => r.id === "google-FORELDRELØS")!.parent_poi_id).toBeNull();
    expect(result.membersUnlinked).toBe(1);
  });

  it("lar Googles containment nå lenger enn adresse og nærhet", async () => {
    const sirkus = fixture.malls.find((m) => m.id === SIRKUS)!;
    // 200 m nord for Sirkus: for langt for nærhets-gaten (60 m), og adressen
    // matcher ingen. Uten containment ville stedet ikke fått noe anker.
    const utenfor = { lat: sirkus.lat + 200 / 111320, lng: sirkus.lng };

    const utenContainment = buildMockSupabase({
      rows: boardRows([
        {
          id: "google-CONTAINMENT-TEST",
          name: "Butikk i senteret",
          address: "Ingen senter-veg 1, Trondheim",
          ...utenfor,
          category_id: "butikk",
        },
      ]),
      categories: CATEGORIES,
    });
    useMock(utenContainment);
    await resolveProjectAnchors({ projectId: "p1" });
    expect(
      utenContainment.rows.find((r) => r.id === "google-CONTAINMENT-TEST")!.parent_poi_id
    ).toBeNull();

    const medContainment = buildMockSupabase({
      rows: boardRows([
        {
          id: "google-CONTAINMENT-TEST",
          name: "Butikk i senteret",
          address: "Ingen senter-veg 1, Trondheim",
          ...utenfor,
          category_id: "butikk",
          contained_in_ids: [SIRKUS],
        },
      ]),
      categories: CATEGORIES,
    });
    useMock(medContainment);
    await resolveProjectAnchors({ projectId: "p1" });
    expect(
      medContainment.rows.find((r) => r.id === "google-CONTAINMENT-TEST")!.parent_poi_id
    ).toBe(SIRKUS);
  });
});

describe("resolveProjectAnchors — fail-soft", () => {
  it("aborterer aldri når project_pois feiler", async () => {
    useMock(
      buildMockSupabase({ rows: boardRows(), projectPoisError: { message: "DB nede" } })
    );
    const result = await resolveProjectAnchors({ projectId: "p1" });
    expect(result.anchors).toEqual([]);
    expect(result.warnings[0]).toContain("DB nede");
  });

  it("samler skrivefeil som warnings i stedet for å kaste", async () => {
    useMock(
      buildMockSupabase({
        rows: boardRows(),
        categories: CATEGORIES,
        poiUpdateError: { message: "skriv feilet" },
      })
    );
    const result = await resolveProjectAnchors({ projectId: "p1" });
    expect(result.membersLinked).toBe(0);
    expect(result.warnings.some((w) => w.includes("skriv feilet"))).toBe(true);
  });

  it("fanger fail-fast-kastet fra createServerClient", async () => {
    // createServerClient kaster når service-role-config mangler. Steget er
    // fail-soft og skal si fra, ikke rive med seg provisjoneringen.
    (createServerClient as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY må være satt");
    });
    const result = await resolveProjectAnchors({ projectId: "p1" });
    expect(result.warnings[0]).toContain("Supabase ikke konfigurert");
    expect(result.anchors).toEqual([]);
  });
});
