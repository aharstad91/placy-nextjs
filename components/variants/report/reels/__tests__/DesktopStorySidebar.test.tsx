import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  SidebarContentPreview,
  type SidebarPreviewCategory,
} from "../DesktopStorySidebar";

// next/image → vanlig img i jsdom (strip Next-spesifikke props).
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={typeof src === "string" ? src : ""} alt={alt} />;
  },
}));

const categories: SidebarPreviewCategory[] = [
  {
    id: "hverdagsliv",
    label: "Hverdagsliv",
    color: "#22c55e",
    count: 13,
    lead: "Valentinlyst senter dekker daglig matkasse.",
    image: "/illustrations/themes/hverdagsliv.jpg",
  },
  {
    id: "transport",
    label: "Transport & Mobilitet",
    color: "#3b82f6",
    count: 19,
    lead: "Linje 12 dekker ruten fra Dragvoll via Strindheim.",
  },
];

describe("SidebarContentPreview (empty state)", () => {
  it("posisjonerer lydturen som et kommende tillegg", () => {
    const { getByText } = render(
      <SidebarContentPreview categories={categories} />,
    );
    expect(getByText("Guidet lydtur kommer")).toBeTruthy();
  });

  it("viser hvert tema med label, POI-antall og lead", () => {
    const { getByText } = render(
      <SidebarContentPreview categories={categories} />,
    );
    expect(getByText("Hverdagsliv")).toBeTruthy();
    expect(getByText("13 steder")).toBeTruthy();
    expect(getByText("Transport & Mobilitet")).toBeTruthy();
    expect(getByText("19 steder")).toBeTruthy();
    expect(getByText(/Valentinlyst senter/)).toBeTruthy();
    expect(getByText(/Linje 12/)).toBeTruthy();
  });

  it("rendrer uten lead/bilde uten å krasje", () => {
    const { getByText } = render(
      <SidebarContentPreview
        categories={[{ id: "x", label: "Tema X", color: "#000", count: 0 }]}
      />,
    );
    expect(getByText("Tema X")).toBeTruthy();
    expect(getByText("0 steder")).toBeTruthy();
  });
});
