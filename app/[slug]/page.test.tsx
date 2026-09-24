import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  report: vi.fn(),
  translations: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/public-projects", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/public-projects")>(),
  resolvePublicProjectRoute: mocks.resolve,
}));
vi.mock("@/lib/supabase/cached-board-reads", () => ({
  getCachedReportProduct: mocks.report,
  getCachedProjectTranslations: mocks.translations,
}));
vi.mock("@/lib/utils/school-zones", () => ({ getSchoolZone: () => undefined }));
vi.mock("@/lib/board/report-board-style", () => ({ buildReportBoardStyle: () => ({}) }));
vi.mock("@/app/eiendom/[customer]/[project]/rapport-board/board-embed-gate", () => ({ default: () => null }));

import { PublicProjectError } from "@/lib/public-projects";
import ProjectPage, { generateMetadata } from "@/app/[slug]/page";

const project = {
  id: "063a0b6a-edb3-4fb2-885d-c594ddd46063",
  name: "Prosjekt",
  customer: "kunde",
  urlSlug: "prosjekt",
  productType: "report",
  centerCoordinates: { lat: 63.4, lng: 10.4 },
  pois: [],
  reportConfig: { themes: [], assets: { logoUrl: "/illustrations/prosjekt-logo.svg" } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({ slug: "prosjekt", customer: "kunde", projectSlug: "prosjekt", projectId: "kunde_prosjekt" });
  mocks.report.mockResolvedValue(project);
  mocks.translations.mockResolvedValue(null);
});

describe("public standard board", () => {
  it("renders the ordinary report product behind the public slug", async () => {
    const props = { params: Promise.resolve({ slug: "prosjekt" }) };
    expect(await ProjectPage(props)).toBeTruthy();
    expect(mocks.resolve).toHaveBeenCalledWith("prosjekt");
    expect(mocks.report).toHaveBeenCalledWith("kunde", "prosjekt");
  });

  it("keeps the public URL, noindex and project branding in metadata", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "prosjekt" }) });
    expect(metadata).toMatchObject({
      robots: { index: false, follow: false },
      alternates: { canonical: "https://placy.no/prosjekt" },
      icons: { icon: "/illustrations/prosjekt-logo.svg" },
    });
  });

  it("returns not found for unknown projects", async () => {
    mocks.resolve.mockRejectedValueOnce(new PublicProjectError());
    await expect(ProjectPage({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("rejects a report product from another project", async () => {
    mocks.report.mockResolvedValueOnce({ ...project, urlSlug: "annet" });
    await expect(ProjectPage({ params: Promise.resolve({ slug: "prosjekt" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("keeps dependency outages retryable", async () => {
    const outage = new PublicProjectError("unavailable");
    mocks.resolve.mockRejectedValueOnce(outage);
    await expect(ProjectPage({ params: Promise.resolve({ slug: "outage" }) })).rejects.toBe(outage);
  });
});
