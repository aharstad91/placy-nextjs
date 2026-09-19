import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/lib/types";

const getProduct = vi.fn();

vi.mock("@/lib/supabase/cached-board-reads", () => ({
  getCachedReportProduct: () => getProduct(),
  getCachedProjectTranslations: vi.fn(async () => ({})),
}));
vi.mock("@/lib/utils/school-zones", () => ({ getSchoolZone: () => null }));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/components/variants/report/reels/ReportReelsPage", () => ({
  default: ({ project }: { project: Project }) => (
    <div data-testid="reels-page">{project.name}</div>
  ),
}));

import EiendomReportReelsPage from "./page";

function project(): Project {
  return {
    id: "product-id",
    name: "Leangenbukta",
    customer: "placy-demo",
    urlSlug: "leangenbukta",
    productType: "report",
    centerCoordinates: { lat: 63.44, lng: 10.46 },
    story: { id: "story", title: "Leangenbukta" },
    tags: [],
    pois: [],
    categories: [],
    reportConfig: {
      assets: { brand: true },
      presentation: {
        brand: {
          surfaceColor: "#eeedec",
          inkColor: "#2a2c2e",
          accentColor: "#90553e",
          radius: "2px",
          headingFontFamily: "Mukta",
          headingFontWeight: 500,
        },
      },
    },
  };
}

describe("ordinary report-reels presentation", () => {
  beforeEach(() => {
    getProduct.mockReset();
    getProduct.mockResolvedValue(project());
  });

  it("applies the same configured board brand as the other public routes", async () => {
    const view = render(
      await EiendomReportReelsPage({
        params: Promise.resolve({ customer: "placy-demo", project: "leangenbukta" }),
      }),
    );

    expect(view.getByTestId("reels-page").parentElement).toHaveStyle({
      "--background": "30 6% 93%",
      "--foreground": "210 5% 17%",
      "--primary": "17 40% 40%",
      "--radius": "2px",
      "--board-heading-font": "Mukta",
      "--board-heading-weight": "500",
    });
  });
});
