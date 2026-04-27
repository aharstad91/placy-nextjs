import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReportThemeGroundingView } from "@/lib/types";
import ReportGroundingChips from "./ReportGroundingChips";

afterEach(cleanup);

function buildGrounding(
  overrides: Partial<ReportThemeGroundingView> = {},
): ReportThemeGroundingView {
  return {
    groundingVersion: 1,
    narrative: "Lorem ipsum narrative content for testing.",
    sources: [],
    searchEntryPointHtml:
      '<div><a href="https://google.com/search?q=test">test</a><a href="https://google.com/search?q=foo">foo</a></div>',
    fetchedAt: "2026-04-27T10:00:00Z",
    ...overrides,
  } as ReportThemeGroundingView;
}

describe("ReportGroundingChips", () => {
  it("renders the 'Google foreslår også' heading", () => {
    render(<ReportGroundingChips grounding={buildGrounding()} />);
    expect(screen.getByText("Google foreslår også")).toBeInTheDocument();
  });

  it("renders searchEntryPointHtml verbatim via dangerouslySetInnerHTML", () => {
    const html =
      '<span data-testid="chip-marker"><a href="https://example.com">x</a></span>';
    render(
      <ReportGroundingChips grounding={buildGrounding({ searchEntryPointHtml: html })} />,
    );
    expect(screen.getByTestId("chip-marker")).toBeInTheDocument();
  });

  it("injects target='_blank' + rel + referrerpolicy on every <a> after mount", () => {
    const { container } = render(
      <ReportGroundingChips grounding={buildGrounding()} />,
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);
    links.forEach((a) => {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer nofollow");
      expect(a.getAttribute("referrerpolicy")).toBe("no-referrer");
    });
  });

  it("returns null when searchEntryPointHtml is empty string", () => {
    const { container } = render(
      <ReportGroundingChips grounding={buildGrounding({ searchEntryPointHtml: "" })} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("supports v2 grounding-shape (curatedNarrative present)", () => {
    const v2: ReportThemeGroundingView = {
      groundingVersion: 2,
      narrative: "raw",
      curatedNarrative:
        "Curated narrative with sufficient length to satisfy schema constraints. ".repeat(
          3,
        ),
      sources: [],
      searchEntryPointHtml: '<div><a href="https://x.test">x</a></div>',
      fetchedAt: "2026-04-27T10:00:00Z",
      curatedAt: "2026-04-27T11:00:00Z",
      poiLinksUsed: [],
    };
    const { container } = render(<ReportGroundingChips grounding={v2} />);
    expect(container.querySelector("a")).not.toBeNull();
  });
});
