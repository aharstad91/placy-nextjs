import { describe, it, expect, vi } from "vitest";
import { render as rtlRender, fireEvent } from "@testing-library/react";
import { useEffect } from "react";
import type { ViewportRect } from "@/lib/board/board-types";
import type { BoardCategory, BoardData } from "../board/board-data";
import { BoardProvider, useBoard } from "../board/board-state";
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

// Panelet leser board-contexten (kartutsnitt + kamera for «ramm inn») fra
// 2026-08-13, og lever alltid under BoardProvider i produksjon. Testene wrapper
// derfor renderen i en minimal ekte provider i stedet for å mocke contexten.
const BOARD_DATA = {
  projectSlug: "test",
  home: { name: "Hjem", coordinates: { lat: 63.43, lng: 10.4 }, address: "Gata 1" },
  categories: [],
  poisById: new Map(),
  audioTourEnabled: false,
} as unknown as BoardData;

function BoardWrapper({ children }: { children: React.ReactNode }) {
  return <BoardProvider data={BOARD_DATA}>{children}</BoardProvider>;
}

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: BoardWrapper });

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
          icon: "Bus",
          color: "#4d93f8",
          enturStopplaceId: "NSR:StopPlace:60260",
        },
        {
          id: "poi-uten-kobling",
          name: "Grilstad mall",
          icon: "ShoppingBag",
          color: "#9973f8",
        },
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
              highlights: [
                {
                  id: "poi-uten-kobling",
                  name: "Grilstad mall",
                  icon: "ShoppingBag",
                  color: "#9973f8",
                },
              ],
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

describe("kategori-panelet: viewport-scopet liste + ærlig dekning (2026-08-13)", () => {
  /**
   * Panelet lister kategoriens steder i det brukeren faktisk ser på kartet.
   * Mobilens kategoriside gjør bevisst det motsatte (R16) — her er lista ved
   * siden av kartet, så «det du ser» er det ærlige svaret, og dekningsbrøken
   * sier eksplisitt hvor mange som ligger utenfor.
   */
  const RECT: ViewportRect = {
    west: 10.39,
    east: 10.41,
    south: 63.42,
    north: 63.44,
  };
  const FAR = { lat: 63.505, lng: 10.51 };

  function poi(id: string, opts: { lat?: number; lng?: number; walk?: number } = {}) {
    const coordinates = { lat: opts.lat ?? 63.43, lng: opts.lng ?? 10.4 };
    return {
      id,
      name: id,
      coordinates,
      categoryId: "transport",
      raw: {
        id,
        name: id,
        coordinates,
        category: { id: "bus", name: "Buss", icon: "Bus", color: "#3b82f6" },
        travelTime: opts.walk === undefined ? undefined : { walk: opts.walk },
      },
    };
  }

  const BOARD_CATEGORY = {
    id: "transport",
    label: "Transport & Mobilitet",
    lead: "",
    body: "",
    icon: "Bus",
    color: "#3b82f6",
    pois: [
      poi("Naerstopp", { walk: 3 }),
      poi("Mellomstopp", { walk: 8 }),
      poi("Langtstopp", { ...FAR, walk: 24 }),
    ],
    topRankedPois: [],
  } as unknown as BoardCategory;

  /** Rendrer panelet under en ekte provider med gitt utsnitt og åpen POI. */
  function renderPanel({
    rect = RECT,
    openPoiId,
    boardCategories = [BOARD_CATEGORY],
    utenKamera = false,
  }: {
    rect?: ViewportRect | null;
    openPoiId?: string;
    boardCategories?: BoardCategory[];
    utenKamera?: boolean;
  } = {}) {
    const data = {
      projectSlug: "test",
      home: { name: "Hjem", coordinates: { lat: 63.43, lng: 10.4 }, address: "Gata 1" },
      categories: boardCategories,
      poisById: new Map(),
      audioTourEnabled: false,
    } as unknown as BoardData;

    function Driver() {
      const { setViewportRect, dispatch, setMapCamera } = useBoard();
      useEffect(() => {
        setViewportRect(rect);
      }, [setViewportRect]);
      useEffect(() => {
        if (openPoiId) dispatch({ type: "OPEN_POI", id: openPoiId as never });
      }, [dispatch]);
      useEffect(() => {
        // BoardMap registrerer dette i produksjon (kun på publiserende flater).
        if (!utenKamera) {
          setMapCamera({ snapshot: () => null, restore: () => {}, fitVisible: () => {} } as never);
        }
      }, [setMapCamera]);
      return null;
    }

    return rtlRender(
      <BoardProvider data={data}>
        <Driver />
        <SidebarContentPreview
          categories={[makeCategory()]}
          boardCategories={boardCategories}
          activeCategoryId="transport"
        />
      </BoardProvider>,
    );
  }

  it("lister kategoriens steder i utsnittet, med gangtid", () => {
    const { getAllByTestId } = renderPanel();
    const rows = getAllByTestId("viewport-row").map((el) => el.textContent);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("Naerstopp");
    expect(rows[0]).toContain("3 min");
    expect(rows[1]).toContain("Mellomstopp");
  });

  it("viser ærlig dekningsbrøk i stedet for et rått totaltall", () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId("category-subline").textContent).toBe("2 av 3 synlig · 3–8 min");
  });

  it("tilbyr «ramm inn» med antallet som ligger utenfor utsnittet", () => {
    const { getByTestId } = renderPanel();
    const rad = getByTestId("outside-viewport");
    expect(rad.textContent).toContain("1 sted ligger");
    expect(rad.textContent).toContain("utenfor utsnittet");
    // Knappen finnes bare når kamera-API-et er registrert — ingen død knapp.
    expect(rad.querySelector('[data-testid="reframe-category"]')).not.toBeNull();
  });

  it("viser antallet uten «ramm inn»-knapp når kamera-API-et mangler", () => {
    // Provideren i denne testen registrerer aldri et kamera (ingen BoardMap),
    // så knappen skal utebli mens tallet fortsatt informerer.
    const { queryByTestId, getByTestId } = renderPanel({ utenKamera: true });
    expect(getByTestId("outside-viewport")).not.toBeNull();
    expect(queryByTestId("reframe-category")).toBeNull();
  });

  it("skjuler «ramm inn» når alt er synlig", () => {
    const { queryByTestId, getByTestId } = renderPanel({ rect: null });
    expect(queryByTestId("reframe-category")).toBeNull();
    expect(getByTestId("category-subline").textContent).toBe("3 steder · 3–24 min");
  });

  it("tom tilstand når ingenting er i utsnittet — highlights står fortsatt", () => {
    const { getByTestId, queryAllByTestId } = renderPanel({
      rect: { west: 11, east: 11.1, south: 64, north: 64.1 },
    });
    expect(getByTestId("viewport-list-empty")).not.toBeNull();
    expect(queryAllByTestId("viewport-row")).toHaveLength(0);
    // Redaksjonelt utvalg er IKKE utsnitts-filtrert.
    expect(getByTestId("highlights-section")).not.toBeNull();
  });

  it("pinner den åpne POI-en utenfor scroll-området og ute av lista", () => {
    const { getByTestId, getAllByTestId } = renderPanel({ openPoiId: "Naerstopp" });
    expect(getByTestId("pinned-active-row").textContent).toContain("Naerstopp");
    expect(
      getAllByTestId("viewport-row").map((el) => el.textContent?.trim()),
    ).not.toContain("Naerstopp");
  });

  it("beholder den pinnede raden når POI-en er panorert ut av utsnittet", () => {
    // Explorer-buggen fra februar: raden brukeren leste forsvant ved panorering.
    const { getByTestId } = renderPanel({ openPoiId: "Langtstopp" });
    expect(getByTestId("pinned-active-row").textContent).toContain("Langtstopp");
    expect(getByTestId("pinned-active-row").textContent).toContain("24 min");
  });

  it("klikk på en viewport-rad åpner POI-en på kartet", () => {
    const onOpenPoi = vi.fn();
    const data = {
      projectSlug: "test",
      home: { name: "Hjem", coordinates: { lat: 63.43, lng: 10.4 }, address: "Gata 1" },
      categories: [BOARD_CATEGORY],
      poisById: new Map(),
      audioTourEnabled: false,
    } as unknown as BoardData;
    const { getAllByTestId } = rtlRender(
      <BoardProvider data={data}>
        <SidebarContentPreview
          categories={[makeCategory()]}
          boardCategories={[BOARD_CATEGORY]}
          activeCategoryId="transport"
          onOpenPoi={onOpenPoi}
        />
      </BoardProvider>,
    );
    fireEvent.click(getAllByTestId("viewport-row")[0]);
    expect(onOpenPoi).toHaveBeenCalledWith("Naerstopp", "transport");
  });

  it("uten board-kategorier vises panelet uten liste (prosa + highlights som før)", () => {
    const { queryByTestId, getByTestId } = renderPanel({ boardCategories: [] });
    expect(queryByTestId("viewport-list")).toBeNull();
    expect(getByTestId("category-subline").textContent).toBe("4 steder i nærheten");
  });
});
