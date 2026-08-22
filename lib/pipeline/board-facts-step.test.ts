import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/pipeline/board-facts", () => ({ computeBoardFacts: vi.fn() }));

import { computeBoardFacts } from "@/lib/pipeline/board-facts";
import { runBoardFactsStep } from "./board-facts-step";
import type { ReportBoardFacts } from "@/lib/types";

const computeMock = vi.mocked(computeBoardFacts);

const UPDATED_AT = "2026-08-22T12:00:00.123456+00:00";

const FACTS: ReportBoardFacts = {
  factsVersion: 1,
  fetchedAt: "2026-08-22T20:00:00.000Z",
  departureAt: "2026-08-24T08:00:00+02:00",
  stops: [
    {
      stopPlaceId: "NSR:StopPlace:60260",
      name: "Strindfjordvegen",
      distanceM: 28,
      modes: ["bus"],
      directions: [{ quayId: "NSR:Quay:102724", destinations: ["Grillstad"], lines: ["20"] }],
    },
  ],
};

function baseConfig() {
  return {
    reportConfig: {
      reportTier: 2,
      themes: [{ id: "transport", name: "Transport", editorial: { body: "Skal overleve" } }],
      grounding: "skal overleve",
    },
    otherTopLevel: "skal overleve",
  };
}

interface Call {
  url: string;
  init?: RequestInit;
}

function stubFetch(opts: { config?: unknown; getOk?: boolean; patchRows?: unknown[] } = {}) {
  const gets: Call[] = [];
  const patches: Call[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PATCH") {
      patches.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => opts.patchRows ?? [{ id: "prod-1" }],
        text: async () => "",
      };
    }
    gets.push({ url, init });
    if (opts.getOk === false) {
      return { ok: false, status: 500, json: async () => [], text: async () => "boom" };
    }
    return {
      ok: true,
      status: 200,
      json: async () => [
        { id: "prod-1", config: opts.config ?? baseConfig(), updated_at: UPDATED_AT },
      ],
      text: async () => "",
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { gets, patches };
}

function writtenConfig(patches: Call[]) {
  expect(patches.length).toBe(1);
  const body = JSON.parse(patches[0].init!.body as string) as { config: unknown };
  return (typeof body.config === "string" ? JSON.parse(body.config) : body.config) as Record<
    string,
    unknown
  >;
}

const ARGS = { productId: "prod-1", lat: 63.435107, lng: 10.505335, city: "Trondheim" };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  computeMock.mockResolvedValue({ facts: FACTS, warnings: [] });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("runBoardFactsStep", () => {
  it("skriver boardFacts under reportConfig og lar alt annet stå urørt", async () => {
    const { patches } = stubFetch();

    const result = await runBoardFactsStep(ARGS);

    expect(result.skipped).toBeUndefined();
    const config = writtenConfig(patches);
    const rc = config.reportConfig as Record<string, unknown>;
    expect(rc.boardFacts).toEqual(FACTS);
    expect(rc.grounding).toBe("skal overleve");
    expect(rc.themes).toHaveLength(1);
    expect(config.otherTopLevel).toBe("skal overleve");
  });

  it("låser PATCH-en på updated_at slik den ble lest", async () => {
    // Uten låsen ville et samtidig skriv (editorial-arven, audio-bygget) blitt
    // stille overskrevet.
    const { patches } = stubFetch();
    await runBoardFactsStep(ARGS);
    expect(patches[0].url).toContain(`updated_at=eq.${encodeURIComponent(UPDATED_AT)}`);
  });

  it("leser og skriver mot v2-skjemaet", async () => {
    // Rå REST treffer `public` som default, og public har 0 base-tabeller
    // etter cutover — uten profil-headerne treffer steget ingenting.
    const { gets, patches } = stubFetch();
    await runBoardFactsStep(ARGS);
    expect((gets[0].init!.headers as Record<string, string>)["Accept-Profile"]).toBe("v2");
    expect((patches[0].init!.headers as Record<string, string>)["Content-Profile"]).toBe("v2");
  });

  it("bevarer streng-formen når config er lagret som JSON-streng", async () => {
    // jsonb-vs-streng-gotchaen: bytter vi representasjon under føttene på
    // andre lesere, er det ikke en feil noen ser før mye senere.
    const { patches } = stubFetch({ config: JSON.stringify(baseConfig()) });
    await runBoardFactsStep(ARGS);
    const body = JSON.parse(patches[0].init!.body as string) as { config: unknown };
    expect(typeof body.config).toBe("string");
  });

  it("overskriver eldre fakta i sin helhet i stedet for å flette", async () => {
    // Faktaene er ett øyeblikksbilde med ett hentetidspunkt. En fletting ville
    // gitt et board med holdeplasser fra i fjor og skoler fra i dag, under
    // samme fetchedAt.
    const gammel = { ...baseConfig() };
    (gammel.reportConfig as Record<string, unknown>).boardFacts = {
      factsVersion: 1,
      fetchedAt: "2025-01-01T00:00:00.000Z",
      departureAt: "2025-01-02T08:00:00+01:00",
      stops: [{ stopPlaceId: "NSR:StopPlace:1", name: "Gammel", distanceM: 5, modes: [], directions: [] }],
      cityCentre: { name: "Gammelt sentrum", patterns: [] },
    };
    const { patches } = stubFetch({ config: gammel });

    await runBoardFactsStep(ARGS);

    const rc = writtenConfig(patches).reportConfig as Record<string, unknown>;
    expect(rc.boardFacts).toEqual(FACTS);
  });

  it("skriver ingenting når ingen kilde ga fakta", async () => {
    computeMock.mockResolvedValue({ facts: undefined, warnings: ["ℹ️  ingenting"] });
    const { patches } = stubFetch();

    const result = await runBoardFactsStep(ARGS);

    expect(result.skipped).toBe(true);
    expect(patches).toHaveLength(0);
  });

  it("er fail-soft når products-raden ikke kan hentes", async () => {
    const { patches } = stubFetch({ getOk: false });

    const result = await runBoardFactsStep(ARGS);

    expect(result.skipped).toBe(true);
    expect(result.warnings.some((w) => w.includes("Henting av products-rad feilet"))).toBe(true);
    expect(patches).toHaveLength(0);
  });

  it("er fail-soft, ikke stille, når den optimistiske låsen traff 0 rader", async () => {
    const { patches } = stubFetch({ patchRows: [] });

    const result = await runBoardFactsStep(ARGS);

    expect(result.skipped).toBe(true);
    expect(result.warnings.some((w) => w.includes("Optimistisk lås"))).toBe(true);
    expect(patches).toHaveLength(1);
  });

  it("er fail-soft når config er korrupt JSON-streng — kaster aldri", async () => {
    const { patches } = stubFetch({ config: "{ ikke json" });

    const result = await runBoardFactsStep(ARGS);

    expect(result.skipped).toBe(true);
    expect(result.warnings.some((w) => w.includes("korrupt JSON-streng"))).toBe(true);
    expect(patches).toHaveLength(0);
  });

  it("er fail-soft uten Supabase-nøkler", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { patches } = stubFetch();

    const result = await runBoardFactsStep(ARGS);

    expect(result.skipped).toBe(true);
    expect(patches).toHaveLength(0);
  });

  it("bærer advarslene fra faktainnhentingen videre", async () => {
    computeMock.mockResolvedValue({
      facts: FACTS,
      warnings: ["⚠️  Entur reise til «Trondheim S» feilet"],
    });
    stubFetch();

    const result = await runBoardFactsStep(ARGS);

    expect(result.warnings).toContain("⚠️  Entur reise til «Trondheim S» feilet");
  });
});
