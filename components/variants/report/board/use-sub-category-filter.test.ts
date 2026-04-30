import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useSubCategoryFilter,
  deriveSubCategories,
} from "./use-sub-category-filter";
import type { BoardCategory, BoardCategoryId, BoardPOIId } from "./board-data";
import type { POI } from "@/lib/types";

function makePoi(id: string, catId: string, catName = catId): POI {
  return {
    id,
    name: `POI ${id}`,
    coordinates: { lat: 0, lng: 0 },
    category: {
      id: catId,
      name: catName,
      icon: "MapPin",
      color: "#000000",
    },
  } as POI;
}

function makeCategory(id: string, pois: POI[]): BoardCategory {
  return {
    id: id as BoardCategoryId,
    label: id,
    lead: "",
    body: "",
    icon: "MapPin",
    color: "#94a3b8",
    pois: pois.map((p) => ({
      id: p.id as BoardPOIId,
      name: p.name,
      coordinates: p.coordinates,
      categoryId: id as BoardCategoryId,
      raw: p,
    })),
  };
}

describe("deriveSubCategories", () => {
  it("returns empty array for category with no POIs", () => {
    const cat = makeCategory("mat", []);
    expect(deriveSubCategories(cat)).toEqual([]);
  });

  it("dedupes by category.id and counts POIs per sub-category", () => {
    const cat = makeCategory("mat", [
      makePoi("p1", "bakeri"),
      makePoi("p2", "bakeri"),
      makePoi("p3", "restaurant"),
      makePoi("p4", "restaurant"),
      makePoi("p5", "restaurant"),
      makePoi("p6", "pub"),
    ]);
    const result = deriveSubCategories(cat);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.id)).toEqual(["restaurant", "bakeri", "pub"]);
    expect(result.map((r) => r.count)).toEqual([3, 2, 1]);
  });

  it("returns single entry when all POIs share one sub-category", () => {
    const cat = makeCategory("mat", [
      makePoi("p1", "bakeri"),
      makePoi("p2", "bakeri"),
    ]);
    const result = deriveSubCategories(cat);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("bakeri");
    expect(result[0].count).toBe(2);
  });

  it("sorts by count desc", () => {
    const cat = makeCategory("mat", [
      makePoi("p1", "low"),
      makePoi("p2", "high"),
      makePoi("p3", "high"),
      makePoi("p4", "high"),
      makePoi("p5", "mid"),
      makePoi("p6", "mid"),
    ]);
    const result = deriveSubCategories(cat);
    expect(result.map((r) => r.id)).toEqual(["high", "mid", "low"]);
  });

  it("preserves name/icon/color from first POI of each sub-category", () => {
    const poi = makePoi("p1", "bakeri", "Bakeri");
    poi.category.icon = "Coffee";
    poi.category.color = "#ff0000";
    const cat = makeCategory("mat", [poi]);
    const result = deriveSubCategories(cat);
    expect(result[0]).toMatchObject({
      id: "bakeri",
      name: "Bakeri",
      icon: "Coffee",
      color: "#ff0000",
      count: 1,
    });
  });
});

describe("useSubCategoryFilter", () => {
  it("starts with empty hiddenIds (all visible)", () => {
    const { result } = renderHook(() => useSubCategoryFilter("mat"));
    expect(result.current.hiddenIds.size).toBe(0);
  });

  it("toggle adds id to hiddenIds, second toggle removes it", () => {
    const { result } = renderHook(() => useSubCategoryFilter("mat"));

    act(() => result.current.toggle("bakeri"));
    expect(result.current.hiddenIds.has("bakeri")).toBe(true);

    act(() => result.current.toggle("bakeri"));
    expect(result.current.hiddenIds.has("bakeri")).toBe(false);
  });

  it("toggle multiple ids accumulates", () => {
    const { result } = renderHook(() => useSubCategoryFilter("mat"));

    act(() => result.current.toggle("bakeri"));
    act(() => result.current.toggle("pub"));

    expect(result.current.hiddenIds.has("bakeri")).toBe(true);
    expect(result.current.hiddenIds.has("pub")).toBe(true);
    expect(result.current.hiddenIds.size).toBe(2);
  });

  it("toggleAll hides all when all visible", () => {
    const { result } = renderHook(() => useSubCategoryFilter("mat"));

    act(() =>
      result.current.toggleAll(["bakeri", "restaurant", "pub", "kafé"]),
    );
    expect(result.current.hiddenIds.size).toBe(4);
  });

  it("toggleAll shows all when all hidden", () => {
    const { result } = renderHook(() => useSubCategoryFilter("mat"));

    act(() =>
      result.current.toggleAll(["bakeri", "restaurant", "pub", "kafé"]),
    );
    act(() =>
      result.current.toggleAll(["bakeri", "restaurant", "pub", "kafé"]),
    );

    expect(result.current.hiddenIds.size).toBe(0);
  });

  it("toggleAll hides all when partial (some hidden)", () => {
    const { result } = renderHook(() => useSubCategoryFilter("mat"));

    act(() => result.current.toggle("bakeri"));
    expect(result.current.hiddenIds.size).toBe(1);

    act(() =>
      result.current.toggleAll(["bakeri", "restaurant", "pub", "kafé"]),
    );
    expect(result.current.hiddenIds.size).toBe(4);
  });

  it("resets hiddenIds when activeCategoryId changes", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useSubCategoryFilter(id),
      { initialProps: { id: "mat" } },
    );

    act(() => result.current.toggle("bakeri"));
    expect(result.current.hiddenIds.has("bakeri")).toBe(true);

    rerender({ id: "transport" });
    expect(result.current.hiddenIds.size).toBe(0);
  });

  it("does not reset when activeCategoryId stays the same on re-render", () => {
    const { result, rerender } = renderHook(
      ({ id }) => useSubCategoryFilter(id),
      { initialProps: { id: "mat" } },
    );

    act(() => result.current.toggle("bakeri"));
    rerender({ id: "mat" });
    expect(result.current.hiddenIds.has("bakeri")).toBe(true);
  });

  it("reset() clears hiddenIds", () => {
    const { result } = renderHook(() => useSubCategoryFilter("mat"));

    act(() => result.current.toggle("bakeri"));
    act(() => result.current.toggle("pub"));
    expect(result.current.hiddenIds.size).toBe(2);

    act(() => result.current.reset());
    expect(result.current.hiddenIds.size).toBe(0);
  });

  it("handles null activeCategoryId without errors", () => {
    const { result } = renderHook(() => useSubCategoryFilter(null));
    expect(result.current.hiddenIds.size).toBe(0);

    // toggle still works (might just be unused state)
    act(() => result.current.toggle("anything"));
    expect(result.current.hiddenIds.has("anything")).toBe(true);
  });
});
