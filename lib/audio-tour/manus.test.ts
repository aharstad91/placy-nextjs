import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  buildTrackInputs,
  countWords,
  findBannedWords,
  stripWrappingQuotes,
  validateManus,
  MIN_WORDS,
  MAX_WORDS,
} from "./manus";
import { TARGET_WORDS } from "./manus-prompt";
import type { ReportConfig, ReportThemeConfig } from "../types";

const HEAVY_PITCH = Array.from({ length: 70 }, (_, i) => `ord${i}`).join(" ");

const VALID_THEME_GROUNDING = {
  narrative: "Cras et tincidunt arcu placerat venenatis.",
  curatedNarrative:
    "Solsiden ligger langs Nidelva. Bakklandet er nært nok til en spasertur over Gamle Bybro.",
  sources: [],
  searchEntryPointHtml: "<style>.x</style>",
  fetchedAt: "2026-05-01T00:00:00.000Z",
  groundingVersion: 2 as const,
  curatedAt: "2026-05-01T00:00:00.000Z",
  poiLinksUsed: [],
  meta: {
    model: "gemini-2.5-flash" as const,
    searchQueries: [],
  },
};

function makeTheme(over: Partial<ReportThemeConfig> = {}): ReportThemeConfig {
  return {
    id: "mat-drikke",
    name: "Mat & drikke",
    icon: "utensils",
    categories: ["food"],
    color: "#000",
    leadText: "Lead-tekst",
    bridgeText: "Bro-tekst",
    grounding: { ...VALID_THEME_GROUNDING },
    ...over,
  };
}

describe("ren domene-modul (AC4: ingen runtime-LLM)", () => {
  // Les kilden via process.cwd() (ikke import.meta.url — kaster under jsdom).
  const src = readFileSync(
    join(process.cwd(), "lib/audio-tour/manus.ts"),
    "utf8",
  );
  // Skann KODEN, ikke doc-kommentarene (header-prosaen sier eksplisitt at
  // modulen testes "uten Anthropic-side-effekter" — det ordet er ikke et kall).
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("har ingen runtime-LLM- eller nettverks-kall", () => {
    expect(code).not.toMatch(/@anthropic-ai|messages\.create/);
    expect(code).not.toMatch(/\bfetch\s*\(/);
    expect(code).not.toMatch(/x-goog-api-key|xi-api-key/);
  });

  it("importerer kun TYPE fra manus-prompt (reference-only-grense)", () => {
    // Eneste manus-prompt-referansen er en `import type` — ingen verdi-import
    // som ville dratt inn prompt-bygging i den rene domene-modulen.
    const promptImports =
      code.match(/import[^;]*from\s+["']\.\/manus-prompt["']/g) ?? [];
    expect(promptImports).toHaveLength(1);
    expect(promptImports[0]).toMatch(/import\s+type/);
  });
});

describe("ord-grense-reconciliation (PRD 14 Unit 2)", () => {
  it("pinner de kanoniske aksept-grensene (guardrail-bånd)", () => {
    // Drift-vakt: endrer noen disse må reconciliation-headeren i manus.ts
    // (mål vs. bånd) re-vurderes — ikke stille endring.
    expect(MIN_WORDS).toBe(35);
    expect(MAX_WORDS).toBe(90);
  });

  it("genererings-målet (~70) ligger INNE i aksept-båndet", () => {
    // Kjernen i reconciliationen: målet og båndet er ortogonale roller.
    // Hvis målet noensinne flyttes utenfor [MIN, MAX] er valideringen
    // garantert å forkaste mål-treffende manus — den motsetningen fanges her.
    expect(MIN_WORDS).toBeLessThanOrEqual(TARGET_WORDS);
    expect(TARGET_WORDS).toBeLessThanOrEqual(MAX_WORDS);
  });

  it("aksepterer et manus på akkurat mål-ordtellingen", () => {
    const atTarget = Array.from({ length: TARGET_WORDS }, () => "ord").join(" ");
    const r = validateManus(atTarget);
    expect(r.ok).toBe(true);
    expect(r.wordCount).toBe(TARGET_WORDS);
  });

  it("aksepterer båndets ytterpunkter (MIN og MAX inklusiv)", () => {
    const atMin = Array.from({ length: MIN_WORDS }, () => "ord").join(" ");
    const atMax = Array.from({ length: MAX_WORDS }, () => "ord").join(" ");
    expect(validateManus(atMin).ok).toBe(true);
    expect(validateManus(atMax).ok).toBe(true);
  });

  it("forkaster akkurat utenfor båndet (MIN-1 og MAX+1)", () => {
    const belowMin = Array.from({ length: MIN_WORDS - 1 }, () => "ord").join(" ");
    const aboveMax = Array.from({ length: MAX_WORDS + 1 }, () => "ord").join(" ");
    expect(validateManus(belowMin).ok).toBe(false);
    expect(validateManus(belowMin).reason).toContain("for kort");
    expect(validateManus(aboveMax).ok).toBe(false);
    expect(validateManus(aboveMax).reason).toContain("for langt");
  });
});

describe("countWords", () => {
  it("teller enkle ord", () => {
    expect(countWords("ett to tre")).toBe(3);
  });
  it("normaliserer whitespace", () => {
    expect(countWords("  ett   to\n\tre  ")).toBe(3);
  });
  it("tom streng → 0", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});

describe("findBannedWords", () => {
  it("fanger fantastisk", () => {
    expect(findBannedWords("Et fantastisk område.")).toContain("fantastisk");
  });
  it("case-insensitive", () => {
    expect(findBannedWords("UTROLIG bra.").length).toBeGreaterThan(0);
  });
  it("flere uttrykk i samme tekst", () => {
    const hits = findBannedWords("En koselig og hyggelig hidden gem.");
    expect(hits.length).toBeGreaterThanOrEqual(3);
  });
  it("ren tekst → ingen treff", () => {
    expect(findBannedWords("Solsiden ligger langs Nidelva.")).toEqual([]);
  });
});

describe("stripWrappingQuotes", () => {
  it("fjerner doble anførselstegn", () => {
    expect(stripWrappingQuotes('"Et manus."')).toBe("Et manus.");
  });
  it("fjerner enkle anførselstegn", () => {
    expect(stripWrappingQuotes("'Et manus.'")).toBe("Et manus.");
  });
  it("lar mismatched quotes være", () => {
    expect(stripWrappingQuotes('"Et manus.')).toBe('"Et manus.');
  });
  it("normaliserer whitespace", () => {
    expect(stripWrappingQuotes('  "Et manus."  ')).toBe("Et manus.");
  });
});

describe("validateManus", () => {
  it("ok ved 50 ord, ingen banned", () => {
    const text = Array.from({ length: 50 }, () => "ord").join(" ");
    const r = validateManus(text);
    expect(r.ok).toBe(true);
    expect(r.wordCount).toBe(50);
  });
  it("fail ved for kort", () => {
    const r = validateManus("kun fem ord her totalt");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("for kort");
    expect(r.wordCount).toBeLessThan(MIN_WORDS);
  });
  it("fail ved for langt", () => {
    const text = Array.from({ length: MAX_WORDS + 5 }, () => "ord").join(" ");
    const r = validateManus(text);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("for langt");
  });
  it("fail ved banned-word", () => {
    const text = HEAVY_PITCH + " fantastisk";
    const r = validateManus(text);
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("fantastisk");
    expect(r.banned).toContain("fantastisk");
  });
});

describe("buildTrackInputs", () => {
  it("genererer Hjem + alle temaer (happy path)", () => {
    const rc: ReportConfig = {
      heroIntro: "Velkommen til området — landlig og urbant.",
      themes: [makeTheme({ id: "mat-drikke", name: "Mat & drikke" }), makeTheme({ id: "natur", name: "Natur" })],
    };
    const inputs = buildTrackInputs(rc, "Stasjonskvartalet");
    expect(inputs.map((i) => i.key)).toEqual(["home", "mat-drikke", "natur"]);
    expect(inputs[0].kind).toBe("home");
    expect(inputs[1].kind).toBe("category");
    expect(inputs[1].prevTrackSummary).toBe("Stasjonskvartalet");
    expect(inputs[2].prevTrackSummary).toBe("Mat & drikke");
  });

  it("hopper over Hjem hvis heroIntro mangler", () => {
    const rc: ReportConfig = {
      themes: [makeTheme()],
    };
    const inputs = buildTrackInputs(rc, "Spro Havn");
    expect(inputs.map((i) => i.key)).toEqual(["mat-drikke"]);
    expect(inputs[0].prevTrackSummary).toBe("Spro Havn");
  });

  it("hopper over tema uten input-tekst", () => {
    const rc: ReportConfig = {
      heroIntro: "Hjem-intro her.",
      themes: [
        makeTheme({
          id: "tom",
          name: "Tom",
          leadText: undefined,
          bridgeText: undefined,
          grounding: undefined,
        }),
        makeTheme({ id: "mat-drikke", name: "Mat & drikke" }),
      ],
    };
    const inputs = buildTrackInputs(rc, "Område");
    expect(inputs.map((i) => i.key)).toEqual(["home", "mat-drikke"]);
  });

  it("tom config → tom array", () => {
    const inputs = buildTrackInputs({}, "X");
    expect(inputs).toEqual([]);
  });

  it("foretrekker curatedNarrative over rå narrative", () => {
    const rc: ReportConfig = {
      themes: [
        makeTheme({
          id: "with-curated",
          leadText: undefined,
          bridgeText: undefined,
          grounding: {
            ...VALID_THEME_GROUNDING,
            narrative: "RÅ-tekst",
            curatedNarrative: "KURATERT-tekst",
          },
        }),
      ],
    };
    const inputs = buildTrackInputs(rc, "Y");
    expect(inputs[0].inputText).toContain("KURATERT-tekst");
    expect(inputs[0].inputText).not.toContain("RÅ-tekst");
  });

  it("flagger hasExistingManus når audio.manus eksisterer", () => {
    const rc: ReportConfig = {
      heroIntro: "Intro.",
      heroAudio: { manus: "eksisterende hjem-manus" },
      themes: [
        makeTheme({ id: "a", audio: { manus: "eksisterende kat-manus" } }),
        makeTheme({ id: "b" }),
      ],
    };
    const inputs = buildTrackInputs(rc, "Z");
    expect(inputs.find((i) => i.key === "home")?.hasExistingManus).toBe(true);
    expect(inputs.find((i) => i.key === "a")?.hasExistingManus).toBe(true);
    expect(inputs.find((i) => i.key === "b")?.hasExistingManus).toBe(false);
  });
});
