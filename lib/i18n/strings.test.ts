import { describe, it, expect } from "vitest";
import { t, getThemeQuestion, interpolate, themeQuestions } from "./strings";

describe("t — UI string dictionary", () => {
  it("returns the Norwegian string for the 'no' locale", () => {
    expect(t("no", "label")).toBe("Nabolagsrapport");
    expect(t("no", "byPlacy")).toBe("av Placy");
  });

  it("returns the English string for the 'en' locale", () => {
    expect(t("en", "label")).toBe("Neighborhood Report");
    expect(t("en", "byPlacy")).toBe("by Placy");
  });

  it("covers hero-intro variants in both locales", () => {
    expect(t("no", "heroIntroBolig")).toContain("{name}");
    expect(t("en", "heroIntroNaering")).toContain("{name}");
  });
});

describe("getThemeQuestion — bilingual theme questions", () => {
  it("returns localized questions for bolig theme-ids", () => {
    // bolig theme-ids (strings.ts:65-72)
    expect(getThemeQuestion("no", "barn-oppvekst")).toBe("Er det bra for barna?");
    expect(getThemeQuestion("en", "transport")).toBe("How do I get around?");
    expect(getThemeQuestion("no", "natur-friluftsliv")).toBe(
      "Er det grønt i nærheten?"
    );
  });

  it("returns localized questions for nærings theme-ids", () => {
    // nærings-specific theme-ids (strings.ts:73-75)
    expect(getThemeQuestion("no", "hverdagstjenester")).toBe(
      "Hva kan jeg ordne i nærheten?"
    );
    expect(getThemeQuestion("en", "nabolaget")).toBe(
      "What's in the neighborhood?"
    );
  });

  it("returns undefined for an unknown theme-id", () => {
    expect(getThemeQuestion("no", "does-not-exist")).toBeUndefined();
  });
});

describe("themeQuestions — coverage invariant", () => {
  it("covers both bolig and nærings theme-ids with both locales", () => {
    const boligIds = [
      "barn-oppvekst",
      "hverdagsliv",
      "mat-drikke",
      "opplevelser",
      "natur-friluftsliv",
      "trening-aktivitet",
      "transport",
    ];
    const naeringsIds = ["hverdagstjenester", "nabolaget"];
    for (const id of [...boligIds, ...naeringsIds]) {
      expect(themeQuestions[id]).toBeDefined();
      expect(themeQuestions[id].no).toBeTruthy();
      expect(themeQuestions[id].en).toBeTruthy();
    }
  });
});

describe("interpolate — {placeholder} substitution", () => {
  it("replaces a known placeholder", () => {
    expect(interpolate("Hei {name}!", { name: "Ralph" })).toBe("Hei Ralph!");
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    expect(interpolate("{x}-{x}", { x: "a" })).toBe("a-a");
  });

  it("substitutes an empty string for a missing variable", () => {
    expect(interpolate("Hei {name}!", {})).toBe("Hei !");
  });

  it("leaves text without placeholders unchanged", () => {
    expect(interpolate("no placeholders here", { name: "x" })).toBe(
      "no placeholders here"
    );
  });

  it("composes with the hero-intro templates", () => {
    expect(
      interpolate(t("en", "heroIntroFallback"), { name: "Ranheim" })
    ).toBe("Explore what's nearby Ranheim.");
  });
});
