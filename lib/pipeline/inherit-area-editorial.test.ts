import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock-fabrikker (eksplisitte — auto-mock ville lastet originalene, og
// report-data drar en "use client"-kjede som ikke skal inn i testen).
// vi.mock intercepter også de DYNAMISKE importene i steg-funksjonen.
vi.mock("@/lib/pipeline/find-area-for-point", () => ({
  findAreaForPoint: vi.fn(),
}));
vi.mock("@/lib/supabase/queries", () => ({
  getProductFromSupabase: vi.fn(),
}));
vi.mock("@/components/variants/report/report-data", () => ({
  transformToReportData: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({
  createServerClient: vi.fn(),
}));

import { findAreaForPoint } from "@/lib/pipeline/find-area-for-point";
import { getProductFromSupabase } from "@/lib/supabase/queries";
import {
  transformToReportData,
  type ReportData,
} from "@/components/variants/report/report-data";
import { createServerClient } from "@/lib/supabase/client";
import { inheritAreaEditorial } from "./inherit-area-editorial";
import type { Project } from "@/lib/types";

const findAreaForPointMock = vi.mocked(findAreaForPoint);
const getProductFromSupabaseMock = vi.mocked(getProductFromSupabase);
const transformToReportDataMock = vi.mocked(transformToReportData);
const createServerClientMock = vi.mocked(createServerClient);

// ── Fixtures ──────────────────────────────────────────────────────────────

const ARGS = {
  projectId: "placy-demo_testveien-1",
  customerSlug: "placy-demo",
  projectSlug: "testveien-1",
  lat: 63.43,
  lng: 10.52,
};

const UPDATED_AT = "2026-06-10T12:00:00.123456+00:00";

function curatedArea(reportEditorial: Record<string, unknown>) {
  return {
    area: {
      id: "ranheim",
      name_no: "Ranheim",
      level: "strok",
      boundary: { type: "Polygon" as const, coordinates: [] },
      report_editorial: reportEditorial,
    },
    warnings: [],
  };
}

/** Board-sett på formen inherit-steget leser: themes[].id + allPOIs[].id */
function board(themes: Array<{ id: string; poiIds: string[] }>): ReportData {
  return {
    themes: themes.map((t) => ({
      id: t.id,
      allPOIs: t.poiIds.map((id) => ({ id })),
    })),
  } as unknown as ReportData;
}

function baseConfig() {
  return {
    reportConfig: {
      reportTier: 2,
      themes: [
        {
          id: "mat-drikke",
          name: "Mat & drikke",
          icon: "Utensils",
          color: "#b45309",
          leadText: "Lead som skal overleve",
          grounding: { groundingVersion: 1, summary: "grounding som skal overleve" },
          audio: { manus: "audio-manus som skal overleve" },
        },
        {
          id: "hverdagsliv",
          name: "Hverdagsliv",
          editorial: { body: "eksisterende editorial", highlightPoiIds: ["poi-old"] },
        },
      ],
    },
    otherTopLevel: "skal overleve",
  };
}

function productRow(config: unknown = baseConfig()) {
  return { id: "prod-1", config, updated_at: UPDATED_AT };
}

// ── fetch-mock (REST GET + PATCH mot products) ────────────────────────────

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function stubFetch(opts: {
  productRows?: unknown[];
  getOk?: boolean;
  patchOk?: boolean;
  patchReturnsRows?: boolean;
} = {}) {
  const getCalls: FetchCall[] = [];
  const patchCalls: FetchCall[] = [];

  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PATCH") {
      patchCalls.push({ url, init });
      if (opts.patchOk === false) {
        return {
          ok: false,
          status: 500,
          json: async () => [],
          text: async () => "boom",
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () =>
          opts.patchReturnsRows === false ? [] : [{ id: "prod-1" }],
        text: async () => "",
      };
    }
    getCalls.push({ url, init });
    if (opts.getOk === false) {
      return { ok: false, status: 500, json: async () => [], text: async () => "boom" };
    }
    return {
      ok: true,
      status: 200,
      json: async () => opts.productRows ?? [productRow()],
      text: async () => "",
    };
  });

  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, getCalls, patchCalls };
}

/** Config slik den faktisk ble skrevet i PATCH (håndterer streng-form). */
function writtenConfig(patchCalls: FetchCall[]) {
  expect(patchCalls.length).toBeGreaterThan(0);
  const body = JSON.parse(patchCalls[0].init!.body as string) as { config: unknown };
  return (
    typeof body.config === "string" ? JSON.parse(body.config) : body.config
  ) as {
    reportConfig: {
      themes: Array<Record<string, unknown>>;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  };
}

/** Mock pois-oppslaget som R9-klassifiseringen bruker. */
function mockPoisLookup(
  rows: Array<{ id: string; trust_score: number | null }>,
  error: { message: string } | null = null
) {
  createServerClientMock.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn((_col: string, ids: string[]) =>
          Promise.resolve({
            data: error ? null : rows.filter((r) => ids.includes(r.id)),
            error,
          })
        ),
      })),
    })),
  } as never);
}

// ── Oppsett ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  getProductFromSupabaseMock.mockResolvedValue({
    name: "Testveien 1",
    pois: [],
  } as unknown as Project);
  mockPoisLookup([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ── Scenarier ─────────────────────────────────────────────────────────────

describe("inheritAreaEditorial", () => {
  it("(a) område + kandidater overlever → inntil 3 highlights i kurator-rekkefølge; forbi capen logges off-board som droppet, on-board ikke", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": {
          body: "Ranheim har et godt mattilbud.",
          highlightCandidates: ["c1", "c2", "c3", "c4", "off5"],
        },
      })
    );
    // c1–c4 finnes på boardet → kun de 3 FØRSTE beholdes; off5 er off-board
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["other", "c4", "c3", "c2", "c1"] }])
    );
    mockPoisLookup([{ id: "off5", trust_score: 0.9 }]);
    const { patchCalls } = stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.skipped).toBeUndefined();
    expect(result.areaName).toBe("Ranheim");
    expect(result.themesInherited).toEqual(["mat-drikke"]);
    expect(result.highlights.kept).toBe(3);
    // R9 forbi capen: on-board c4 logges IKKE (bare forbi visningstaket),
    // off-board off5 logges FORTSATT som droppet (utilgjengelig uansett cap)
    expect(result.highlights.dropped).toEqual([
      { themeId: "mat-drikke", id: "off5", reason: "utenfor-board" },
    ]);

    const config = writtenConfig(patchCalls);
    const theme = config.reportConfig.themes.find((t) => t.id === "mat-drikke")!;
    expect(theme.editorial).toEqual({
      body: "Ranheim har et godt mattilbud.",
      highlightPoiIds: ["c1", "c2", "c3"], // render-feltnavnet, kurator-rekkefølge
    });

    // Optimistisk lås: PATCH målrettes id + updated_at (URL-enkodet, inkl. +)
    expect(patchCalls[0].url).toContain("id=eq.prod-1");
    expect(patchCalls[0].url).toContain(
      "updated_at=eq.2026-06-10T12%3A00%3A00.123456%2B00%3A00"
    );
  });

  it("(b) punkt utenfor alle polygoner → skipped, config urørt (R2)", async () => {
    findAreaForPointMock.mockResolvedValue({ area: null, warnings: [] });
    const { fetchMock } = stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.skipped).toBe(true);
    expect(result.themesInherited).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getProductFromSupabaseMock).not.toHaveBeenCalled();
  });

  it("(c) droppede kandidater klassifiseres: utenfor-board (Teknostallen-gotchaen), ikke-i-db, under-trust", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": {
          body: "Tekst.",
          highlightCandidates: [
            "i-db-ikke-board",
            "finnes-ikke",
            "lav-trust",
            "paa-board",
          ],
        },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["paa-board"] }])
    );
    mockPoisLookup([
      { id: "i-db-ikke-board", trust_score: 0.9 },
      { id: "lav-trust", trust_score: 0.3 },
      // "finnes-ikke" mangler bevisst i pois-tabellen
    ]);
    const { patchCalls } = stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.highlights.kept).toBe(1);
    expect(result.highlights.dropped).toEqual([
      { themeId: "mat-drikke", id: "i-db-ikke-board", reason: "utenfor-board" },
      { themeId: "mat-drikke", id: "finnes-ikke", reason: "ikke-i-db" },
      { themeId: "mat-drikke", id: "lav-trust", reason: "under-trust" },
    ]);

    const theme = writtenConfig(patchCalls).reportConfig.themes.find(
      (t) => t.id === "mat-drikke"
    )!;
    expect(theme.editorial).toEqual({
      body: "Tekst.",
      highlightPoiIds: ["paa-board"],
    });
  });

  it("(c2) klassifisering fail-soft: pois-oppslag feiler → alle utenfor-board + warning", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Tekst.", highlightCandidates: ["x1", "x2"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: [] }])
    );
    mockPoisLookup([], { message: "boom" });
    stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.highlights.dropped).toEqual([
      { themeId: "mat-drikke", id: "x1", reason: "utenfor-board" },
      { themeId: "mat-drikke", id: "x2", reason: "utenfor-board" },
    ]);
    expect(result.warnings.some((w) => w.includes("Klassifisering"))).toBe(true);
  });

  it("(d) 0 survivors men body finnes → editorial skrives med tom highlight-liste (gating: body bærer drill-in)", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": {
          body: "Body som alene bærer nivå 2.",
          highlightCandidates: ["borte-1", "borte-2"],
        },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["helt-andre"] }])
    );
    mockPoisLookup([]);
    const { patchCalls } = stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.themesInherited).toEqual(["mat-drikke"]);
    expect(result.highlights.kept).toBe(0);
    expect(result.highlights.dropped).toHaveLength(2);

    const theme = writtenConfig(patchCalls).reportConfig.themes.find(
      (t) => t.id === "mat-drikke"
    )!;
    expect(theme.editorial).toEqual({
      body: "Body som alene bærer nivå 2.",
      highlightPoiIds: [],
    });
  });

  it("(d2) verken body eller survivors → tema skippes med warning (ikke ekte nivå 2)", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "   ", highlightCandidates: ["borte"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: [] }])
    );
    mockPoisLookup([]);
    const { patchCalls } = stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.themesInherited).toEqual([]);
    expect(patchCalls).toHaveLength(0); // ingenting å skrive → ingen PATCH
    expect(
      result.warnings.some((w) => w.includes("verken body eller overlevende"))
    ).toBe(true);
  });

  it("(e) tema i area-editorial som ikke finnes i prosjektets config → warning + skip, resten arves", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        transport: { body: "Transport-tekst.", highlightCandidates: ["t1"] },
        "mat-drikke": { body: "Mat-tekst.", highlightCandidates: ["c1"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([
        { id: "transport", poiIds: ["t1"] },
        { id: "mat-drikke", poiIds: ["c1"] },
      ])
    );
    const { patchCalls } = stubFetch(); // baseConfig har IKKE transport-tema

    const result = await inheritAreaEditorial(ARGS);

    expect(result.themesInherited).toEqual(["mat-drikke"]);
    expect(
      result.warnings.some(
        (w) => w.includes("transport") && w.includes("config-temaer")
      )
    ).toBe(true);

    const config = writtenConfig(patchCalls);
    expect(config.reportConfig.themes.some((t) => t.id === "transport")).toBe(false);
  });

  it("(f) optimistisk lås — PATCH treffer 0 rader → høylytt feil", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Tekst.", highlightCandidates: ["c1"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["c1"] }])
    );
    stubFetch({ patchReturnsRows: false });

    await expect(inheritAreaEditorial(ARGS)).rejects.toThrow(/0 rader/);
  });

  it("(g) skrivefeil → kaster, og det finnes nøyaktig ÉN PATCH (alt-eller-ingenting, aldri per-tema-løkke)", async () => {
    // To temaer skal arves — en per-tema-løkke ville gitt 2 PATCH-kall og
    // risikert delvis editorial ved midt-løkke-feil.
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Mat.", highlightCandidates: ["c1"] },
        hverdagsliv: { body: "Hverdag.", highlightCandidates: ["h1"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([
        { id: "mat-drikke", poiIds: ["c1"] },
        { id: "hverdagsliv", poiIds: ["h1"] },
      ])
    );
    const { patchCalls } = stubFetch({ patchOk: false });

    await expect(inheritAreaEditorial(ARGS)).rejects.toThrow(/INGEN temaer skrevet/);
    expect(patchCalls).toHaveLength(1);
  });

  it("(h) merge bevarer ALT annet på temaet (grounding, leadText, audio) og resten av config", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": {
          body: "Ny arvet body.",
          highlightCandidates: ["c1"],
          image: "/illustrations/ranheim-mat.png",
        },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["c1"] }])
    );
    const { patchCalls } = stubFetch();

    await inheritAreaEditorial(ARGS);

    const config = writtenConfig(patchCalls);
    const matDrikke = config.reportConfig.themes.find((t) => t.id === "mat-drikke")!;

    // Eksplisitt pin: nøklene på temaet overlever spread-mergen urørt
    expect(matDrikke.grounding).toEqual({
      groundingVersion: 1,
      summary: "grounding som skal overleve",
    });
    expect(matDrikke.leadText).toBe("Lead som skal overleve");
    expect(matDrikke.audio).toEqual({ manus: "audio-manus som skal overleve" });
    expect(matDrikke.name).toBe("Mat & drikke");
    expect(matDrikke.editorial).toEqual({
      body: "Ny arvet body.",
      highlightPoiIds: ["c1"],
      image: "/illustrations/ranheim-mat.png",
    });

    // Urørte temaer beholder eksisterende editorial; toppnivå-nøkler overlever
    const hverdagsliv = config.reportConfig.themes.find((t) => t.id === "hverdagsliv")!;
    expect(hverdagsliv.editorial).toEqual({
      body: "eksisterende editorial",
      highlightPoiIds: ["poi-old"],
    });
    expect(config.otherTopLevel).toBe("skal overleve");
    expect(config.reportConfig.reportTier).toBe(2);
  });

  it("(i) jsonb-vs-streng: config lagret som JSON-streng → skrives tilbake som streng med samme merge", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Tekst.", highlightCandidates: ["c1"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["c1"] }])
    );
    const { patchCalls } = stubFetch({
      productRows: [productRow(JSON.stringify(baseConfig()))],
    });

    const result = await inheritAreaEditorial(ARGS);
    expect(result.themesInherited).toEqual(["mat-drikke"]);

    // Lagringsformen bevares: PATCH-body sin config er en STRENG
    const body = JSON.parse(patchCalls[0].init!.body as string) as { config: unknown };
    expect(typeof body.config).toBe("string");

    const config = writtenConfig(patchCalls); // parser strengen
    const theme = config.reportConfig.themes.find((t) => t.id === "mat-drikke")!;
    expect(theme.editorial).toEqual({ body: "Tekst.", highlightPoiIds: ["c1"] });
    expect(theme.leadText).toBe("Lead som skal overleve");
  });

  it("(j) prosjekt ikke funnet (getProductFromSupabase → null) → skipped, ingen REST-kall", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Tekst.", highlightCandidates: ["c1"] },
      })
    );
    getProductFromSupabaseMock.mockResolvedValue(null);
    const { fetchMock } = stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.skipped).toBe(true);
    expect(result.themesInherited).toEqual([]);
    expect(result.warnings.some((w) => w.includes("ikke funnet"))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("(k) config er korrupt JSON-streng → kaster høylytt, ingen PATCH", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Tekst.", highlightCandidates: ["c1"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["c1"] }])
    );
    const { patchCalls } = stubFetch({
      productRows: [productRow("{ikke gyldig json")],
    });

    await expect(inheritAreaEditorial(ARGS)).rejects.toThrow(/korrupt JSON-streng/);
    expect(patchCalls).toHaveLength(0);
  });

  it("(l) tom reportConfig.themes → skipped med warning, ingen PATCH", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Tekst.", highlightCandidates: ["c1"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["c1"] }])
    );
    const { patchCalls } = stubFetch({
      productRows: [productRow({ reportConfig: { themes: [] } })],
    });

    const result = await inheritAreaEditorial(ARGS);

    expect(result.skipped).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("themes mangler/er tom"))
    ).toBe(true);
    expect(patchCalls).toHaveLength(0);
  });

  it("(m) duplikat POI-id i highlightCandidates dedupliseres — kept teller unike", async () => {
    findAreaForPointMock.mockResolvedValue(
      curatedArea({
        "mat-drikke": { body: "Tekst.", highlightCandidates: ["c1", "c1", "c2"] },
      })
    );
    transformToReportDataMock.mockReturnValue(
      board([{ id: "mat-drikke", poiIds: ["c1", "c2"] }])
    );
    const { patchCalls } = stubFetch();

    const result = await inheritAreaEditorial(ARGS);

    expect(result.highlights.kept).toBe(2);
    expect(result.highlights.dropped).toEqual([]);

    const theme = writtenConfig(patchCalls).reportConfig.themes.find(
      (t) => t.id === "mat-drikke"
    )!;
    expect(theme.editorial).toEqual({
      body: "Tekst.",
      highlightPoiIds: ["c1", "c2"],
    });
  });
});
