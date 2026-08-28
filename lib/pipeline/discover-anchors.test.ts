import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/pipeline/poi-discovery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pipeline/poi-discovery")>()),
  discoverAnchorCandidates: vi.fn(),
  probeAnchorMembers: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/pipeline/import-pois", () => ({
  persistDiscoveredPOIs: vi.fn(async () => ({
    total: 0,
    new: 0,
    updated: 0,
    byCategory: {},
  })),
}));

import {
  discoverAnchorCandidates,
  probeAnchorMembers,
  type AnchorHit,
  type DiscoveredPOI,
} from "@/lib/pipeline/poi-discovery";
import { persistDiscoveredPOIs } from "@/lib/pipeline/import-pois";
import { createServerClient } from "@/lib/supabase/client";
import {
  selectAnchorImports,
  discoverAnchorsForProject,
  ANCHOR_MIN_COUNT,
} from "./discover-anchors";

/**
 * Alle avstandene under er MÅLT mot Places API 2026-08-27, ett kall per board
 * med `rankPreference: DISTANCE` og 20 km radius. De er ikke oppdiktede tall
 * valgt for å få regelen til å se pen ut — de er hva Google faktisk svarer for
 * de fem provisjonerte boardene, og de er grunnen til at regelen er «alle
 * innenfor sirkelen + de tre nærmeste» og ikke en større radius.
 */
const PROJECT_RADIUS_M = 3000;

/** [navn, km, harRating] — harRating er `true` når ikke oppgitt. */
function hits(pairs: Array<[string, number] | [string, number, boolean]>): AnchorHit[] {
  return pairs.map(([name, km, rated]) => ({
    poi: {
      id: `google-${name.toLowerCase().replace(/\s+/g, "-")}`,
      googlePlaceId: `ChIJ-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name,
      coordinates: { lat: 63.4, lng: 10.4 },
      category: { id: "shopping", name: "Kjøpesenter", icon: "ShoppingBag", color: "#8b5cf6" },
      source: "google",
    } as DiscoveredPOI,
    distanceMeters: km * 1000,
    hasQualitySignals: rated ?? true,
  }));
}

/** Sundsøya, Inderøy — null kjøpesenter innenfor sirkelen. */
const SUNDSOYA = hits([
  ["Thon Senter Verdal", 12.14],
  ["Alti Verdal", 12.38],
  ["Alti Magneten Mall", 14.78],
  ["Thon Senter Steinkjer", 18.7],
  ["Dampsaga Senter", 19.34],
]);

/** Strindfjordvegen 10, Ranheim — seks innenfor, City Lade ti meter utenfor. */
const STRINDFJORDVEGEN = hits([
  ["Grilstad mall", 0.17],
  ["Parkering ikea leangen", 1.72],
  ["Hangaren Lade", 2.11],
  ["Lade Arena", 2.2],
  ["Sirkus Shopping", 2.42],
  ["Falkenborgvegen 3", 2.49],
  ["City Lade", 3.01],
  ["Coop Midt-Norge SA", 3.02],
  ["Valentinlyst Senter", 3.38],
]);

/**
 * Utsikten 6, Vikhammer — ETT innenfor sirkelen, resten seks kilometer unna.
 * Vikhammer senteret har verken rating eller anmeldelser hos Google (målt).
 */
const VIKHAMMER = hits([
  ["Vikhammer senteret", 0.47, false],
  ["Grilstad mall", 6.29],
  ["Sveberg Handelspark", 6.44],
  ["Hangaren Lade", 8.27],
]);

/** Oppdal sentrum — tre innenfor, alle innen 120 meter. */
const OPPDAL = hits([
  ["Aunasenteret", 0.07],
  ["Domus", 0.08],
  ["Coop Oppdal SA", 0.12],
]);

describe("selectAnchorImports — alle innenfor sirkelen + de tre nærmeste", () => {
  it("Sundsøya: null innenfor → de tre nærmeste, 12–15 km unna", () => {
    const picked = selectAnchorImports(SUNDSOYA, PROJECT_RADIUS_M);
    expect(picked.map((h) => h.poi.name)).toEqual([
      "Thon Senter Verdal",
      "Alti Verdal",
      "Alti Magneten Mall",
    ]);
    // Nummer fire og fem ligger 18,7 og 19,3 km unna. Det er ikke nabolaget.
    expect(picked).toHaveLength(ANCHOR_MIN_COUNT);
  });

  it("Strindfjordvegen: de seks innenfor — City Lade blir stående ute på 3 010 m", () => {
    // Regelen garanterer DEKNING, den utvider ikke sirkelen. Når tre nærmere
    // sentre allerede finnes innenfor, henter den ikke inn det fjerde som
    // ligger ti meter på feil side av grensa.
    const picked = selectAnchorImports(STRINDFJORDVEGEN, PROJECT_RADIUS_M);
    expect(picked).toHaveLength(6);
    expect(picked.map((h) => h.poi.name)).not.toContain("City Lade");
    expect(picked.every((h) => h.distanceMeters <= PROJECT_RADIUS_M)).toBe(true);
  });

  it("Vikhammer: ett innenfor → fylles opp til tre, to av dem utenfor sirkelen", () => {
    const picked = selectAnchorImports(VIKHAMMER, PROJECT_RADIUS_M);
    expect(picked.map((h) => h.poi.name)).toEqual([
      "Vikhammer senteret",
      "Grilstad mall",
      "Sveberg Handelspark",
    ]);
    expect(picked.filter((h) => h.distanceMeters > PROJECT_RADIUS_M)).toHaveLength(2);
  });

  it("Vikhammer: nærsenteret uten anmeldelser overlever fordi det ligger innenfor", () => {
    // Regresjonsvernet for den verste feilmodusen passet kan ha: dropper man
    // senteret på rating, fyller «de tre nærmeste» plassen med Hangaren Lade
    // 8,3 km unna — boardet mister nærsenteret sitt OG får tre feil i stedet.
    const picked = selectAnchorImports(VIKHAMMER, PROJECT_RADIUS_M);
    expect(picked[0].hasQualitySignals).toBe(false);
    expect(picked.map((h) => h.poi.name)).not.toContain("Hangaren Lade");
  });

  it("uten anmeldelser OG utenfor sirkelen → avvist, for der finnes ingen andre kilder", () => {
    const ukjent = hits([
      ["Nærsenteret", 0.9, false],
      ["Ukjent senter", 8.0, false],
      ["Alti Verdal", 12.38],
      ["Alti Magneten Mall", 14.78],
    ]);
    const picked = selectAnchorImports(ukjent, PROJECT_RADIUS_M);
    expect(picked.map((h) => h.poi.name)).toEqual([
      "Nærsenteret",
      "Alti Verdal",
      "Alti Magneten Mall",
    ]);
  });

  it("Oppdal: nøyaktig tre innenfor → uendret, ingenting hentes utenfra", () => {
    const picked = selectAnchorImports(OPPDAL, PROJECT_RADIUS_M);
    expect(picked).toHaveLength(3);
    expect(picked.every((h) => h.distanceMeters <= PROJECT_RADIUS_M)).toBe(true);
  });

  it("usortert input gir samme utvalg — regelen sorterer selv", () => {
    const shuffled = [...VIKHAMMER].reverse();
    expect(selectAnchorImports(shuffled, PROJECT_RADIUS_M).map((h) => h.poi.name)).toEqual(
      selectAnchorImports(VIKHAMMER, PROJECT_RADIUS_M).map((h) => h.poi.name)
    );
  });

  it("færre treff enn minstetallet → tar alt som finnes", () => {
    expect(selectAnchorImports(SUNDSOYA.slice(0, 2), PROJECT_RADIUS_M)).toHaveLength(2);
    expect(selectAnchorImports([], PROJECT_RADIUS_M)).toEqual([]);
  });

  it("minstetallet er justerbart og kan nulles ut", () => {
    expect(selectAnchorImports(SUNDSOYA, PROJECT_RADIUS_M, 5)).toHaveLength(5);
    expect(selectAnchorImports(SUNDSOYA, PROJECT_RADIUS_M, 0)).toEqual([]);
    // Et negativt tall skal ikke slå ut i en negativ slice
    expect(selectAnchorImports(SUNDSOYA, PROJECT_RADIUS_M, -3)).toEqual([]);
  });

  it("muterer ikke input-lista", () => {
    const before = VIKHAMMER.map((h) => h.poi.name);
    selectAnchorImports([...VIKHAMMER].reverse(), PROJECT_RADIUS_M);
    expect(VIKHAMMER.map((h) => h.poi.name)).toEqual(before);
  });
});

const BASE = {
  projectId: "placy-demo_sundsoya",
  lat: 63.865218,
  lng: 11.303152,
  radiusMeters: PROJECT_RADIUS_M,
};

/** Nok medlemmer til å bestå realitets-gaten. */
const REAL_MALL = {
  memberCount: 19,
  categoryNames: ["Dagligvare", "Apotek", "Butikk", "Butikk", "Hotell"],
  saturated: false,
};

function buildSupabase() {
  const updates: Array<{ patch: Record<string, unknown>; id: unknown }> = [];
  const thenable = (value: unknown) => ({
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(value).then(resolve),
  });
  const db = {
    from: () => ({
      select: () => ({
        in: () =>
          thenable({
            data: [{ id: "google-thon-senter-verdal", poi_metadata: { kilde: "beholdes" } }],
            error: null,
          }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, id: unknown) => {
          updates.push({ patch, id });
          return thenable({ error: null });
        },
      }),
    }),
  };
  return { client: { schema: () => db }, updates };
}

describe("discoverAnchorsForProject", () => {
  let updates: Array<{ patch: Record<string, unknown>; id: unknown }>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.mocked(discoverAnchorCandidates).mockResolvedValue(SUNDSOYA);
    vi.mocked(probeAnchorMembers).mockResolvedValue(REAL_MALL);
    const supabase = buildSupabase();
    updates = supabase.updates;
    vi.mocked(createServerClient).mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createServerClient>
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lagrer nøyaktig de utvalgte ankrene mot prosjektet", async () => {
    const result = await discoverAnchorsForProject(BASE);

    expect(vi.mocked(persistDiscoveredPOIs)).toHaveBeenCalledTimes(1);
    const [pois, projectId] = vi.mocked(persistDiscoveredPOIs).mock.calls[0];
    expect(pois.map((p) => p.name)).toEqual([
      "Thon Senter Verdal",
      "Alti Verdal",
      "Alti Magneten Mall",
    ]);
    expect(projectId).toBe("placy-demo_sundsoya");
    expect(result.candidatesFound).toBe(5);
    expect(result.imported).toHaveLength(3);
    expect(result.beyondCircle).toBe(3);
  });

  it("tørrkjøring skriver INGENTING — verken POI-er eller anker-tekst", async () => {
    // Beslutningsgrunnlaget for en irreversibel backfill mot prod. Går den
    // gjennom en egen simuleringsgren i stedet for den ekte koden, beviser den
    // ingenting; her er kravet at samme vei kjøres, bare uten skriv.
    const result = await discoverAnchorsForProject({ ...BASE, dryRun: true });

    expect(vi.mocked(persistDiscoveredPOIs)).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(result.imported).toHaveLength(3);
  });

  it("tørrkjøringen bygger anker-teksten som ville blitt skrevet", async () => {
    // Teksten er det som skal gjennomgås før den lagres — den må stå i
    // rapporten selv om ingen rad røres.
    const result = await discoverAnchorsForProject({ ...BASE, dryRun: true });
    const beyond = result.imported.filter((a) => a.beyondCircle);
    expect(beyond.length).toBeGreaterThan(0);
    for (const a of beyond) expect(a.summary).toBeTruthy();
  });

  it("tørrkjøring og ekte kjøring rapporterer det samme", async () => {
    const dry = await discoverAnchorsForProject({ ...BASE, dryRun: true });
    vi.clearAllMocks();
    vi.mocked(discoverAnchorCandidates).mockResolvedValue(SUNDSOYA);
    vi.mocked(probeAnchorMembers).mockResolvedValue(REAL_MALL);
    const wet = await discoverAnchorsForProject(BASE);

    expect(dry.candidatesFound).toBe(wet.candidatesFound);
    expect(dry.beyondCircle).toBe(wet.beyondCircle);
    expect(dry.rejected).toEqual(wet.rejected);
    expect(dry.imported).toEqual(wet.imported);
  });

  it("rapporterer avstand i hele meter og merker hvem som lå utenfor sirkelen", async () => {
    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported[0]).toMatchObject({
      name: "Thon Senter Verdal",
      distanceMeters: 12140,
      beyondCircle: true,
      memberCount: 19,
    });
    expect(
      result.warnings.some((w) => w.includes("utenfor prosjektsirkelen")),
    ).toBe(true);
  });

  it("ingenting utenfor sirkelen → ingen prober, ingen warning", async () => {
    vi.mocked(discoverAnchorCandidates).mockResolvedValue(OPPDAL);

    const result = await discoverAnchorsForProject(BASE);

    expect(result.beyondCircle).toBe(0);
    expect(result.warnings).toEqual([]);
    // Ankre INNENFOR sirkelen har medlemmene sine i poolen; Steg 5b svarer på
    // firetallet gratis. Å probe dem ville vært betalt for samme svar.
    expect(probeAnchorMembers).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it("skriver anchor_summary og angre-tagg på de probede ankrene", async () => {
    await discoverAnchorsForProject(BASE);

    expect(updates).toHaveLength(3);
    const first = updates[0];
    expect(first.id).toBe("google-thon-senter-verdal");
    expect(first.patch.anchor_summary).toBe("Butikk, apotek, dagligvare og hotell");
    // Et anker er aldri medlem av noe.
    expect(first.patch.parent_poi_id).toBeNull();
    const metadata = first.patch.poi_metadata as Record<string, unknown>;
    expect(metadata.kilde).toBe("beholdes");
    expect(metadata.anchor_probe).toMatchObject({ member_count: 19, saturated: false });
  });

  it("teksten sier «minst» når Googles tak på 20 ble truffet", async () => {
    vi.mocked(probeAnchorMembers).mockResolvedValue({ ...REAL_MALL, saturated: true });

    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported[0].memberCountIsFloor).toBe(true);
    expect(result.warnings.some((w) => w.includes("minst 19 virksomheter"))).toBe(true);
  });

  it("under fire virksomheter → ikke importert, og det SIES hvorfor", async () => {
    // Realitets-gaten er den samme som Unit 1 bruker i poolen — den er bare
    // målt hos Google i stedet, siden medlemmene aldri importeres.
    vi.mocked(probeAnchorMembers)
      .mockResolvedValueOnce(REAL_MALL)
      .mockResolvedValueOnce({ memberCount: 2, categoryNames: ["Butikk"], saturated: false })
      .mockResolvedValueOnce(REAL_MALL);

    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported.map((a) => a.name)).toEqual([
      "Thon Senter Verdal",
      "Alti Magneten Mall",
    ]);
    expect(result.rejected).toEqual([
      { name: "Alti Verdal", distanceMeters: 12380, memberCount: 2 },
    ]);
    expect(result.warnings.some((w) => w.includes("bare 2 virksomheter"))).toBe(true);
  });

  it("probe-feil er ikke det samme som godkjent — stedet droppes med warning", async () => {
    vi.mocked(probeAnchorMembers).mockRejectedValue(new Error("timeout"));

    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported).toEqual([]);
    expect(persistDiscoveredPOIs).not.toHaveBeenCalled();
    expect(result.warnings.some((w) => w.includes("Kunne ikke telle medlemmer"))).toBe(true);
  });

  it("ingen fjerne kandidater består → warning som sier at boardet står uten", async () => {
    vi.mocked(probeAnchorMembers).mockResolvedValue({
      memberCount: 1,
      categoryNames: [],
      saturated: false,
    });

    const result = await discoverAnchorsForProject(BASE);

    expect(result.rejected).toHaveLength(3);
    expect(result.warnings.some((w) => w.includes("realitets-gaten"))).toBe(true);
    expect(persistDiscoveredPOIs).not.toHaveBeenCalled();
  });

  it("ankre innenfor sirkelen importeres selv om de fjerne stryker", async () => {
    vi.mocked(discoverAnchorCandidates).mockResolvedValue(VIKHAMMER);
    vi.mocked(probeAnchorMembers).mockResolvedValue({
      memberCount: 0,
      categoryNames: [],
      saturated: false,
    });

    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported.map((a) => a.name)).toEqual(["Vikhammer senteret"]);
    expect(result.beyondCircle).toBe(0);
    expect(result.rejected).toHaveLength(2);
  });

  it("uten API-nøkkel: hopper over med warning, kaster ikke", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");

    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported).toEqual([]);
    expect(result.warnings[0]).toContain("GOOGLE_PLACES_API_KEY");
    expect(persistDiscoveredPOIs).not.toHaveBeenCalled();
  });

  it("Google-feil felles ikke provisjoneringen", async () => {
    vi.mocked(discoverAnchorCandidates).mockRejectedValue(new Error("quota exceeded"));

    const result = await discoverAnchorsForProject(BASE);

    expect(result.warnings[0]).toContain("quota exceeded");
    expect(result.imported).toEqual([]);
    expect(persistDiscoveredPOIs).not.toHaveBeenCalled();
  });

  it("null kjøpesenter innen 20 km → warning som SIER at boardet blir uten anker", async () => {
    vi.mocked(discoverAnchorCandidates).mockResolvedValue([]);

    const result = await discoverAnchorsForProject(BASE);

    expect(result.warnings[0]).toContain("Ingen kjøpesenter");
    expect(result.warnings[0]).toContain("20 km");
    expect(persistDiscoveredPOIs).not.toHaveBeenCalled();
  });

  it("skrivefeil rapporteres som warning, ikke som importerte ankre", async () => {
    // Ellers ville loggen sagt «3 ankre hentet» om en kjøring som skrev null.
    vi.mocked(persistDiscoveredPOIs).mockRejectedValueOnce(new Error("DB nede"));

    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported).toEqual([]);
    expect(result.beyondCircle).toBe(0);
    expect(result.warnings.some((w) => w.includes("DB nede"))).toBe(true);
  });

  it("manglende Supabase gir anker uten register, ikke board uten anker", async () => {
    vi.mocked(createServerClient).mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY mangler");
    });

    const result = await discoverAnchorsForProject(BASE);

    expect(result.imported).toHaveLength(3);
    expect(result.warnings.some((w) => w.includes("Supabase utilgjengelig"))).toBe(true);
  });

  it("søkeradius, minstetall og medlemsterskel kan overstyres", async () => {
    await discoverAnchorsForProject({
      ...BASE,
      searchRadiusMeters: 5000,
      minCount: 1,
      minMembers: 25,
    });

    expect(vi.mocked(discoverAnchorCandidates).mock.calls[0][0]).toEqual({
      center: { lat: BASE.lat, lng: BASE.lng },
      radius: 5000,
    });
    // minCount 1 → én kandidat probes; minMembers 25 → 19 er ikke nok.
    expect(probeAnchorMembers).toHaveBeenCalledTimes(1);
    expect(persistDiscoveredPOIs).not.toHaveBeenCalled();
  });
});
