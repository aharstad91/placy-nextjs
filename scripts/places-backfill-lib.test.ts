import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildOpeningHoursPatch,
  collectGalleryImages,
  collectOpeningHours,
  fetchScopedPois,
  formatSummary,
  OPENING_HOURS_LANGUAGE,
  parseMode,
  parseScope,
  patchPoi,
  QuotaAbort,
  verifyWritten,
  writeFacts,
  type GalleryPoiRow,
  type OpeningHoursPoiRow,
  type SupabaseCtx,
} from "./places-backfill-lib";
import { PlacesApiError } from "../lib/google-places/errors";
import { OPENING_HOURS_FIELDS } from "../lib/google-places/fetch-place-details";

/** Ingen ekte venting mellom batcher i test. */
const noSleep = () => Promise.resolve();

function hoursPoi(over: Partial<OpeningHoursPoiRow> = {}): OpeningHoursPoiRow {
  return {
    id: "google-ChIJtest",
    name: "Testkafé",
    google_place_id: "ChIJtest",
    opening_hours_json: null,
    ...over,
  };
}

function galleryPoi(over: Partial<GalleryPoiRow> = {}): GalleryPoiRow {
  return {
    id: "google-ChIJtest",
    name: "Testkafé",
    google_place_id: "ChIJtest",
    gallery_images: null,
    ...over,
  };
}

const WEEKDAYS_EN = [
  "Monday: 8:00 AM – 5:00 PM",
  "Tuesday: 8:00 AM – 5:00 PM",
  "Wednesday: 8:00 AM – 5:00 PM",
  "Thursday: 8:00 AM – 5:00 PM",
  "Friday: 8:00 AM – 4:00 PM",
  "Saturday: Closed",
  "Sunday: Closed",
];

// ───────────────────────────────────────────────────────────────────────────
// Arg-parsing
// ───────────────────────────────────────────────────────────────────────────

describe("parseScope — scope er påkrevd (kostnadsvern)", () => {
  it("uten scope → feil som nevner alle tre flaggene", () => {
    const r = parseScope([]);
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toMatch(/--project/);
    expect((r as { error: string }).error).toMatch(/--area/);
    expect((r as { error: string }).error).toMatch(/--all/);
  });

  it("--project med gyldig ID", () => {
    expect(parseScope(["--project", "placy-demo_sundsoya"])).toEqual({
      scope: { kind: "project", projectId: "placy-demo_sundsoya" },
    });
  });

  it("--project med ugyldig ID-form avvises (ville ellers gitt 0 POI-er stille)", () => {
    const r = parseScope(["--project", "Sundsøya"]);
    expect(r).toHaveProperty("error");
    expect((r as { error: string }).error).toMatch(/customer.*slug/i);
  });

  it("--project uten verdi avvises", () => {
    expect(parseScope(["--project", "--apply"])).toHaveProperty("error");
    expect(parseScope(["--project"])).toHaveProperty("error");
  });

  it("to scopes samtidig avvises", () => {
    expect(parseScope(["--all", "--area", "ranheim"])).toHaveProperty("error");
  });

  it("--all og --area virker", () => {
    expect(parseScope(["--all"])).toEqual({ scope: { kind: "all" } });
    expect(parseScope(["--area", "ranheim"])).toEqual({
      scope: { kind: "area", areaSlug: "ranheim" },
    });
  });
});

describe("parseMode — dry-run er default", () => {
  it("uten flagg → apply: false", () => {
    expect(parseMode([])).toEqual({ apply: false, force: false, limit: undefined });
  });

  it("--apply --force --limit 5", () => {
    expect(parseMode(["--apply", "--force", "--limit", "5"])).toEqual({
      apply: true,
      force: true,
      limit: 5,
    });
  });

  it("ugyldig --limit avvises", () => {
    expect(parseMode(["--limit", "0"])).toHaveProperty("error");
    expect(parseMode(["--limit", "tolv"])).toHaveProperty("error");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PATCH-payload for åpningstider
// ───────────────────────────────────────────────────────────────────────────

describe("buildOpeningHoursPatch", () => {
  it("skriver weekday_text + tidsstempel + telefon", () => {
    const { patch, summary } = buildOpeningHoursPatch(null, {
      openingHours: WEEKDAYS_EN,
      phone: "+47 12 34 56 78",
    });
    expect(patch.opening_hours_json).toEqual({ weekday_text: WEEKDAYS_EN });
    expect(patch.google_phone).toBe("+47 12 34 56 78");
    expect(patch.opening_hours_updated_at).toBeTypeOf("string");
    expect(summary).toBe("7 dager, telefon");
  });

  it("jsonb: slår SAMMEN med eksisterende nøkler i stedet for å overskrive dem", () => {
    const { patch } = buildOpeningHoursPatch(
      { weekday_text: ["gammel"], special_days: ["17. mai"] },
      { openingHours: WEEKDAYS_EN },
    );
    expect(patch.opening_hours_json).toEqual({
      special_days: ["17. mai"],
      weekday_text: WEEKDAYS_EN,
    });
  });

  it("park uten åpningstider → opening_hours_json settes IKKE (ingen tom-verdi lagres)", () => {
    const { patch } = buildOpeningHoursPatch(null, { phone: "+47 99 88 77 66" });
    expect(patch).not.toHaveProperty("opening_hours_json");
    expect(patch).not.toHaveProperty("opening_hours_updated_at");
    expect(patch.google_phone).toBe("+47 99 88 77 66");
  });

  it("tom weekdayDescriptions-liste teller som ingen åpningstider", () => {
    const { patch } = buildOpeningHoursPatch(null, { openingHours: [] });
    expect(patch).not.toHaveProperty("opening_hours_json");
  });

  it("verken tider eller telefon → tom patch (kalleren teller den som noData)", () => {
    expect(buildOpeningHoursPatch(null, {}).patch).toEqual({});
  });
});

// ───────────────────────────────────────────────────────────────────────────
// collectOpeningHours
// ───────────────────────────────────────────────────────────────────────────

describe("collectOpeningHours", () => {
  it("happy path: åpningstider + telefon samles til en patch", async () => {
    const fetchDetails = vi.fn(async () => ({
      openingHours: WEEKDAYS_EN,
      phone: "+47 11 22 33 44",
    }));

    const result = await collectOpeningHours([hoursPoi()], {
      apiKey: "k",
      fetchDetails,
      sleep: noSleep,
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].patch.opening_hours_json).toEqual({ weekday_text: WEEKDAYS_EN });
    expect(result.apiCalls).toBe(1);
  });

  it("SPRÅK-KONTRAKT: ber om engelsk og bruker det snevre feltsettet", async () => {
    const fetchDetails = vi.fn(async () => ({ openingHours: WEEKDAYS_EN }));

    await collectOpeningHours([hoursPoi()], { apiKey: "hemmelig", fetchDetails, sleep: noSleep });

    expect(fetchDetails).toHaveBeenCalledWith("ChIJtest", "hemmelig", OPENING_HOURS_FIELDS, {
      languageCode: "en",
    });
    expect(OPENING_HOURS_LANGUAGE).toBe("en");
  });

  it("engelske dagsnavn er formen konsumentene matcher på", async () => {
    // computeIsOpen (lib/hooks/useOpeningHours.ts) og MapPopupCard matcher begge
    // på engelske dagsnavn OG AM/PM-klokke. Norsk output ville slått av
    // åpent/stengt-merket stille.
    const fetchDetails = vi.fn(async () => ({ openingHours: WEEKDAYS_EN }));
    const result = await collectOpeningHours([hoursPoi()], {
      apiKey: "k",
      fetchDetails,
      sleep: noSleep,
    });
    const stored = result.facts[0].patch.opening_hours_json as { weekday_text: string[] };
    expect(stored.weekday_text[0]).toMatch(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):/,
    );
  });

  it("POI uten google_place_id hoppes over, telles og koster 0 API-kall", async () => {
    const fetchDetails = vi.fn();
    const result = await collectOpeningHours(
      [hoursPoi({ id: "bhf-1", name: "Barnehage", google_place_id: null })],
      { apiKey: "k", fetchDetails: fetchDetails as never, sleep: noSleep },
    );

    expect(result.skippedNoPlaceId).toEqual([{ id: "bhf-1", name: "Barnehage" }]);
    expect(result.facts).toHaveLength(0);
    expect(result.apiCalls).toBe(0);
    expect(fetchDetails).not.toHaveBeenCalled();
  });

  it("park uten åpningstider hos Google → noData, ingenting skrives", async () => {
    const fetchDetails = vi.fn(async () => ({}));
    const result = await collectOpeningHours([hoursPoi({ name: "Muustrøparken" })], {
      apiKey: "k",
      fetchDetails,
      sleep: noSleep,
    });

    expect(result.facts).toHaveLength(0);
    expect(result.noData).toEqual([{ id: "google-ChIJtest", name: "Muustrøparken" }]);
  });

  it("404 (utdatert place_id) → POI hoppes over, batchen fortsetter", async () => {
    const fetchDetails = vi.fn(async (placeId: string) =>
      placeId === "ChIJdød" ? null : { openingHours: WEEKDAYS_EN },
    );

    const result = await collectOpeningHours(
      [
        hoursPoi({ id: "a", name: "Død POI", google_place_id: "ChIJdød" }),
        hoursPoi({ id: "b", name: "Levende POI", google_place_id: "ChIJlev" }),
      ],
      { apiKey: "k", fetchDetails: fetchDetails as never, sleep: noSleep },
    );

    expect(result.notFound).toEqual([{ id: "a", name: "Død POI" }]);
    expect(result.facts.map((f) => f.poiId)).toEqual(["b"]);
    expect(result.apiCalls).toBe(2);
  });

  it("500 er transient → telles som feil, batchen fortsetter", async () => {
    const fetchDetails = vi.fn(async (placeId: string) => {
      if (placeId === "ChIJfeil") throw new PlacesApiError(500);
      return { openingHours: WEEKDAYS_EN };
    });

    const result = await collectOpeningHours(
      [
        hoursPoi({ id: "a", name: "Feiler", google_place_id: "ChIJfeil" }),
        hoursPoi({ id: "b", name: "Virker", google_place_id: "ChIJok" }),
      ],
      { apiKey: "k", fetchDetails: fetchDetails as never, sleep: noSleep },
    );

    expect(result.failed).toHaveLength(1);
    expect(result.facts.map((f) => f.poiId)).toEqual(["b"]);
  });

  for (const status of [403, 429]) {
    it(`${status} → QuotaAbort med tydelig melding, INGEN facts å skrive`, async () => {
      const fetchDetails = vi.fn(async () => {
        throw new PlacesApiError(status);
      });

      const pois = Array.from({ length: 10 }, (_, i) =>
        hoursPoi({ id: `p${i}`, name: `POI ${i}`, google_place_id: `ChIJ${i}` }),
      );

      const err = await collectOpeningHours(pois, {
        apiKey: "k",
        fetchDetails: fetchDetails as never,
        batchSize: 5,
        sleep: noSleep,
      }).catch((e) => e);

      expect(err).toBeInstanceOf(QuotaAbort);
      expect((err as QuotaAbort).status).toBe(status);
      expect((err as QuotaAbort).message).toMatch(/avbrutt FØR/);
      expect((err as QuotaAbort).partial.facts).toHaveLength(0);
      // Aborterer etter FØRSTE batch — ikke etter alle 10.
      expect(fetchDetails.mock.calls.length).toBeLessThanOrEqual(5);
    });
  }

  it("kvotefeil aborterer selv om andre POI-er i samme batch lyktes", async () => {
    const fetchDetails = vi.fn(async (placeId: string) => {
      if (placeId === "ChIJkvote") throw new PlacesApiError(429);
      return { openingHours: WEEKDAYS_EN };
    });

    const err = await collectOpeningHours(
      [
        hoursPoi({ id: "a", name: "Ok", google_place_id: "ChIJok" }),
        hoursPoi({ id: "b", name: "Kvote", google_place_id: "ChIJkvote" }),
      ],
      { apiKey: "k", fetchDetails: fetchDetails as never, sleep: noSleep },
    ).catch((e) => e);

    expect(err).toBeInstanceOf(QuotaAbort);
    // Én POI lyktes, men ingenting skrives — halvferdig board er verre enn null.
    expect((err as QuotaAbort).partial.facts).toHaveLength(1);
  });

  it("POI med eksisterende åpningstider hoppes over uten API-kall (idempotens)", async () => {
    const fetchDetails = vi.fn();
    const result = await collectOpeningHours(
      [hoursPoi({ opening_hours_json: { weekday_text: WEEKDAYS_EN } })],
      { apiKey: "k", fetchDetails: fetchDetails as never, sleep: noSleep },
    );

    expect(fetchDetails).not.toHaveBeenCalled();
    expect(result.apiCalls).toBe(0);
    expect(result.noData).toHaveLength(1);
  });

  it("skipExisting: false (--force) henter på nytt", async () => {
    const fetchDetails = vi.fn(async () => ({ openingHours: WEEKDAYS_EN }));
    const result = await collectOpeningHours(
      [hoursPoi({ opening_hours_json: { weekday_text: ["gammel"] } })],
      { apiKey: "k", fetchDetails, skipExisting: false, sleep: noSleep },
    );

    expect(fetchDetails).toHaveBeenCalledTimes(1);
    expect(result.facts).toHaveLength(1);
  });

  it("--limit N behandler kun N POI-er", async () => {
    const fetchDetails = vi.fn(async () => ({ openingHours: WEEKDAYS_EN }));
    const pois = Array.from({ length: 20 }, (_, i) =>
      hoursPoi({ id: `p${i}`, google_place_id: `ChIJ${i}` }),
    );

    const result = await collectOpeningHours(pois, {
      apiKey: "k",
      fetchDetails,
      limit: 3,
      sleep: noSleep,
    });

    expect(result.apiCalls).toBe(3);
    expect(result.facts).toHaveLength(3);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// collectGalleryImages
// ───────────────────────────────────────────────────────────────────────────

describe("collectGalleryImages", () => {
  it("happy path: 3 bilder + photo_resolved_at-stempel", async () => {
    const fetchNames = vi.fn(async () => ["places/X/photos/a", "places/X/photos/b", "places/X/photos/c"]);
    const resolveUri = vi.fn(async (name: string) => `https://lh3.googleusercontent.com/${name}`);

    const result = await collectGalleryImages([galleryPoi()], {
      apiKey: "k",
      fetchNames,
      resolveUri: resolveUri as never,
      sleep: noSleep,
    });

    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].patch.gallery_images).toHaveLength(3);
    // photo_resolved_at er det refresh-photo-urls.ts leter etter senere.
    expect(result.facts[0].patch.photo_resolved_at).toBeTypeOf("string");
    // 1 navne-oppslag + 3 resolves
    expect(result.apiCalls).toBe(4);
  });

  it("første bilde hentes i 800px, resten i 400px", async () => {
    const fetchNames = vi.fn(async () => ["n0", "n1", "n2"]);
    const resolveUri = vi.fn(
      async (_name: string, _key: string, maxWidthPx?: number) =>
        `https://lh3.googleusercontent.com/${maxWidthPx}`,
    );

    await collectGalleryImages([galleryPoi()], {
      apiKey: "k",
      fetchNames,
      resolveUri,
      sleep: noSleep,
    });

    expect(resolveUri.mock.calls.map((c) => c[2])).toEqual([800, 400, 400]);
  });

  it("POI uten google_place_id hoppes over og telles", async () => {
    const fetchNames = vi.fn();
    const result = await collectGalleryImages(
      [galleryPoi({ id: "nsr-1", name: "Holdeplass", google_place_id: null })],
      { apiKey: "k", fetchNames: fetchNames as never, sleep: noSleep },
    );

    expect(result.skippedNoPlaceId).toEqual([{ id: "nsr-1", name: "Holdeplass" }]);
    expect(result.apiCalls).toBe(0);
  });

  it("ingen bilder hos Google → noData, ingen tom-verdi skrives", async () => {
    const result = await collectGalleryImages([galleryPoi()], {
      apiKey: "k",
      fetchNames: vi.fn(async () => []),
      sleep: noSleep,
    });

    expect(result.facts).toHaveLength(0);
    expect(result.noData).toHaveLength(1);
  });

  it("429 fra navne-oppslaget → QuotaAbort, ingen facts", async () => {
    const err = await collectGalleryImages([galleryPoi()], {
      apiKey: "k",
      fetchNames: vi.fn(async () => {
        throw new PlacesApiError(429);
      }),
      sleep: noSleep,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(QuotaAbort);
    expect((err as QuotaAbort).partial.facts).toHaveLength(0);
  });

  it("429 fra bilde-resolve → QuotaAbort (ikke tolket som «bildet er borte»)", async () => {
    const err = await collectGalleryImages([galleryPoi()], {
      apiKey: "k",
      fetchNames: vi.fn(async () => ["places/X/photos/a"]),
      resolveUri: vi.fn(async () => {
        throw new PlacesApiError(429);
      }) as never,
      sleep: noSleep,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(QuotaAbort);
  });

  it("POI med eksisterende bilder hoppes over uten API-kall", async () => {
    const fetchNames = vi.fn();
    const result = await collectGalleryImages(
      [galleryPoi({ gallery_images: ["https://lh3.googleusercontent.com/gammel"] })],
      { apiKey: "k", fetchNames: fetchNames as never, sleep: noSleep },
    );

    expect(fetchNames).not.toHaveBeenCalled();
    expect(result.apiCalls).toBe(0);
  });

  it("alle resolves gir null → feil, ingen tom gallery_images skrives", async () => {
    const result = await collectGalleryImages([galleryPoi()], {
      apiKey: "k",
      fetchNames: vi.fn(async () => ["places/X/photos/a"]),
      resolveUri: vi.fn(async () => null) as never,
      sleep: noSleep,
    });

    expect(result.facts).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Supabase-stien
// ───────────────────────────────────────────────────────────────────────────

describe("Supabase-lesing og -skriving", () => {
  const ctx = (fetchImpl: typeof fetch): SupabaseCtx => ({
    url: "https://db.example.co",
    key: "service-role-key",
    fetchImpl,
  });

  function jsonResponse(body: unknown, status = 200) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as Response;
  }

  it("prosjekt-scope går via product_pois og dedupliserer POI-er på tvers av produkter", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: string) => {
      calls.push(url);
      if (url.includes("/products?")) {
        return jsonResponse([
          { id: "prod-report", product_type: "report" },
          { id: "prod-explorer", product_type: "explorer" },
        ]);
      }
      return jsonResponse([
        { poi_id: "a", pois: { id: "a", name: "Bakeri", google_place_id: "ChIJa" } },
        // Samme POI på to produkter — skal telles ÉN gang, ellers betales den to ganger.
        { poi_id: "a", pois: { id: "a", name: "Bakeri", google_place_id: "ChIJa" } },
        { poi_id: "b", pois: { id: "b", name: "Apotek", google_place_id: "ChIJb" } },
        // PostgREST kan gi null-embed hvis POI-en er slettet.
        { poi_id: "c", pois: null },
      ]);
    }) as unknown as typeof fetch;

    const { pois, note } = await fetchScopedPois(
      ctx(fetchImpl),
      { kind: "project", projectId: "placy-demo_sundsoya" },
      "id,name,google_place_id",
    );

    expect(pois.map((p) => p.id)).toEqual(["b", "a"]); // sortert på navn (nb)
    expect(note).toMatch(/2 produkt/);
    expect(calls[1]).toContain("product_pois");
    expect(calls.every((u) => !u.includes("area_id"))).toBe(true);
  });

  it("prosjekt uten produkter kaster tydelig", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse([])) as unknown as typeof fetch;
    await expect(
      fetchScopedPois(ctx(fetchImpl), { kind: "project", projectId: "ukjent_prosjekt" }, "id"),
    ).rejects.toThrow(/ingen produkter/i);
  });

  it("patchPoi bruker Content-Profile v2 og PATCH-er kun de oppgitte kolonnene", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, 204)) as unknown as typeof fetch;

    await patchPoi(ctx(fetchImpl), "google-ChIJa", { google_phone: "+47 1" });

    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit & { headers: Record<string, string> }][] } })
      .mock.calls[0];
    expect(url).toBe("https://db.example.co/rest/v1/pois?id=eq.google-ChIJa");
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Profile"]).toBe("v2");
    expect(JSON.parse(init.body as string)).toEqual({ google_phone: "+47 1" });
  });

  it("heterogene POI-IDer URL-enkodes (v2.pois.id er TEXT, ikke uuid)", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(null, 204)) as unknown as typeof fetch;
    await patchPoi(ctx(fetchImpl), "entur-NSR:StopPlace:12345", { google_phone: "x" });
    const [url] = (fetchImpl as unknown as { mock: { calls: [string][] } }).mock.calls[0];
    expect(url).toContain("entur-NSR%3AStopPlace%3A12345");
  });

  it("writeFacts fortsetter etter én skrivefeil og rapporterer den", async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.includes("feil-poi") ? jsonResponse({ message: "nope" }, 400) : jsonResponse(null, 204),
    ) as unknown as typeof fetch;

    const report = await writeFacts(ctx(fetchImpl), [
      { poiId: "ok-poi", name: "Ok", patch: { google_phone: "1" }, summary: "" },
      { poiId: "feil-poi", name: "Feil", patch: { google_phone: "2" }, summary: "" },
      { poiId: "ok-poi-2", name: "Ok 2", patch: { google_phone: "3" }, summary: "" },
    ]);

    expect(report.written).toBe(2);
    expect(report.failed).toHaveLength(1);
    expect(report.failed[0].name).toBe("Feil");
  });

  it("verifyWritten fanger POI-er der kolonnen fortsatt er null etter skriving", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse([
        { id: "a", gallery_images: ["u1"], photo_resolved_at: "2026-08-12T00:00:00Z" },
        { id: "b", gallery_images: null, photo_resolved_at: null },
      ]),
    ) as unknown as typeof fetch;

    const problems = await verifyWritten(
      ctx(fetchImpl),
      [
        { poiId: "a", name: "A", patch: { gallery_images: ["u1"], photo_resolved_at: "x" }, summary: "" },
        { poiId: "b", name: "B", patch: { gallery_images: ["u2"], photo_resolved_at: "x" }, summary: "" },
      ],
      ["gallery_images", "photo_resolved_at"],
    );

    expect(problems.map((p) => p.name)).toEqual(["B"]);
    expect(problems[0].missing).toEqual(["gallery_images", "photo_resolved_at"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Rapport
// ───────────────────────────────────────────────────────────────────────────

describe("formatSummary — kostnadskontrollens kvittering", () => {
  let result: Parameters<typeof formatSummary>[0];

  beforeEach(() => {
    result = {
      facts: [{ poiId: "a", name: "A", patch: {}, summary: "" }],
      skippedNoPlaceId: [{ id: "b", name: "B" }],
      notFound: [],
      noData: [],
      failed: [],
      apiCalls: 42,
    };
  });

  it("rapporterer faktisk antall Google-kall", () => {
    expect(formatSummary(result, { apply: true, force: false })).toMatch(
      /Google-API-kall:\s+42/,
    );
  });

  it("kolonnene er innrettet på samme bredde", () => {
    const lines = formatSummary(result, { apply: true, force: false }).split("\n").slice(1);
    // Tallet skal starte på samme kolonne i alle radene.
    const valueColumns = lines.map((line) => line.search(/\d+$/));
    expect(valueColumns.every((c) => c > 0)).toBe(true);
    expect(new Set(valueColumns).size).toBe(1);
  });

  it("dry-run sier eksplisitt at ingenting er skrevet", () => {
    expect(formatSummary(result, { apply: false, force: false })).toMatch(/DRY RUN/);
    expect(formatSummary(result, { apply: true, force: false })).not.toMatch(/DRY RUN/);
  });
});
