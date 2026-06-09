import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBoardCollection } from "./use-board-collection";
import { useCollectionStore } from "@/lib/collection-store";

describe("useBoardCollection (Unit 5)", () => {
  beforeEach(() => {
    // Nullstill den persisterte storen mellom tester.
    useCollectionStore.setState({ projectId: null, collectionPOIs: [] });
  });

  it("rehydrerer en delt ?c=-samling (server → store) — 3 events preselektert", () => {
    const { result } = renderHook(() =>
      useBoardCollection("kulturnatt-2025", true, ["p1", "p2", "p3"], "abc123"),
    );

    // FAKTISK rehydrering: de 3 IDene ligger i samlingen, ikke bare param-parsing.
    expect(result.current.collectionPoiIds).toEqual(new Set(["p1", "p2", "p3"]));
    expect(result.current.collectionPoiList).toEqual(["p1", "p2", "p3"]);
    expect(result.current.has("p2")).toBe(true);
    expect(result.current.has("p9")).toBe(false);
  });

  it("uten delt slug starter samlingen tom; toggle legger til / fjerner", () => {
    const { result } = renderHook(() =>
      useBoardCollection("kulturnatt-2025", true),
    );
    expect(result.current.collectionPoiIds.size).toBe(0);

    act(() => result.current.toggle("p1"));
    expect(result.current.has("p1")).toBe(true);

    act(() => result.current.toggle("p1"));
    expect(result.current.has("p1")).toBe(false);
  });

  it("ugyldig slug (poiIds undefined) → tom samling, ingen krasj", () => {
    const { result } = renderHook(() =>
      useBoardCollection("kulturnatt-2025", true, undefined, undefined),
    );
    expect(result.current.collectionPoiIds.size).toBe(0);
  });

  it("disabled (boligrapport) → inert: scoper ikke, eksponerer tom samling", () => {
    // Forhåndsfyll storen som om en Explorer-samling er aktiv i et annet prosjekt.
    useCollectionStore.setState({
      projectId: "annet-prosjekt",
      collectionPOIs: ["x1", "x2"],
    });

    const { result } = renderHook(() =>
      useBoardCollection("kulturnatt-2025", false, ["p1"], "abc123"),
    );

    // Inert: ingen scoping (Explorer-samlingen er urørt) og API-en er tom.
    expect(useCollectionStore.getState().projectId).toBe("annet-prosjekt");
    expect(useCollectionStore.getState().collectionPOIs).toEqual(["x1", "x2"]);
    expect(result.current.collectionPoiIds.size).toBe(0);

    // toggle/remove/clear er no-op når disabled.
    act(() => result.current.toggle("p1"));
    expect(useCollectionStore.getState().collectionPOIs).toEqual(["x1", "x2"]);
  });

  it("setProject clearer stale POIer ved prosjekt-bytte (scoping)", () => {
    useCollectionStore.setState({
      projectId: "gammelt",
      collectionPOIs: ["stale1"],
    });

    const { result } = renderHook(() =>
      useBoardCollection("nytt-prosjekt", true),
    );

    // Prosjekt-bytte clearet den stale samlingen.
    expect(result.current.collectionPoiIds.size).toBe(0);
    expect(useCollectionStore.getState().projectId).toBe("nytt-prosjekt");
  });
});
