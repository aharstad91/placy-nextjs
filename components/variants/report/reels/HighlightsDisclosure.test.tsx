import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { HighlightsDisclosure } from "./HighlightsDisclosure";
import type { SidebarHighlight } from "./HighlightsDisclosure";

/**
 * «Verdt å merke seg»-seksjonen i desktop-sidebarens kategori-panel
 * (2026-08-13). Kontrakten: kollapset ved 2+, toggle begge veier, ingen
 * accordion ved presis ett punkt, og POI-ens EGEN identitet på radene.
 */

vi.mock("@/lib/hooks/useRealtimeData", () => ({
  useRealtimeData: () => null,
}));
vi.mock("../blocks/POIRealtimeSection", () => ({
  POIRealtimeSection: () => <div data-testid="realtime" />,
}));

afterEach(() => cleanup());

function highlight(
  id: string,
  overrides: Partial<SidebarHighlight> = {},
): SidebarHighlight {
  return {
    id,
    name: `Sted ${id}`,
    icon: "ForkKnife",
    color: "#f35a5a",
    ...overrides,
  };
}

const THREE = [highlight("a"), highlight("b"), highlight("c")];

describe("HighlightsDisclosure", () => {
  it("rendrer ingenting uten highlights", () => {
    const { queryByTestId } = render(<HighlightsDisclosure highlights={[]} />);
    expect(queryByTestId("highlights-section")).toBeNull();
  });

  it("ett punkt → ingen toggle, raden står åpen", () => {
    const { queryByTestId, getAllByTestId } = render(
      <HighlightsDisclosure highlights={[highlight("solo")]} />,
    );
    expect(queryByTestId("highlights-toggle")).toBeNull();
    expect(getAllByTestId("highlight-row")).toHaveLength(1);
  });

  it("tre punkter → kollapset ved montering, med antall i toggle-raden", () => {
    const { getByTestId } = render(<HighlightsDisclosure highlights={THREE} />);
    const toggle = getByTestId("highlights-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toContain("3 steder å merke seg");

    const panel = getByTestId("highlights-panel");
    expect(panel.dataset.expanded).toBe("false");
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    // Husets CSS-toggle: begge tilstander i DOM, høyde/opacity styrer.
    expect(panel.className).toContain("max-h-0");
    expect(panel.className).toContain("opacity-0");
  });

  it("klikk åpner, nytt klikk lukker (toggle begge veier)", () => {
    const { getByTestId } = render(<HighlightsDisclosure highlights={THREE} />);
    const toggle = getByTestId("highlights-toggle");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(getByTestId("highlights-panel").dataset.expanded).toBe("true");
    expect(getByTestId("highlights-panel").className).toContain("opacity-100");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(getByTestId("highlights-panel").dataset.expanded).toBe("false");
  });

  it("toggle-teksten forteller hva klikket gjør, i begge tilstander", () => {
    const { getByTestId } = render(<HighlightsDisclosure highlights={THREE} />);
    const toggle = getByTestId("highlights-toggle");
    expect(toggle.textContent).toContain("Se hvilke");
    fireEvent.click(toggle);
    expect(toggle.textContent).toContain("Skjul lista");
  });

  it("alle radene finnes i DOM også kollapset (CSS-toggle, ikke unmount)", () => {
    const { getAllByTestId } = render(<HighlightsDisclosure highlights={THREE} />);
    expect(getAllByTestId("highlight-row")).toHaveLength(3);
  });

  it("rad-klikk åpner POI-en og rører ikke accordion-tilstanden", () => {
    const onOpenPoi = vi.fn();
    const { getByTestId, getAllByTestId } = render(
      <HighlightsDisclosure highlights={THREE} onOpenPoi={onOpenPoi} />,
    );
    fireEvent.click(getByTestId("highlights-toggle"));
    fireEvent.click(getAllByTestId("highlight-row")[1]);

    expect(onOpenPoi).toHaveBeenCalledWith("b");
    expect(getByTestId("highlights-toggle").getAttribute("aria-expanded")).toBe("true");
  });

  it("POI-radene ligger UTENFOR toggle-knappen (ingen nøstede knapper)", () => {
    const { getByTestId } = render(<HighlightsDisclosure highlights={THREE} />);
    expect(getByTestId("highlights-toggle").querySelector("button")).toBeNull();
  });

  it("transport-highlight får sanntidsseksjon, vanlig punkt ikke", () => {
    const { queryAllByTestId } = render(
      <HighlightsDisclosure
        highlights={[
          highlight("buss", { enturStopplaceId: "NSR:StopPlace:1" }),
          highlight("kafe"),
        ]}
      />,
    );
    expect(queryAllByTestId("realtime")).toHaveLength(1);
  });

  it("ikon-klyngen viser maks fire, uansett hvor mange highlights", () => {
    const many = ["a", "b", "c", "d", "e", "f"].map((id) => highlight(id));
    const { getByTestId } = render(<HighlightsDisclosure highlights={many} />);
    const cluster = getByTestId("highlights-toggle").querySelector("span[aria-hidden]");
    expect(cluster?.querySelectorAll("svg")).toHaveLength(4);
    // Men tallet er sant.
    expect(getByTestId("highlights-toggle").textContent).toContain("6 steder");
  });
});
