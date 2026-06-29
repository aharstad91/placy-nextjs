import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeCount,
  normalizeRating,
  normalizeProximity,
  normalizeVariety,
  calculateCategoryScore,
  generateCategoryQuote,
  type CategoryScore,
} from "./category-score";

// PRD 5 Unit 6 (r05.6): category-score is a PURE-utils port (Walk Score-style
// weighted scoring + quote generation). No I/O — verified both structurally
// (no imports) and via the source-purity guard below. Only consumer is
// report-data.ts (PRD 3, calls :422/:429/:560/:567); no new consumer here.

describe("normalizeCount", () => {
  it("scales linearly toward the 10-POI full-score threshold", () => {
    expect(normalizeCount(0)).toBe(0);
    expect(normalizeCount(5)).toBe(50);
    expect(normalizeCount(10)).toBe(100);
    expect(normalizeCount(3)).toBe(30);
  });

  it("caps at 100 above the threshold", () => {
    expect(normalizeCount(20)).toBe(100);
    expect(normalizeCount(1000)).toBe(100);
  });
});

describe("normalizeRating", () => {
  it("maps a 0–5 rating onto 0–100", () => {
    expect(normalizeRating(5)).toBe(100);
    expect(normalizeRating(0)).toBe(0);
    expect(normalizeRating(4)).toBe(80);
    expect(normalizeRating(2.5)).toBe(50);
  });

  it("returns the neutral 50 default when rating data is missing (null)", () => {
    expect(normalizeRating(null)).toBe(50);
  });
});

describe("normalizeProximity", () => {
  it("rewards short walk times and decays to 0 at the 15-minute ceiling", () => {
    expect(normalizeProximity(0)).toBe(100);
    expect(normalizeProximity(7.5)).toBe(50);
    expect(normalizeProximity(15)).toBe(0);
  });

  it("clamps to 0 beyond the 15-minute ceiling", () => {
    expect(normalizeProximity(30)).toBe(0);
  });

  it("returns the neutral 50 default when walk-time data is missing (null)", () => {
    expect(normalizeProximity(null)).toBe(50);
  });
});

describe("normalizeVariety", () => {
  it("treats a single category as zero variety and reaches 100 at 5 categories", () => {
    expect(normalizeVariety(1)).toBe(0);
    expect(normalizeVariety(0)).toBe(0); // adjusted = max(0, -1) = 0
    expect(normalizeVariety(2)).toBe(25);
    expect(normalizeVariety(3)).toBe(50);
    expect(normalizeVariety(5)).toBe(100);
  });

  it("caps at 100 above 5 categories", () => {
    expect(normalizeVariety(9)).toBe(100);
  });
});

describe("calculateCategoryScore", () => {
  it("rounds each breakdown component and applies the weighted total (count .30 / rating .25 / proximity .25 / variety .20)", () => {
    const result: CategoryScore = calculateCategoryScore({
      totalPOIs: 10,
      avgRating: 5,
      avgWalkTimeMinutes: 0,
      uniqueCategories: 5,
    });
    expect(result.breakdown).toEqual({
      count: 100,
      rating: 100,
      proximity: 100,
      variety: 100,
    });
    expect(result.total).toBe(100);
  });

  it("computes mixed inputs with half-up rounding on the total", () => {
    // count 50*.30=15, rating 80*.25=20, proximity 50*.25=12.5, variety 50*.20=10 → 57.5 → 58
    const result = calculateCategoryScore({
      totalPOIs: 5,
      avgRating: 4,
      avgWalkTimeMinutes: 7.5,
      uniqueCategories: 3,
    });
    expect(result.breakdown).toEqual({
      count: 50,
      rating: 80,
      proximity: 50,
      variety: 50,
    });
    expect(result.total).toBe(58);
  });

  it("falls back to neutral defaults when rating and walk-time are null", () => {
    const result = calculateCategoryScore({
      totalPOIs: 0,
      avgRating: null,
      avgWalkTimeMinutes: null,
      uniqueCategories: 0,
    });
    // count 0, rating 50, proximity 50, variety 0 → 0+12.5+12.5+0 = 25
    expect(result.breakdown).toEqual({
      count: 0,
      rating: 50,
      proximity: 50,
      variety: 0,
    });
    expect(result.total).toBe(25);
  });
});

describe("generateCategoryQuote", () => {
  it("resolves score thresholds to the correct level via the DEFAULT fallback templates (unknown theme)", () => {
    // DEFAULT_TEMPLATES has exactly one template per level → isolates getQuoteLevel boundaries.
    const q = (score: number) => generateCategoryQuote("unknown-theme", score, 0);
    expect(q(90)).toBe("Eksepsjonelt tilbud i området");
    expect(q(89)).toBe("Svært godt tilbud i området");
    expect(q(75)).toBe("Svært godt tilbud i området");
    expect(q(74)).toBe("Godt tilbud i området");
    expect(q(60)).toBe("Godt tilbud i området");
    expect(q(59)).toBe("Tilstrekkelig tilbud i området");
    expect(q(40)).toBe("Tilstrekkelig tilbud i området");
    expect(q(39)).toBe("Begrenset tilbud i umiddelbar nærhet");
  });

  it("selects a theme-specific template by variety when no seed is given", () => {
    // mat-drikke / exceptional has 2 templates. variety > 3 → index 0; else min(1, len-1) → 1.
    expect(generateCategoryQuote("mat-drikke", 95, 5)).toBe(
      "Matmekka med alt fra gatemat til fine dining"
    );
    expect(generateCategoryQuote("mat-drikke", 95, 1)).toBe(
      "Et område som bugner av matopplevelser"
    );
  });

  it("clamps the no-seed index to the last template when a level has only one", () => {
    // mat-drikke / good has a single template → min(1, 0) = 0 regardless of variety.
    expect(generateCategoryQuote("mat-drikke", 65, 0)).toBe(
      "Godt utvalg av spisesteder i nærområdet"
    );
  });

  it("is deterministic for a given seed and returns a template from the matched level", () => {
    const levelTemplates = [
      "Matmekka med alt fra gatemat til fine dining",
      "Et område som bugner av matopplevelser",
    ];
    const first = generateCategoryQuote("mat-drikke", 95, 0, "ferjemannsveien-10");
    const second = generateCategoryQuote("mat-drikke", 95, 99, "ferjemannsveien-10");
    expect(first).toBe(second); // seed dominates variety → stable
    expect(levelTemplates).toContain(first);
  });
});

describe("source purity (no I/O)", () => {
  it("contains no network/env/LLM access — build-time pure utils only", () => {
    const src = readFileSync(join(process.cwd(), "lib/utils/category-score.ts"), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/\b(anthropic|gemini|openai)\b/i);
    // No import statements at all — the module is self-contained.
    expect(src).not.toMatch(/^\s*import\s/m);
  });
});
