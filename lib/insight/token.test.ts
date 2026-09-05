import { describe, it, expect } from "vitest";
import { insightToken, verifyInsightToken } from "./token";

describe("insightToken", () => {
  it("er deterministisk og prosjekt-bundet", () => {
    const a = insightToken("broset-utvikling-as_wesselslokka", "s");
    expect(a).toBe(insightToken("broset-utvikling-as_wesselslokka", "s"));
    expect(a).not.toBe(insightToken("placy-demo_strindfjordvegen-10", "s"));
    expect(a).toHaveLength(24);
  });

  it("verifiserer riktig token og avviser alt annet", () => {
    const t = insightToken("p_x", "secret");
    expect(verifyInsightToken("p_x", t, "secret")).toBe(true);
    expect(verifyInsightToken("p_x", t, "annen")).toBe(false);
    expect(verifyInsightToken("p_y", t, "secret")).toBe(false);
    expect(verifyInsightToken("p_x", t.slice(1), "secret")).toBe(false);
    expect(verifyInsightToken("p_x", null, "secret")).toBe(false);
    expect(verifyInsightToken("p_x", t, undefined)).toBe(false);
  });
});
