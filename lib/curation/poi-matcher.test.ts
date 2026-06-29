import { describe, it, expect } from "vitest";
import {
  escapeRegex,
  findPoiMatches,
  type MatchCandidate,
} from "./poi-matcher";
import { linkPOIsInText } from "@/lib/utils/story-text-linker";
import { linkPoisInMarkdown, type PoiEntry } from "./poi-linker";
import type { POI } from "@/lib/types";

// ---------------------------------------------------------------------------
// Delt kjerne-matcher (poi-matcher.ts) — direkte enhetstester
// ---------------------------------------------------------------------------

function cand(name: string, key: string): MatchCandidate<string> {
  return { name, key, ref: key };
}

describe("findPoiMatches — kjerne-kontrakt", () => {
  it("matcher case-insensitive og bevarer original casing i treffstreng", () => {
    const m = findPoiMatches("BYHAVEN er stort.", [cand("Byhaven", "a")], {
      boundary: "none",
    });
    expect(m).toEqual([{ start: 0, end: 7, text: "BYHAVEN", ref: "a", key: "a" }]);
  });

  it("lengste-navn-først: lengste alternativ vinner ved overlapp", () => {
    const m = findPoiMatches(
      "Solsiden senter er fint.",
      [cand("Solsiden", "s"), cand("Solsiden senter", "ss")],
      { boundary: "none" },
    );
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ text: "Solsiden senter", key: "ss", start: 0 });
  });

  it("første-forekomst-per-POI: senere forekomster av samme key hoppes over", () => {
    const m = findPoiMatches(
      "Byhaven og Byhaven igjen.",
      [cand("Byhaven", "a")],
      { boundary: "none" },
    );
    expect(m).toHaveLength(1);
    expect(m[0].start).toBe(0);
  });

  it('boundary "word" hindrer delvise treff (\\b…\\b)', () => {
    const m = findPoiMatches("Byhavenesque", [cand("Byhaven", "a")], {
      boundary: "word",
    });
    expect(m).toEqual([]);
  });

  it('boundary "none" tillater delvise treff (substring)', () => {
    const m = findPoiMatches("Sentrumsterminalen", [cand("Sentrum", "e")], {
      boundary: "none",
    });
    expect(m).toEqual([
      { start: 0, end: 7, text: "Sentrum", ref: "e", key: "e" },
    ]);
  });

  it("deler `used`-sett på tvers av kall (dokument-bred dedup)", () => {
    const used = new Set<string>();
    const cands = [cand("Byhaven", "a")];
    const first = findPoiMatches("Byhaven her.", cands, { boundary: "none" }, used);
    const second = findPoiMatches("Byhaven der.", cands, { boundary: "none" }, used);
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0); // allerede brukt
  });

  it("returnerer tomt ved tom tekst eller tomme kandidater", () => {
    expect(findPoiMatches("", [cand("X", "x")], { boundary: "none" })).toEqual([]);
    expect(findPoiMatches("noe tekst", [], { boundary: "none" })).toEqual([]);
  });

  it("flere POIs i posisjons-rekkefølge", () => {
    const m = findPoiMatches(
      "Byhaven, så Nidarosdomen.",
      [cand("Byhaven", "a"), cand("Nidarosdomen", "f")],
      { boundary: "none" },
    );
    expect(m.map((x) => x.key)).toEqual(["a", "f"]);
    expect(m.map((x) => x.start)).toEqual([0, 12]);
  });

  it("escapeRegex escaper regex-spesialtegn", () => {
    expect(escapeRegex("a.b*c")).toBe("a\\.b\\*c");
    const m = findPoiMatches("Kafé (Nord)", [cand("(Nord)", "n")], {
      boundary: "none",
    });
    expect(m).toHaveLength(1);
    expect(m[0].text).toBe("(Nord)");
  });
});

// ---------------------------------------------------------------------------
// Segment-adapter (linkPOIsInText) — golden-output per call-site-mønster
// Konsumenter: ReportThemeSection / ParaformThemeSection / StoryThemeChapter
// ---------------------------------------------------------------------------

function poi(id: string, name: string): POI {
  return { id, name } as unknown as POI;
}

const SEG_POIS: POI[] = [
  poi("a", "Byhaven"),
  poi("b", "Solsiden senter"),
  poi("c", "Solsiden"),
  poi("d", "Bunnpris AS"),
  poi("e", "Sentrum"),
  poi("f", "Nidarosdomen"),
  poi("g", "Bakklandet Skydsstation"),
  poi("h", "Ø"),
  poi("i", "Æra"),
];

describe("linkPOIsInText (segment-adapter) — golden output", () => {
  it("basic: lenker enkelt POI-navn", () => {
    expect(linkPOIsInText("Nidarosdomen er fin.", SEG_POIS)).toEqual([
      { type: "poi", content: "Nidarosdomen", poi: poi("f", "Nidarosdomen") },
      { type: "text", content: " er fin." },
    ]);
  });

  it("kun første forekomst per POI", () => {
    expect(linkPOIsInText("Byhaven og Byhaven igjen.", SEG_POIS)).toEqual([
      { type: "poi", content: "Byhaven", poi: poi("a", "Byhaven") },
      { type: "text", content: " og Byhaven igjen." },
    ]);
  });

  it("lengste navn først (Solsiden senter før Solsiden)", () => {
    expect(linkPOIsInText("Solsiden senter er fint.", SEG_POIS)).toEqual([
      { type: "poi", content: "Solsiden senter", poi: poi("b", "Solsiden senter") },
      { type: "text", content: " er fint." },
    ]);
  });

  it("DIVERGENS §5.3: matcher delvise treff uten ordgrense (Sentrum i Sentrumsterminalen)", () => {
    expect(linkPOIsInText("Sentrumsterminalen er travel.", SEG_POIS)).toEqual([
      { type: "poi", content: "Sentrum", poi: poi("e", "Sentrum") },
      { type: "text", content: "sterminalen er travel." },
    ]);
  });

  it("DIVERGENS §5.3: AS-stripping — kort navn matcher (Bunnpris ← Bunnpris AS)", () => {
    expect(linkPOIsInText("Bunnpris ligger nær.", SEG_POIS)).toEqual([
      { type: "poi", content: "Bunnpris", poi: poi("d", "Bunnpris AS") },
      { type: "text", content: " ligger nær." },
    ]);
  });

  it("AS-stripping: fullt navn matcher også", () => {
    expect(linkPOIsInText("Bunnpris AS er åpen.", SEG_POIS)).toEqual([
      { type: "poi", content: "Bunnpris AS", poi: poi("d", "Bunnpris AS") },
      { type: "text", content: " er åpen." },
    ]);
  });

  it("min navnelengde 3: Ø (1 tegn) filtreres, Æra (3 tegn) matcher (æøå)", () => {
    expect(linkPOIsInText("Æra og Ø.", SEG_POIS)).toEqual([
      { type: "poi", content: "Æra", poi: poi("i", "Æra") },
      { type: "text", content: " og Ø." },
    ]);
  });

  it("bevarer eksterne markdown-lenker som external-segmenter", () => {
    expect(linkPOIsInText("Se [her](https://x.com) og Byhaven.", SEG_POIS)).toEqual([
      { type: "text", content: "Se " },
      { type: "external", content: "her", url: "https://x.com" },
      { type: "text", content: " og " },
      { type: "poi", content: "Byhaven", poi: poi("a", "Byhaven") },
      { type: "text", content: "." },
    ]);
  });

  it("case-insensitive med original casing bevart", () => {
    expect(linkPOIsInText("byhaven er bra.", SEG_POIS)).toEqual([
      { type: "poi", content: "byhaven", poi: poi("a", "Byhaven") },
      { type: "text", content: " er bra." },
    ]);
  });

  it("æøå: flerords-navn matcher korrekt", () => {
    expect(linkPOIsInText("Bakklandet Skydsstation er flott.", SEG_POIS)).toEqual([
      {
        type: "poi",
        content: "Bakklandet Skydsstation",
        poi: poi("g", "Bakklandet Skydsstation"),
      },
      { type: "text", content: " er flott." },
    ]);
  });

  it("tom tekst → ett tekst-segment", () => {
    expect(linkPOIsInText("", SEG_POIS)).toEqual([{ type: "text", content: "" }]);
  });

  it("tom POI-liste → uendret tekst", () => {
    expect(linkPOIsInText("Byhaven her.", [])).toEqual([
      { type: "text", content: "Byhaven her." },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Markdown-adapter (linkPoisInMarkdown) — divergens-låsing vs segment-adapter
// (Pass-1-whitelist + grunnatferd dekkes i poi-linker.test.ts.)
// ---------------------------------------------------------------------------

const UUID_A = "550e8400-e29b-41d4-a716-446655440000";

describe("linkPoisInMarkdown (markdown-adapter) — divergens-låsing", () => {
  it("DIVERGENS §5.3: AS IKKE strippet — kort navn matcher ikke", () => {
    const pois: PoiEntry[] = [
      { uuid: UUID_A, name: "Byhaven AS", category: "hverdagsliv" },
    ];
    // Fullt navn matcher (ordgrense), men "Bunnpris"-stil kort-form gjør det ikke.
    expect(linkPoisInMarkdown("Byhaven AS er fint.", pois).linked).toBe(
      `[Byhaven AS](poi:${UUID_A}) er fint.`,
    );
    expect(linkPoisInMarkdown("Byhaven er fint.", pois).linked).toBe(
      "Byhaven er fint.", // "Byhaven" alene matcher ikke "Byhaven AS" (ingen stripping)
    );
  });

  it("DIVERGENS §5.3: ordgrense hindrer delvise treff (motsatt av segment-adapter)", () => {
    const pois: PoiEntry[] = [
      { uuid: UUID_A, name: "Sentrum", category: "hverdagsliv" },
    ];
    // Markdown: ordgrense → ingen treff inne i "Sentrumsterminalen".
    expect(linkPoisInMarkdown("Sentrumsterminalen er travel.", pois).linked).toBe(
      "Sentrumsterminalen er travel.",
    );
    // Segment-adapteren (motsatt vedtak) ville lenket "Sentrum" — bevist over.
  });

  it("æøå-navn lenkes korrekt", () => {
    const pois: PoiEntry[] = [
      { uuid: UUID_A, name: "Bakklandet Skydsstation", category: "opplevelser" },
    ];
    expect(
      linkPoisInMarkdown("Besøk Bakklandet Skydsstation i dag.", pois).linked,
    ).toBe(`Besøk [Bakklandet Skydsstation](poi:${UUID_A}) i dag.`);
  });
});
