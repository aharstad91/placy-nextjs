import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  decidePoi,
  mergeFailedAttempt,
  mergeGrounding,
  deriveAreaHint,
  thresholdSensitivity,
  histogram,
  FAILED_ATTEMPT_STALE_DAYS,
  type GateSample,
} from "./ground-poi-content-lib";
import {
  PoiGroundingViewSchema,
  type PoiGrounding,
  type PoiGroundingAttempt,
} from "../lib/types";

const NOW = new Date("2026-08-12T12:00:00.000Z");

function grounding(opts: {
  passed: boolean;
  fetchedAt: string;
  reason?: string;
  curated?: boolean;
}): PoiGrounding {
  return {
    poiGroundingVersion: 1,
    generated: {
      provider: "gemini-search-grounding",
      narrative: "n".repeat(500),
      sources: [],
      searchEntryPointHtml: "<div>chip</div>",
      searchQueries: [],
      model: "gemini-2.5-flash",
      fetchedAt: opts.fetchedAt,
      qualityGate: {
        passed: opts.passed,
        sourceCount: 3,
        charCount: 500,
        ...(opts.reason ? { reason: opts.reason } : {}),
      },
    },
    ...(opts.curated
      ? { curated: { narrative: "kuratert av megler", curatedAt: "2026-08-01T00:00:00.000Z" } }
      : {}),
  };
}

/** Kun det Placy-eide laget — normaltilstanden for et servicested vi har skrevet selv. */
function onlyCurated(): PoiGrounding {
  return {
    poiGroundingVersion: 1,
    curated: { narrative: "kuratert av megler", curatedAt: "2026-08-01T00:00:00.000Z" },
  };
}

/** Kun et tomt forsøk — POI-et Gemini ikke fant noe om. */
function attempt(outcome: PoiGroundingAttempt["outcome"], at: string): PoiGrounding {
  return {
    poiGroundingVersion: 1,
    lastAttempt: { at, outcome, reason: `${outcome} fra kalibreringskjøring` },
  };
}

describe("decidePoi", () => {
  it("POI uten grounding → generer", () => {
    expect(decidePoi({ name: "Muustrøparken", grounding: undefined }, { force: false, now: NOW }))
      .toEqual({ action: "generate" });
  });

  it("POI med bestått grounding → hopp over (ikke bruk kvote på nytt)", () => {
    const d = decidePoi(
      { name: "Muustrøparken", grounding: grounding({ passed: true, fetchedAt: "2026-08-01T00:00:00.000Z" }) },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("skip");
    if (d.action !== "skip") return;
    expect(d.reason).toBe("har-bestått-grounding");
  });

  it("ferskt strykende forsøk → hopp over med begrunnelsen bevart", () => {
    const d = decidePoi(
      {
        name: "Nilsparken",
        grounding: grounding({
          passed: false,
          fetchedAt: "2026-08-10T00:00:00.000Z",
          reason: "for få kilder (1 < 2)",
        }),
      },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("skip");
    if (d.action !== "skip") return;
    expect(d.reason).toBe("ferskt-strykende-forsøk");
    expect(d.detail).toContain("for få kilder");
  });

  it("gammelt strykende forsøk → generer på nytt (verden endrer seg)", () => {
    const old = new Date(NOW.getTime() - (FAILED_ATTEMPT_STALE_DAYS + 5) * 86_400_000);
    const d = decidePoi(
      { name: "Nilsparken", grounding: grounding({ passed: false, fetchedAt: old.toISOString() }) },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("generate");
  });

  it("--force overstyrer bestått grounding", () => {
    const d = decidePoi(
      { name: "Muustrøparken", grounding: grounding({ passed: true, fetchedAt: "2026-08-11T00:00:00.000Z" }) },
      { force: true, now: NOW },
    );
    expect(d.action).toBe("generate");
  });

  it("POI uten navn hoppes over selv med --force — ingen prompt å bygge", () => {
    const d = decidePoi({ name: "  ", grounding: undefined }, { force: true, now: NOW });
    expect(d.action).toBe("skip");
    if (d.action !== "skip") return;
    expect(d.reason).toBe("mangler-navn");
  });

  it("ugyldig fetchedAt → generer i stedet for å hoppe over på en uleselig dato", () => {
    const d = decidePoi(
      { name: "X", grounding: grounding({ passed: false, fetchedAt: "ikke-en-dato" }) },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("generate");
  });

  /**
   * Kuratert tekst vinner i modalen, så leverandør-teksten under den blir aldri
   * sett. Uten disse testene ville hver kjøring brent et Gemini-kall per POI vi
   * alt har skrevet selv — tannklinikken på Sundsøya var det første tilfellet.
   */
  it("POI med KUN kuratert tekst → hopp over (ingen kvote på et sted vi har svart på)", () => {
    const d = decidePoi(
      { name: "Inderøy tannklinikk", grounding: onlyCurated() },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("skip");
    if (d.action !== "skip") return;
    expect(d.reason).toBe("har-kuratert-tekst");
  });

  it("kuratert tekst slår et strykende generated-lag — rekkefølgen på sjekkene er sikret", () => {
    const g = grounding({ passed: false, fetchedAt: "2026-01-01T00:00:00.000Z", curated: true });
    const d = decidePoi({ name: "X", grounding: g }, { force: false, now: NOW });
    expect(d.action).toBe("skip");
    if (d.action !== "skip") return;
    expect(d.reason).toBe("har-kuratert-tekst");
  });

  it("--force går forbi kuratert tekst (kalibrering skal fortsatt være mulig)", () => {
    const d = decidePoi(
      { name: "Inderøy tannklinikk", grounding: onlyCurated() },
      { force: true, now: NOW },
    );
    expect(d.action).toBe("generate");
  });

  it("ferskt no-data-forsøk → hopp over", () => {
    const d = decidePoi(
      { name: "Nilsparken", grounding: attempt("no-data", "2026-08-01T00:00:00.000Z") },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("skip");
    if (d.action !== "skip") return;
    expect(d.reason).toBe("ferskt-tomt-forsøk");
    expect(d.detail).toContain("no-data");
  });

  it("gammelt no-data-forsøk → prøv igjen (stedet kan ha fått nettinnhold siden)", () => {
    const oldDate = new Date(NOW.getTime() - (FAILED_ATTEMPT_STALE_DAYS + 5) * 86_400_000);
    const d = decidePoi(
      { name: "Nilsparken", grounding: attempt("no-data", oldDate.toISOString()) },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("generate");
  });

  /**
   * Den viktigste av de tre outcome-verdiene: en kvote-timeout er ikke et faktum
   * om stedet. Ble den behandlet som no-data, ville en dårlig kjøring låst POI-en
   * ute i 30 dager.
   */
  it("ferskt error-forsøk → prøv igjen straks (transient, ikke et faktum om stedet)", () => {
    const d = decidePoi(
      { name: "Nilsparken", grounding: attempt("error", "2026-08-12T11:59:00.000Z") },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("generate");
  });

  it("ferskt refusal-forsøk → hopp over (prompt-problem, ikke løst av re-kall)", () => {
    const d = decidePoi(
      { name: "Den Gyldne Omvei", grounding: attempt("refusal", "2026-08-10T00:00:00.000Z") },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("skip");
  });

  it("ugyldig attempt-dato → generer i stedet for å låse POI-en på en uleselig dato", () => {
    const d = decidePoi(
      { name: "X", grounding: attempt("no-data", "ikke-en-dato") },
      { force: false, now: NOW },
    );
    expect(d.action).toBe("generate");
  });
});

describe("mergeFailedAttempt", () => {
  it("bevarer curated ved tomt re-forsøk — Moat-1-arbeid går ALDRI tapt", () => {
    const existing = onlyCurated();
    const merged = mergeFailedAttempt(existing, {
      at: "2026-08-12T12:00:00.000Z",
      outcome: "no-data",
      reason: "ingenting funnet",
    });
    expect(merged.curated?.narrative).toBe("kuratert av megler");
    expect(merged.lastAttempt?.outcome).toBe("no-data");
  });

  it("bevarer et bestått generated-lag ved tomt re-forsøk", () => {
    const existing = grounding({ passed: true, fetchedAt: "2026-07-01T00:00:00.000Z" });
    const merged = mergeFailedAttempt(existing, {
      at: "2026-08-12T12:00:00.000Z",
      outcome: "error",
      reason: "timeout",
    });
    expect(merged.generated?.fetchedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(merged.lastAttempt?.outcome).toBe("error");
  });

  it("validerer mot lagringsskjemaet — scriptet skal aldri skrive noe lesestien avviser", () => {
    const merged = mergeFailedAttempt(undefined, {
      at: "2026-08-12T12:00:00.000Z",
      outcome: "no-data",
      reason: "ingenting funnet",
    });
    expect(PoiGroundingViewSchema.safeParse(merged).success).toBe(true);
  });
});

describe("mergeGrounding", () => {
  it("bevarer curated-laget ved re-generering — megler-arbeid går ALDRI tapt", () => {
    const existing = grounding({ passed: true, fetchedAt: "2026-07-01T00:00:00.000Z", curated: true });
    const next = grounding({ passed: true, fetchedAt: "2026-08-12T00:00:00.000Z" }).generated;

    const merged = mergeGrounding(existing, next);

    expect(merged.curated?.narrative).toBe("kuratert av megler");
    expect(merged.generated?.fetchedAt).toBe("2026-08-12T00:00:00.000Z");
  });

  it("uten eksisterende curated settes kun generated", () => {
    const next = grounding({ passed: true, fetchedAt: "2026-08-12T00:00:00.000Z" }).generated;
    const merged = mergeGrounding(undefined, next);
    expect(merged.curated).toBeUndefined();
    expect(merged.poiGroundingVersion).toBe(1);
  });
});

describe("deriveAreaHint", () => {
  it("finner hyppigste siste adressesegment (Sundsøya-dataene: 43 × Inderøy)", () => {
    const pois = [
      { address: "Muustrøa 4, Inderøy" },
      { address: "Sundsnesvegen 8, Inderøy" },
      { address: "Vennalivegen 5, Inderøy" },
      { address: "Kongens gate 1, Trondheim" },
      { address: null },
    ];
    expect(deriveAreaHint(pois)).toBe("Inderøy");
  });

  it("ingen adresser → undefined (kalleren logger at ankeret mangler)", () => {
    expect(deriveAreaHint([{ address: null }, { address: "Uten komma" }])).toBeUndefined();
  });
});

describe("thresholdSensitivity", () => {
  const samples: GateSample[] = [
    { poiId: "a", name: "A", charCount: 600, sourceCount: 5, passed: true },
    { poiId: "b", name: "B", charCount: 350, sourceCount: 2, passed: true },
    { poiId: "c", name: "C", charCount: 210, sourceCount: 1, passed: false },
  ];

  it("strengere terskler slipper gjennom færre", () => {
    const [loose, strict] = thresholdSensitivity(samples, [
      { minSourceCount: 1, minCharCount: 200, maxCharCount: 1400 },
      { minSourceCount: 3, minCharCount: 400, maxCharCount: 1400 },
    ]);
    expect(loose.passed).toBe(3);
    expect(strict.passed).toBe(1);
    expect(strict.failed).toBe(2);
  });

  it("regner uten API-kall — det er hele poenget med kalibreringsinstrumentet", () => {
    // Ingen fetch-mock her; funksjonen skal være ren.
    expect(() =>
      thresholdSensitivity(samples, [{ minSourceCount: 2, minCharCount: 280, maxCharCount: 1400 }]),
    ).not.toThrow();
  });
});

describe("histogram", () => {
  it("plasserer verdier i riktig bøtte", () => {
    const rows = histogram([150, 250, 250, 900], [0, 200, 400, 800]);
    expect(rows).toEqual([
      { label: "0–199", count: 1 },
      { label: "200–399", count: 2 },
      { label: "400–799", count: 0 },
      { label: "800+", count: 1 },
    ]);
  });

  it("tom serie gir nullrader, ikke krasj", () => {
    expect(histogram([], [0, 100]).every((r) => r.count === 0)).toBe(true);
  });
});

describe("kilde-vakter for CLI-en", () => {
  const src = readFileSync(join(process.cwd(), "scripts", "ground-poi-content.ts"), "utf8");

  it("dry-run er default — --apply kreves for å skrive", () => {
    expect(src).toContain("const DRY_RUN = !APPLY;");
    expect(src).toMatch(/if \(DRY_RUN\)/);
  });

  it("PATCH bruker optimistic lock på updated_at", () => {
    expect(src).toContain('patchUrl.searchParams.set("updated_at", `eq.${row.updated_at}`)');
  });

  it("PATCH setter KUN grounding-kolonnen (ingen nabo-kolonner overskrives)", () => {
    expect(src).toContain("JSON.stringify({ grounding: o.grounding })");
  });

  it("skriver mot v2-skjemaet, ikke public", () => {
    expect(src).toContain('"Content-Profile": "v2"');
    expect(src).toContain('"Accept-Profile": "v2"');
  });

  it("API-nøkler ligger i headere, aldri i querystring", () => {
    expect(src).not.toMatch(/[?&](key|apikey)=\$\{/);
  });

  it("secret maskeres før logging i revalidate", () => {
    expect(src).toContain('url.replace(/([?&]secret=)[^&]*/, "$1***")');
  });
});
