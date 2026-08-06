import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { Project } from "@/lib/types";

/**
 * Ruta er en tynn komposisjon, men den bærer beslutningen hele demoen hviler
 * på: `boardData` skal IKKE sendes inn.
 *
 * `ReportReelsPage` setter `eventMode = inputBoardData !== undefined`, og i
 * event-modus rendrer mobil `EventMobileSheet` i stedet for nabolagsflaten.
 * En senere «gjenbruk event-mønsteret»-endring ville byttet flaten uten at én
 * eneste test feilet. Denne gjør det.
 */

const seen: { props: Record<string, unknown> | null } = { props: null };

vi.mock("@/components/variants/report/reels/ReportReelsPage", () => ({
  default: (props: Record<string, unknown>) => {
    seen.props = props;
    return <div data-testid="report-reels-page" />;
  },
}));

afterEach(() => {
  cleanup();
  seen.props = null;
});

async function renderPage() {
  const { default: MidtbyenPage } = await import("./page");
  return render(<MidtbyenPage />);
}

describe("/midtbyen", () => {
  it("rendrer boardet med et prosjekt som har butikker", async () => {
    const { getByTestId } = await renderPage();
    expect(getByTestId("report-reels-page")).toBeTruthy();

    const project = seen.props?.project as Project;
    expect(project.pois.length).toBe(147);
    expect(project.categories.length).toBeGreaterThan(0);
  });

  it("sender IKKE boardData — det ville byttet mobilflaten til event-sheeten", async () => {
    await renderPage();
    expect(seen.props).not.toBeNull();
    expect("boardData" in seen.props!).toBe(false);
  });

  it("eksporterer metadata med tittel", async () => {
    const { metadata } = await import("./page");
    expect(metadata.title).toBeTruthy();
    expect(String(metadata.description).length).toBeGreaterThan(0);
  });
});
