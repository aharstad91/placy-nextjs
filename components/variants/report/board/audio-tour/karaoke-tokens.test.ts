import { describe, it, expect } from "vitest";
import { mapCharTimingsToWords } from "./karaoke-tokens";

function timings(chars: string[], starts: number[], ends: number[]) {
  return {
    characters: chars,
    characterStartTimesSeconds: starts,
    characterEndTimesSeconds: ends,
  };
}

describe("mapCharTimingsToWords", () => {
  it("splitter tre ord på enkelt-whitespace", () => {
    const t = timings(
      ["e", "n", " ", "t", "o", " ", "t", "r", "e"],
      [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
    );
    const tokens = mapCharTimingsToWords(t);
    expect(tokens.map((tok) => tok.text)).toEqual(["en", "to", "tre"]);
    expect(tokens[0].startMs).toBe(0);
    expect(tokens[0].endMs).toBe(200);
    expect(tokens[1].startMs).toBe(300);
    expect(tokens[2].endMs).toBe(900);
  });

  it("returnerer tom array når timings mangler", () => {
    expect(mapCharTimingsToWords(undefined)).toEqual([]);
  });

  it("returnerer tom array når characters er tom", () => {
    expect(mapCharTimingsToWords(timings([], [], []))).toEqual([]);
  });

  it("returnerer tom array når lengdene divergerer", () => {
    expect(
      mapCharTimingsToWords(timings(["a", "b"], [0, 0.1], [0.1])),
    ).toEqual([]);
  });

  it("flere whitespace mellom ord kollapser ikke charStartIndex", () => {
    const t = timings(
      ["a", " ", " ", "b"],
      [0.0, 0.1, 0.2, 0.3],
      [0.1, 0.2, 0.3, 0.4],
    );
    const tokens = mapCharTimingsToWords(t);
    expect(tokens).toHaveLength(2);
    expect(tokens[0].charStartIndex).toBe(0);
    expect(tokens[1].charStartIndex).toBe(3);
    expect(tokens[1].text).toBe("b");
  });

  it("leading/trailing whitespace droppes", () => {
    const t = timings(
      [" ", "a", " "],
      [0.0, 0.1, 0.2],
      [0.1, 0.2, 0.3],
    );
    const tokens = mapCharTimingsToWords(t);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe("a");
    expect(tokens[0].charStartIndex).toBe(1);
  });

  it("norske tegn æøå telles som vanlige ikke-whitespace-tegn", () => {
    const t = timings(
      ["b", "å", "t"],
      [0.0, 0.1, 0.2],
      [0.1, 0.2, 0.3],
    );
    const tokens = mapCharTimingsToWords(t);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe("båt");
  });

  it("bindestrek bryter ikke ord-tokens", () => {
    const t = timings(
      ["B", "a", "k", "k", "-", "l", "a", "n", "d", "e", "t"],
      [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1],
    );
    const tokens = mapCharTimingsToWords(t);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].text).toBe("Bakk-landet");
  });

  it("punktum holdes sammen med foregående ord", () => {
    const t = timings(
      ["h", "e", "i", ".", " ", "d", "u"],
      [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],
      [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7],
    );
    const tokens = mapCharTimingsToWords(t);
    expect(tokens.map((tok) => tok.text)).toEqual(["hei.", "du"]);
  });
});
