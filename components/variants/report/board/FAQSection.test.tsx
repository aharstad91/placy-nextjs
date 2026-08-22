import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FAQSection } from "./FAQSection";
import type { FaqEntry } from "@/lib/generators/faq-generator";

function entry(over: Partial<FaqEntry> & { id: string }): FaqEntry {
  return {
    question: `Spørsmål ${over.id}?`,
    answer: `Svar ${over.id}.`,
    source: "deterministic",
    ...over,
  };
}

/**
 * Nøklene er lowercased, verdiene bærer POI-ens EGEN skrivemåte — nøyaktig som
 * `board-data.ts` bygger mappen. Testene ville ikke fanget lowercase-fella med
 * en håndbygd map der de to var like.
 */
const POIS = new Map([
  ["entur-nsr-stopplace-60260", { id: "entur-NSR-StopPlace-60260" }],
  ["nsr-975278980", { id: "nsr-975278980" }],
]);
const CATEGORIES = ["transport", "barn-oppvekst"];

function renderFaq(
  entries: FaqEntry[],
  props: Partial<React.ComponentProps<typeof FAQSection>> = {},
) {
  return render(
    <FAQSection entries={entries} poisById={POIS} categoryIds={CATEGORIES} {...props} />,
  );
}

describe("FAQSection", () => {
  it("rendrer spørsmålene, og svarene er skjult til man trykker", () => {
    renderFaq([entry({ id: "krets" }), entry({ id: "linjer" })]);
    expect(screen.getAllByTestId("faq-question")).toHaveLength(2);
    for (const panel of screen.getAllByTestId("faq-answer")) {
      expect(panel.getAttribute("data-expanded")).toBe("false");
      expect(panel.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("ekspanderer på klikk og lukker på nytt klikk", () => {
    renderFaq([entry({ id: "krets" })]);
    const knapp = screen.getByTestId("faq-question");
    fireEvent.click(knapp);
    expect(knapp.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("faq-answer").getAttribute("data-expanded")).toBe("true");
    fireEvent.click(knapp);
    expect(knapp.getAttribute("aria-expanded")).toBe("false");
  });

  it("lar flere svar stå åpne samtidig", () => {
    renderFaq([entry({ id: "a" }), entry({ id: "b" })]);
    const [første, andre] = screen.getAllByTestId("faq-question");
    fireEvent.click(første);
    fireEvent.click(andre);
    expect(
      screen.getAllByTestId("faq-answer").map((p) => p.getAttribute("data-expanded")),
    ).toEqual(["true", "true"]);
  });

  it("scroller ALDRI ved åpning — høyde-animasjonen er signal nok", () => {
    // Et scroll-hopp river leseren vekk fra spørsmålet hun nettopp trykket på.
    const scrollIntoView = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      value: scrollIntoView,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      value: scrollTo,
      configurable: true,
      writable: true,
    });

    renderFaq([entry({ id: "a" }), entry({ id: "b" })]);
    fireEvent.click(screen.getAllByTestId("faq-question")[0]);
    fireEvent.click(screen.getAllByTestId("faq-question")[1]);

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("beholder BEGGE tilstander i DOM så animasjonen kan kjøre", () => {
    renderFaq([entry({ id: "a" })]);
    expect(screen.getByTestId("faq-answer").textContent).toContain("Svar a.");
  });

  it("gjør et sted i svaret klikkbart og sender POI-ens egen id videre", () => {
    // Referansen er mixed-case, oppslaget er lowercased, og OPEN_POI må ha
    // POI-ens EGEN skrivemåte. Alle tre må stemme samtidig.
    const onOpenPoi = vi.fn();
    renderFaq(
      [
        entry({
          id: "naermeste-holdeplass",
          answer:
            "[Strindfjordvegen](poi:entur-NSR-StopPlace-60260) ligger 30 meter fra boligen.",
        }),
      ],
      { onOpenPoi },
    );
    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-poi-link"));
    expect(onOpenPoi).toHaveBeenCalledWith("entur-NSR-StopPlace-60260");
  });

  it("degraderer et sted utenfor boardet til ren tekst — aldri sensur", () => {
    renderFaq([
      entry({ id: "vgs", answer: "[Byåsen videregående](poi:nsr-984477112) i vest." }),
    ]);
    fireEvent.click(screen.getByTestId("faq-question"));
    expect(screen.queryByTestId("faq-poi-link")).toBeNull();
    expect(screen.getByTestId("faq-answer").textContent).toContain("Byåsen videregående i vest.");
  });

  it("sender kategorilenker til kategorivalget, ikke til POI-åpning", () => {
    const onSelectCategory = vi.fn();
    const onOpenPoi = vi.fn();
    renderFaq(
      [
        entry({
          id: "til-byen",
          answer: "Se [Transport & Mobilitet](category:transport) for holdeplassene.",
        }),
      ],
      { onSelectCategory, onOpenPoi },
    );
    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-category-link"));
    expect(onSelectCategory).toHaveBeenCalledWith("transport");
    expect(onOpenPoi).not.toHaveBeenCalled();
  });

  it("rendrer ingenting når kategorien ikke har svar", () => {
    // En tom overskrift ville lovet innhold som ikke finnes, og på en
    // ukuratert adresse er det den normale tilstanden for flere kategorier.
    const { container } = renderFaq([]);
    expect(container.firstChild).toBeNull();
  });

  it("gir inline-lenkene en treffflate uten å endre linjehøyden", () => {
    // En lenke midt i en setning er et mye mindre mål enn en frittstående rad.
    renderFaq([entry({ id: "a", answer: "[Ranheim skole](poi:nsr-975278980) er nærmest." })]);
    fireEvent.click(screen.getByTestId("faq-question"));
    const lenke = screen.getByTestId("faq-poi-link");
    expect(lenke.className).toContain("py-1");
    expect(lenke.className).toContain("-my-1");
  });

  it("gjør lenkene tastaturnåbare i naturlig lesrekkefølge", () => {
    // <button> og ikke <a>: de navigerer ikke, de flytter kartet.
    renderFaq([entry({ id: "a", answer: "[Ranheim skole](poi:nsr-975278980) er nærmest." })]);
    fireEvent.click(screen.getByTestId("faq-question"));
    const lenke = screen.getByTestId("faq-poi-link");
    expect(lenke.tagName).toBe("BUTTON");
    expect(lenke.getAttribute("tabindex")).toBeNull();
    expect(lenke.className).toContain("focus-visible:outline");
  });

  it("kobler knapp og panel med aria-controls", () => {
    renderFaq([entry({ id: "krets" })]);
    const knapp = screen.getByTestId("faq-question");
    expect(screen.getByTestId("faq-answer").id).toBe(knapp.getAttribute("aria-controls"));
  });

  it("lar overskriften styres av flaten", () => {
    renderFaq([entry({ id: "a" })], { title: "Om nabolaget" });
    expect(screen.getByText("Om nabolaget")).toBeTruthy();
  });
});
