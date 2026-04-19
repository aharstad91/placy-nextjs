import { describe, it, expect } from "vitest";
import {
  extractProperNouns,
  validateCuratedNarrative,
} from "./validator";

describe("extractProperNouns", () => {
  it("finner enkle egennavn", () => {
    const nouns = extractProperNouns("Jeg bor på Byhaven i Midtbyen.");
    expect(nouns).toContain("Byhaven");
    expect(nouns).toContain("Midtbyen");
  });

  it("finner enkle egennavn i multi-word-navn (single-word match)", () => {
    // Forenklet heuristikk: kun enkelt-ord fanges. Multi-word navn som
    // "Solsiden senter" fanges av POI-linkeren gjennom exact match.
    const nouns = extractProperNouns("Solsiden senter er et kjøpesenter.");
    expect(nouns).toContain("Solsiden");
  });

  it("dropper setningsstarter-stoppord", () => {
    const nouns = extractProperNouns("Her finner du Byhaven. Det er stort.");
    expect(nouns).not.toContain("Her");
    expect(nouns).not.toContain("Det");
    expect(nouns).toContain("Byhaven");
  });

  it("håndterer norske bokstaver æøå", () => {
    const nouns = extractProperNouns("Ålesund ligger ved Ølfestivalen.");
    expect(nouns).toContain("Ålesund");
    expect(nouns).toContain("Ølfestivalen");
  });
});

describe("validateCuratedNarrative", () => {
  const LONG_VALID =
    "Byhaven ligger sentralt i Midtbyen og tilbyr et bredt spekter av butikker. " +
    "Nidarosdomen er også innen kort avstand. Området har flere matbutikker og " +
    "kafeer. Her bor du nært alt du trenger i hverdagen.";

  const reference = {
    geminiNarrative: "Byhaven, Midtbyen og Nidarosdomen er sentrale steder.",
    poiNames: ["Byhaven", "Nidarosdomen"],
  };

  it("godtar gyldig curated text", () => {
    const result = validateCuratedNarrative(LONG_VALID, reference);
    expect(result.ok).toBe(true);
  });

  it("avviser for kort tekst", () => {
    const result = validateCuratedNarrative("For kort.", reference);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/length/);
    }
  });

  it("avviser for lang tekst (over hard cap)", () => {
    const longText = "Byhaven er fin. ".repeat(100); // 1600+ tegn
    const result = validateCuratedNarrative(longText, reference);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/length/);
    }
  });

  it("avviser zero-width chars", () => {
    const withZeroWidth = LONG_VALID + "\u200B"; // zero-width space
    const result = validateCuratedNarrative(withZeroWidth, reference);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/zero-width|control/);
    }
  });

  it("avviser RTL-override chars", () => {
    const withRTL = LONG_VALID + "\u202E"; // RTL override
    const result = validateCuratedNarrative(withRTL, reference);
    expect(result.ok).toBe(false);
  });

  it("flagger få ukjente navn som warning (ikke error)", () => {
    const withOneUnknown =
      LONG_VALID + " Ukjentstedet har også mye å tilby.";
    const result = validateCuratedNarrative(withOneUnknown, reference);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0);
    }
  });

  it("avviser mange ukjente navn (hallusinering)", () => {
    const manyUnknowns =
      LONG_VALID +
      " Ukjentplass og Mysteriebutikk og Falskkafe og Hypotetisksenter og Tenkthotell ligger her.";
    const result = validateCuratedNarrative(manyUnknowns, reference);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/hallucination|unknown/i);
    }
  });

  it("fuzzy-match godtar bøyningsformer", () => {
    const withInflection =
      "Byhavens tilbud er bredt. Nidarosdomens historie er lang og " +
      "interessant. Midtbyen har mange kafeer og butikker. Området er " +
      "livlig og sentralt i Trondheim.";
    const result = validateCuratedNarrative(withInflection, reference);
    expect(result.ok).toBe(true);
  });
});
