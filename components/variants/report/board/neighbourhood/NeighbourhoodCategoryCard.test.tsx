import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import {
  NeighbourhoodCategoryCard,
  categorySubline,
} from "./NeighbourhoodCategoryCard";
import type { NeighbourhoodCategory } from "@/lib/board/neighbourhood-list";
import type { BoardPOI } from "../board-data";

/**
 * Unit 3b — kategorikortet.
 *
 * Kortets jobb er å være avgjørbart uten prosa: ikon, navn, dekning,
 * tidsspenn, og inntil tre punkter med gangtid. Testene låser at tallene
 * stemmer med modellens output, at R26-grenen (punkt uten gangtid) rendres
 * uten minutt-tall, og at begge veiene til kategorisiden fungerer (R15).
 */

afterEach(() => cleanup());

function poi(id: string, name = id): BoardPOI {
  return {
    id: id as BoardPOI["id"],
    name,
    coordinates: { lat: 63.43, lng: 10.4 },
    categoryId: "mat" as BoardPOI["categoryId"],
    raw: {
      id,
      name,
      coordinates: { lat: 63.43, lng: 10.4 },
      category: { id: "restaurant", name: "Restaurant", icon: "UtensilsCrossed", color: "#c33" },
    } as BoardPOI["raw"],
  };
}

function category(
  overrides: Partial<NeighbourhoodCategory<BoardPOI>> = {},
): NeighbourhoodCategory<BoardPOI> {
  return {
    id: "hverdag",
    label: "Hverdagsliv",
    icon: "ShoppingCart",
    color: "#2f6f4f",
    visibleCount: 9,
    totalCount: 17,
    minMinutes: 4,
    maxMinutes: 21,
    rows: [
      { poi: poi("p1", "Coop Mega"), minutes: 4 },
      { poi: poi("p2", "Vinmonopolet"), minutes: 6 },
      { poi: poi("p3", "Kiwi Tyholt"), minutes: 5 },
    ],
    hasMore: true,
    ...overrides,
  };
}

describe("categorySubline", () => {
  it("viser dekning og tidsspenn når bare noen punkter er synlige", () => {
    expect(categorySubline(category())).toBe("9 av 17 synlig · 4–21 min");
  });

  it("viser antall i stedet for brøk når alt er synlig (17 av 17 er støy)", () => {
    expect(
      categorySubline(category({ visibleCount: 17, totalCount: 17 })),
    ).toBe("17 steder · 4–21 min");
  });

  it("viser ett tall når spennet er sammenfallende", () => {
    expect(
      categorySubline(
        category({ visibleCount: 1, totalCount: 1, minMinutes: 6, maxMinutes: 6 }),
      ),
    ).toBe("1 sted · 6 min");
  });

  it("utelater tidsspennet helt når ingen punkter har gangtid (R26)", () => {
    expect(
      categorySubline(
        category({ minMinutes: undefined, maxMinutes: undefined }),
      ),
    ).toBe("9 av 17 synlig");
  });
});

describe("NeighbourhoodCategoryCard", () => {
  it("viser navn, dekning/spenn og inntil tre punkter med gangtid", () => {
    const { getByText } = render(
      <NeighbourhoodCategoryCard category={category()} onOpen={vi.fn()} />,
    );
    expect(getByText("Hverdagsliv")).toBeTruthy();
    expect(getByText("9 av 17 synlig · 4–21 min")).toBeTruthy();
    expect(getByText("Coop Mega")).toBeTruthy();
    expect(getByText("4 min")).toBeTruthy();
  });

  it("rendrer punkt uten gangtid uten minutt-tall — aldri et estimat (R26)", () => {
    const { getByText, queryByText, container } = render(
      <NeighbourhoodCategoryCard
        category={category({
          rows: [
            { poi: poi("p1", "Coop Mega"), minutes: 4 },
            { poi: poi("p9", "Ukjent sted") },
          ],
        })}
        onOpen={vi.fn()}
      />,
    );
    expect(getByText("Ukjent sted")).toBeTruthy();
    expect(queryByText("NaN min")).toBeNull();
    expect(container.textContent).not.toContain("undefined");
  });

  it("åpner kategorisiden fra headeren (R15)", () => {
    const onOpen = vi.fn();
    const { getByText } = render(
      <NeighbourhoodCategoryCard category={category()} onOpen={onOpen} />,
    );
    fireEvent.click(getByText("Hverdagsliv"));
    expect(onOpen).toHaveBeenCalledWith("hverdag");
  });

  it("åpner kategorisiden fra «se alle»-raden (R15)", () => {
    const onOpen = vi.fn();
    const { getByText } = render(
      <NeighbourhoodCategoryCard category={category()} onOpen={onOpen} />,
    );
    fireEvent.click(getByText("Se alle 17"));
    expect(onOpen).toHaveBeenCalledWith("hverdag");
  });

  it("viser ingen «se alle»-rad når alle synlige punkter allerede står der", () => {
    const { queryByText } = render(
      <NeighbourhoodCategoryCard
        category={category({ hasMore: false, visibleCount: 3, totalCount: 3 })}
        onOpen={vi.fn()}
      />,
    );
    expect(queryByText(/Se alle/)).toBeNull();
  });

  it("rendrer færre enn tre rader uten tomme plassholdere", () => {
    const { container } = render(
      <NeighbourhoodCategoryCard
        category={category({
          rows: [{ poi: poi("p1", "Coop Mega"), minutes: 4 }],
          hasMore: false,
        })}
        onOpen={vi.fn()}
      />,
    );
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("bruker vanlige lister og knapper — ikke listbox/option (a11y-buggen)", () => {
    const { container } = render(
      <NeighbourhoodCategoryCard category={category()} onOpen={vi.fn()} />,
    );
    expect(container.querySelector('[role="listbox"]')).toBeNull();
    expect(container.querySelector('[role="option"]')).toBeNull();
    expect(container.querySelector("ul")).toBeTruthy();
  });
});
