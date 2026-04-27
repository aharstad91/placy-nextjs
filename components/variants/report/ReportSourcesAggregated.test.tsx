import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReportTheme } from "./report-data";
import type { ReportThemeGroundingView } from "@/lib/types";
import ReportSourcesAggregated from "./ReportSourcesAggregated";

afterEach(cleanup);

function grounding(
  domains: string[],
  fetchedAt = "2026-04-27T10:00:00Z",
): ReportThemeGroundingView {
  return {
    groundingVersion: 1,
    narrative: "narrative",
    sources: domains.map((d) => ({
      domain: d,
      url: `https://${d}/`,
      title: `${d} title`,
    })),
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

describe("ReportSourcesAggregated", () => {
  it("returns null when no theme has sources", () => {
    const { container } = render(
      <ReportSourcesAggregated themes={[theme("a", "A")]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null for empty themes array", () => {
    const { container } = render(<ReportSourcesAggregated themes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders 'Kilder (N)' header with the deduplicated count", () => {
    render(
      <ReportSourcesAggregated
        themes={[
          theme("a", "Skoler", grounding(["a.no", "b.no"])),
          theme("b", "Handel", grounding(["a.no", "c.no"])),
        ]}
      />,
    );
    expect(screen.getByText("Kilder (3)")).toBeInTheDocument();
  });

  it("renders source links with correct security attributes", () => {
    const { container } = render(
      <ReportSourcesAggregated
        themes={[theme("a", "Skoler", grounding(["a.no"]))]}
      />,
    );
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://a.no/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("shows theme-name badges for sources used in multiple themes", () => {
    render(
      <ReportSourcesAggregated
        themes={[
          theme("a", "Skoler", grounding(["valentinlyst.no"])),
          theme("b", "Handel", grounding(["valentinlyst.no"])),
        ]}
      />,
    );
    expect(screen.getByText("(Skoler, Handel)")).toBeInTheDocument();
  });

  it("renders attribution with latest fetchedAt formatted in no-NO locale", () => {
    render(
      <ReportSourcesAggregated
        themes={[
          theme(
            "a",
            "A",
            grounding(["a.no"], "2026-04-27T10:00:00Z"),
          ),
        ]}
      />,
    );
    // no-NO long date — example: "27. april 2026"
    expect(
      screen.getByText(/Generert med Google AI basert på offentlige kilder\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/27\. april 2026/)).toBeInTheDocument();
  });
});
