import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SubCategoryFilter } from "./SubCategoryFilter";
import type { SubCategoryInfo } from "./use-sub-category-filter";

afterEach(cleanup);

const FOUR_SUBS: SubCategoryInfo[] = [
  { id: "restaurant", name: "Restaurant", icon: "Utensils", color: "#ff0000", count: 12 },
  { id: "bakeri", name: "Bakeri", icon: "Coffee", color: "#00ff00", count: 8 },
  { id: "kafé", name: "Kafé", icon: "Coffee", color: "#0000ff", count: 7 },
  { id: "pub", name: "Pub", icon: "Wine", color: "#ffff00", count: 4 },
];

describe("SubCategoryFilter", () => {
  it("returns null when there are fewer than 2 sub-categories", () => {
    const { container } = render(
      <SubCategoryFilter
        subCategories={[FOUR_SUBS[0]]}
        hiddenIds={new Set()}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("returns null when there are 0 sub-categories", () => {
    const { container } = render(
      <SubCategoryFilter
        subCategories={[]}
        hiddenIds={new Set()}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders trigger with full POI count when nothing is filtered", () => {
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set()}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );
    // 12+8+7+4 = 31
    expect(screen.getByText("(31)")).toBeInTheDocument();
  });

  it("renders trigger with partial counter X/Y when some are hidden", () => {
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set(["bakeri"])}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );
    // visible: restaurant(12) + kafé(7) + pub(4) = 23, total 31
    expect(screen.getByText("(23/31)")).toBeInTheDocument();
  });

  it("renders trigger with 0/Y when everything hidden", () => {
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set(["restaurant", "bakeri", "kafé", "pub"])}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );
    expect(screen.getByText("(0/31)")).toBeInTheDocument();
  });

  it("calls onToggle with sub-category id when row clicked", () => {
    const onToggle = vi.fn();
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set()}
        onToggle={onToggle}
        onToggleAll={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Filtrér"));
    fireEvent.click(screen.getByText("Bakeri"));

    expect(onToggle).toHaveBeenCalledWith("bakeri");
  });

  it("renders 'Skjul alle' label when all visible", () => {
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set()}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Filtrér"));
    expect(screen.getByText("Skjul alle")).toBeInTheDocument();
  });

  it("renders 'Vis alle' label when partial or none visible", () => {
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set(["bakeri"])}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Filtrér"));
    expect(screen.getByText("Vis alle")).toBeInTheDocument();
  });

  it("calls onToggleAll with all sub-category ids when toggle-all clicked", () => {
    const onToggleAll = vi.fn();
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set()}
        onToggle={() => {}}
        onToggleAll={onToggleAll}
      />,
    );

    fireEvent.click(screen.getByText("Filtrér"));
    fireEvent.click(screen.getByText("Skjul alle"));

    expect(onToggleAll).toHaveBeenCalledWith([
      "restaurant",
      "bakeri",
      "kafé",
      "pub",
    ]);
  });

  it("renders count per sub-category in the popover", () => {
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set()}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Filtrér"));
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("aria-pressed reflects visibility state on each sub-category row", () => {
    render(
      <SubCategoryFilter
        subCategories={FOUR_SUBS}
        hiddenIds={new Set(["bakeri"])}
        onToggle={() => {}}
        onToggleAll={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Filtrér"));

    const restaurantRow = screen.getByText("Restaurant").closest("button")!;
    const bakeriRow = screen.getByText("Bakeri").closest("button")!;

    expect(restaurantRow).toHaveAttribute("aria-pressed", "true");
    expect(bakeriRow).toHaveAttribute("aria-pressed", "false");
  });
});
