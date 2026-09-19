import { describe, expect, it } from "vitest";

import { buildReportBoardStyle } from "@/lib/board/report-board-style";
import type { Project } from "@/lib/types";

function project(brand: Record<string, unknown>): Project {
  return {
    id: "report",
    name: "Board",
    customer: "customer",
    urlSlug: "board",
    productType: "report",
    centerCoordinates: { lat: 63.4, lng: 10.4 },
    story: { id: "story", title: "Board" },
    tags: [],
    pois: [],
    categories: [],
    reportConfig: {
      assets: { brand: true },
      presentation: { brand: brand as never },
    },
  };
}

describe("report board style", () => {
  it("maps allowlisted brand values to CSS variables", () => {
    expect(
      buildReportBoardStyle(
        project({
          surfaceColor: "#eeedec",
          radius: "2px",
          headingFontFamily: "Mukta",
          headingFontWeight: 500,
        }),
      ),
    ).toMatchObject({
      "--background": "30 6% 93%",
      "--card": "30 6% 93%",
      "--radius": "2px",
      "--board-heading-font": "Mukta",
      "--board-heading-weight": "500",
    });
  });

  it("drops malformed JSONB values at the render boundary", () => {
    const style = buildReportBoardStyle(
      project({
        surfaceColor: "red; background:url(https://example.com)",
        radius: "2px; color:red",
        headingFontFamily: "url(https://example.com/font.woff2)",
        headingFontWeight: 901,
      }),
    );
    expect(style).not.toHaveProperty("--background");
    expect(style).not.toHaveProperty("--radius");
    expect(style).not.toHaveProperty("--board-heading-font");
    expect(style).not.toHaveProperty("--board-heading-weight");
  });
});
