import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { EventMobileSheet } from "./EventMobileSheet";
import { BoardProvider, useBoard } from "../board-state";
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

// EventDetailPanel (surfaced ved phase "poi") driver useRealtimeData — mock så
// ingen nettverkskall. Default: ikke-transport (ingen data).
vi.mock("@/lib/hooks/useRealtimeData", () => ({
  useRealtimeData: () => ({ loading: false, error: null, lastUpdated: null }),
}));

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={typeof src === "string" ? src : ""} alt={alt} />;
  },
}));

// BoardMap bruker Mapbox GL (ingen WebGL i jsdom). Mock-en eksponerer en
// "marker-tap"-knapp som dispatcher OPEN_POI via board-konteksten — slik
// simulerer vi et markør-trykk uten å mounte et ekte kart.
vi.mock("../BoardMap", () => ({
  BoardMap: () => {
    const { dispatch } = useBoard();
    return (
      <div data-testid="board-map">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "OPEN_POI",
              id: "konsert" as BoardPOIId,
              categoryId: "kn-musikk" as BoardCategoryId,
            })
          }
        >
          marker-tap
        </button>
      </div>
    );
  },
}));

function rawPoi(): POI {
  return {
    id: "konsert",
    name: "Konsert i Domkirken",
    coordinates: { lat: 63.4, lng: 10.4 },
    category: { id: "kn-musikk", name: "Musikk", icon: "MapPin", color: "#a855f7" },
    eventDates: ["2025-09-12"],
    eventTimeStart: "20:00",
    eventTimeEnd: "21:30",
    address: "Kongsgårdsgata 2",
    eventDescription: "En kveld med korsang.",
  };
}

function boardPoi(): BoardPOI {
  const raw = rawPoi();
  return {
    id: raw.id as BoardPOIId,
    name: raw.name,
    coordinates: raw.coordinates,
    address: raw.address,
    body: raw.eventDescription,
    categoryId: "kn-musikk" as BoardCategoryId,
    eventDates: raw.eventDates,
    eventTimeStart: raw.eventTimeStart,
    eventTimeEnd: raw.eventTimeEnd,
    raw,
  };
}

function cat(): BoardCategory {
  return {
    id: "kn-musikk" as BoardCategoryId,
    label: "Musikk",
    lead: "",
    body: "",
    icon: "MapPin",
    color: "#a855f7",
    pois: [boardPoi()],
    topRankedPois: [],
  };
}

const boardData: BoardData = {
  home: { name: "Kulturnatt", coordinates: { lat: 63.4, lng: 10.4 }, address: "" },
  categories: [cat()],
  poisById: new Map(),
  audioTourEnabled: false,
};

function makeFilter(
  over: Partial<EventBoardFilterResult> = {},
): EventBoardFilterResult {
  const poi = rawPoi();
  return {
    recommended: [poi],
    visiblePoiIds: new Set(["konsert"]),
    sections: [
      { dateKey: "2025-09-12", isUndated: false, pois: [poi] },
    ],
    days: ["2025-09-12"],
    isSingleDay: true,
    filteredCount: 1,
    hasActiveFilter: false,
    ...over,
  };
}

function makeCollection(
  over: Partial<BoardCollectionApi> = {},
): BoardCollectionApi {
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

function renderSheet(opts: {
  filter?: EventBoardFilterResult;
  collection?: BoardCollectionApi | null;
  onOpenCollection?: () => void;
} = {}) {
  const onOpenCollection = opts.onOpenCollection ?? vi.fn();
  const utils = render(
    <BoardProvider data={boardData}>
      <EventMobileSheet
        has3dAddon={false}
        eventFilter={opts.filter ?? makeFilter()}
        categories={[cat()]}
        collection={opts.collection ?? null}
        onOpenCollection={onOpenCollection}
      />
    </BoardProvider>,
  );
  return { ...utils, onOpenCollection };
}

function sheet(container: HTMLElement) {
  return container.querySelector<HTMLElement>('[data-testid="event-sheet"]')!;
}

describe("EventMobileSheet (Unit 7)", () => {
  beforeEach(() => {
    useKompassStore.getState().resetKompass();
  });

  it("starter i peek og viser event-lista (R17: kartet er aldri skjult)", () => {
    const { container, getByText } = renderSheet();
    const s = sheet(container);
    expect(s.getAttribute("data-sheet-phase")).toBe("peek");
    // Kartet er montert (aldri skjult i peek).
    expect(container.querySelector('[data-testid="board-map"]')).toBeTruthy();
    // Event-lista er synlig (dato-seksjonert).
    expect(getByText("Konsert i Domkirken")).toBeTruthy();
  });

  it("dra/tap på handle hever peek → half → full (R17: full < 100%)", () => {
    const { container, getByLabelText } = renderSheet();
    const s = sheet(container);
    expect(s.getAttribute("data-sheet-phase")).toBe("peek");

    fireEvent.click(getByLabelText("Vis mer av programmet"));
    expect(s.getAttribute("data-sheet-phase")).toBe("half");

    fireEvent.click(getByLabelText("Utvid"));
    expect(s.getAttribute("data-sheet-phase")).toBe("full");

    // R17: selv i full er kartet aldri helt skjult (sheet < 100%).
    expect(parseFloat(s.style.height)).toBeLessThan(100);
    // Kartet forblir montert i full.
    expect(container.querySelector('[data-testid="board-map"]')).toBeTruthy();
  });

  it("full → chevron kollapser tilbake til peek", () => {
    const { container, getByLabelText } = renderSheet();
    fireEvent.click(getByLabelText("Vis mer av programmet")); // half
    fireEvent.click(getByLabelText("Utvid")); // full
    fireEvent.click(getByLabelText("Vis mindre")); // collapse
    expect(sheet(container).getAttribute("data-sheet-phase")).toBe("peek");
  });

  it("marker-tap åpner per-event-detalj og hever sheet til half UTEN å skjule kartet", () => {
    const { container, getByText } = renderSheet();
    // Marker-tap (board OPEN_POI → phase "poi").
    fireEvent.click(getByText("marker-tap"));
    // Sheet heves fra peek til half (detaljen blir synlig).
    expect(sheet(container).getAttribute("data-sheet-phase")).toBe("half");
    // Per-event-detalj-panelet (Unit 6) tar over sheet-innholdet.
    expect(getByText("Tilbake til programmet")).toBeTruthy();
    expect(getByText("Kongsgårdsgata 2")).toBeTruthy();
    // Kartet er fortsatt montert (aldri skjult).
    expect(container.querySelector('[data-testid="board-map"]')).toBeTruthy();
  });

  it("Min samling-affordance er synlig og trykkbar i alle faser", () => {
    const onOpenCollection = vi.fn();
    const collection = makeCollection({
      collectionPoiIds: new Set(["konsert"]),
      collectionPoiList: ["konsert"],
      has: (id) => id === "konsert",
    });
    const { getByLabelText } = renderSheet({
      collection,
      onOpenCollection,
    });

    // Peek: affordance synlig + viser antall.
    const fab = getByLabelText("Min samling");
    expect(fab.textContent).toContain("1");
    expect(fab).not.toBeDisabled();

    // Heves til full — affordansen forblir synlig/trykkbar (over kartet, ikke
    // i sheet-en) i alle faser.
    fireEvent.click(getByLabelText("Vis mer av programmet")); // half
    fireEvent.click(getByLabelText("Utvid")); // full
    expect(getByLabelText("Min samling")).not.toBeDisabled();

    fireEvent.click(getByLabelText("Min samling"));
    expect(onOpenCollection).toHaveBeenCalled();
  });

  it("uten lagrede events er affordansen synlig men disabled", () => {
    const { getByLabelText } = renderSheet({ collection: makeCollection() });
    const fab = getByLabelText("Min samling");
    expect(fab).toBeDisabled();
  });

  it("uten collection-prop rendres ingen affordance", () => {
    const { queryByLabelText } = renderSheet({ collection: null });
    expect(queryByLabelText("Min samling")).toBeNull();
  });

  it("lagre-toggle i event-rad kaller collection.toggle med POI-id", () => {
    const collection = makeCollection();
    const { getByLabelText } = renderSheet({ collection });
    fireEvent.click(getByLabelText("Legg Konsert i Domkirken i samling"));
    expect(collection.toggle).toHaveBeenCalledWith("konsert");
  });

  it("klikk på event-rad i lista åpner detaljen (samme sti som marker-tap)", () => {
    const { container, getByText } = renderSheet();
    fireEvent.click(getByText("Konsert i Domkirken"));
    expect(sheet(container).getAttribute("data-sheet-phase")).toBe("half");
    expect(getByText("Tilbake til programmet")).toBeTruthy();
  });

  it("tomtilstand med aktivt filter viser nullstill-CTA (R12) i peek-sheet", () => {
    useKompassStore.getState().toggleTheme("finnes-ikke");
    const { getByText } = renderSheet({
      filter: makeFilter({
        filteredCount: 0,
        hasActiveFilter: true,
        recommended: [],
        sections: [],
        visiblePoiIds: new Set<string>(),
      }),
    });
    expect(getByText(/Ingen arrangementer matcher/)).toBeTruthy();
    expect(getByText("Nullstill filter")).toBeTruthy();
  });
});
