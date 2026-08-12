import { describe, it, expect } from "vitest";
import { splitLongParagraphs, GEMINI_MODEL } from "./grounding";

describe("GEMINI_MODEL", () => {
  it("er hardkodet gemini-2.5-flash (r07.1 AC2)", () => {
    expect(GEMINI_MODEL).toBe("gemini-2.5-flash");
  });
});

describe("splitLongParagraphs", () => {
  it("beholder korte avsnitt (≤3 setninger) uendret", () => {
    const input = "Setning en. Setning to. Setning tre.";
    expect(splitLongParagraphs(input)).toBe(input);
  });

  it("splitter 4 setninger i 2 chunks (maks 3 per chunk)", () => {
    const out = splitLongParagraphs("En. To. Tre. Fire.");
    expect(out.split("\n\n")).toHaveLength(2);
  });

  it("splitter 7 setninger i 3 chunks", () => {
    const out = splitLongParagraphs("En. To. Tre. Fire. Fem. Seks. Sju.");
    expect(out.split("\n\n")).toHaveLength(3);
  });

  it("bevarer markdown-lister uten å splitte", () => {
    const input =
      "- Punkt en\n- Punkt to\n- Punkt tre\n- Punkt fire\n- Punkt fem";
    expect(splitLongParagraphs(input)).toBe(input);
  });

  it("splitter ikke på norske forkortelser (f.eks., bl.a., osv.)", () => {
    // Én logisk setning med forkortelser → skal ikke over-splittes.
    const input =
      "Sentrum har mange tilbud, f.eks. kafeer, bl.a. utested, osv. og mer.";
    expect(splitLongParagraphs(input)).toBe(input);
  });

  it("dropper tomme avsnitt", () => {
    expect(splitLongParagraphs("\n\nTekst.")).toBe("Tekst.");
  });

  // Regresjonsvern: Gemini bruker ofte en-dash som punktmarkør. Før
  // normaliseringen falt slike lister gjennom markdown-sjekken og ble
  // setningssplittet, slik at flere punkter havnet på samme linje (målt på
  // reell Muustrøparken-output 2026-08-12).
  it("normaliserer en-dash-punkter til markdown og bevarer dem som liste", () => {
    const input =
      "– Punkt en er her\n– Punkt to er her\n– Punkt tre er her\n– Punkt fire er her";
    const out = splitLongParagraphs(input);
    expect(out).toBe(
      "- Punkt en er her\n- Punkt to er her\n- Punkt tre er her\n- Punkt fire er her",
    );
  });

  it("normaliserer em-dash og kulepunkt-markører også", () => {
    expect(splitLongParagraphs("— Ett\n• To\n· Tre\n— Fire")).toBe(
      "- Ett\n- To\n- Tre\n- Fire",
    );
  });

  it("rører ikke tankestrek midt i en setning", () => {
    const input = "Parken ligger sentralt – rett ved elva – og er åpen.";
    expect(splitLongParagraphs(input)).toBe(input);
  });
});
