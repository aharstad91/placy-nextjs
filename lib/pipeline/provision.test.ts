import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

vi.mock("@/lib/pipeline/geocode", () => ({
  geocodeAddress: vi.fn(),
  getKommunenummer: vi.fn(),
  meetsGeocodeConfidence: vi.fn(() => true),
}));
vi.mock("@/lib/pipeline/create-report-project", () => ({ createReportProject: vi.fn() }));
vi.mock("@/lib/pipeline/import-public-pois", () => ({ importPublicPois: vi.fn() }));
vi.mock("@/lib/pipeline/enrich-report-pois", async (orig) => ({
  ...(await orig<typeof import("@/lib/pipeline/enrich-report-pois")>()),
  enrichReportPois: vi.fn(),
}));
vi.mock("@/lib/pipeline/validate-report-trust", () => ({ validateReportTrust: vi.fn() }));
vi.mock("@/lib/pipeline/hydrate-report", () => ({ hydrateReport: vi.fn() }));
vi.mock("@/lib/pipeline/travel-times", () => ({ computeProjectTravelTimes: vi.fn() }));
vi.mock("@/lib/pipeline/board-facts-step", () => ({ runBoardFactsStep: vi.fn() }));
vi.mock("@/lib/pipeline/inherit-area-editorial-via-route", () => ({ inheritAreaEditorialViaRoute: vi.fn() }));
vi.mock("@/lib/pipeline/provision-acceptance", () => ({ runAcceptanceCheck: vi.fn() }));

import { geocodeAddress, getKommunenummer, meetsGeocodeConfidence } from "@/lib/pipeline/geocode";
import { NAERING_GOOGLE_CATEGORIES } from "@/lib/pipeline/enrich-report-pois";
import { createReportProject } from "@/lib/pipeline/create-report-project";
import { importPublicPois } from "@/lib/pipeline/import-public-pois";
import { enrichReportPois } from "@/lib/pipeline/enrich-report-pois";
import { validateReportTrust } from "@/lib/pipeline/validate-report-trust";
import { hydrateReport } from "@/lib/pipeline/hydrate-report";
import { computeProjectTravelTimes } from "@/lib/pipeline/travel-times";
import { runBoardFactsStep } from "@/lib/pipeline/board-facts-step";
import { inheritAreaEditorialViaRoute } from "@/lib/pipeline/inherit-area-editorial-via-route";
import { runAcceptanceCheck } from "@/lib/pipeline/provision-acceptance";
import { provisionReportBoard, revalidateProject } from "./provision";

const m = {
  geocode: vi.mocked(geocodeAddress),
  kommune: vi.mocked(getKommunenummer),
  project: vi.mocked(createReportProject),
  publicPois: vi.mocked(importPublicPois),
  enrich: vi.mocked(enrichReportPois),
  trust: vi.mocked(validateReportTrust),
  hydrate: vi.mocked(hydrateReport),
  travel: vi.mocked(computeProjectTravelTimes),
  boardFacts: vi.mocked(runBoardFactsStep),
  editorial: vi.mocked(inheritAreaEditorialViaRoute),
  acceptance: vi.mocked(runAcceptanceCheck),
};

function setHappyDefaults(existed = false) {
  m.geocode.mockResolvedValue([
    { placeName: "Adr", lat: 63.4, lng: 10.4, confidence: 1, city: "Trondheim" },
  ]);
  m.kommune.mockResolvedValue({ kommunenummer: "5001", kommunenavn: "Trondheim" });
  m.project.mockResolvedValue({
    projectId: "intern_x", productId: "prod-1", customerSlug: "intern", slug: "x",
    existed, warnings: [],
  });
  m.publicPois.mockResolvedValue({ counts: { nsr: 1, barnehagefakta: 1, overpass: 1, taxi: 1 }, warnings: [] });
  m.enrich.mockResolvedValue({ google: { total: 20, new: 20, updated: 0, byCategory: {} }, warnings: [] });
  m.trust.mockResolvedValue({ scored: 10, skipped: 0, skippedPublic: 5, stillNull: [], warnings: [] });
  m.hydrate.mockResolvedValue({ productPoisLinked: 20, featuredMarked: 6, categoriesPopulated: 8, warnings: [] });
  m.travel.mockResolvedValue({
    computed: 20,
    unchanged: 0,
    total: 20,
    coverage: { walk: 20, bike: 20, car: 20 },
    warnings: [],
  });
  m.boardFacts.mockResolvedValue({ skipped: true, warnings: [] });
  m.editorial.mockResolvedValue({
    skipped: true, areaName: "", themesInherited: [], themesWithFaq: [], globalFaqAnswers: 0,
    highlights: { kept: 0, dropped: [] }, warnings: [],
  });
  m.acceptance.mockResolvedValue({ ok: true, findings: [], urls: { local: "l", prod: "p" } });
}

const BASE = {
  name: "X", address: "Adr", customer: "intern", profile: "bolig" as const,
  has3dAddon: false, allowUpdate: false,
};

describe("provisionReportBoard (orkestrator-kjerne)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHappyDefaults();
  });

  it("AC4: kjernen importerer ikke readline/stdin (TTY-løs)", () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "provision.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["']readline["']/);
    expect(src).not.toContain("process.stdin");
  });

  it("confirmCoords gitt → kjernen geocoder IKKE (CLI har resolvet)", async () => {
    const result = await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 }, placeName: "P" });
    expect(m.geocode).not.toHaveBeenCalled();
    expect(result.acceptance?.ok).toBe(true);
    expect(result.projectId).toBe("intern_x");
  });

  it("uten confirmCoords → kjernen geocoder selv (self-serve)", async () => {
    await provisionReportBoard(BASE);
    expect(m.geocode).toHaveBeenCalledWith("Adr");
  });

  it("existed && !allowUpdate → aborted, ingen discovery/writes nedstrøms", async () => {
    setHappyDefaults(true);
    const result = await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 } });
    expect(result.aborted?.reason).toBe("exists");
    expect(m.publicPois).not.toHaveBeenCalled();
    expect(m.enrich).not.toHaveBeenCalled();
    expect(m.acceptance).not.toHaveBeenCalled();
  });

  it("nærings-profil → hopper over offentlige POI (importPublicPois ikke kalt)", async () => {
    await provisionReportBoard({ ...BASE, profile: "naering", confirmCoords: { lat: 1, lng: 2 } });
    expect(m.publicPois).not.toHaveBeenCalled();
    // men Google-discovery kjører fortsatt
    expect(m.enrich).toHaveBeenCalled();
  });

  it("AC1: stegene kjører i ratifisert rekkefølge (project→enrich→trust→hydrate→travel→editorial→acceptance)", async () => {
    const order: string[] = [];
    m.project.mockImplementation(async () => { order.push("project"); return {
      projectId: "intern_x", productId: "prod-1", customerSlug: "intern", slug: "x", existed: false, warnings: [],
    }; });
    m.publicPois.mockImplementation(async () => { order.push("public"); return { counts: { nsr: 0, barnehagefakta: 0, overpass: 0, taxi: 0 }, warnings: [] }; });
    m.enrich.mockImplementation(async () => { order.push("enrich"); return { google: { total: 0, new: 0, updated: 0, byCategory: {} }, warnings: [] }; });
    m.trust.mockImplementation(async () => { order.push("trust"); return { scored: 0, skipped: 0, skippedPublic: 0, stillNull: [], warnings: [] }; });
    m.hydrate.mockImplementation(async () => { order.push("hydrate"); return { productPoisLinked: 0, featuredMarked: 0, categoriesPopulated: 0, warnings: [] }; });
    m.travel.mockImplementation(async () => { order.push("travel"); return { computed: 0, unchanged: 0, total: 0, coverage: { walk: 0, bike: 0, car: 0 }, warnings: [] }; });
    m.boardFacts.mockImplementation(async () => { order.push("board-facts"); return { skipped: true, warnings: [] }; });
    m.editorial.mockImplementation(async () => { order.push("editorial"); return { skipped: true, areaName: "", themesInherited: [], themesWithFaq: [], globalFaqAnswers: 0, highlights: { kept: 0, dropped: [] }, warnings: [] }; });
    m.acceptance.mockImplementation(async () => { order.push("acceptance"); return { ok: true, findings: [], urls: { local: "l", prod: "p" } }; });

    await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 } });

    // Board-fakta står MELLOM reisetider og editorial: begge de to siste gjør
    // read-modify-write mot samme config-rad, og rekkefølgen er derfor én å
    // resonnere om i stedet for to.
    expect(order).toEqual(["project", "public", "enrich", "trust", "hydrate", "travel", "board-facts", "editorial", "acceptance"]);
  });

  it("reisetid-steget er fail-soft: warnings videreformidles, provisjonen fullfører", async () => {
    m.travel.mockResolvedValue({
      computed: 0,
      unchanged: 0,
      total: 20,
      coverage: { walk: 0, bike: 0, car: 0 },
      warnings: ["⚠️  Mapbox Matrix walk: HTTP 503 (batch hoppet over)"],
    });
    const warned: string[] = [];
    const result = await provisionReportBoard(
      { ...BASE, confirmCoords: { lat: 1, lng: 2 } },
      { log() {}, warn: (msg) => warned.push(msg), section() {} }
    );
    expect(result.acceptance?.ok).toBe(true);
    expect(warned.some((w) => w.includes("Mapbox Matrix"))).toBe(true);
  });

  it("existed && !allowUpdate → reisetid-steget kjøres heller ikke", async () => {
    setHappyDefaults(true);
    await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 } });
    expect(m.travel).not.toHaveBeenCalled();
  });

  it("geocode uten treff → KASTER før noen writes (aldri board på feil sted)", async () => {
    m.geocode.mockResolvedValue([]);
    await expect(provisionReportBoard(BASE)).rejects.toThrow(/Finner ikke adresse/);
    expect(m.project).not.toHaveBeenCalled();
  });

  it("lav geocode-confidence → KASTER før noen writes (gaten er load-bearing)", async () => {
    // En svak match (feil gate/nabolag) ville gitt et komplett, plausibelt
    // board rundt FEIL punkt — den dyreste stille feilen i hele pipelinen.
    vi.mocked(meetsGeocodeConfidence).mockReturnValueOnce(false);
    await expect(provisionReportBoard(BASE)).rejects.toThrow(/confidence/i);
    expect(m.project).not.toHaveBeenCalled();
  });

  it("Kartverket-oppslag feiler (kommunenummer null) → offentlige POI-er skippes med varsel, resten kjører", async () => {
    // Stille-tap-kontrakten: uten kommunenummer mister boardet NSR-skolene,
    // men provisjonen skal varsle og fullføre — ikke kaste, ikke skippe stille.
    m.kommune.mockResolvedValue(null);
    const warned: string[] = [];
    const result = await provisionReportBoard(BASE, {
      log() {}, warn: (msg) => warned.push(msg), section() {},
    });
    expect(m.publicPois).not.toHaveBeenCalled();
    expect(warned.some((w) => w.includes("kommunenummer ukjent"))).toBe(true);
    expect(result.acceptance?.ok).toBe(true);
    expect(m.enrich).toHaveBeenCalled();
  });

  it("profil→kategoriliste: bolig sender undefined (BOLIG-default i enrich), næring sender NAERING_GOOGLE_CATEGORIES", async () => {
    await provisionReportBoard({ ...BASE, confirmCoords: { lat: 1, lng: 2 } });
    expect(m.enrich.mock.calls[0][0].categories).toBeUndefined();

    vi.clearAllMocks();
    setHappyDefaults();
    await provisionReportBoard({ ...BASE, profile: "naering", confirmCoords: { lat: 1, lng: 2 } });
    expect(m.enrich.mock.calls[0][0].categories).toEqual(NAERING_GOOGLE_CATEGORIES);
  });
});

// === Steg 9: revalidering (luken lukket 2026-08-24) ========================

describe("revalidateProject", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.PLACY_REVALIDATE_URLS;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.PORT;
  });

  function mockFetch(byBase: Record<string, number>) {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      void init;
      const base = String(url).replace("/api/admin/revalidate", "");
      const status = byBase[base];
      if (status === undefined) throw new Error("ECONNREFUSED");
      return { ok: status >= 200 && status < 300, status } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("treffer den lokale dev-serveren når prod svarer 403 (admin avslått i prod)", async () => {
    // Selve luken: cache-bustet gikk BARE til prod, der ADMIN_ENABLED er av,
    // mens dev-serveren som faktisk serverte boardet aldri fikk beskjed.
    mockFetch({ "https://www.placy.no": 403, "http://localhost:3000": 200 });

    const result = await revalidateProject("placy-demo", "strindfjordvegen-10");

    expect(result.revalidated).toEqual(["http://localhost:3000"]);
  });

  it("revaliderer ALLE flater som svarer, ikke bare den første", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://preview.placy.no";
    mockFetch({
      "https://preview.placy.no": 200,
      "https://www.placy.no": 200,
      "http://localhost:3000": 200,
    });

    const result = await revalidateProject("placy-demo", "strindfjordvegen-10");

    expect(result.revalidated).toHaveLength(3);
  });

  it("sender riktig tag og path", async () => {
    const fetchMock = mockFetch({ "http://localhost:3000": 200 });

    await revalidateProject("placy-demo", "strindfjordvegen-10");

    const lastCall = fetchMock.mock.calls.at(-1)!;
    const body = JSON.parse(lastCall[1]!.body as string);
    expect(body).toEqual({
      tag: "product:placy-demo_strindfjordvegen-10",
      path: "/eiendom/placy-demo/strindfjordvegen-10/rapport-board",
    });
  });

  it("PORT respekteres for den lokale flaten (worktree på 3001)", async () => {
    process.env.PORT = "3001";
    const fetchMock = mockFetch({ "http://localhost:3001": 200 });

    const result = await revalidateProject("placy-demo", "x");

    expect(result.revalidated).toEqual(["http://localhost:3001"]);
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes(":3000"))).toBe(false);
  });

  it("ingen flate tar imot + boardet finnes fra før → varsler at cachen fortsatt serveres", async () => {
    mockFetch({});
    const warned: string[] = [];

    await revalidateProject("placy-demo", "x", { log() {}, warn: (m) => warned.push(m), section() {} }, { existed: true });

    expect(warned).toHaveLength(1);
    expect(warned[0]).toMatch(/hard refresh/i);
  });

  it("ingen flate tar imot + NYTT board → informerer i stedet for å advare", async () => {
    mockFetch({});
    const warned: string[] = [];

    await revalidateProject("placy-demo", "x", { log() {}, warn: (m) => warned.push(m), section() {} }, { existed: false });

    expect(warned[0]).toMatch(/rendrer ferskt/i);
  });

  it("kaster aldri — en flate som feiler hardt stopper ikke provisjonen", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));

    await expect(revalidateProject("placy-demo", "x")).resolves.toEqual({ revalidated: [] });
  });
});
