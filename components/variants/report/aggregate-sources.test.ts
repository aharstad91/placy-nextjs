import { describe, it, expect } from "vitest";
import type { ReportTheme } from "./report-data";
import type {
  ReportThemeGroundingSource,
  ReportThemeGroundingView,
} from "@/lib/types";
import { aggregateSources } from "./aggregate-sources";

function source(domain: string, urlSuffix = ""): ReportThemeGroundingSource {
  return {
    domain,
    url: `https://${domain}/${urlSuffix}`,
    redirectUrl: `https://vertexaisearch.cloud.google.com/grounding-api-redirect/${domain}`,
    title: `${domain} title`,
  };
}

function grounding(
  sources: ReportThemeGroundingSource[],
  fetchedAt = "2026-04-27T10:00:00Z",
): ReportThemeGroundingView {
  return {
    groundingVersion: 1,
    narrative: "narrative content for testing.",
    sources: sources.map(({ redirectUrl: _r, ...rest }) => rest),
    searchEntryPointHtml: "<div></div>",
    fetchedAt,
  } as ReportThemeGroundingView;
}

function theme(
  id: string,
  name: string,
  groundingView?: ReportThemeGroundingView,
): ReportTheme {
  return {
    id,
    name,
    icon: "Coffee",
    color: "#000",
    grounding: groundingView,
    stats: {} as ReportTheme["stats"],
    pois: [],
    allPOIs: [],
    topRanked: [] as ReportTheme["topRanked"],
    hiddenPOIs: [],
    richnessScore: 0,
    score: {} as ReportTheme["score"],
    quote: "",
  } as ReportTheme;
}

describe("aggregateSources", () => {
  it("returns empty result for empty themes", () => {
    expect(aggregateSources([])).toEqual({ sources: [], latestFetchedAt: "" });
  });

  it("excludes themes without grounding without erroring", () => {
    const result = aggregateSources([theme("a", "Skoler")]);
    expect(result.sources).toEqual([]);
    expect(result.latestFetchedAt).toBe("");
  });

  it("excludes themes with empty sources array", () => {
    const result = aggregateSources([
      theme("a", "Skoler", grounding([])),
    ]);
    expect(result.sources).toEqual([]);
    expect(result.latestFetchedAt).toBe("2026-04-27T10:00:00Z");
  });

  it("flattens sources from multiple themes with distinct domains", () => {
    const result = aggregateSources([
      theme("a", "Skoler", grounding([source("schoolinfo.no")])),
      theme("b", "Transport", grounding([source("atb.no")])),
    ]);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].domain).toBe("atb.no"); // alphabetical
    expect(result.sources[1].domain).toBe("schoolinfo.no");
    expect(result.sources[0].themeNames).toEqual(["Transport"]);
    expect(result.sources[1].themeNames).toEqual(["Skoler"]);
  });

  it("deduplicates same domain across themes and merges themeNames", () => {
    const result = aggregateSources([
      theme("a", "Skoler", grounding([source("valentinlyst.no")])),
      theme("b", "Handel", grounding([source("valentinlyst.no", "shop")])),
      theme("c", "Transport", grounding([source("valentinlyst.no", "bus")])),
    ]);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].domain).toBe("valentinlyst.no");
    expect(result.sources[0].themeNames).toEqual([
      "Skoler",
      "Handel",
      "Transport",
    ]);
    // First-seen url wins
    expect(result.sources[0].url).toBe("https://valentinlyst.no/");
  });

  it("treats domain case-insensitively (Valentinlyst.no === valentinlyst.no)", () => {
    const result = aggregateSources([
      theme("a", "Skoler", grounding([source("Valentinlyst.no")])),
      theme("b", "Handel", grounding([source("valentinlyst.no")])),
    ]);
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].themeNames).toEqual(["Skoler", "Handel"]);
  });

  it("does not duplicate themeName if same theme has multiple sources for same domain", () => {
    const result = aggregateSources([
      theme(
        "a",
        "Skoler",
        grounding([source("valentinlyst.no"), source("valentinlyst.no", "page2")]),
      ),
    ]);
    expect(result.sources[0].themeNames).toEqual(["Skoler"]);
  });

  it("picks the latest fetchedAt across themes", () => {
    const result = aggregateSources([
      theme("a", "A", grounding([source("a.no")], "2026-04-25T10:00:00Z")),
      theme("b", "B", grounding([source("b.no")], "2026-04-27T11:30:00Z")),
      theme("c", "C", grounding([source("c.no")], "2026-04-26T09:00:00Z")),
    ]);
    expect(result.latestFetchedAt).toBe("2026-04-27T11:30:00Z");
  });

  it("supports mixed v1 + v2 grounding shapes", () => {
    const v2: ReportThemeGroundingView = {
      groundingVersion: 2,
      narrative: "raw",
      curatedNarrative: "curated narrative ".repeat(10),
      sources: [
        {
          domain: "a.no",
          url: "https://a.no/",
          title: "A",
        },
      ],
      searchEntryPointHtml: "<div></div>",
      fetchedAt: "2026-04-27T10:00:00Z",
      curatedAt: "2026-04-27T11:00:00Z",
      poiLinksUsed: [],
    };
    const v1 = grounding([source("b.no")]);
    const result = aggregateSources([
      theme("a", "A", v1),
      theme("b", "B", v2),
    ]);
    expect(result.sources.map((s) => s.domain)).toEqual(["a.no", "b.no"]);
  });
});
