import { describe, it, expect } from "vitest";
import { mapCharTimingsToWords, mapTokensToSentences } from "./karaoke-tokens";

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

describe("mapTokensToSentences", () => {
  it("tom token-array → tom setnings-array", () => {
    expect(mapTokensToSentences([])).toEqual([]);
  });

  it("splitter på terminator og fanger siste blokk uten terminator", () => {
    // "en to. tre" — to setninger: "en to." (terminert) + "tre" (siste blokk)
    const tokens = mapCharTimingsToWords(
      timings(
        ["e", "n", " ", "t", "o", ".", " ", "t", "r", "e"],
        [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      ),
    );
    const sentences = mapTokensToSentences(tokens);
    expect(sentences).toHaveLength(2);
    expect(sentences[0].text).toBe("en to.");
    expect(sentences[1].text).toBe("tre");
  });

  it("bevarer token-index, char-offset og ms-spenn per setning", () => {
    const tokens = mapCharTimingsToWords(
      timings(
        ["e", "n", " ", "t", "o", ".", " ", "t", "r", "e"],
        [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      ),
    );
    const [first, second] = mapTokensToSentences(tokens);
    // Setning 1 dekker token 0–1 (chars 0–5), starter ved første ords startMs,
    // slutter ved siste ords endMs.
    expect(first.startTokenIdx).toBe(0);
    expect(first.endTokenIdx).toBe(1);
    expect(first.charStartIdx).toBe(0);
    expect(first.charEndIdx).toBe(5);
    expect(first.startMs).toBe(0);
    expect(first.endMs).toBe(600);
    // Setning 2 = token 2 ("tre", chars 7–9).
    expect(second.startTokenIdx).toBe(2);
    expect(second.endTokenIdx).toBe(2);
    expect(second.charStartIdx).toBe(7);
    expect(second.charEndIdx).toBe(9);
  });

  it("behandler ?, ! og … som terminatorer", () => {
    const tokens = mapCharTimingsToWords(
      timings(
        ["a", "?", " ", "b", "!", " ", "c", "…", " ", "d"],
        [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
        [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      ),
    );
    expect(mapTokensToSentences(tokens).map((s) => s.text)).toEqual([
      "a?",
      "b!",
      "c…",
      "d",
    ]);
  });
});
