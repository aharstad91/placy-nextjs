import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { EventFilterPanel } from "./EventFilterPanel";
import { BoardProvider } from "../board-state";
import type {
  BoardCategory,
  BoardCategoryId,
  BoardData,
  BoardPOI,
  BoardPOIId,
} from "../board-data";
import type { EventBoardFilterResult } from "@/lib/event-board/useEventBoardFilter";
import type { BoardCollectionApi } from "@/lib/event-board/use-board-collection";
import { useKompassStore } from "@/lib/kompass-store";
import type { POI } from "@/lib/types";

// Per-event-panelet driver useRealtimeData; mock-en lar oss styre transport-
// staten uten faktiske nettverkskall. Default: ingen data (ikke-transport).
const realtimeMock = vi.hoisted(() => ({
  value: {
    loading: false,
    error: null as string | null,
    lastUpdated: null as Date | null,
  } as {
    loading: boolean;
    error: string | null;
    lastUpdated: Date | null;
    entur?: { stopName: string; departures: unknown[] };
    bysykkel?: { availableBikes: number; availableDocks: number; isOpen: boolean };
  },
}));

vi.mock("@/lib/hooks/useRealtimeData", () => ({
  useRealtimeData: () => realtimeMock.value,
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={typeof src === "string" ? src : ""} alt={alt} />;
  },
}));

function rawPoi(over: Partial<POI> = {}): POI {
  return {
    id: "konsert",
    name: "Konsert i Domkirken",
    coordinates: { lat: 63.4, lng: 10.4 },
    category: { id: "kn-musikk", name: "Musikk", icon: "MapPin", color: "#a855f7" },
    eventDates: ["2025-09-12"],
    eventTimeStart: "20:00",
    eventTimeEnd: "21:30",
    address: "Kongsgårdsgata 2",
    eventDescription: "En kveld med korsang.\n\nGratis inngang.",
    ...over,
  };
}

function boardPoi(over: Partial<POI> = {}): BoardPOI {
  const raw = rawPoi(over);
  const desc = raw.eventDescription?.trim() || raw.description?.trim();
  return {
    id: raw.id as BoardPOIId,
    name: raw.name,
    coordinates: raw.coordinates,
    address: raw.address,
    body: desc || undefined,
    categoryId: "kn-musikk" as BoardCategoryId,
    eventDates:
      raw.eventDates && raw.eventDates.length > 0 ? raw.eventDates : undefined,
    eventTimeStart: raw.eventTimeStart,
    eventTimeEnd: raw.eventTimeEnd,
    raw,
  };
}

function cat(pois: BoardPOI[]): BoardCategory {
  return {
    id: "kn-musikk" as BoardCategoryId,
    label: "Musikk",
    lead: "",
    body: "",
    icon: "MapPin",
    color: "#a855f7",
    pois,
    topRankedPois: pois,
  };
}

function makeBoardData(pois: BoardPOI[]): BoardData {
  return {
    home: { name: "Kulturnatt", coordinates: { lat: 63.4, lng: 10.4 }, address: "" },
    categories: pois.length > 0 ? [cat(pois)] : [],
    poisById: new Map(),
    audioTourEnabled: false,
  };
}

function makeFilter(poi: BoardPOI): EventBoardFilterResult {
  const raw = poi.raw;
  return {
    recommended: [raw],
    visiblePoiIds: new Set([raw.id]),
    sections: [
      { dateKey: "2025-09-12", isUndated: false, pois: [raw] },
    ],
    days: ["2025-09-12"],
    isSingleDay: true,
    filteredCount: 1,
    hasActiveFilter: false,
  };
}

function makeCollection(over: Partial<BoardCollectionApi> = {}): BoardCollectionApi {
  return {
    collectionPoiIds: new Set(),
    collectionPoiList: [],
    toggle: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    has: () => false,
    ...over,
  };
}

function renderPanel(
  poi: BoardPOI,
  opts: { collection?: BoardCollectionApi | null } = {},
) {
  const boardData = makeBoardData([poi]);
  return render(
    <BoardProvider data={boardData}>
      <EventFilterPanel
        filter={makeFilter(poi)}
        categories={boardData.categories}
        collection={opts.collection}
      />
    </BoardProvider>,
  );
}

describe("EventDetailPanel (Unit 6, R15)", () => {
  beforeEach(() => {
    useKompassStore.getState().resetKompass();
    realtimeMock.value = { loading: false, error: null, lastUpdated: null };
  });

  it("event-klikk åpner per-event-panel med korrekt metadata (tittel/dato/tid/sted/beskrivelse)", () => {
    const poi = boardPoi();
    const { getByText, getByRole } = renderPanel(poi);

    // Klikk event-raden i lista → OPEN_POI → detalj-panel tar over.
    fireEvent.click(getByText("Konsert i Domkirken"));

    // Tilbake-knappen er beviset på at detalj-panelet rendres.
    expect(getByText("Tilbake til programmet")).toBeTruthy();
    // Metadata.
    expect(getByRole("heading", { name: "Konsert i Domkirken" })).toBeTruthy();
    expect(getByText(/12\. sep/)).toBeTruthy(); // dato-label
    expect(getByText("20:00–21:30")).toBeTruthy(); // tid
    expect(getByText("Kongsgårdsgata 2")).toBeTruthy(); // sted
    expect(getByText(/En kveld med korsang/)).toBeTruthy(); // beskrivelse
    expect(getByText(/Gratis inngang/)).toBeTruthy(); // andre avsnitt
  });

  it("'Tilbake til programmet' lukker panelet (BACK_TO_DEFAULT → tilbake til lista)", () => {
    const poi = boardPoi();
    const { getByText, queryByText } = renderPanel(poi);

    fireEvent.click(getByText("Konsert i Domkirken"));
    expect(getByText("Tilbake til programmet")).toBeTruthy();

    fireEvent.click(getByText("Tilbake til programmet"));
    // Filter-lista er tilbake (tid-chip-gruppen finnes igjen), panelet borte.
    expect(queryByText("Tilbake til programmet")).toBeNull();
    expect(getByText("Tid på døgnet")).toBeTruthy();
  });

  it("legg-i-samling-knapp i panelet kaller collection.toggle med POI-id", () => {
    const collection = makeCollection();
    const poi = boardPoi();
    const { getByText, getByLabelText } = renderPanel(poi, { collection });

    fireEvent.click(getByText("Konsert i Domkirken"));
    fireEvent.click(getByLabelText("Legg Konsert i Domkirken i samling"));
    expect(collection.toggle).toHaveBeenCalledWith("konsert");
  });

  it("lagret event → knappen viser 'Lagret i samling' (aria-pressed)", () => {
    const collection = makeCollection({
      collectionPoiIds: new Set(["konsert"]),
      collectionPoiList: ["konsert"],
      has: (id) => id === "konsert",
    });
    const poi = boardPoi();
    const { getByText, getByLabelText } = renderPanel(poi, { collection });

    fireEvent.click(getByText("Konsert i Domkirken"));
    expect(getByText("Lagret i samling")).toBeTruthy();
    const btn = getByLabelText("Fjern Konsert i Domkirken fra samling");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("uten collection-prop → ingen lagre-knapp i panelet", () => {
    const poi = boardPoi();
    const { getByText, queryByLabelText } = renderPanel(poi, {
      collection: null,
    });
    fireEvent.click(getByText("Konsert i Domkirken"));
    expect(queryByLabelText(/i samling/)).toBeNull();
  });

  it("event uten beskrivelse/tid/dato → panel degraderer pent ('Tidspunkt ikke oppgitt', ingen krasj)", () => {
    const poi = boardPoi({
      eventTimeStart: undefined,
      eventTimeEnd: undefined,
      eventDates: undefined,
      eventDescription: undefined,
      description: undefined,
      address: undefined,
    });
    const { getByText, queryByText } = renderPanel(poi);

    fireEvent.click(getByText("Konsert i Domkirken"));
    // Tittel + tidsfallback finnes, ingen krasj.
    expect(getByText("Konsert i Domkirken")).toBeTruthy();
    expect(getByText("Tidspunkt ikke oppgitt")).toBeTruthy();
    // Beskrivelsen mangler → ingen brødtekst.
    expect(queryByText(/En kveld med korsang/)).toBeNull();
  });

  it("D7: venue MED stopp-ID → transport-rad viser live avgangsdata", () => {
    realtimeMock.value = {
      loading: false,
      error: null,
      lastUpdated: new Date(),
      entur: {
        stopName: "Dronningens gate",
        departures: [
          {
            departureTime: new Date(Date.now() + 5 * 60000).toISOString(),
            isRealtime: true,
            destination: "Lade",
            lineCode: "3",
            transportMode: "bus",
          },
        ],
      },
    };
    const poi = boardPoi({ enturStopplaceId: "NSR:StopPlace:42" });
    const { getByText } = renderPanel(poi);

    fireEvent.click(getByText("Konsert i Domkirken"));
    expect(getByText("Kollektiv i nærheten")).toBeTruthy();
    // POIRealtimeSection rendrer linjekode + destinasjon.
    expect(getByText("3")).toBeTruthy();
    expect(getByText(/Lade/)).toBeTruthy();
  });

  it("D7: venue UTEN stopp-ID → ingen transport-rad", () => {
    const poi = boardPoi(); // ingen entur/bysykkel/hyre-IDer
    const { getByText, queryByText } = renderPanel(poi);

    fireEvent.click(getByText("Konsert i Domkirken"));
    expect(queryByText("Kollektiv i nærheten")).toBeNull();
  });

  it("event-tags rendres når oppgitt", () => {
    const poi = boardPoi({ eventTags: ["Gratis", "Barnevennlig"] });
    const { getByText } = renderPanel(poi);

    fireEvent.click(getByText("Konsert i Domkirken"));
    expect(getByText("Gratis")).toBeTruthy();
    expect(getByText("Barnevennlig")).toBeTruthy();
  });

  it("kart-markør-klikk (OPEN_POI) åpner samme panel som lista", () => {
    // Simuler markør-klikk: BoardMap dispatcher OPEN_POI med categoryId.
    // Verifiserer at panelet resolver aktiv POI via useActivePOI uavhengig av
    // hvilken overflate som trigget klikket.
    const poi = boardPoi();
    const boardData = makeBoardData([poi]);
    const { getByText, getAllByText } = render(
      <BoardProvider data={boardData}>
        <EventFilterPanel
          filter={makeFilter(poi)}
          categories={boardData.categories}
        />
      </BoardProvider>,
    );
    // Klikk på rad-knappen (samme dispatch som markør-klikk).
    fireEvent.click(getByText("Konsert i Domkirken"));
    // Panelet viser tittel som heading.
    const headings = getAllByText("Konsert i Domkirken");
    expect(headings.length).toBeGreaterThanOrEqual(1);
    expect(within(document.body).getByText("Tilbake til programmet")).toBeTruthy();
  });
});
