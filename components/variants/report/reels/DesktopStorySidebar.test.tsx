import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { SidebarContentPreview, type SidebarPreviewCategory } from "./DesktopStorySidebar";
import type { RealtimeData } from "@/lib/hooks/useRealtimeData";

// Sanntids-hooket mockes: transport-rader (poi != null) får levende data,
// ikke-transport-rader (poi == null) får tom tilstand. Dette speiler den
// null-trygge kontrakten i POIHighlightRow (isTransport-gatingen).
const LIVE: RealtimeData = {
  loading: false,
  error: null,
  lastUpdated: new Date("2026-07-05T12:00:00Z"),
  entur: {
    stopName: "Strindfjordvegen",
    departures: [
      {
        departureTime: "2026-07-05T12:05:00Z",
        isRealtime: true,
        destination: "Grillstad",
        lineCode: "20",
        transportMode: "bus",
      },
    ],
  },
};
const EMPTY: RealtimeData = { loading: false, error: null, lastUpdated: null };

vi.mock("@/lib/hooks/useRealtimeData", () => ({
  useRealtimeData: (poi: unknown) => (poi ? LIVE : EMPTY),
}));
vi.mock("@/lib/utils/format-time", () => ({
  formatRelativeDepartureTime: () => "5 min",
}));

function makeCategory(
  overrides: Partial<SidebarPreviewCategory> = {},
): SidebarPreviewCategory {
  return {
    id: "transport",
    label: "Transport & Mobilitet",
    color: "#3b82f6",
    count: 4,
    editorial: {
      body: "Linje 20 går langs fjorden.",
      highlights: [
        {
          id: "entur-NSR-StopPlace-60260",
          name: "Strindfjordvegen bussholdeplass",
          enturStopplaceId: "NSR:StopPlace:60260",
        },
        { id: "poi-uten-kobling", name: "Grilstad mall" },
      ],
    },
    ...overrides,
  };
}

describe("SidebarContentPreview — sanntid i drill-in-panelet (PRD 11 Unit 7 AC1)", () => {
  it("aktiv nivå-2-kategori viser highlights med live avganger for transport-rader", () => {
    const { getByText } = render(
      <SidebarContentPreview
        categories={[makeCategory()]}
        activeCategoryId="transport"
      />,
    );
    expect(getByText("Verdt å merke seg")).not.toBeNull();
    expect(getByText("Strindfjordvegen bussholdeplass")).not.toBeNull();
    // Live-avgangen fra useRealtimeData rendres via POIRealtimeSection
    expect(getByText("20")).not.toBeNull();
    expect(getByText(/Grillstad/)).not.toBeNull();
    expect(getByText("5 min")).not.toBeNull();
  });

  it("ikke-transport-highlight rendrer rad uten sanntidsseksjon", () => {
    const { getByText, queryByText } = render(
      <SidebarContentPreview
        categories={[
          makeCategory({
            editorial: {
              body: "Tekst.",
              highlights: [{ id: "poi-uten-kobling", name: "Grilstad mall" }],
            },
          }),
        ]}
        activeCategoryId="transport"
      />,
    );
    expect(getByText("Grilstad mall")).not.toBeNull();
    expect(queryByText("5 min")).toBeNull();
  });

  it("kategori uten editorial (nivå 1) viser index-lista, ikke drill-in", () => {
    const { getByText, queryByText } = render(
      <SidebarContentPreview
        categories={[makeCategory({ editorial: undefined })]}
        activeCategoryId="transport"
      />,
    );
    expect(getByText("Hele nabolaget")).not.toBeNull();
    expect(queryByText("Verdt å merke seg")).toBeNull();
  });
});
