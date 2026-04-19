import { describe, it, expect } from "vitest";
import { linkPoisInMarkdown, type PoiEntry } from "./poi-linker";

const UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
const UUID_C = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

const POI_SET: PoiEntry[] = [
  { uuid: UUID_A, name: "Byhaven", category: "hverdagsliv" },
  { uuid: UUID_B, name: "Solsiden senter", category: "hverdagsliv" },
  { uuid: UUID_C, name: "Nidarosdomen", category: "opplevelser" },
];

describe("linkPoisInMarkdown — Pass 1 (validate existing)", () => {
  it("keeps valid poi:uuid links from Claude", () => {
    const input = `Du finner [Byhaven](poi:${UUID_A}) i Midtbyen.`;
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(input);
    expect(result.poiLinksUsed).toEqual([UUID_A.toLowerCase()]);
  });

  it("strips poi:uuid with malformed UUID, keeps text (Pass 2 re-lenker hvis navn matcher)", () => {
    const input = "Check [Byhaven](poi:not-a-uuid) for details.";
    const result = linkPoisInMarkdown(input, POI_SET);
    // Pass 1 stripper malformert uuid, Pass 2 gjenkjenner "Byhaven" som POI-navn
    expect(result.linked).toBe(
      `Check [Byhaven](poi:${UUID_A}) for details.`,
    );
    expect(result.poiLinksUsed).toEqual([UUID_A.toLowerCase()]);
  });

  it("strips poi:uuid not in whitelist (cross-tenant defense)", () => {
    const ghostUuid = "00000000-0000-0000-0000-000000000000";
    const input = `Visit [Ghost POI](poi:${ghostUuid}) for fun.`;
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe("Visit Ghost POI for fun.");
    expect(result.poiLinksUsed).toEqual([]);
  });

  it("keeps https:// and http:// links untouched", () => {
    const input =
      "Se [nettsiden](https://example.com) og [dok](http://docs.com).";
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(input);
  });

  it("dedupes repeat poi:uuid links (keeps first, strips later)", () => {
    const input = `[Byhaven](poi:${UUID_A}) er stort. [Byhaven](poi:${UUID_A}) igjen.`;
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(`[Byhaven](poi:${UUID_A}) er stort. Byhaven igjen.`);
    expect(result.poiLinksUsed).toEqual([UUID_A.toLowerCase()]);
  });
});

describe("linkPoisInMarkdown — Pass 2 (bare name matching)", () => {
  it("links first occurrence of a POI name", () => {
    const input = "Byhaven er et populært kjøpesenter.";
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(
      `[Byhaven](poi:${UUID_A}) er et populært kjøpesenter.`,
    );
    expect(result.poiLinksUsed).toEqual([UUID_A.toLowerCase()]);
  });

  it("only links first occurrence per POI", () => {
    const input = "Byhaven er fint. Byhaven har mye.";
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(
      `[Byhaven](poi:${UUID_A}) er fint. Byhaven har mye.`,
    );
  });

  it("links multi-word names correctly", () => {
    const input = "Solsiden senter er en anbefaling.";
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(
      `[Solsiden senter](poi:${UUID_B}) er en anbefaling.`,
    );
  });

  it("word-boundary match — ikke delvise treff", () => {
    const input = "Byhavenesque er et påfunn.";
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(input);
    expect(result.poiLinksUsed).toEqual([]);
  });

  it("preserves original casing in replacement", () => {
    const input = "byhaven og BYHAVEN er skrevet forskjellig.";
    const result = linkPoisInMarkdown(input, POI_SET);
    // Case-insensitive regex finner første forekomst (lowercase).
    expect(result.linked).toContain(`[byhaven](poi:${UUID_A})`);
  });

  it("ikke dobbelt-lenker POIs som allerede var Pass 1-lenket", () => {
    const input = `[Byhaven](poi:${UUID_A}) er fint. Byhaven er stort.`;
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(
      `[Byhaven](poi:${UUID_A}) er fint. Byhaven er stort.`,
    );
    expect(result.poiLinksUsed).toEqual([UUID_A.toLowerCase()]);
  });

  it("ikke matcher POI-navn inni eksisterende markdown-lenke", () => {
    const input =
      "Se [Byhaven og Solsiden](https://example.com) for guides.";
    const result = linkPoisInMarkdown(input, POI_SET);
    // Navnene er inne i ekstern lenke — skal ikke dobbelt-wrappe
    expect(result.linked).toBe(input);
    expect(result.poiLinksUsed).toEqual([]);
  });
});

describe("linkPoisInMarkdown — kategoriprioritet", () => {
  it("prioriterer POI i themeCategory ved navnekollisjon", () => {
    const collisionSet: PoiEntry[] = [
      { uuid: UUID_A, name: "Torget", category: "opplevelser" },
      { uuid: UUID_B, name: "Torget", category: "hverdagsliv" },
    ];
    const input = "Torget er sentralt.";
    const hverdag = linkPoisInMarkdown(input, collisionSet, {
      themeCategory: "hverdagsliv",
    });
    expect(hverdag.linked).toContain(`poi:${UUID_B}`);

    const opplev = linkPoisInMarkdown(input, collisionSet, {
      themeCategory: "opplevelser",
    });
    expect(opplev.linked).toContain(`poi:${UUID_A}`);
  });
});

describe("linkPoisInMarkdown — edge cases", () => {
  it("returnerer tom input uendret", () => {
    expect(linkPoisInMarkdown("", POI_SET)).toEqual({
      linked: "",
      poiLinksUsed: [],
    });
  });

  it("returnerer input uendret ved tom poi_set", () => {
    const input = "Byhaven er fint.";
    const result = linkPoisInMarkdown(input, []);
    expect(result.linked).toBe(input);
    expect(result.poiLinksUsed).toEqual([]);
  });

  it("håndterer markdown-formatering rundt POI-navn", () => {
    const input = "**Byhaven** er fantastisk.";
    const result = linkPoisInMarkdown(input, POI_SET);
    expect(result.linked).toBe(`**[Byhaven](poi:${UUID_A})** er fantastisk.`);
  });

  it("lengre navn matcher før kortere (Solsiden senter før Solsiden)", () => {
    const set: PoiEntry[] = [
      { uuid: UUID_A, name: "Solsiden", category: "hverdagsliv" },
      { uuid: UUID_B, name: "Solsiden senter", category: "hverdagsliv" },
    ];
    const input = "Solsiden senter er et kjøpesenter.";
    const result = linkPoisInMarkdown(input, set);
    expect(result.linked).toBe(
      `[Solsiden senter](poi:${UUID_B}) er et kjøpesenter.`,
    );
    expect(result.poiLinksUsed).toEqual([UUID_B.toLowerCase()]);
  });

  it("filtrerer bort POIs med ugyldige UUIDs", () => {
    const set: PoiEntry[] = [
      { uuid: "not-a-uuid", name: "Ugyldig POI", category: "hverdagsliv" },
      { uuid: UUID_A, name: "Byhaven", category: "hverdagsliv" },
    ];
    const input = "Ugyldig POI og Byhaven.";
    const result = linkPoisInMarkdown(input, set);
    expect(result.linked).toContain(`[Byhaven](poi:${UUID_A})`);
    expect(result.linked).toContain("Ugyldig POI"); // ikke linket
    expect(result.poiLinksUsed).toEqual([UUID_A.toLowerCase()]);
  });
});
