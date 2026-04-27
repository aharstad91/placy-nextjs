import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReportTheme } from "./report-data";
import type { ReportThemeGroundingView } from "@/lib/types";
import ReportSourcesAggregated from "./ReportSourcesAggregated";

// vaul (Drawer) leser window.matchMedia ved mount — jsdom har det ikke som default.
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
});

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

  it("renders 'Kilder (N)' trigger button with the deduplicated count", () => {
    render(
      <ReportSourcesAggregated
        themes={[
          theme("a", "Skoler", grounding(["a.no", "b.no"])),
          theme("b", "Handel", grounding(["a.no", "c.no"])),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: /Kilder \(3\)/ })).toBeInTheDocument();
  });

  it("renders attribution paragraph (visible without opening drawer)", () => {
    render(
      <ReportSourcesAggregated
        themes={[
          theme("a", "A", grounding(["a.no"], "2026-04-27T10:00:00Z")),
        ]}
      />,
    );
    expect(
      screen.getByText(/Generert med Google AI basert på offentlige kilder\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/27\. april 2026/)).toBeInTheDocument();
  });

  it("opens drawer with grouped content on trigger click", async () => {
    const user = userEvent.setup();
    render(
      <ReportSourcesAggregated
        themes={[
          theme(
            "hverdag",
            "Hverdagsliv",
            grounding(["coop.no", "valentinlyst.no"]),
          ),
          theme(
            "barn",
            "Barn & Oppvekst",
            grounding(["barnehagefakta.no"]),
          ),
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Kilder \(3\)/ }));

    // Drawer headings (themes in input order)
    const themeHeadings = await screen.findAllByText(/Hverdagsliv|Barn & Oppvekst/);
    expect(themeHeadings.length).toBeGreaterThanOrEqual(2);

    // Source links rendered
    expect(screen.getByRole("link", { name: "coop.no" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "valentinlyst.no" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "barnehagefakta.no" })).toBeInTheDocument();
  });

  it("source links inside drawer carry correct security attributes", async () => {
    const user = userEvent.setup();
    render(
      <ReportSourcesAggregated
        themes={[theme("a", "Skoler", grounding(["a.no"]))]}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Kilder \(1\)/ }));
    const link = await screen.findByRole("link", { name: "a.no" });
    expect(link.getAttribute("href")).toBe("https://a.no/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(link.getAttribute("referrerpolicy")).toBe("no-referrer");
  });
});
