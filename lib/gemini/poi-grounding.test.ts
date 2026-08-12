import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// url-resolver gjør DNS-oppslag + fetch mot Google. Mock den ut; SSRF-guarden
// har sine egne tester i url-resolver.test.ts.
vi.mock("./url-resolver", () => ({
  resolveUrlsParallel: vi.fn(async (urls: string[]) =>
    urls.map((u) => ({
      input: u,
      result: {
        url: `https://trondheim.kommune.no/${u.slice(-3)}`,
        domain: "trondheim.kommune.no",
        redirectUrl: u,
      },
    })),
  ),
}));

import { resolveUrlsParallel } from "./url-resolver";
import {
  groundPoi,
  evaluatePoiQualityGate,
  buildPoiGroundingPrompt,
  looksLikeRefusal,
  DEFAULT_POI_QUALITY_THRESHOLDS,
  NO_DATA_SENTINEL,
} from "./poi-grounding";

// Muustrøparken ligger i Straumen på Inderøy — ikke i Trondheim. Verifisert
// mot Gemini 2026-08-12, som nektet å svare på den feilaktige Trondheim-
// varianten i stedet for å dikte. Fixturen holdes faktariktig for at
// forventningene under skal betyr noe.
const POI = {
  id: "google-ChIJe2pnuSJibUYRqz4D6mc_JdM",
  name: "Muustrøparken",
  address: "Straumen, Inderøy",
  categoryName: "Park",
  areaHint: "Inderøy",
};

/**
 * Representativt svar i den lengden prompten ber om (400–900 tegn). Fixturen
 * må ligge i det reelle båndet — en kunstig kort fixture ville fått porten til
 * å stryke happy path-en og skjult hva tersklene faktisk gjør.
 */
const NARRATIVE = [
  "Muustrøparken er en skulpturpark i Straumen sentrum på Inderøy, med gangveier gjennom et åpent parkanlegg. Parken brukes til lufting, soling og uteopphold, og ligger noen minutters gange fra butikkene i sentrum.",
  "",
  "- Flere skulpturer plassert langs gangveiene gjennom parken",
  "- Amfi i skrånende terreng, brukt til konserter og uteforestillinger",
  "- Kvernhuset ved vannkanten, med sittegruppe utenfor",
  "- Åpne plener med plass til ballspill",
  "- Gangforbindelse videre mot Straumen sentrum",
].join("\n");

/** Bygger et Gemini-API-svar i den formen GeminiResponseSchema forventer. */
function geminiResponse(overrides: {
  text?: string;
  chunks?: Array<{ web: { uri: string; title?: string } }>;
  entryPoint?: string | null;
  queries?: string[];
  omitGroundingMetadata?: boolean;
}) {
  const candidate: Record<string, unknown> = {
    content: { parts: [{ text: overrides.text ?? NARRATIVE }] },
  };
  if (!overrides.omitGroundingMetadata) {
    candidate.groundingMetadata = {
      groundingChunks:
        overrides.chunks ??
        [
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aaa", title: "Kilde A" } },
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/bbb", title: "Kilde B" } },
        ],
      webSearchQueries: overrides.queries ?? ["Muustrøparken Trondheim"],
      ...(overrides.entryPoint === null
        ? {}
        : { searchEntryPoint: { renderedContent: overrides.entryPoint ?? '<div class="chip">søk</div>' } }),
    };
  }
  return { candidates: [candidate] };
}

function mockFetchOk(body: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
}

const NOW = () => new Date("2026-08-12T10:00:00.000Z");
const OPTS = { apiKey: "test-key", now: NOW };

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = global.fetch;
  vi.clearAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("evaluatePoiQualityGate", () => {
  it("4 kilder og ~700 tegn består", () => {
    const gate = evaluatePoiQualityGate({
      narrative: "a".repeat(700),
      sourceCount: 4,
    });
    expect(gate.passed).toBe(true);
    expect(gate.sourceCount).toBe(4);
    expect(gate.charCount).toBe(700);
    expect(gate.reason).toBeUndefined();
  });

  it("1 kilde og 120 tegn stryker med lesbar begrunnelse på BEGGE grunner", () => {
    const gate = evaluatePoiQualityGate({
      narrative: "a".repeat(120),
      sourceCount: 1,
    });
    expect(gate.passed).toBe(false);
    expect(gate.reason).toContain("for få kilder");
    expect(gate.reason).toContain("for kort innhold");
  });

  it("stryker på for langt innhold også — en vegg av tekst er ikke en modal", () => {
    const gate = evaluatePoiQualityGate({
      narrative: "a".repeat(DEFAULT_POI_QUALITY_THRESHOLDS.maxCharCount + 1),
      sourceCount: 5,
    });
    expect(gate.passed).toBe(false);
    expect(gate.reason).toContain("for langt innhold");
  });

  it("teller trimmet lengde — whitespace er ikke innhold", () => {
    const gate = evaluatePoiQualityGate({
      narrative: `   ${"a".repeat(300)}   `,
      sourceCount: 2,
    });
    expect(gate.charCount).toBe(300);
  });

  it("respekterer overstyrte terskler (kalibreringsverktøyet i Unit 3)", () => {
    const gate = evaluatePoiQualityGate(
      { narrative: "a".repeat(100), sourceCount: 1 },
      { minSourceCount: 1, minCharCount: 50, maxCharCount: 5000 },
    );
    expect(gate.passed).toBe(true);
  });
});

describe("buildPoiGroundingPrompt", () => {
  it("ankrer søket med navn, adresse og område", () => {
    const prompt = buildPoiGroundingPrompt(POI);
    expect(prompt).toContain("Muustrøparken");
    expect(prompt).toContain("Straumen, Inderøy");
    expect(prompt).toContain("Kategori: Park");
  });

  it("POI uten adresse og kategori gir likevel gyldig prompt", () => {
    const prompt = buildPoiGroundingPrompt({ id: "x", name: "Sundsøya" });
    expect(prompt).toContain("Sted: Sundsøya");
    expect(prompt).not.toContain("Kategori:");
    expect(prompt).not.toContain("undefined");
  });

  it("forbyr eksplisitt det Andreas har avvist: årstall, poesi, turist-vinkel, åpningstider", () => {
    const prompt = buildPoiGroundingPrompt(POI);
    expect(prompt).toContain("IKKE årstall");
    expect(prompt).toContain("IKKE byggeår");
    // Modellen skrev «Muusbrua fra 1816» uten dette eksempelet (målt 2026-08-12)
    expect(prompt).toContain("Muusbrua fra 1816");
    expect(prompt).toContain("IKKE poetisk");
    expect(prompt).toContain("Beboer-perspektiv");
    expect(prompt).toContain("IKKE åpningstider");
  });
});

describe("groundPoi — happy path", () => {
  it("returnerer validert generated med resolvede kilder og sanert entry-point", async () => {
    global.fetch = mockFetchOk(geminiResponse({}));

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.provider).toBe("gemini-search-grounding");
    expect(result.generated.narrative).toContain("Muustrøparken");
    expect(result.generated.sources).toHaveLength(2);
    expect(result.generated.sources[0].domain).toBe("trondheim.kommune.no");
    expect(result.generated.sources[0].redirectUrl).toContain("grounding-api-redirect");
    expect(result.generated.searchQueries).toEqual(["Muustrøparken Trondheim"]);
    expect(result.generated.model).toBe("gemini-2.5-flash");
    expect(result.generated.fetchedAt).toBe("2026-08-12T10:00:00.000Z");
    expect(result.generated.qualityGate.passed).toBe(true);
  });

  it("sender per-POI-prompten, ikke den tema-skala buildPrompt()", async () => {
    const fetchMock = mockFetchOk(geminiResponse({}));
    global.fetch = fetchMock;

    await groundPoi(POI, OPTS);

    const body = JSON.parse(
      (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body,
    );
    const sentPrompt = body.contents[0].parts[0].text;
    expect(sentPrompt).toContain("Sted: Muustrøparken");
    // Tema-promptens signatur-linje skal IKKE være med
    expect(sentPrompt).not.toContain("Tema:");
  });

  it("bruker x-goog-api-key-header — nøkkelen skal aldri i URL", async () => {
    const fetchMock = mockFetchOk(geminiResponse({}));
    global.fetch = fetchMock;

    await groundPoi(POI, OPTS);

    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(url)).not.toContain("test-key");
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
  });

  it("returnerer strykere med passed=false i stedet for å feile — de skal lagres", async () => {
    global.fetch = mockFetchOk(
      geminiResponse({
        text: "Kort.",
        chunks: [
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aaa", title: "Kilde A" } },
        ],
      }),
    );

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.qualityGate.passed).toBe(false);
    expect(result.generated.qualityGate.reason).toBeTruthy();
  });
});

describe("«ingen data» og avslags-narrativ", () => {
  it("looksLikeRefusal fanger det faktiske avslaget vi målte 2026-08-12", () => {
    expect(
      looksLikeRefusal(
        "Jeg finner ingen informasjon om en park ved navn Muustrøparken i Bakklandet, Trondheim. Søkene indikerer at Muustrøparken er en skulpturpark som ligger i Straumen, Inderøy kommune.",
      ),
    ).toBe(true);
  });

  it("looksLikeRefusal slår ikke ut på ekte stedsinnhold", () => {
    expect(looksLikeRefusal(NARRATIVE)).toBe(false);
  });

  it("sentinel-svar → ok:false uten å bruke nettverk på URL-resolving", async () => {
    global.fetch = mockFetchOk(geminiResponse({ text: NO_DATA_SENTINEL }));

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("ingen konkrete opplysninger");
    expect(resolveUrlsParallel).not.toHaveBeenCalled();
  });

  it("langt avslags-narrativ → ok:false selv om lengdeterskelen ville passert", async () => {
    const longRefusal =
      "Jeg finner ingen informasjon om dette stedet i søkeresultatene. " +
      "Søkene indikerer at navnet kan referere til flere ulike steder i Norge. ".repeat(6);
    expect(longRefusal.length).toBeGreaterThan(
      DEFAULT_POI_QUALITY_THRESHOLDS.minCharCount,
    );
    global.fetch = mockFetchOk(geminiResponse({ text: longRefusal }));

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("avslags-narrativ");
  });

  it("prompten instruerer sentinelen framfor en forklaring", () => {
    const prompt = buildPoiGroundingPrompt(POI);
    expect(prompt).toContain(NO_DATA_SENTINEL);
    expect(prompt).toContain("Ingen «jeg finner»");
    expect(prompt).toContain("IKKE kjede- eller konseptomtale");
  });
});

describe("kilde-dedup", () => {
  it("samme side sitert flere ganger teller som ÉN kilde", async () => {
    // Tre chunks, to av dem samme underliggende side.
    vi.mocked(resolveUrlsParallel).mockResolvedValueOnce([
      {
        input: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aaa",
        result: { url: "https://visitinnherred.com/x", domain: "visitinnherred.com", redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aaa" },
      },
      {
        input: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/bbb",
        result: { url: "https://visitinnherred.com/x", domain: "visitinnherred.com", redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/bbb" },
      },
      {
        input: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ccc",
        result: { url: "https://inderoy.kommune.no/y", domain: "inderoy.kommune.no", redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ccc" },
      },
    ]);
    global.fetch = mockFetchOk(
      geminiResponse({
        chunks: [
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aaa", title: "A" } },
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/bbb", title: "A igjen" } },
          { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/ccc", title: "B" } },
        ],
      }),
    );

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.sources).toHaveLength(2);
    expect(result.generated.qualityGate.sourceCount).toBe(2);
  });
});

describe("groundPoi — sanering og ToS", () => {
  it("fjerner <script> fra entry-point-HTML før retur (saneringen ER i kjeden)", async () => {
    global.fetch = mockFetchOk(
      geminiResponse({
        entryPoint:
          '<style>.chip{color:red}</style><script>alert("xss")</script><div class="chip">søk</div>',
      }),
    );

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.searchEntryPointHtml).not.toContain("<script");
    expect(result.generated.searchEntryPointHtml).not.toContain("alert(");
    expect(result.generated.searchEntryPointHtml).toContain("chip");
  });

  it("mangler searchEntryPoint → ok:false (ToS: ingen attribusjon, ingen visning)", async () => {
    global.fetch = mockFetchOk(geminiResponse({ entryPoint: null }));

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/searchEntryPoint|shape invalid/i);
  });

  it("entry-point som saneres til tom streng → ok:false", async () => {
    global.fetch = mockFetchOk(
      geminiResponse({ entryPoint: '<script>alert("bare xss")</script>' }),
    );

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(false);
  });
});

describe("groundPoi — feilstier (kaster aldri)", () => {
  it("mangler groundingMetadata → ok:false", async () => {
    global.fetch = mockFetchOk(geminiResponse({ omitGroundingMetadata: true }));
    const result = await groundPoi(POI, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBeTruthy();
  });

  it("tomt narrativ → ok:false", async () => {
    global.fetch = mockFetchOk(geminiResponse({ text: "   " }));
    const result = await groundPoi(POI, OPTS);
    expect(result.ok).toBe(false);
  });

  it("HTTP-feil fra Gemini → ok:false, ingen kast", async () => {
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 429,
      text: async () => "quota exceeded",
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const result = await groundPoi(POI, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("429");
  });

  it("nettverksfeil/timeout → ok:false, ingen kast", async () => {
    global.fetch = vi.fn(async () => {
      throw new Error("The operation was aborted");
    }) as unknown as typeof fetch;

    const result = await groundPoi(POI, OPTS);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("aborted");
  });

  it("POI uten navn → ok:false uten å bruke Gemini-kvote", async () => {
    const fetchMock = mockFetchOk(geminiResponse({}));
    global.fetch = fetchMock;

    const result = await groundPoi({ id: "x", name: "  " }, OPTS);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("feilet URL-resolve beholder kilden med redirect-URL som fallback", async () => {
    vi.mocked(resolveUrlsParallel).mockResolvedValueOnce([
      {
        input: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/aaa",
        result: new Error("SSRF blocked"),
      },
      {
        input: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/bbb",
        result: {
          url: "https://trondheim.kommune.no/x",
          domain: "trondheim.kommune.no",
          redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/bbb",
        },
      },
    ]);
    global.fetch = mockFetchOk(geminiResponse({}));

    const result = await groundPoi(POI, OPTS);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.sources).toHaveLength(2);
    const fallback = result.generated.sources[0];
    expect(fallback.url).toContain("grounding-api-redirect");
    expect(fallback.domain).toBe("vertexaisearch.cloud.google.com");
  });
});
