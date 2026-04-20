import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { POI } from "@/lib/types";
import ReportThemePOICarousel from "./ReportThemePOICarousel";

function poi(id: string, name: string, overrides: Partial<POI> = {}): POI {
  return {
    id,
    name,
    coordinates: { lat: 0, lng: 0 },
    category: { id: "cat", name: "Mat & Drikke", icon: "Coffee", color: "#a33" },
    googleRating: 4.5,
    editorialHook: `Tekst om ${name}`,
    ...overrides,
  } as POI;
}

describe("ReportThemePOICarousel", () => {
  it("TC-1: returns null when pois is empty", () => {
    const { container } = render(
      <ReportThemePOICarousel
        pois={[]}
        totalCount={0}
        onOpenMap={() => undefined}
        ariaLabel="Steder i Test"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("TC-2: 6 POIs — renders all, CTA skjult (totalCount === pois.length)", () => {
    const pois = Array.from({ length: 6 }, (_, i) => poi(`p${i}`, `Sted ${i}`));
    render(
      <ReportThemePOICarousel
        pois={pois}
        totalCount={6}
        onOpenMap={() => undefined}
        ariaLabel="Steder i Mat & Drikke"
      />,
    );
    // Kortene rendres (unike aria-labels fra card "name, n av N")
    expect(screen.getByRole("button", { name: /Sted 0, 1 av 6/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sted 5, 6 av 6/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Se alle/ })).toBeNull();
  });

  it("TC-3: 7+ POIs — viser 6 kort (pois allerede capped av caller), CTA synlig med totalCount", () => {
    const pois = Array.from({ length: 6 }, (_, i) => poi(`p${i}`, `Sted ${i}`));
    const onOpenMap = vi.fn();
    render(
      <ReportThemePOICarousel
        pois={pois}
        totalCount={12}
        onOpenMap={onOpenMap}
        ariaLabel="Steder i Mat & Drikke"
      />,
    );
    const cta = screen.getByRole("button", { name: /Se alle 12 steder på kartet/ });
    expect(cta).toBeInTheDocument();
  });

  it("TC-3b: CTA-klikk kaller onOpenMap", async () => {
    const user = userEvent.setup();
    const pois = Array.from({ length: 6 }, (_, i) => poi(`p${i}`, `Sted ${i}`));
    const onOpenMap = vi.fn();
    render(
      <ReportThemePOICarousel
        pois={pois}
        totalCount={10}
        onOpenMap={onOpenMap}
        ariaLabel="Steder i Mat & Drikke"
      />,
    );
    await user.click(screen.getByRole("button", { name: /Se alle 10/ }));
    expect(onOpenMap).toHaveBeenCalledTimes(1);
  });

  it("TC-6: fallback når editorialHook + localInsight + description mangler (no layout crash)", () => {
    const barePOI = poi("bare", "Tom POI", {
      editorialHook: undefined,
      localInsight: undefined,
      description: undefined,
    });
    render(
      <ReportThemePOICarousel
        pois={[barePOI]}
        totalCount={1}
        onOpenMap={() => undefined}
        ariaLabel="Steder i Test"
      />,
    );
    expect(screen.getByRole("button", { name: /Tom POI, 1 av 1/ })).toBeInTheDocument();
  });

  it("A11y: uses aria-roledescription=carousel on section og slide på li", () => {
    const pois = [poi("a", "A"), poi("b", "B")];
    const { container } = render(
      <ReportThemePOICarousel
        pois={pois}
        totalCount={2}
        onOpenMap={() => undefined}
        ariaLabel="Steder i Test"
      />,
    );
    const section = container.querySelector('[aria-roledescription="carousel"]');
    expect(section).not.toBeNull();
    expect(section?.getAttribute("aria-label")).toBe("Steder i Test");
    const slides = container.querySelectorAll('[aria-roledescription="slide"]');
    expect(slides).toHaveLength(2);
  });
});
