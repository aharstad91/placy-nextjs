import { describe, expect, it } from "vitest";
import { blocksFromToolResult, mergeBlocks, upsertAnswer } from "@/lib/prototype/bolig/blocks";
import type { Block, ToolResult } from "@/lib/prototype/bolig/contract";

const topic: ToolResult = { kind: "topic", topic: "barn", places: [{ id: "p1", name: "Skole", kind: "Barneskole", walk_min: 5, provenance: "documented" }], seller: [{ id: "s1", text: "…", provenance: "example" }], unknowns: [{ id: "u1", question: "Skolekrets?", answer: "Ukjent." }], source_ids: ["src-nsr"], note: "" };

describe("blocks", () => {
  it("renders topic results as places, seller, unknown and sources in that order", () => {
    expect(blocksFromToolResult(topic, 2, "call1").map(b => b.kind)).toEqual(["places", "seller", "unknown", "sources"]);
  });
  it("deduplicates repeated tool outputs by call id", () => {
    const first = mergeBlocks([], blocksFromToolResult(topic, 2, "call1"));
    expect(mergeBlocks(first, blocksFromToolResult(topic, 2, "call1"))).toBe(first);
  });
  it("streams answer deltas and can replace with the final transcript", () => {
    let blocks: Block[] = upsertAnswer([], "a1", 1, "Hei", false);
    blocks = upsertAnswer(blocks, "a1", 1, " der", false);
    expect(blocks[0]).toMatchObject({ kind: "answer", text: "Hei der", done: false });
    blocks = upsertAnswer(blocks, "a1", 1, "Hei der!", true, true);
    expect(blocks[0]).toMatchObject({ text: "Hei der!", done: true });
  });
  it("ignores map and error results", () => {
    expect(blocksFromToolResult({ kind: "map", ok: true }, 1, "c")).toEqual([]);
    expect(blocksFromToolResult({ kind: "error", error: "x" }, 1, "c")).toEqual([]);
  });
});
