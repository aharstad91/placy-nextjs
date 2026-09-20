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

  it("kan slå assistenten av uten å miste hilsen, navn eller funksjonsvalg", () => {
    // Et board kan ha ferdig samtalekonfigurasjon før backenden finnes i
    // miljøet den skal kjøre i. Da skal knappen være borte, ikke feile.
    const off = mergeBoardAssistantConfig({
      enabled: true,
      name: "Anja",
      greeting: "Prosjektets egen hilsen",
    }, { name: "Anja", enabled: false }) as Record<string, unknown>;
    expect(off).toMatchObject({
      enabled: false,
      greeting: "Prosjektets egen hilsen",
      features: { faqProgress: true, guidedPersona: true },
    });
  });

  it("only replaces the greeting when a new one is explicitly supplied", () => {
    expect(mergeBoardAssistantConfig({ greeting: "Gammel" }, {
      name: "Anja",
      greeting: "Ny",
    })).toMatchObject({ greeting: "Ny" });
  });
});
