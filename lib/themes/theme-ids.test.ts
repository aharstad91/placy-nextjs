import { describe, it, expect } from "vitest";
import { THEME_IDS } from "./theme-ids";
import { REPORT_THEME_DEFAULTS } from "@/lib/pipeline/report-defaults";

describe("THEME_IDS", () => {
  it("er avledet fra REPORT_THEME_DEFAULTS (single source, ikke duplikat)", () => {
    expect(THEME_IDS).toEqual(REPORT_THEME_DEFAULTS.map((t) => t.id));
  });

  it("er ikke-tom og uten duplikater", () => {
    expect(THEME_IDS.length).toBeGreaterThan(0);
    expect(new Set(THEME_IDS).size).toBe(THEME_IDS.length);
  });
});
