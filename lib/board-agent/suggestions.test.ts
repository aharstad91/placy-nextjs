import { describe, expect, it } from "vitest";
import type { BoardData } from "@/components/variants/report/board/board-data";
import { agentSuggestions, suggestionKey } from "@/lib/board-agent/suggestions";

const category = (id: string, label: string, faq: { id: string; question: string }[], highlights: { id: string; name: string }[]) => ({
  id,
  label,
  pois: [{ id: `${id}-poi` }],
  editorial: { body: "", faq, highlights },
});

const data = {
  globalFaq: [{ id: "g1", question: "Hva er Nyhavna?" }, { id: "g2", question: "Hvor ligger det?" }],
  categories: [
    category("servering", "Servering", [{ id: "s1", question: "Hvilke restauranter finnes?" }, { id: "s2", question: "Er det kafeer?" }], [{ id: "dora-kaffebar", name: "Dora Kaffebar" }]),
    category("natur", "Natur", [{ id: "n1", question: "Hvor kan vi gå tur?" }], [{ id: "strandveiparken", name: "Strandveiparken" }]),
    { id: "tom", label: "Tom", pois: [], editorial: undefined },
  ],
} as unknown as BoardData;

const none = new Set<string>();

describe("agentSuggestions", () => {
  it("uten tema: boardets spørsmål, et tema og et sted — én fra hver gruppe", () => {
    const result = agentSuggestions(data, { categoryId: null, used: none, dismissed: none });
    expect(result.map((s) => s.key)).toEqual([suggestionKey.faq("g1"), suggestionKey.theme("servering"), suggestionKey.place("dora-kaffebar")]);
  });

  it("i et tema: temaets spørsmål og sted først, så et annet tema", () => {
    const result = agentSuggestions(data, { categoryId: "servering", used: none, dismissed: none });
    expect(result.map((s) => s.key)).toEqual([suggestionKey.faq("s1"), suggestionKey.place("dora-kaffebar"), suggestionKey.theme("natur")]);
  });

  it("gjentar ikke brukte eller avviste knagger", () => {
    const result = agentSuggestions(data, {
      categoryId: "servering",
      used: new Set([suggestionKey.faq("s1")]),
      dismissed: new Set([suggestionKey.place("dora-kaffebar"), suggestionKey.theme("natur")]),
    });
    expect(result.map((s) => s.key)).toEqual([suggestionKey.faq("s2"), suggestionKey.faq("g1"), suggestionKey.faq("g2")]);
  });

  it("tilbyr aldri et tema uten steder eller temaet brukeren står i", () => {
    const keys = agentSuggestions(data, { categoryId: "natur", used: none, dismissed: none, limit: 10 }).map((s) => s.key);
    expect(keys).not.toContain(suggestionKey.theme("tom"));
    expect(keys).not.toContain(suggestionKey.theme("natur"));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("ukjent tema faller tilbake til oversikten", () => {
    expect(agentSuggestions(data, { categoryId: "finnes-ikke", used: none, dismissed: none })[0]).toMatchObject({ kind: "faq", faqId: "g1" });
  });
});
