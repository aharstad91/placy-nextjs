import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/live/projects", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/live/projects")>(),
  resolveVoiceProject: mocks.resolve,
}));
vi.mock("@/app/demo/nyhavna-lokal/lokal-board-gate", () => ({ default: () => null }));

import { VoiceProjectError } from "@/lib/live/projects";
import ProjectPage, { generateMetadata } from "@/app/[slug]/page";

const project = {
  id: "00000000-0000-4000-8000-000000000001",
  customer: "kunde",
  urlSlug: "prosjekt",
  name: "Prosjekt",
  centerCoordinates: { lat: 63.4, lng: 10.4 },
  pois: [],
  reportConfig: { themes: [] },
};
const board = {
  demoDataset: "nyhavna-lokal",
  demoSnapshotId: "nyhavna-lokal-snapshot",
  home: {
    name: "Prosjekt",
    address: "",
    coordinates: { lat: 63.4, lng: 10.4 },
    pinImage: "/demo/nyhavna-lokal/bydeler/nyhavna-logo.svg",
  },
  categories: [],
  poisById: new Map(),
  audioTourEnabled: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({
    slug: "prosjekt",
    project,
    demo: { id: "nyhavna-lokal", board, snapshotId: board.demoSnapshotId },
    tenant: { id: "tenant" },
  });
});

describe("public standard board", () => {
  it("renders the exact registered local board behind the public slug", async () => {
    const page = await ProjectPage({ params: Promise.resolve({ slug: "prosjekt" }) });
    expect(mocks.resolve).toHaveBeenCalledWith({ project: "prosjekt" }, "public");
    expect(page.props.children.props).toMatchObject({
      project,
      boardData: board,
      voiceProjectSlug: "prosjekt",
    });
  });

  it("keeps the public URL, noindex and board branding in metadata", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "prosjekt" }) });
    expect(metadata).toMatchObject({
      robots: { index: false, follow: false },
      alternates: { canonical: "https://placy.no/prosjekt" },
      icons: { icon: "/demo/nyhavna-lokal/bydeler/nyhavna-logo.svg" },
    });
  });

  it("returns not found for unknown projects", async () => {
    mocks.resolve.mockRejectedValueOnce(new VoiceProjectError());
    await expect(ProjectPage({ params: Promise.resolve({ slug: "missing" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("keeps dependency outages retryable", async () => {
    const outage = new VoiceProjectError("unavailable");
    mocks.resolve.mockRejectedValueOnce(outage);
    await expect(ProjectPage({ params: Promise.resolve({ slug: "outage" }) })).rejects.toBe(outage);
  });
});
