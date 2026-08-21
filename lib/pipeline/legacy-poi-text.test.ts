import { describe, it, expect } from "vitest";
import {
  byggProsjektnavnListe,
  finnProsjektnavnITekst,
  finnLegacyTekst,
  planTekstopprydding,
  KJENTE_DODE_PROSJEKTNAVN,
  type LegacyTextPoi,
} from "@/lib/pipeline/legacy-poi-text";

const NAVN = byggProsjektnavnListe(["Grilstad Marina", "Stasjonskvartalet", "Teknostallen"]);

function poi(over: Partial<LegacyTextPoi> & { id: string }): LegacyTextPoi {
  return { name: "Et sted", ...over };
}

describe("byggProsjektnavnListe", () => {
  it("tar med både levende og kjente døde prosjektnavn", () => {
    expect(NAVN).toContain("Grilstad Marina");
    expect(NAVN).toContain("Overvik");
  });

  it("sorterer lengst først så «Grilstad Marina» matcher før «Grilstad»", () => {
    const liste = byggProsjektnavnListe(["Grilstad", "Grilstad Marina"], []);
    expect(liste[0]).toBe("Grilstad Marina");
  });

  it("dropper for korte navn som ville gitt falske treff", () => {
    expect(byggProsjektnavnListe(["Ila", "Lade"], [])).toEqual(["Lade"]);
  });

  it("dedupliserer navn som finnes i begge lister", () => {
    const liste = byggProsjektnavnListe(["Overvik"], KJENTE_DODE_PROSJEKTNAVN);
    expect(liste.filter((n) => n === "Overvik")).toHaveLength(1);
  });
});

describe("finnProsjektnavnITekst", () => {
  it("finner prosjektnavnet uavhengig av store bokstaver", () => {
    expect(finnProsjektnavnITekst("Kort vei fra overvik.", NAVN)).toBe("Overvik");
  });

  it("krever ordgrense — «Lade» treffer ikke «Ladestien»", () => {
    const liste = byggProsjektnavnListe(["Lade"], []);
    expect(finnProsjektnavnITekst("Turen går langs Ladestien.", liste)).toBeNull();
  });

  it("returnerer null for tekst uten prosjektnavn", () => {
    expect(finnProsjektnavnITekst("Badeplass med sandstrand.", NAVN)).toBeNull();
  });

  it("takler null og tom streng", () => {
    expect(finnProsjektnavnITekst(null, NAVN)).toBeNull();
    expect(finnProsjektnavnITekst("", NAVN)).toBeNull();
  });

  it("escaper regex-metategn i prosjektnavn", () => {
    const liste = byggProsjektnavnListe(["Kvartal (nord)"], []);
    expect(finnProsjektnavnITekst("Ligger i Kvartal (nord).", liste)).toBe("Kvartal (nord)");
    expect(finnProsjektnavnITekst("Ligger i Kvartal nord.", liste)).toBeNull();
  });
});

describe("finnLegacyTekst", () => {
  it("fanger prosjekt-forankret tekst i alle tre felter", () => {
    const treff = finnLegacyTekst(
      [
        poi({ id: "a", local_insight: "Treningsalternativ i gangavstand fra Overvik." }),
        poi({ id: "b", editorial_hook: "Nærbutikken for Stasjonskvartalet." }),
        poi({ id: "c", description: "Rett ved Teknostallen." }),
        poi({ id: "d", local_insight: "Badeplass med sandstrand." }),
      ],
      NAVN,
    );
    expect(treff.map((t) => t.poi.id)).toEqual(["a", "b", "c"]);
  });

  it("markerer om POI-en har grounding som overtar", () => {
    const treff = finnLegacyTekst(
      [
        poi({ id: "med", local_insight: "Fra Overvik.", grounding: { generated: {} } }),
        poi({ id: "uten", local_insight: "Fra Overvik." }),
      ],
      NAVN,
    );
    expect(treff.find((t) => t.poi.id === "med")?.harErstatning).toBe(true);
    expect(treff.find((t) => t.poi.id === "uten")?.harErstatning).toBe(false);
  });

  it("rapporterer flere felter på samme POI", () => {
    const treff = finnLegacyTekst(
      [poi({ id: "a", editorial_hook: "Ved Overvik.", local_insight: "Gangavstand fra Overvik." })],
      NAVN,
    );
    expect(treff[0].felter.map((f) => f.felt)).toEqual(["editorial_hook", "local_insight"]);
  });
});

describe("planTekstopprydding", () => {
  it("nuller bare feltene som navngir et prosjekt", () => {
    const [treff] = finnLegacyTekst(
      [poi({ id: "a", local_insight: "Fra Overvik.", editorial_hook: "Nybakt brød daglig." })],
      NAVN,
    );
    const { patch } = planTekstopprydding(treff);
    expect(patch).toEqual({ local_insight: null });
  });

  it("flagger POI-er som mister all tekst", () => {
    const [treff] = finnLegacyTekst([poi({ id: "a", local_insight: "Fra Overvik." })], NAVN);
    expect(planTekstopprydding(treff).mister_all_tekst).toBe(true);
  });

  it("flagger ikke tap når grounding overtar", () => {
    const [treff] = finnLegacyTekst(
      [poi({ id: "a", local_insight: "Fra Overvik.", grounding: { generated: {} } })],
      NAVN,
    );
    expect(planTekstopprydding(treff).mister_all_tekst).toBe(false);
  });

  it("flagger ikke tap når et annet tekstfelt overlever", () => {
    const [treff] = finnLegacyTekst(
      [poi({ id: "a", local_insight: "Fra Overvik.", editorial_hook: "Nybakt brød daglig." })],
      NAVN,
    );
    expect(planTekstopprydding(treff).mister_all_tekst).toBe(false);
  });
});
