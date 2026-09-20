import { describe, expect, it } from "vitest";

import { mergeBoardContentConfig } from "@/lib/admin/board-content";

interface ContentResult {
  reportConfig: {
    themes: Array<{
      id: string;
      grounding?: { keep: boolean };
      faq?: unknown[];
    }>;
    globalFaq?: Array<{ id: string; spørsmål?: string; svar: string }>;
    standalonePoiIds?: string[];
  };
}

describe("mergeBoardContentConfig", () => {
  it("adds a project theme while preserving existing theme fields", () => {
    const result = mergeBoardContentConfig({ reportConfig: { themes: [{
      id: "transport",
      name: "Transport",
      icon: "Bus",
      color: "#0000ff",
      categories: ["bus"],
      grounding: { keep: true },
    }] } }, {
      reportConfig: { label: "Nyhavna", standalonePoiIds: ["meny-solsiden"] },
      themes: [
        { id: "transport", faq: [{ id: "live", spørsmål: "Avganger?", svar: "Hentes live." }] },
        {
          id: "development",
          prepend: true,
          name: "Utvikling",
          icon: "Building2",
          color: "#123456",
          categories: ["development"],
          editorial: { body: "Planene." },
        },
      ],
      globalFaq: [],
    }) as unknown as ContentResult;
    expect(result.reportConfig.themes.map((theme) => theme.id))
      .toEqual(["development", "transport"]);
    expect(result.reportConfig.themes[1].grounding).toEqual({ keep: true });
    expect(result.reportConfig.themes[1].faq).toHaveLength(1);
    expect(result.reportConfig.standalonePoiIds).toEqual(["meny-solsiden"]);
  });

  it("upserts FAQ by id and preserves unrelated global answers", () => {
    const result = mergeBoardContentConfig({ reportConfig: {
      themes: [],
      globalFaq: [{ id: "keep", spørsmål: "Keep?", svar: "Yes." }, { id: "replace", svar: "Old." }],
    } }, {
      reportConfig: {},
      themes: [],
      globalFaq: [{ id: "replace", spørsmål: "New?", svar: "New." }],
    }) as unknown as ContentResult;
    expect(result.reportConfig.globalFaq).toEqual([
      { id: "keep", spørsmål: "Keep?", svar: "Yes." },
      { id: "replace", spørsmål: "New?", svar: "New." },
    ]);
  });
});
