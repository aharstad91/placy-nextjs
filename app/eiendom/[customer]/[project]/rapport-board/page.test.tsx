import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/lib/types";

const getProduct = vi.fn();
const getTranslations = vi.fn(async () => ({}));
const findHostedVoiceProjectSlug = vi.fn(async (customer: string, project: string) => {
  void customer;
  void project;
  return "nyhavna";
});

vi.mock("@/lib/supabase/cached-board-reads", () => ({
  getCachedReportProduct: () => getProduct(),
  getCachedProjectTranslations: () => getTranslations(),
}));
vi.mock("@/lib/utils/school-zones", () => ({ getSchoolZone: () => null }));
vi.mock("@/lib/public-projects", () => ({
  findHostedVoiceProjectSlug: (customer: string, project: string) =>
    findHostedVoiceProjectSlug(customer, project),
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("./board-embed-gate", () => ({
  default: ({ project, voiceProjectSlug }: { project: Project; voiceProjectSlug?: string }) => (
    <div data-testid="board-gate" data-voice-project={voiceProjectSlug}>{project.name}</div>
  ),
}));

import EiendomReportBoardPage from "./page";

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
    has3dAddon: true,
    reportConfig: {
      assets: {
        brand: true,
        logoUrl: "/illustrations/leangenbukta-logo.svg",
        splashImageUrl: "/illustrations/leangenbukta-splash.jpg",
        splashVideoUrl: "/illustrations/leangenbukta-splash-video.mp4",
      },
      presentation: {
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
    },
  };
}

describe("ordinary report-board presentation", () => {
  beforeEach(() => {
    getProduct.mockReset();
    getTranslations.mockClear();
    findHostedVoiceProjectSlug.mockClear();
    getProduct.mockResolvedValue(project());
  });

  it("maps the configured brand to safe CSS variables and keeps the ordinary gate", async () => {
    const view = render(
      await EiendomReportBoardPage({
        params: Promise.resolve({ customer: "placy-demo", project: "leangenbukta" }),
      }),
    );

    const shell = view.getByTestId("board-gate").parentElement!;
    expect(shell).toHaveStyle({
      "--background": "30 6% 93%",
      "--foreground": "210 5% 17%",
      "--primary": "17 40% 40%",
      "--radius": "2px",
      "--board-heading-font": "Mukta",
      "--board-heading-weight": "500",
    });
    expect(view.getByTestId("board-gate")).toHaveTextContent("Leangenbukta");
  });

  it("forwards the hosted voice binding only when the assistant is enabled", async () => {
    const enabled = project();
    enabled.reportConfig = {
      ...enabled.reportConfig,
      assistant: { enabled: true, name: "Anja" },
    };
    getProduct.mockResolvedValueOnce(enabled);

    const view = render(
      await EiendomReportBoardPage({
        params: Promise.resolve({ customer: "nyhavna-utvikling", project: "nyhavna" }),
      }),
    );

    expect(findHostedVoiceProjectSlug).toHaveBeenCalledWith("nyhavna-utvikling", "nyhavna");
    expect(view.getByTestId("board-gate")).toHaveAttribute("data-voice-project", "nyhavna");

    getProduct.mockResolvedValueOnce(project());
    render(
      await EiendomReportBoardPage({
        params: Promise.resolve({ customer: "placy-demo", project: "leangenbukta" }),
      }),
    );
    expect(findHostedVoiceProjectSlug).toHaveBeenCalledTimes(1);
  });
});
