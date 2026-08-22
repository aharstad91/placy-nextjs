import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  GLOBAL_EDITORIAL_KEY,
  parseAreaStaging,
  ThemeEditorialStagingSchema,
  type ThemeEditorialStaging,
} from "./area-staging";
import { REPORT_THEME_DEFAULTS } from "./report-defaults";

// ── Test-fixtures ─────────────────────────────────────────────────────────

/** Lukket ytre ring rundt Ranheim-senteret (63.4350, 10.5200) — [lng, lat]. */
function closedRing(): number[][] {
  return [
    [10.505, 63.428],
    [10.535, 63.428],
    [10.535, 63.442],
    [10.505, 63.442],
    [10.505, 63.428],
  ];
}

function validStaging() {
  return {
    areaId: "ranheim",
    boundary: {
      type: "Polygon",
      coordinates: [closedRing()],
    },
    report_editorial: {
      "mat-drikke": {
        body: "Kuratert tekst om mat og drikke i nabolaget.",
        highlightCandidates: ["google-ChIJabc123", "bus-x", "entur-NSR-StopPlace-41742"],
      },
      transport: {
        body: "",
        highlightCandidates: [],
      },
    },
  };
}

function validMeta() {
  return {
    name_no: "Malvik",
    name_en: "Malvik",
    slug_no: "malvik",
    slug_en: "malvik",
    center_lat: 63.42,
    center_lng: 10.74,
  };
}

function expectFailure(raw: unknown): string[] {
  const result = parseAreaStaging(raw);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("unreachable");
  return result.errors;
}

/**
 * Tema-entryen for et tema-id, smalnet fra unionen med den reserverte
 * `global`-entryen. Nøkkelen bestemmer formen — se superRefine i skjemaet.
 */
function themeEntry(raw: unknown, themeId: string): ThemeEditorialStaging {
  const result = parseAreaStaging(raw);
  expect(result.success).toBe(true);
  if (!result.success) throw new Error("unreachable");
  const entry = result.data.report_editorial[themeId];
  if (!entry || !("body" in entry)) {
    throw new Error(`Fant ingen tema-entry for "${themeId}"`);
  }
  return entry;
}

// ── Happy path ────────────────────────────────────────────────────────────

describe("parseAreaStaging — gyldig staging", () => {
  it("passerer og bevarer kandidat-rekkefølgen (heterogene POI-IDer)", () => {
    const result = parseAreaStaging(validStaging());
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.areaId).toBe("ranheim");
    expect(result.data.boundary.type).toBe("Polygon");
    // google-ChIJ…/bus-…/entur-NSR-…-former passerer, rekkefølgen er bevart
    expect(themeEntry(validStaging(), "mat-drikke").highlightCandidates).toEqual([
      "google-ChIJabc123",
      "bus-x",
      "entur-NSR-StopPlace-41742",
    ]);
  });

  it("aksepterer tom body og tomme kandidatlister (mal-tilstand)", () => {
    expect(themeEntry(validStaging(), "transport").body).toBe("");
    expect(themeEntry(validStaging(), "transport").highlightCandidates).toEqual([]);
  });

  it("aksepterer MultiPolygon med lukkede ringer", () => {
    const staging = {
      ...validStaging(),
      boundary: {
        type: "MultiPolygon",
        coordinates: [[closedRing()], [closedRing()]],
      },
    };
    const result = parseAreaStaging(staging);
    expect(result.success).toBe(true);
  });

  it("malfila data/areas/ranheim.staging.json validerer (inkl. _instructions)", () => {
    const file = path.resolve(process.cwd(), "data/areas/ranheim.staging.json");
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    const result = parseAreaStaging(raw);
    expect(result).toEqual(expect.objectContaining({ success: true }));
    if (!result.success) throw new Error("unreachable");
    // Malen har alle 6 bolig-temaer
    expect(Object.keys(result.data.report_editorial).sort()).toEqual(
      [
        "barn-oppvekst",
        "hverdagsliv",
        "mat-drikke",
        "natur-friluftsliv",
        "transport",
        "trening-aktivitet",
      ].sort()
    );
  });
});

// ── meta-blokk (opprettelse av ny areas-rad) ───────────────────────────────

describe("parseAreaStaging — meta-blokk", () => {
  it("meta er valgfri — staging uten meta validerer (PATCH-tilfellet)", () => {
    const result = parseAreaStaging(validStaging());
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.meta).toBeUndefined();
  });

  it("gyldig meta validerer og defaulter level til 'city'", () => {
    const staging = { ...validStaging(), meta: validMeta() };
    const result = parseAreaStaging(staging);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.meta?.name_no).toBe("Malvik");
    expect(result.data.meta?.level).toBe("city");
  });

  it("eksplisitt level/zoom_level/postal_codes bevares", () => {
    const staging = {
      ...validStaging(),
      meta: { ...validMeta(), level: "strok", zoom_level: 14, postal_codes: ["7560", "7563"] },
    };
    const result = parseAreaStaging(staging);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    expect(result.data.meta?.level).toBe("strok");
    expect(result.data.meta?.zoom_level).toBe(14);
    expect(result.data.meta?.postal_codes).toEqual(["7560", "7563"]);
  });

  it("meta uten påkrevd felt avvises (manglende name_no)", () => {
    const meta = validMeta() as Record<string, unknown>;
    delete meta.name_no;
    const errors = expectFailure({ ...validStaging(), meta });
    expect(errors.some((e) => e.includes("name_no"))).toBe(true);
  });

  it("meta.center_lng utenfor [-180, 180] avvises", () => {
    const staging = { ...validStaging(), meta: { ...validMeta(), center_lng: 200 } };
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("center_lng"))).toBe(true);
  });

  it("ugyldig level-enum avvises", () => {
    const staging = { ...validStaging(), meta: { ...validMeta(), level: "kommune" } };
    const errors = expectFailure(staging);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("ukjent meta-nøkkel avvises (strict — fanger typo)", () => {
    const staging = { ...validStaging(), meta: { ...validMeta(), centre_lat: 63.4 } };
    const errors = expectFailure(staging);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── Error paths ───────────────────────────────────────────────────────────

describe("parseAreaStaging — valideringsfeil", () => {
  it("ukjent tema-id gir høylytt feil med temanavnet i meldingen", () => {
    const staging = validStaging();
    (staging.report_editorial as Record<string, unknown>)["uteliv"] = {
      body: "Tekst",
      highlightCandidates: [],
    };
    const errors = expectFailure(staging);
    const themeError = errors.find((e) => e.includes('"uteliv"'));
    expect(themeError).toBeDefined();
    // Meldingen lister gyldige tema-IDer
    expect(themeError).toContain("hverdagsliv");
    expect(themeError).toContain("trening-aktivitet");
  });

  it("tom POI-id-streng avvises", () => {
    const staging = validStaging();
    staging.report_editorial["mat-drikke"].highlightCandidates = [
      "google-ChIJabc123",
      "",
    ];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("tom streng"))).toBe(true);
  });

  it("ulukket ytre ring avvises", () => {
    const staging = validStaging();
    const openRing = closedRing();
    openRing[openRing.length - 1] = [10.51, 63.43]; // siste != første
    staging.boundary.coordinates = [openRing];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("ikke lukket"))).toBe(true);
  });

  it("ring med færre enn 4 punkter avvises", () => {
    const staging = validStaging();
    staging.boundary.coordinates = [
      [
        [10.505, 63.428],
        [10.535, 63.428],
        [10.505, 63.428],
      ],
    ];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("minst 4 punkter"))).toBe(true);
  });

  it("koordinater utenfor verdensranger avvises (lat 95)", () => {
    const staging = validStaging();
    staging.boundary.coordinates = [
      [
        [10.505, 95],
        [10.535, 63.428],
        [10.535, 63.442],
        [10.505, 95],
      ],
    ];
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.includes("[-90, 90]"))).toBe(true);
  });

  it("tom areaId avvises", () => {
    const staging = { ...validStaging(), areaId: "" };
    const errors = expectFailure(staging);
    expect(errors.some((e) => e.startsWith("areaId"))).toBe(true);
  });

  it("ukjent toppnivå-nøkkel avvises (strict — fanger typo som reportEditorial)", () => {
    const staging = { ...validStaging(), reportEditorial: {} };
    const errors = expectFailure(staging);
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── Bolig-profil-grense (AC4b) ──────────────────────────────────────────────

describe("parseAreaStaging — bolig-profil-grense (AC4b)", () => {
  it("hverdagstjenester (et NÆRINGS-tema) avvises som ukjent i bolig-scope", () => {
    // VALID_THEME_IDS er avledet fra REPORT_THEME_DEFAULTS (bolig), IKKE
    // getThemeDefaults(profile). Staging av et rent nærings-tema
    // (hverdagstjenester/nabolaget) er derfor en dokumentert no-op: avvist som
    // ukjent i bolig-scope, selv om id-en er et gyldig NAERING_THEME_DEFAULTS-tema.
    const staging = validStaging();
    (staging.report_editorial as Record<string, unknown>)["hverdagstjenester"] = {
      body: "Dagligvare på vei til jobb.",
      highlightCandidates: [],
    };
    const errors = expectFailure(staging);
    const themeError = errors.find((e) => e.includes('"hverdagstjenester"'));
    expect(themeError).toBeDefined();
    expect(themeError).toContain("Ukjent tema-id");
  });
});

// ── VALID_THEME_IDS-avledning (AC4) + eksportert kontrakt (AC2) ──────────────

describe("VALID_THEME_IDS-avledning + ThemeEditorialStagingSchema-kontrakt", () => {
  it("aksepterer ALLE 6 bolig-tema-IDer fra REPORT_THEME_DEFAULTS, uten duplikat (AC4)", () => {
    // Avledet fra taksonomien (PRD 2), ikke hardkodet: nøyaktig 6, ingen duplikat.
    expect(REPORT_THEME_DEFAULTS).toHaveLength(6);
    const ids = REPORT_THEME_DEFAULTS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Hver gyldig bolig-tema-id passerer som report_editorial-nøkkel.
    const report_editorial = Object.fromEntries(
      ids.map((id) => [id, { body: "", highlightCandidates: [] }]),
    );
    const result = parseAreaStaging({
      areaId: "x",
      boundary: { type: "Polygon", coordinates: [closedRing()] },
      report_editorial,
    });
    expect(result.success).toBe(true);
  });

  it("ThemeEditorialStagingSchema er eksportert, .strict() og image? er ikke-tom (AC2)", () => {
    // Arve-steget (inherit-area-editorial.ts:39/:264) gjenbruker dette skjemaet
    // for å validere hver report_editorial-entry — kontrakten må holde.
    expect(
      ThemeEditorialStagingSchema.safeParse({
        body: "t",
        highlightCandidates: [],
        ukjentFelt: 1,
      }).success,
    ).toBe(false);
    expect(
      ThemeEditorialStagingSchema.safeParse({ body: "t", highlightCandidates: [] }).success,
    ).toBe(true);
    expect(
      ThemeEditorialStagingSchema.safeParse({
        body: "t",
        highlightCandidates: [],
        image: "",
      }).success,
    ).toBe(false);
    expect(
      ThemeEditorialStagingSchema.safeParse({
        body: "t",
        highlightCandidates: [],
        image: "scene.jpg",
      }).success,
    ).toBe(true);
  });
});

// ── FAQ-feltet og den reserverte global-nøkkelen ───────────────────────────

describe("kuratert FAQ i staging", () => {
  function withFaq(over: Record<string, unknown>) {
    const s = validStaging();
    s.report_editorial = { ...s.report_editorial, ...over } as typeof s.report_editorial;
    return s;
  }

  it("aksepterer faq på en tema-entry uten å røre body eller highlights", () => {
    const entry = themeEntry(
      withFaq({
        "barn-oppvekst": {
          body: "Kuratert tekst om oppvekst.",
          highlightCandidates: ["nsr-975278980"],
          faq: [{ id: "krets", svar: "Boligen sogner til Ranheim skole." }],
        },
      }),
      "barn-oppvekst",
    );
    expect(entry.faq).toEqual([{ id: "krets", svar: "Boligen sogner til Ranheim skole." }]);
    expect(entry.body).toBe("Kuratert tekst om oppvekst.");
    expect(entry.highlightCandidates).toEqual(["nsr-975278980"]);
  });

  it("krever spørsmålstekst når kurator finner på en egen id — ellers er svaret uten spørsmål", () => {
    // Skjemaet kan ikke vite hvilke id-er malverket har, så det tillater begge
    // former. Generatoren utelater svar som verken har eget spørsmål eller
    // treffer malverket; testen her sikrer at feltet i det minste FINNES.
    const entry = themeEntry(
      withFaq({
        "barn-oppvekst": {
          body: "Tekst.",
          highlightCandidates: [],
          faq: [{ id: "skolevei", spørsmål: "Hvordan er skoleveien?", svar: "Uten kryssing." }],
        },
      }),
      "barn-oppvekst",
    );
    expect(entry.faq?.[0].spørsmål).toBe("Hvordan er skoleveien?");
  });

  it("avviser tomt svar — utelat spørsmålet i stedet for å stå med en tom rad", () => {
    const errors = expectFailure(
      withFaq({
        "barn-oppvekst": { body: "T.", highlightCandidates: [], faq: [{ id: "krets", svar: "" }] },
      }),
    );
    expect(errors.join(" ")).toMatch(/kan ikke være tomt/);
  });

  it("avviser ukjent felt inne i et FAQ-svar (strict, som resten av malverket)", () => {
    const errors = expectFailure(
      withFaq({
        "barn-oppvekst": {
          body: "T.",
          highlightCandidates: [],
          faq: [{ id: "krets", svar: "Svar.", kilde: "megler" }],
        },
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it("aksepterer den reserverte global-nøkkelen med bare faq", () => {
    const result = parseAreaStaging(
      withFaq({
        [GLOBAL_EDITORIAL_KEY]: {
          faq: [{ id: "karakteristikk", spørsmål: "Hva kjennetegner området?", svar: "Sjøkant." }],
        },
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) throw new Error("unreachable");
    const entry = result.data.report_editorial[GLOBAL_EDITORIAL_KEY];
    expect(entry && "faq" in entry && entry.faq).toHaveLength(1);
  });

  it("avviser global-nøkkelen med body — den beskriver ikke et tema", () => {
    const errors = expectFailure(
      withFaq({
        [GLOBAL_EDITORIAL_KEY]: {
          body: "Feilplassert brødtekst",
          highlightCandidates: [],
          faq: [{ id: "k", svar: "S." }],
        },
      }),
    );
    expect(errors.join(" ")).toMatch(/bærer kun \{ faq \}/);
  });

  it("avviser global-nøkkelen uten faq — da bærer den ingenting", () => {
    expectFailure(withFaq({ [GLOBAL_EDITORIAL_KEY]: { faq: [] } }));
  });

  it("avviser en tema-entry som bare har faq — body/highlights er fortsatt kontrakten", () => {
    const errors = expectFailure(
      withFaq({ "barn-oppvekst": { faq: [{ id: "krets", svar: "Svar." }] } }),
    );
    expect(errors.join(" ")).toMatch(/mangler body/);
  });

  it("holder fortsatt ukjente tema-IDer ute, og nevner unntaket i feilmeldingen", () => {
    const errors = expectFailure(withFaq({ "finnes-ikke": { body: "T.", highlightCandidates: [] } }));
    expect(errors.join(" ")).toMatch(/Ukjent tema-id "finnes-ikke"/);
    expect(errors.join(" ")).toMatch(new RegExp(GLOBAL_EDITORIAL_KEY));
  });
});

describe("ThemeEditorialStagingSchema — regresjonsvern for strict", () => {
  it("dropper IKKE en entry som bærer det nye faq-feltet", () => {
    // Dette er hele grunnen til at skjemaendringen måtte lande FØR første
    // skriving: arve-steget bruker samme skjema per entry, og et ukjent felt
    // gjør at HELE entryen (body, highlights, alt) hoppes over med en warning.
    const parsed = ThemeEditorialStagingSchema.safeParse({
      body: "Brødtekst som skal overleve",
      highlightCandidates: ["poi-1"],
      faq: [{ id: "krets", svar: "Svar." }],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("unreachable");
    expect(parsed.data.body).toBe("Brødtekst som skal overleve");
    expect(parsed.data.highlightCandidates).toEqual(["poi-1"]);
  });

  it("er fortsatt strict for felt vi ikke har innført", () => {
    expect(
      ThemeEditorialStagingSchema.safeParse({
        body: "T.",
        highlightCandidates: [],
        faqs: [{ id: "krets", svar: "Svar." }],
      }).success,
    ).toBe(false);
  });
});
