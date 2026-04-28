import { describe, it, expect } from "vitest";
import { GeminiResponseSchema } from "./types";
import { ReportThemeGroundingViewSchema } from "../types";

describe("GeminiResponseSchema", () => {
  it("parses a valid response", () => {
    const result = GeminiResponseSchema.safeParse({
      candidates: [
        {
          content: { parts: [{ text: "En historisk bydel i Trondheim." }] },
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://example.com/redirect/abc", title: "Kilde 1" } },
            ],
            webSearchQueries: ["Stasjonskvartalet dagligvare"],
            searchEntryPoint: { renderedContent: "<div>chip</div>" },
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty candidates array", () => {
    const result = GeminiResponseSchema.safeParse({ candidates: [] });
    expect(result.success).toBe(false);
  });

  it("accepts response without groundingMetadata (optional)", () => {
    const result = GeminiResponseSchema.safeParse({
      candidates: [{ content: { parts: [{ text: "hi" }] } }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when searchEntryPoint missing renderedContent", () => {
    const result = GeminiResponseSchema.safeParse({
      candidates: [
        {
          content: { parts: [{ text: "x" }] },
          groundingMetadata: {
            searchEntryPoint: { renderedContent: "" },
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("ReportThemeGroundingViewSchema", () => {
  const valid = {
    narrative: "En fin beskrivelse med flere setninger.",
    sources: [
      {
        title: "Kilde 1",
        url: "https://trondheim.kommune.no/artikkel",
        domain: "trondheim.kommune.no",
      },
    ],
    searchEntryPointHtml: "<div>google chip</div>",
    fetchedAt: "2026-04-18T12:00:00Z",
    groundingVersion: 1 as const,
  };

  it("parses valid data", () => {
    const result = ReportThemeGroundingViewSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects groundingVersion outside {1, 2}", () => {
    const result = ReportThemeGroundingViewSchema.safeParse({
      ...valid,
      groundingVersion: 3,
    });
    expect(result.success).toBe(false);
  });

  it("parses v2 with curatedNarrative", () => {
    const v2 = {
      ...valid,
      groundingVersion: 2 as const,
      curatedNarrative:
        "En kuratert unified tekst med minst hundre tegn. Den har POI-lenker og flyter sømløst. Her er enda en setning for å sikre lengden.",
      curatedAt: "2026-04-19T08:00:00Z",
      poiLinksUsed: ["550e8400-e29b-41d4-a716-446655440000"],
    };
    const result = ReportThemeGroundingViewSchema.safeParse(v2);
    expect(result.success).toBe(true);
  });

  it("rejects v2 without curatedNarrative", () => {
    const result = ReportThemeGroundingViewSchema.safeParse({
      ...valid,
      groundingVersion: 2,
      curatedAt: "2026-04-19T08:00:00Z",
    });
    expect(result.success).toBe(false);
  });

  it("v1 passthrough allows extra v2 fields during rollout", () => {
    const partial = {
      ...valid,
      // v2-felter på v1-rad (mellomtilstand under curation)
      curatedNarrative: "pågående kuratering",
    };
    const result = ReportThemeGroundingViewSchema.safeParse(partial);
    expect(result.success).toBe(true);
  });

  it("accepts non-UUID POI ids in poiLinksUsed", () => {
    // POI-tabellen i Placy har heterogene IDer (UUID, google-ChIJ…, slug-stil).
    // Schema må akseptere alle — sikkerheten ligger i whitelist-oppslaget
    // mot prosjektets POI-set ved render, ikke ID-form.
    const result = ReportThemeGroundingViewSchema.safeParse({
      ...valid,
      groundingVersion: 2,
      curatedNarrative:
        "En kuratert unified tekst med minst hundre tegn. Den har POI-lenker og flyter sømløst. Her er enda en setning for å sikre lengden.",
      curatedAt: "2026-04-19T08:00:00Z",
      poiLinksUsed: [
        "550e8400-e29b-41d4-a716-446655440000",
        "google-ChIJm6lLfZ8xbUYRFYo0NaeG5sk",
        "bus-dronningens-gate",
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty strings in poiLinksUsed", () => {
    const result = ReportThemeGroundingViewSchema.safeParse({
      ...valid,
      groundingVersion: 2,
      curatedNarrative:
        "En kuratert unified tekst med minst hundre tegn. Den har POI-lenker og flyter sømløst. Her er enda en setning for å sikre lengden.",
      curatedAt: "2026-04-19T08:00:00Z",
      poiLinksUsed: [""],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty searchEntryPointHtml (Google ToS)", () => {
    const result = ReportThemeGroundingViewSchema.safeParse({
      ...valid,
      searchEntryPointHtml: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty narrative", () => {
    const result = ReportThemeGroundingViewSchema.safeParse({
      ...valid,
      narrative: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid URL in sources", () => {
    const result = ReportThemeGroundingViewSchema.safeParse({
      ...valid,
      sources: [{ title: "x", url: "not-a-url", domain: "x" }],
    });
    expect(result.success).toBe(false);
  });

  it("defaults sources to empty array", () => {
    const rest = { ...valid };
    delete (rest as Partial<typeof valid>).sources;
    const result = ReportThemeGroundingViewSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.sources).toEqual([]);
  });
});
