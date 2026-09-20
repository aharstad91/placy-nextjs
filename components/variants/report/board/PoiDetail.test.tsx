import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { PoiDetailBody } from "./PoiDetail";
import type { BoardPOI } from "./board-data";

/**
 * Stedsflaten når innholdet er LÅNT (Nyhavna-demoen, 2026-09-11).
 *
 * `PoiDetailBody` er den ene blokka modalen, anker-siden og omvisningens rad
 * deler, så en kildelinje eller et «Planlagt» som havner feil her, havner feil
 * tre steder. Testene låser to ting: at merkene står når feltene finnes, og at
 * en POI UTEN dem rendrer nøyaktig som før — det er hele forutsetningen for at
 * demoen ikke rører de vanlige boardene.
 */

afterEach(() => cleanup());

function poi(raw: Partial<BoardPOI["raw"]> = {}): BoardPOI {
  return {
    id: "p1" as BoardPOI["id"],
    name: "Bunkerparken",
    coordinates: { lat: 63.4395, lng: 10.4182 },
    // `body` er det adaptPOI setter sammen av editorialHook + localInsight —
    // det er DEN teksten flaten viser.
    body: "Uteareal foran Fyringsbunkeren.",
    categoryId: "kultur" as BoardPOI["categoryId"],
    icon: "TreePine",
    color: "#a06cf5",
    raw: {
      id: "p1",
      name: "Bunkerparken",
      coordinates: { lat: 63.4395, lng: 10.4182 },
      category: { id: "park", name: "Park", icon: "TreePine", color: "#a06cf5" },
      editorialHook: "Uteareal foran Fyringsbunkeren.",
      ...raw,
    } as BoardPOI["raw"],
  };
}

describe("PoiDetailBody — lånt innhold", () => {
  it("merker et planlagt sted øverst, der tittelen står", () => {
    const { getByTestId } = render(
      <PoiDetailBody poi={poi({ developmentStatus: "planned" })} />,
    );
    expect(getByTestId("status-planned")).not.toBeNull();
  });

  it("lar kallstedet slå av merket når raden bærer det selv", () => {
    const { queryByTestId } = render(
      <PoiDetailBody poi={poi({ developmentStatus: "planned" })} showStatus={false} />,
    );
    expect(queryByTestId("status-planned")).toBeNull();
  });

  it("tar forbehold om en omtrentlig plassering, som egen linje", () => {
    const { getByTestId } = render(
      <PoiDetailBody
        poi={poi({
          locationPrecision: "approximate",
          locationNote: "Plassert omtrentlig foran Fyringsbunkeren.",
        })}
      />,
    );
    expect(getByTestId("precision-note").textContent).toContain(
      "Plassert omtrentlig foran Fyringsbunkeren.",
    );
  });

  it("tar ikke forbehold om en koordinat som ER belagt", () => {
    // Noten alene er ikke nok: uten `approximate` ville flaten sådd tvil om et
    // punkt vi kan dokumentere.
    const { queryByTestId } = render(
      <PoiDetailBody poi={poi({ locationNote: "En note uten flagg." })} />,
    );
    expect(queryByTestId("precision-note")).toBeNull();
  });

  it("viser kilden som EGEN linje, ved siden av stedets egen nettside", () => {
    const { getByTestId } = render(
      <PoiDetailBody
        poi={poi({
          editorialSources: ["https://nyhavna.no/leve/kunst-og-kultur/"],
          googleWebsite: "https://www.instagram.com/dorakaffebar/",
        })}
      />,
    );
    const facts = getByTestId("poi-facts");
    const source = getByTestId("poi-source-link") as HTMLAnchorElement;
    expect(source.getAttribute("href")).toBe(
      "https://nyhavna.no/leve/kunst-og-kultur/",
    );
    expect(source.textContent).toBe("nyhavna.no");
    // Begge finnes samtidig, og radene sier hvem de er.
    expect(facts.textContent).toContain("Omtalt på");
    expect(facts.textContent).toContain("instagram.com/dorakaffebar");
  });

  it("åpner faktablokka for en POI som BARE har en kilde", () => {
    // Uten dette ville kildelinja vært usynlig på demoens steder: de har
    // hverken vurdering, åpningstid, telefon eller nettside.
    const { getByTestId } = render(
      <PoiDetailBody poi={poi({ editorialSources: ["https://nyhavna.no/leve/"] })} />,
    );
    expect(getByTestId("poi-facts")).not.toBeNull();
  });

  it("dropper en «kilde» som ikke er en lenke", () => {
    // `editorial_sources` er en gammel fritekst-kolonne i poolen. En verdi som
    // ikke parser som URL ville blitt en død `href`.
    const { queryByTestId } = render(
      <PoiDetailBody poi={poi({ editorialSources: ["Trondheim kommune, sak 42"] })} />,
    );
    expect(queryByTestId("poi-source-link")).toBeNull();
    expect(queryByTestId("poi-facts")).toBeNull();
  });

  it("et vanlig sted rendrer ingen av merkene", () => {
    const { queryByTestId, getByText } = render(<PoiDetailBody poi={poi()} />);
    expect(getByText("Uteareal foran Fyringsbunkeren.")).not.toBeNull();
    expect(queryByTestId("status-planned")).toBeNull();
    expect(queryByTestId("precision-note")).toBeNull();
    expect(queryByTestId("poi-facts")).toBeNull();
  });
});

/**
 * Prosjektopplysningene (2026-09-18).
 *
 * Blokka finnes fordi status, åpning, tidspunkt og adgang er fire påstander med
 * hver sin kilde. Testene låser det som ellers ville glidd: at forbeholdene
 * følger verdiene, og at et sted UTEN opplysninger ikke får en tom ramme som
 * leser som «ingenting er avklart».
 */
describe("PoiDetailBody — prosjektopplysninger", () => {
  it("viser opplysningene og forbeholdene som følger dem", () => {
    const { getByTestId, getAllByTestId } = render(
      <PoiDetailBody
        poi={poi({
          development: {
            facts: [
              { label: "Status", value: "under bygging" },
              { label: "Åpning", value: "åpning ikke oppgitt" },
              { label: "Forventet tidspunkt", value: "Q1 2027" },
            ],
            caveats: ["Kildene sier ikke om «Treningsrommet» er åpen. Ikke slutt at den er åpen."],
          },
        })}
      />,
    );
    const block = getByTestId("poi-development");
    expect(block.textContent).toContain("under bygging");
    expect(block.textContent).toContain("åpning ikke oppgitt");
    expect(block.textContent).toContain("Q1 2027");
    expect(getAllByTestId("poi-development-caveat")).toHaveLength(1);
    // Ingen tekst påstår at noe er åpent.
    expect(block.textContent).not.toContain("Åpning: åpnet");
  });

  it("rendrer ingenting for et sted uten prosjektopplysninger", () => {
    const { queryByTestId } = render(<PoiDetailBody poi={poi()} />);
    expect(queryByTestId("poi-development")).toBeNull();
  });

  it("rendrer ingenting når objektet er tomt — en manglende opplysning er ingen ramme", () => {
    const { queryByTestId } = render(
      <PoiDetailBody poi={poi({ development: { facts: [], caveats: [] } })} />,
    );
    expect(queryByTestId("poi-development")).toBeNull();
  });
});
