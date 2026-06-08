import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
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
  it("viser nøytral megler-placeholder i bunn", () => {
    const { getByText } = render(
      <SidebarContentPreview categories={categories} />,
    );
    expect(getByText("Ansvarlig megler")).toBeTruthy();
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

  it("kaller onSelect med kategori-id ved klikk på temakort", () => {
    const onSelect = vi.fn();
    const { getByText } = render(
      <SidebarContentPreview categories={categories} onSelect={onSelect} />,
    );
    fireEvent.click(getByText("Hverdagsliv"));
    expect(onSelect).toHaveBeenCalledWith("hverdagsliv");
  });

  it("viser 'Hele nabolaget'-rad med total og kaller onShowAll ved klikk", () => {
    const onShowAll = vi.fn();
    const { getByText } = render(
      <SidebarContentPreview categories={categories} onShowAll={onShowAll} />,
    );
    expect(getByText("Hele nabolaget")).toBeTruthy();
    expect(getByText("32 steder")).toBeTruthy(); // 13 + 19
    fireEvent.click(getByText("Hele nabolaget"));
    expect(onShowAll).toHaveBeenCalled();
  });

  it("rendrer uten lead/bilde uten å krasje", () => {
    const { getByText } = render(
      <SidebarContentPreview
        categories={[{ id: "x", label: "Tema X", color: "#000", count: 0 }]}
      />,
    );
    expect(getByText("Tema X")).toBeTruthy();
  });
});

const editorialCategories: SidebarPreviewCategory[] = [
  {
    id: "barn",
    label: "Barn & Oppvekst",
    color: "#f59e0b",
    count: 29,
    lead: "Skoler og barnehager for familier.",
    editorial: {
      body: "Oppvekstmiljøet er trygt og grønt.\n\nFlere skoler i gangavstand.",
      highlights: [
        { id: "poi-skole", name: "Ranheim skole" },
        { id: "poi-bhg", name: "Presthus barnehage" },
      ],
    },
  },
  {
    id: "mat",
    label: "Mat & Drikke",
    color: "#ef4444",
    count: 8,
    lead: "Restauranter i nærområdet.",
  },
];

describe("SidebarContentPreview — nivå-2 drill-in", () => {
  it("viser detalj-panel når aktiv kategori har editorial", () => {
    const { getByText, queryByText } = render(
      <SidebarContentPreview
        categories={editorialCategories}
        activeCategoryId="barn"
      />,
    );
    // Detalj-innhold synlig
    expect(getByText(/Oppvekstmiljøet er trygt/)).toBeTruthy();
    expect(getByText("Verdt å merke seg")).toBeTruthy();
    expect(getByText("Ranheim skole")).toBeTruthy();
    // Index-lista er borte (ingen "Hele nabolaget"-rad mens detalj vises)
    expect(queryByText("Hele nabolaget")).toBeNull();
  });

  it("splitter body på dobbelt linjeskift til avsnitt", () => {
    const { getByText } = render(
      <SidebarContentPreview
        categories={editorialCategories}
        activeCategoryId="barn"
      />,
    );
    expect(getByText("Oppvekstmiljøet er trygt og grønt.")).toBeTruthy();
    expect(getByText("Flere skoler i gangavstand.")).toBeTruthy();
  });

  it("tilbake-pil kaller onShowAll", () => {
    const onShowAll = vi.fn();
    const { getByText } = render(
      <SidebarContentPreview
        categories={editorialCategories}
        activeCategoryId="barn"
        onShowAll={onShowAll}
      />,
    );
    fireEvent.click(getByText("Alle kategorier"));
    expect(onShowAll).toHaveBeenCalled();
  });

  it("klikk på highlight-chip kaller onOpenPoi med poiId + categoryId", () => {
    const onOpenPoi = vi.fn();
    const { getByText } = render(
      <SidebarContentPreview
        categories={editorialCategories}
        activeCategoryId="barn"
        onOpenPoi={onOpenPoi}
      />,
    );
    fireEvent.click(getByText("Presthus barnehage"));
    expect(onOpenPoi).toHaveBeenCalledWith("poi-bhg", "barn");
  });

  it("aktiv kategori UTEN editorial viser fortsatt index-lista (nivå 1)", () => {
    const { getByText } = render(
      <SidebarContentPreview
        categories={editorialCategories}
        activeCategoryId="mat"
      />,
    );
    // Index synlig (ingen drill-in for nivå-1-kategori)
    expect(getByText("Hele nabolaget")).toBeTruthy();
    expect(getByText("Barn & Oppvekst")).toBeTruthy();
  });

  it("megler-footer vises også i detalj-visning", () => {
    const { getByText } = render(
      <SidebarContentPreview
        categories={editorialCategories}
        activeCategoryId="barn"
      />,
    );
    expect(getByText("Ansvarlig megler")).toBeTruthy();
  });
});
