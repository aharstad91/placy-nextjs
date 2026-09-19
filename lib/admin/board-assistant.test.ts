import { describe, expect, it } from "vitest";

import { mergeBoardAssistantConfig } from "@/lib/admin/board-assistant";

describe("mergeBoardAssistantConfig", () => {
  it("preserves the project's greeting while enabling standard capabilities", () => {
    expect(mergeBoardAssistantConfig({
      enabled: true,
      name: "Tidligere navn",
      greeting: "Prosjektets egen hilsen",
    }, { name: "Anja" })).toMatchObject({
      enabled: true,
      name: "Anja",
      guided: true,
      greeting: "Prosjektets egen hilsen",
      features: {
        faqProgress: true,
        revealPlaces: true,
        followHighlightCategory: true,
        unscopedCategoryList: true,
        narrationFocus: true,
        voicePacing: true,
        guidedPersona: true,
      },
    });
  });

  it("only replaces the greeting when a new one is explicitly supplied", () => {
    expect(mergeBoardAssistantConfig({ greeting: "Gammel" }, {
      name: "Anja",
      greeting: "Ny",
    })).toMatchObject({ greeting: "Ny" });
  });
});
