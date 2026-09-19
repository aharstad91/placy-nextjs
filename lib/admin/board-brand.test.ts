import { describe, expect, it } from "vitest";

import {
  boardBrandInputSchema,
  mergeBoardBrandConfig,
} from "@/lib/admin/board-brand";

const input = boardBrandInputSchema.parse({
  assets: {
    brand: true,
    logoUrl: "/illustrations/demo-logo.svg",
    splashImageUrl: "/illustrations/demo-splash.jpg",
    splashVideoUrl: "/illustrations/demo-splash-video.mp4",
  },
  presentation: {
    initialView: "splash",
    brand: {
      surfaceColor: "#eeedec",
      inkColor: "#2a2c2e",
      accentColor: "#90553e",
      accentForegroundColor: "#ffffff",
      mutedColor: "#f3ece8",
      mutedForegroundColor: "#5a5f62",
      radius: "2px",
      headingFontFamily: "Mukta",
      headingFontWeight: 500,
    },
  },
});

describe("board brand config", () => {
  it("deep-merges branding without replacing themes, assistant or other assets", () => {
    const merged = mergeBoardBrandConfig(
      {
        keep: "root",
        reportConfig: {
          themes: [{ id: "transport" }],
          assistant: { enabled: true },
          assets: { customIllustrations: true },
          presentation: { old: "preserved" },
        },
      },
      input,
    ) as Record<string, unknown>;

    expect(merged).toMatchObject({
      keep: "root",
      reportConfig: {
        themes: [{ id: "transport" }],
        assistant: { enabled: true },
        assets: { customIllustrations: true, brand: true },
        presentation: {
          old: "preserved",
          initialView: "splash",
          brand: { accentColor: "#90553e" },
        },
      },
    });
  });

  it.each([
    "https://example.com/logo.svg",
    "//example.com/logo.svg",
    "/illustrations/../secret.svg",
  ])("rejects non-internal asset path %s", (logoUrl) => {
    expect(() => boardBrandInputSchema.parse({
      ...input,
      assets: { ...input.assets, logoUrl },
    })).toThrow();
  });

  it("rejects arbitrary fonts", () => {
    expect(() =>
      boardBrandInputSchema.parse({
        ...input,
        presentation: {
          ...input.presentation,
          brand: { ...input.presentation.brand, headingFontFamily: "Comic Sans" },
        },
      }),
    ).toThrow();
  });
});
