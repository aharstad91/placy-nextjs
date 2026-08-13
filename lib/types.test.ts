import { describe, it, expect } from "vitest";
import {
  PoiGroundingViewSchema,
  PoiGroundingGeneratedSchema,
} from "./types";

/**
 * Skjema-tester for per-POI grounding (v2.pois.grounding, migrasjon 084).
 *
 * Tema-grounding-skjemaene (ReportThemeGrounding*) testes i
 * lib/gemini/types.test.ts. Dette er et SEPARAT lag med egen versjonsakse —
 * testene her verner mot at de to blandes.
 */

const GENERATED = {
  provider: "gemini-search-grounding" as const,
  narrative:
    "Muustrøparken ligger langs Nidelva i Trondheim. Parken er et åpent grøntområde med amfi og skulpturer.",
  sources: [
    {
      title: "Muustrøparken – Trondheim kommune",
      url: "https://www.trondheim.kommune.no/muustroparken",
      redirectUrl: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc",
      domain: "trondheim.kommune.no",
    },
  ],
  searchEntryPointHtml: '<style>.chip{}</style><div class="chip">Muustrøparken</div>',
  searchQueries: ["Muustrøparken Trondheim"],
  model: "gemini-2.5-flash",
  fetchedAt: "2026-08-12T10:00:00.000Z",
  qualityGate: { passed: true, sourceCount: 1, charCount: 104 },
};

const CURATED = {
  narrative: "Nabolagets grønne pustehull, med amfiet som samlingspunkt om sommeren.",
  curatedAt: "2026-08-12T12:00:00.000Z",
};

/** Kopi av GENERATED uten de oppgitte feltene — for «mangler felt»-testene. */
function generatedWithout(...fields: string[]): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...GENERATED };
  for (const f of fields) delete copy[f];
  return copy;
}

describe("PoiGroundingViewSchema", () => {
  it("parser komplett generated-lag", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 1,
      generated: GENERATED,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generated?.narrative).toContain("Muustrøparken");
      expect(result.data.generated?.qualityGate.passed).toBe(true);
    }
  });

  it("bevarer begge lag når både generated og curated finnes", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 1,
      generated: GENERATED,
      curated: CURATED,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generated).toBeDefined();
      expect(result.data.curated?.narrative).toContain("pustehull");
    }
  });

  it("godtar curated alene — det Placy-eide laget krever ikke en provider", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 1,
      curated: CURATED,
    });
    expect(result.success).toBe(true);
  });

  it("lagrer strykere: passed=false med reason er gyldig", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 1,
      generated: {
        ...GENERATED,
        qualityGate: {
          passed: false,
          sourceCount: 1,
          charCount: 90,
          reason: "For få kilder (1 < 3)",
        },
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generated?.qualityGate.reason).toBe("For få kilder (1 < 3)");
    }
  });

  it("avviser ukjent poiGroundingVersion — versjon-bump tvinger regenerering", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 2,
      generated: GENERATED,
    });
    expect(result.success).toBe(false);
  });

  it("avviser generated uten searchEntryPointHtml (Google ToS-krav)", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 1,
      generated: generatedWithout("searchEntryPointHtml"),
    });
    expect(result.success).toBe(false);
  });

  it("avviser tom searchEntryPointHtml — tom streng er ikke attribusjon", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 1,
      generated: { ...GENERATED, searchEntryPointHtml: "" },
    });
    expect(result.success).toBe(false);
  });

  it("avviser ukjent provider — vi kan ikke rendre attribusjon vi ikke kjenner", () => {
    const result = PoiGroundingGeneratedSchema.safeParse({
      ...GENERATED,
      provider: "some-future-provider",
    });
    expect(result.success).toBe(false);
  });

  it("default-er tomme sources og searchQueries når feltene mangler", () => {
    const result = PoiGroundingViewSchema.safeParse({
      poiGroundingVersion: 1,
      generated: generatedWithout("sources", "searchQueries"),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generated?.sources).toEqual([]);
      expect(result.data.generated?.searchQueries).toEqual([]);
    }
  });
});
