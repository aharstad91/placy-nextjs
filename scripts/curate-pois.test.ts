import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildCandidate,
  buildStagingFile,
  classifyMissing,
  extractFacts,
  mergeCurated,
  parseGroundingLoose,
  parseStagingForWrite,
  sortCandidates,
  validateNarrative,
  MAX_NARRATIVE_CHARS,
  MIN_NARRATIVE_CHARS,
  type CurationCandidate,
  type CurationCandidateInput,
} from "./curate-pois-lib";
import { PoiGroundingViewSchema, type PoiGrounding } from "../lib/types";

// ─── Fixtures ───────────────────────────────────────────────────────────────

function generated(passed: boolean, sourceCount = 1, narrative = "n".repeat(242)): PoiGrounding {
  return {
    poiGroundingVersion: 1,
    generated: {
      provider: "gemini-search-grounding",
      narrative,
      sources: [],
      searchEntryPointHtml: "<div>chip</div>",
      searchQueries: [],
      model: "gemini-2.5-flash",
      fetchedAt: "2026-08-12T10:00:00.000Z",
      qualityGate: {
        passed,
        sourceCount,
        charCount: narrative.length,
        ...(passed ? {} : { reason: "for få kilder" }),
      },
    },
  };
}

function row(overrides: Partial<CurationCandidateInput> = {}): CurationCandidateInput {
  return {
    id: "google-abc",
    name: "Gallo Nero",
    address: "Vennesborgvegen 17, Inderøy",
    category_id: "butikk",
    grounding: null,
    google_rating: null,
    google_review_count: null,
    google_phone: null,
    google_website: null,
    opening_hours_json: null,
    ...overrides,
  };
}

// ─── classifyMissing ────────────────────────────────────────────────────────

describe("classifyMissing", () => {
  it("kuratert tekst → ferdig, aldri tilbake på lista", () => {
    const g: PoiGrounding = {
      poiGroundingVersion: 1,
      curated: { narrative: "Offentlig tannklinikk …", curatedAt: "2026-08-13T00:00:00.000Z" },
    };
    expect(classifyMissing({ name: "Tannklinikk", grounding: g })).toEqual({
      needsText: false,
      reason: "har-kuratert-tekst",
    });
  });

  /**
   * Normaltilstanden for et servicested vi har skrevet selv: Gemini fant
   * ingenting (lastAttempt) OG vi skrev teksten (curated). Uten denne testen
   * kunne en refaktorering lett gjort at slike POI-er dukket opp igjen på lista
   * hver gang, og kurator ville skrevet samme tekst på nytt.
   */
  it("BÅDE tomt forsøk og kuratert tekst → ferdig (curated vinner)", () => {
    const g: PoiGrounding = {
      poiGroundingVersion: 1,
      lastAttempt: { at: "2026-08-12T10:00:00.000Z", outcome: "no-data", reason: "ingenting" },
      curated: { narrative: "Offentlig tannklinikk …", curatedAt: "2026-08-13T00:00:00.000Z" },
    };
    const c = classifyMissing({ name: "Tannklinikk", grounding: g });
    expect(c.needsText).toBe(false);
  });

  // Policy-endring 2026-08-15: bestått leverandør-tekst er IKKE dekning. Denne
  // testen pinnet den gamle regelen som fasit og er snudd med vilje — det er
  // eier-beslutningen «vi skal eie innholdet», ikke en regresjon.
  it("bestått leverandør-tekst → trenger LIKEVEL vår tekst (lånt er ikke Moat 1)", () => {
    const c = classifyMissing({
      name: "Muustrøparken",
      grounding: generated(true, 4, "Park langs Nidelva."),
    });
    expect(c.needsText).toBe(true);
    if (!c.needsText) return;
    expect(c.why).toBe("har-leverandørtekst");
    expect(c.detail).toContain("4 kilder,");
    expect(c.detail).toContain("lånt");
    expect(c.providerDraft).toBe("Park langs Nidelva.");
  });

  it("strøket leverandør-tekst → trenger tekst, med narrativet som råstoff", () => {
    const c = classifyMissing({ name: "Gallo Nero", grounding: generated(false, 1, "Vintage-butikk.") });
    expect(c.needsText).toBe(true);
    if (!c.needsText) return;
    expect(c.why).toBe("strøk-porten");
    expect(c.detail).toContain("1 kilde,");
    expect(c.providerDraft).toBe("Vintage-butikk.");
  });

  it("kildene følger med som råstoff, uten redirect-URLen", () => {
    const g = generated(true, 2, "Utkast.");
    g.generated!.sources = [
      {
        title: "Ranheim skole",
        url: "https://trondheim.kommune.no/ranheim-skole/",
        redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc",
        domain: "trondheim.kommune.no",
      },
    ];
    const c = classifyMissing({ name: "Ranheim skole", grounding: g });
    if (!c.needsText) throw new Error("skulle trengt tekst");
    expect(c.sources).toEqual([
      {
        title: "Ranheim skole",
        url: "https://trondheim.kommune.no/ranheim-skole/",
        domain: "trondheim.kommune.no",
      },
    ]);
  });

  it("tom kildeliste gir ikke et tomt sources-felt i staging-fila", () => {
    const c = classifyMissing({ name: "X", grounding: generated(true, 0, "Utkast.") });
    if (!c.needsText) throw new Error("skulle trengt tekst");
    expect(c.sources).toBeUndefined();
  });

  it("kuratert tekst slår bestått leverandør-tekst — ferdig er ferdig", () => {
    const g = generated(true, 4, "Leverandørens utkast.");
    const c = classifyMissing({
      name: "Muustrøparken",
      grounding: { ...g, curated: { narrative: "Vår egen tekst om parken.", curatedAt: "2026-08-15T00:00:00.000Z" } },
    });
    expect(c).toEqual({ needsText: false, reason: "har-kuratert-tekst" });
  });

  it("flertallsform på kilder når det er mer enn én", () => {
    const c = classifyMissing({ name: "X", grounding: generated(false, 3) });
    if (!c.needsText) return;
    expect(c.detail).toContain("3 kilder,");
  });

  it("no-data-forsøk → trenger tekst, med Geminis grunn", () => {
    const g: PoiGrounding = {
      poiGroundingVersion: 1,
      lastAttempt: { at: "2026-08-12T10:00:00.000Z", outcome: "no-data", reason: "fant ingenting" },
    };
    const c = classifyMissing({ name: "Nilsparken", grounding: g });
    expect(c.needsText).toBe(true);
    if (!c.needsText) return;
    expect(c.why).toBe("no-data");
    expect(c.detail).toBe("fant ingenting");
  });

  it("error-forsøk → egen kategori (teknisk, ikke kurator-arbeid)", () => {
    const g: PoiGrounding = {
      poiGroundingVersion: 1,
      lastAttempt: { at: "2026-08-12T10:00:00.000Z", outcome: "error", reason: "timeout" },
    };
    const c = classifyMissing({ name: "X", grounding: g });
    if (!c.needsText) return;
    expect(c.why).toBe("error");
  });

  it("ingen grounding i det hele tatt → ingen-forsøk", () => {
    const c = classifyMissing({ name: "Studio F", grounding: undefined });
    expect(c.needsText).toBe(true);
    if (!c.needsText) return;
    expect(c.why).toBe("ingen-forsøk");
  });

  it("POI uten navn hoppes over — det finnes ingen tekst å skrive om «»", () => {
    expect(classifyMissing({ name: "   ", grounding: undefined })).toEqual({
      needsText: false,
      reason: "mangler-navn",
    });
  });
});

// ─── parseGroundingLoose ────────────────────────────────────────────────────

describe("parseGroundingLoose", () => {
  it("null → ingen grounding, ikke ugyldig", () => {
    expect(parseGroundingLoose(null)).toEqual({ invalid: false });
  });

  it("gyldig objekt parses", () => {
    const { grounding, invalid } = parseGroundingLoose(generated(true, 3));
    expect(invalid).toBe(false);
    expect(grounding?.generated?.qualityGate.passed).toBe(true);
  });

  it("ugyldig shape flagges — POI-en havner på lista, men vi vet hvorfor", () => {
    const { grounding, invalid } = parseGroundingLoose({ poiGroundingVersion: 99 });
    expect(invalid).toBe(true);
    expect(grounding).toBeUndefined();
  });
});

// ─── extractFacts ───────────────────────────────────────────────────────────

describe("extractFacts", () => {
  it("plukker ut det vi alt eier", () => {
    const f = extractFacts(
      row({
        opening_hours_json: { periods: [] },
        google_phone: "74 17 48 88",
        google_website: "https://x.no",
        google_rating: 4.8,
        google_review_count: 17,
      }),
    );
    expect(f).toEqual({
      hasOpeningHours: true,
      hasPhone: true,
      website: "https://x.no",
      rating: 4.8,
      reviewCount: 17,
    });
  });

  it("utelater felt som mangler i stedet for å sette null", () => {
    const f = extractFacts(row());
    expect(f).toEqual({ hasOpeningHours: false, hasPhone: false });
    expect("rating" in f).toBe(false);
  });

  /** PostgREST kan levere numeric som streng — rating må bli et tall. */
  it("normaliserer rating til number", () => {
    const f = extractFacts(row({ google_rating: "5.0" as unknown as number }));
    expect(f.rating).toBe(5);
  });
});

// ─── Sortering ──────────────────────────────────────────────────────────────

describe("sortCandidates", () => {
  function cand(over: Partial<CurationCandidate>): CurationCandidate {
    return {
      id: over.id ?? "x",
      name: over.name ?? "X",
      why: over.why ?? "no-data",
      detail: "",
      facts: over.facts ?? { hasOpeningHours: false, hasPhone: false },
      narrative: "",
      ...over,
    };
  }

  it("strøk-porten først (raskest å skrive — råstoff finnes)", () => {
    const sorted = sortCandidates([
      cand({ id: "a", why: "ingen-forsøk" }),
      cand({ id: "b", why: "strøk-porten" }),
      cand({ id: "c", why: "no-data" }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("error sist blant de reelle årsakene (teknisk, ikke kurator-arbeid)", () => {
    const sorted = sortCandidates([
      cand({ id: "a", why: "error" }),
      cand({ id: "b", why: "no-data" }),
    ]);
    expect(sorted[0].id).toBe("b");
  });

  /**
   * Holdeplasser skal ligge sist UANSETT årsak. En holdeplass som strøk porten
   * er fortsatt en holdeplass — sanntidsavgangene er svaret, ikke en tekst.
   */
  it("holdeplasser sorteres sist selv når årsaken ellers rangerer først", () => {
    const sorted = sortCandidates([
      cand({ id: "stop", why: "strøk-porten", realtimeAnswersIt: true }),
      cand({ id: "park", why: "ingen-forsøk" }),
    ]);
    expect(sorted.map((c) => c.id)).toEqual(["park", "stop"]);
  });

  it("innenfor samme årsak: mest Google-fakta først (mest råstoff)", () => {
    const sorted = sortCandidates([
      cand({ id: "tom", name: "A", facts: { hasOpeningHours: false, hasPhone: false } }),
      cand({
        id: "rik",
        name: "B",
        facts: { hasOpeningHours: true, hasPhone: true, website: "https://x.no", rating: 4 },
      }),
    ]);
    expect(sorted[0].id).toBe("rik");
  });

  it("er stabil på navn når alt annet er likt — samme fil-rekkefølge mellom kjøringer", () => {
    const sorted = sortCandidates([cand({ id: "b", name: "Øst" }), cand({ id: "a", name: "Ask" })]);
    expect(sorted.map((c) => c.name)).toEqual(["Ask", "Øst"]);
  });

  it("muterer ikke input-arrayen", () => {
    const input = [cand({ id: "a", why: "ingen-forsøk" }), cand({ id: "b", why: "strøk-porten" })];
    sortCandidates(input);
    expect(input.map((c) => c.id)).toEqual(["a", "b"]);
  });
});

// ─── buildCandidate ─────────────────────────────────────────────────────────

describe("buildCandidate", () => {
  it("markerer bussholdeplass som sanntids-besvart", () => {
    const c = buildCandidate(
      row({ id: "bus-1", name: "Straumen bussholdeplass", category_id: "bus" }),
      { needsText: true, why: "ingen-forsøk", detail: "" },
      "Buss",
    );
    expect(c.realtimeAnswersIt).toBe(true);
  });

  it("markerer IKKE en vanlig kategori", () => {
    const c = buildCandidate(row(), { needsText: true, why: "no-data", detail: "" }, "Butikk");
    expect(c.realtimeAnswersIt).toBeUndefined();
  });

  it("starter med tom narrative — kurator fyller den", () => {
    const c = buildCandidate(row(), { needsText: true, why: "no-data", detail: "" });
    expect(c.narrative).toBe("");
  });

  it("trimmer navnet", () => {
    const c = buildCandidate(
      row({ name: "  Gallo Nero  " }),
      { needsText: true, why: "no-data", detail: "" },
    );
    expect(c.name).toBe("Gallo Nero");
  });
});

// ─── validateNarrative ──────────────────────────────────────────────────────

describe("validateNarrative", () => {
  const OK =
    "Offentlig tannklinikk i samme bygg som rådhuset. Den offentlige tannhelsetjenesten prioriterer barn og unge, og tar voksne betalende pasienter ved kapasitet.";

  it("godtar en tekst som følger reglene", () => {
    expect(validateNarrative("p1", OK)).toEqual([]);
  });

  it("avviser for kort tekst", () => {
    const issues = validateNarrative("p1", "Kort.");
    expect(issues).toHaveLength(1);
    expect(issues[0].problem).toContain("for kort");
  });

  it("avviser for lang tekst", () => {
    const issues = validateNarrative("p1", "a".repeat(MAX_NARRATIVE_CHARS + 1));
    expect(issues[0].problem).toContain("for lang");
  });

  /**
   * Årstall er regelen som brytes oftest — curator-skillens historisk-form er
   * modellens default, og Andreas har ratifisert presens. Derfor mekanisk sperre,
   * ikke bare en kommentar noen skal huske.
   */
  it("avviser årstall — tekst-regel 1 er presens", () => {
    const issues = validateNarrative(
      "p1",
      "Kirken fra 1858 ligger midt i sentrum og brukes til gudstjenester og konserter gjennom hele året.",
    );
    expect(issues.some((i) => i.problem.includes("1858"))).toBe(true);
  });

  it("tar ikke husnummer eller mengder for årstall", () => {
    const text =
      "Dagligvarebutikk på Nessjordet med apotekutlevering i samme bygg. Butikken har 120 parkeringsplasser og ligger ved rundkjøringen.";
    expect(validateNarrative("p1", text)).toEqual([]);
  });

  /**
   * Kjent falsk positiv, dokumentert med vilje: et firesifret tall i 1600–2099
   * flagges uansett hva det betyr. «2000 kvadratmeter» blir avvist. Alternativet
   * — å prøve å skille år fra mengde — ville sluppet gjennom det regelen finnes
   * for. Meldingen navngir tallet, så kurator kan omformulere.
   */
  it("flagger firesifrede mengder også (bevisst falsk positiv, ikke en bug)", () => {
    const issues = validateNarrative(
      "p1",
      "Idrettsanlegget har en kunstgressbane på 2000 kvadratmeter og garderober i samme bygg som klubbhuset.",
    );
    expect(issues.some((i) => i.problem.includes("2000"))).toBe(true);
  });

  it("teller på trimmet tekst — whitespace er ikke innhold", () => {
    const issues = validateNarrative("p1", `   ${"a".repeat(MIN_NARRATIVE_CHARS - 1)}   `);
    expect(issues[0].problem).toContain("for kort");
  });
});

// ─── mergeCurated ───────────────────────────────────────────────────────────

describe("mergeCurated", () => {
  it("bevarer leverandør-laget — provider-swappen skal fortsatt være mulig", () => {
    const merged = mergeCurated(generated(false, 1), "Vår egen tekst om stedet.", "2026-08-13T00:00:00.000Z");
    expect(merged.generated?.provider).toBe("gemini-search-grounding");
    expect(merged.curated?.narrative).toBe("Vår egen tekst om stedet.");
  });

  it("bevarer lastAttempt — dokumentasjonen på HVORFOR noen skrev teksten", () => {
    const existing: PoiGrounding = {
      poiGroundingVersion: 1,
      lastAttempt: { at: "2026-08-12T10:00:00.000Z", outcome: "no-data", reason: "fant ingenting" },
    };
    const merged = mergeCurated(existing, "Vår tekst.", "2026-08-13T00:00:00.000Z");
    expect(merged.lastAttempt?.outcome).toBe("no-data");
  });

  it("trimmer narrativet", () => {
    const merged = mergeCurated(undefined, "  Vår tekst.  ", "2026-08-13T00:00:00.000Z");
    expect(merged.curated?.narrative).toBe("Vår tekst.");
  });

  it("resultatet validerer mot lesestiens skjema", () => {
    const merged = mergeCurated(generated(true, 3), "Vår tekst.", "2026-08-13T00:00:00.000Z");
    expect(PoiGroundingViewSchema.safeParse(merged).success).toBe(true);
  });

  it("erstatter en eksisterende kuratert tekst (redigering er lov)", () => {
    const existing: PoiGrounding = {
      poiGroundingVersion: 1,
      curated: { narrative: "Gammel tekst.", curatedAt: "2026-08-01T00:00:00.000Z" },
    };
    const merged = mergeCurated(existing, "Ny tekst.", "2026-08-13T00:00:00.000Z");
    expect(merged.curated?.narrative).toBe("Ny tekst.");
    expect(merged.curated?.curatedAt).toBe("2026-08-13T00:00:00.000Z");
  });
});

// ─── parseStagingForWrite ───────────────────────────────────────────────────

describe("parseStagingForWrite", () => {
  const GOOD =
    "Offentlig tannklinikk i samme bygg som rådhuset. Tjenesten prioriterer barn og unge, og tar voksne betalende pasienter ved kapasitet.";

  it("plukker ut kun radene med utfylt tekst", () => {
    const res = parseStagingForWrite({
      projectId: "placy-demo_sundsoya",
      pois: [
        { id: "a", narrative: GOOD },
        { id: "b", narrative: "" },
        { id: "c", narrative: "   " },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.toWrite).toEqual([{ id: "a", narrative: GOOD }]);
    expect(res.skipped).toBe(2);
  });

  /**
   * Alt valideres FØR noe skrives. En fil med én ulovlig tekst skal ikke skrive
   * de andre halvveis — da vet ingen hvilken tilstand basen er i.
   */
  it("én ulovlig tekst stopper HELE fila", () => {
    const res = parseStagingForWrite({
      projectId: "p_1",
      pois: [
        { id: "a", narrative: GOOD },
        { id: "b", narrative: "for kort" },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors[0]).toContain("b:");
  });

  it("avviser duplikate IDer — hvilken tekst skulle vunnet?", () => {
    const res = parseStagingForWrite({
      projectId: "p_1",
      pois: [
        { id: "a", narrative: GOOD },
        { id: "a", narrative: GOOD },
      ],
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.errors.some((e) => e.includes("duplikat"))).toBe(true);
  });

  it("avviser fil uten projectId", () => {
    const res = parseStagingForWrite({ pois: [] });
    expect(res.ok).toBe(false);
  });

  it("avviser fil uten pois-array", () => {
    const res = parseStagingForWrite({ projectId: "p_1" });
    expect(res.ok).toBe(false);
  });

  it("avviser noe som ikke er et objekt", () => {
    expect(parseStagingForWrite("nei").ok).toBe(false);
    expect(parseStagingForWrite(null).ok).toBe(false);
  });

  it("godtar heterogene POI-IDer (aldri .uuid() på POI-IDer)", () => {
    const res = parseStagingForWrite({
      projectId: "p_1",
      pois: [
        { id: "google-ChIJe2pnuSJibUYRqz4D6mc_JdM", narrative: GOOD },
        { id: "osm-node-507054412", narrative: GOOD },
        { id: "entur-NSR-StopPlace-271", narrative: GOOD },
      ],
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.toWrite).toHaveLength(3);
  });
});

// ─── buildStagingFile ───────────────────────────────────────────────────────

describe("buildStagingFile", () => {
  it("legger tekstreglene i selve fila — kurator leser dem der, ikke i et skill", () => {
    const file = buildStagingFile("p_1", [], "2026-08-13T00:00:00.000Z");
    expect(file.tekstregler.length).toBeGreaterThan(3);
    expect(file.tekstregler.join(" ")).toContain("Presens");
  });

  it("dokumenterer at funksjon ER lov — grunnen til at lista finnes", () => {
    const file = buildStagingFile("p_1", [], "2026-08-13T00:00:00.000Z");
    expect(file.tekstregler.join(" ")).toContain("Funksjon");
  });

  it("en fil som går ut igjennom parseStagingForWrite gir 0 å skrive", () => {
    const file = buildStagingFile(
      "p_1",
      [
        {
          id: "a",
          name: "X",
          why: "no-data",
          detail: "",
          facts: { hasOpeningHours: false, hasPhone: false },
          narrative: "",
        },
      ],
      "2026-08-13T00:00:00.000Z",
    );
    const res = parseStagingForWrite(JSON.parse(JSON.stringify(file)));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.toWrite).toHaveLength(0);
    expect(res.skipped).toBe(1);
  });
});

// ─── Kilde-vakter ───────────────────────────────────────────────────────────

describe("kilde-vakter for CLI-en", () => {
  const src = readFileSync(join(process.cwd(), "scripts", "curate-pois.ts"), "utf8");

  it("skriver KUN grounding-kolonnen — ingen naboer i raden røres", () => {
    expect(src).toContain("JSON.stringify({ grounding: p.next })");
  });

  it("har optimistisk lås på updated_at", () => {
    expect(src).toContain('url.searchParams.set("updated_at"');
  });

  it("dry run er default — --yes kreves for å skrive", () => {
    expect(src).toContain('const APPLY = args.includes("--yes")');
    expect(src).toMatch(/if \(!APPLY\)[\s\S]{0,200}DRY RUN/);
  });

  it("maskerer revalidate-secret i logg", () => {
    expect(src).toContain('replace(/([?&]secret=)[^&]*/, "$1***")');
  });

  it("validerer mot lesestiens skjema før write", () => {
    expect(src).toContain("PoiGroundingViewSchema.safeParse(p.next)");
  });

  it("tar backup før write", () => {
    expect(src).toMatch(/Backup FØR alt/);
  });
});
