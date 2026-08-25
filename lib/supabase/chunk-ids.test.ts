import { describe, it, expect } from "vitest";
import { chunkIds, MAX_IDS_PER_QUERY } from "./chunk-ids";

describe("chunkIds", () => {
  it("lar en liste under taket stå urørt", () => {
    const ids = ["a", "b", "c"];
    expect(chunkIds(ids)).toEqual([ids]);
  });

  it("deler en liste over taket, uten å miste eller duplisere en id", () => {
    const ids = Array.from({ length: 533 }, (_, i) => `poi-${i}`);
    const chunks = chunkIds(ids);

    expect(chunks.length).toBe(Math.ceil(533 / MAX_IDS_PER_QUERY));
    expect(chunks.flat()).toEqual(ids);
    expect(chunks.every((c) => c.length <= MAX_IDS_PER_QUERY)).toBe(true);
  });

  it("tom liste → ingen spørringer", () => {
    expect(chunkIds([])).toEqual([]);
  });

  it("en batch holder URL-en godt under PostgREST-grensa på ~16 kB", () => {
    // Regnestykket bak taket: verste tilfelle er de lengste id-ene vi har.
    const worstCaseId = "taxi-tk-nardosenteret-othilienborgvegen";
    const urlBytes = encodeURIComponent(
      Array.from({ length: MAX_IDS_PER_QUERY }, () => worstCaseId).join(",")
    ).length;
    expect(urlBytes).toBeLessThan(16_000);
  });
});
