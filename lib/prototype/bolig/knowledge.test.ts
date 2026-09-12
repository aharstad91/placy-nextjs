import { describe, expect, it } from "vitest";
import { BOLIG_FIXTURE } from "@/lib/prototype/bolig/fixture";
import { createBoligKnowledge, searchResult, topicResult } from "@/lib/prototype/bolig/knowledge";

describe("createBoligKnowledge", () => {
  const knowledge = createBoligKnowledge(BOLIG_FIXTURE);

  it("get_topic('barn') returns at most 5 places sorted by walk time, plus at least one unknown", () => {
    const result = topicResult(BOLIG_FIXTURE, "barn");
    expect(result.kind).toBe("topic");
    if (result.kind !== "topic") return;
    expect(result.places.length).toBeLessThanOrEqual(5);
    const walkTimes = result.places.map(p => p.walk_min ?? Infinity);
    const sorted = [...walkTimes].sort((a, b) => a - b);
    expect(walkTimes).toEqual(sorted);
    expect(result.unknowns.length).toBeGreaterThanOrEqual(1);
  });

  it("get_place with an unknown ID returns a kind 'error' result", () => {
    const result = knowledge("get_place", { place_id: "not-a-real-id" });
    expect(result.kind).toBe("error");
  });

  it("find_places('bakeri') hits Rosenborg Bakeri", () => {
    const result = searchResult(BOLIG_FIXTURE, "bakeri");
    expect(result.kind).toBe("search");
    if (result.kind !== "search") return;
    expect(result.places.some(p => p.name === "Rosenborg Bakeri")).toBe(true);
  });

  it("get_topic('selger') surfaces only example-marked content", () => {
    const result = topicResult(BOLIG_FIXTURE, "selger");
    expect(result.kind).toBe("topic");
    if (result.kind !== "topic") return;
    // No documented place carries the 'selger' topic tag.
    expect(result.places.length).toBe(0);
    expect(result.seller.length).toBeGreaterThan(0);
    for (const note of result.seller) expect(note.provenance).toBe("example");
  });

  it("routes get_topic through the tool dispatcher for a valid topic", () => {
    const result = knowledge("get_topic", { topic: "natur" });
    expect(result.kind).toBe("topic");
  });

  it("returns an error for an unknown topic", () => {
    const result = knowledge("get_topic", { topic: "ikke-et-tema" });
    expect(result.kind).toBe("error");
  });
});

describe("resolvePlace", () => {
  it("accepts exact id, exact name and unique partial id", async () => {
    const { resolvePlace } = await import("@/lib/prototype/bolig/knowledge");
    const { BOLIG_FIXTURE } = await import("@/lib/prototype/bolig/fixture");
    const bakery = BOLIG_FIXTURE.places.find(p => p.name === "Rosenborg Bakeri")!;
    expect(resolvePlace(BOLIG_FIXTURE, bakery.id)?.id).toBe(bakery.id);
    expect(resolvePlace(BOLIG_FIXTURE, "rosenborg bakeri")?.id).toBe(bakery.id);
    expect(resolvePlace(BOLIG_FIXTURE, bakery.id.slice(0, 20))?.id).toBe(bakery.id);
    expect(resolvePlace(BOLIG_FIXTURE, "google-")).toBeUndefined();
    expect(resolvePlace(BOLIG_FIXTURE, "")).toBeUndefined();
  });
});
