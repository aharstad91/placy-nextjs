import { describe, it, expect } from "vitest";
import {
  BOLIG_THEME_IDS,
  MIN_HIGHLIGHTS_PER_THEME,
  buildCoverageLedger,
  classifyArea,
  poiHarBrukbarTekst,
  type AreaCoverageInput,
  type PostalAreaInput,
  type ThemeEditorial,
} from "./coverage-ledger";

// ── Test-fixtures ─────────────────────────────────────────────────────────

const FORM = { type: "MultiPolygon", coordinates: [] };

/** Redaksjonelt innhold for alle seks temaer, med N høydepunkter hver. */
function alleTemaer(
  highlightsPerTema = 2,
  idPrefix = "poi"
): Record<string, ThemeEditorial> {
  const out: Record<string, ThemeEditorial> = {};
  BOLIG_THEME_IDS.forEach((id, i) => {
    out[id] = {
      body: `Kuratert tekst om ${id}.`,
      highlightCandidates: Array.from(
        { length: highlightsPerTema },
        (_, n) => `${idPrefix}-${i}-${n}`
      ),
    };
  });
  return out;
}

function area(overrides: Partial<AreaCoverageInput> = {}): AreaCoverageInput {
  return {
    id: "ranheim",
    name_no: "Ranheim",
    boundary: FORM,
    boundary_source: "curated",
    postal_codes: ["7053"],
    report_editorial: null,
    ...overrides,
  };
}

function postal(
  postnummer: string,
  marked = true,
  kommunenavn = "Trondheim"
): PostalAreaInput {
  return {
    postnummer,
    poststed: "RANHEIM",
    kommunenummer: "5001",
    kommunenavn,
    marked,
  };
}

/** Alle POI-IDer i et editorial-sett, som «har tekst». */
function alleHoydepunkter(editorial: Record<string, ThemeEditorial>): Set<string> {
  return new Set(Object.values(editorial).flatMap((t) => t.highlightCandidates ?? []));
}

const INGEN_TEKST = new Set<string>();

// ── Klassifisering av ett område ──────────────────────────────────────────

describe("classifyArea", () => {
  it("har seks bolig-temaer å måle mot", () => {
    expect(BOLIG_THEME_IDS).toHaveLength(6);
    expect(BOLIG_THEME_IDS).toContain("transport");
    expect(BOLIG_THEME_IDS).toContain("mat-drikke");
  });

  it("gir 'geometri' for område med form men uten redaksjonelt innhold", () => {
    const s = classifyArea(area({ report_editorial: null }), () => false);
    expect(s.status).toBe("geometri");
    expect(s.temaerMedTekst).toBe(0);
  });

  it("gir 'geometri' når bare noen av temaene har tekst", () => {
    const delvis = alleTemaer();
    delvis[BOLIG_THEME_IDS[0]] = { body: "", highlightCandidates: [] };
    const s = classifyArea(area({ report_editorial: delvis }), () => true);
    expect(s.status).toBe("geometri");
    expect(s.temaerMedTekst).toBe(5);
  });

  it("gir 'kuratert' når alle temaer har tekst men høydepunktene mangler tekst", () => {
    const editorial = alleTemaer();
    const s = classifyArea(area({ report_editorial: editorial }), () => false);
    expect(s.status).toBe("kuratert");
    expect(s.hoydepunkter).toBe(12);
    expect(s.hoydepunkterMedTekst).toBe(0);
  });

  it("gir 'dekket' når alle temaer har tekst og alle høydepunkter har tekst", () => {
    const editorial = alleTemaer();
    const medTekst = alleHoydepunkter(editorial);
    const s = classifyArea(area({ report_editorial: editorial }), (id) => medTekst.has(id));
    expect(s.status).toBe("dekket");
    expect(s.hoydepunkterMedTekst).toBe(s.hoydepunkter);
  });

  it("gir 'kuratert', ikke 'dekket', når ett eneste høydepunkt mangler tekst", () => {
    const editorial = alleTemaer();
    const medTekst = alleHoydepunkter(editorial);
    const ett = [...medTekst][0];
    medTekst.delete(ett);
    const s = classifyArea(area({ report_editorial: editorial }), (id) => medTekst.has(id));
    expect(s.status).toBe("kuratert");
  });

  it("godtar ett høydepunkt i et tema — transport svares av sanntid, ikke av lister", () => {
    // Terskelen er 1 med vilje. Straumen har ett transport-høydepunkt fordi Entur
    // svarer på holdeplasser; en terskel på 4 ville gjort dekning uoppnåelig av en
    // grunn som ikke er et hull.
    expect(MIN_HIGHLIGHTS_PER_THEME).toBe(1);
    const editorial = alleTemaer(1);
    const medTekst = alleHoydepunkter(editorial);
    const s = classifyArea(area({ report_editorial: editorial }), (id) => medTekst.has(id));
    expect(s.status).toBe("dekket");
  });

  it("gir 'kuratert' når et tema mangler høydepunkter helt", () => {
    const editorial = alleTemaer();
    editorial[BOLIG_THEME_IDS[2]] = { body: "Tekst finnes.", highlightCandidates: [] };
    const medTekst = alleHoydepunkter(editorial);
    const s = classifyArea(area({ report_editorial: editorial }), (id) => medTekst.has(id));
    expect(s.status).toBe("kuratert");
    expect(s.temaerUtenHoydepunkt).toEqual([BOLIG_THEME_IDS[2]]);
  });

  it("gir 'ukjent' med merknad når innholdet finnes men formen mangler", () => {
    // Geofencen krever BÅDE boundary og report_editorial. Uten form leverer
    // området ingenting til noen bolig, uansett hvor godt det er kuratert.
    const editorial = alleTemaer();
    const s = classifyArea(
      area({ boundary: null, boundary_source: null, report_editorial: editorial }),
      () => true
    );
    expect(s.status).toBe("ukjent");
    expect(s.merknad).toMatch(/mangler polygon/);
  });

  it("skiller de to grunnene til 'ukjent' i merknaden", () => {
    const tomt = classifyArea(
      area({ boundary: null, boundary_source: null, report_editorial: null }),
      () => true
    );
    expect(tomt.merknad).toMatch(/både/);
  });

  it("ignorerer tema-tekst som bare er mellomrom", () => {
    const editorial = alleTemaer();
    editorial[BOLIG_THEME_IDS[0]] = { body: "   ", highlightCandidates: ["x"] };
    const s = classifyArea(area({ report_editorial: editorial }), () => true);
    expect(s.temaerMedTekst).toBe(5);
  });

  it("teller ikke næring-temaer med", () => {
    const editorial = { ...alleTemaer(), nabolaget: { body: "Næring-tema.", highlightCandidates: ["n1"] } };
    const s = classifyArea(area({ report_editorial: editorial }), () => true);
    expect(s.temaerMedTekst).toBe(6);
  });
});

// ── Regnskapet ────────────────────────────────────────────────────────────

describe("buildCoverageLedger", () => {
  it("gir 'ukjent' for postnummer ingen områder lister", () => {
    const res = buildCoverageLedger({
      postalAreas: [postal("7099")],
      areas: [area()],
      poiIdsMedTekst: INGEN_TEKST,
    });
    expect(res.perPostnummer[0].status).toBe("ukjent");
    expect(res.perPostnummer[0].areaIds).toEqual([]);
  });

  it("arver områdets status til postnummeret", () => {
    const editorial = alleTemaer();
    const res = buildCoverageLedger({
      postalAreas: [postal("7053")],
      areas: [area({ report_editorial: editorial })],
      poiIdsMedTekst: alleHoydepunkter(editorial),
    });
    expect(res.perPostnummer[0].status).toBe("dekket");
  });

  it("lar høyeste status vinne når to områder lister samme postnummer", () => {
    // Boligen som ligger der ER dekket — geofencen finner det kuraterte området.
    const editorial = alleTemaer();
    const res = buildCoverageLedger({
      postalAreas: [postal("7053")],
      areas: [
        area({ id: "ukuratert", report_editorial: null }),
        area({ id: "kuratert-omrade", report_editorial: editorial }),
      ],
      poiIdsMedTekst: alleHoydepunkter(editorial),
    });
    expect(res.perPostnummer[0].status).toBe("dekket");
    expect(res.perPostnummer[0].areaIds).toEqual(["ukuratert", "kuratert-omrade"]);
  });

  it("rapporterer overlapp eksplisitt", () => {
    const res = buildCoverageLedger({
      postalAreas: [postal("7014")],
      areas: [
        area({ id: "mollenberg", postal_codes: ["7014"] }),
        area({ id: "rosenborg", postal_codes: ["7014"] }),
        area({ id: "solsiden", postal_codes: ["7014"] }),
      ],
      poiIdsMedTekst: INGEN_TEKST,
    });
    expect(res.overlapp).toEqual([
      { postnummer: "7014", areaIds: ["mollenberg", "rosenborg", "solsiden"] },
    ]);
  });

  it("lister områder med form men uten postnummer — de er ellers usynlige", () => {
    const res = buildCoverageLedger({
      postalAreas: [postal("7053")],
      areas: [
        area({ id: "straumen", postal_codes: [], report_editorial: alleTemaer() }),
        area({ id: "ranheim", postal_codes: ["7053"] }),
      ],
      poiIdsMedTekst: INGEN_TEKST,
    });
    expect(res.omraderUtenPostnummer.map((a) => a.id)).toEqual(["straumen"]);
  });

  it("lister ikke et tomt område uten postnummer som et hull", () => {
    // city/bydel-rader uten form og uten innhold er beholdere, ikke manglende dekning.
    const res = buildCoverageLedger({
      postalAreas: [postal("7053")],
      areas: [
        area({ id: "trondheim", boundary: null, boundary_source: null, postal_codes: [], report_editorial: null }),
      ],
      poiIdsMedTekst: INGEN_TEKST,
    });
    expect(res.omraderUtenPostnummer).toEqual([]);
  });

  it("summerer statusene til totalen — ingen postnummer forsvinner mellom kategorier", () => {
    const editorial = alleTemaer();
    const res = buildCoverageLedger({
      postalAreas: [
        postal("7053"),
        postal("7054"),
        postal("7099"),
        postal("7670", false, "Inderøy"),
      ],
      areas: [
        area({ id: "a", postal_codes: ["7053"], report_editorial: editorial }),
        area({ id: "b", postal_codes: ["7054"], report_editorial: null }),
        area({ id: "c", postal_codes: ["7670"], report_editorial: editorial }),
      ],
      poiIdsMedTekst: alleHoydepunkter(editorial),
    });

    const sum = Object.values(res.totals.alle).reduce((a, b) => a + b, 0);
    expect(sum).toBe(4);
    expect(res.totals.alle).toEqual({ ukjent: 1, geometri: 1, kuratert: 0, dekket: 2 });
  });

  it("skiller markedet fra totalen, så et område utenfor ikke pynter dekningsgraden", () => {
    const editorial = alleTemaer();
    const res = buildCoverageLedger({
      postalAreas: [postal("7053"), postal("7670", false, "Inderøy")],
      areas: [area({ id: "straumen", postal_codes: ["7670"], report_editorial: editorial })],
      poiIdsMedTekst: alleHoydepunkter(editorial),
    });

    expect(res.totals.alle.dekket).toBe(1);
    expect(res.totals.marked.dekket).toBe(0);
    expect(Object.values(res.totals.marked).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("returnerer tomt regnskap for tomme lister", () => {
    const res = buildCoverageLedger({ postalAreas: [], areas: [], poiIdsMedTekst: INGEN_TEKST });
    expect(res.perPostnummer).toEqual([]);
    expect(res.overlapp).toEqual([]);
    expect(Object.values(res.totals.alle).reduce((a, b) => a + b, 0)).toBe(0);
  });
});

// ── Hva som teller som brukbar tekst ──────────────────────────────────────

describe("poiHarBrukbarTekst", () => {
  it("godtar kuratert tekst", () => {
    expect(poiHarBrukbarTekst({ curated: { narrative: "Placy-eid tekst." } })).toBe(true);
  });

  it("godtar leverandør-tekst som ligger der (porten kjørte før skriving)", () => {
    expect(poiHarBrukbarTekst({ generated: { narrative: "Gemini-tekst." } })).toBe(true);
  });

  it("avviser et POI som bare har et tomt forsøk", () => {
    expect(
      poiHarBrukbarTekst({ lastAttempt: { outcome: "no-data", reason: "ingenting publisert" } })
    ).toBe(false);
  });

  it("avviser tom og whitespace-narrative", () => {
    expect(poiHarBrukbarTekst({ curated: { narrative: "" } })).toBe(false);
    expect(poiHarBrukbarTekst({ generated: { narrative: "   " } })).toBe(false);
  });

  it("avviser null, undefined og ikke-objekter", () => {
    expect(poiHarBrukbarTekst(null)).toBe(false);
    expect(poiHarBrukbarTekst(undefined)).toBe(false);
    expect(poiHarBrukbarTekst("tekst")).toBe(false);
  });

  it("avviser narrative som ikke er en streng", () => {
    expect(poiHarBrukbarTekst({ curated: { narrative: 42 } })).toBe(false);
  });
});
