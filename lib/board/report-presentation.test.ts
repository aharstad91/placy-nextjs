import { describe, expect, it } from "vitest";

import {
  DEFAULT_REPORT_LAYOUT,
  DEFAULT_REPORT_PLACE_PANEL,
  isInitiallyRevealed,
} from "@/lib/board/report-presentation";

describe("report board presentation", () => {
  it("uses the Nyhavna interaction as the shared board default", () => {
    expect(DEFAULT_REPORT_LAYOUT).toBe("framed");
    expect(DEFAULT_REPORT_PLACE_PANEL).toBe(true);
  });

  it("shows the splash unless the board explicitly starts revealed", () => {
    expect(isInitiallyRevealed(undefined)).toBe(false);
    expect(isInitiallyRevealed({ presentation: { initialView: "revealed" } })).toBe(true);
    expect(isInitiallyRevealed({ presentation: { initialView: "splash" } }, true)).toBe(false);
  });

  it("keeps the published Nyhavna landing revealed until its config is migrated", () => {
    expect(isInitiallyRevealed(undefined, true)).toBe(true);
  });
});
