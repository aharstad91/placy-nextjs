import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { EventFilterPanel } from "./EventFilterPanel";
import { BoardProvider } from "../board-state";
import type {
  BoardCategory,
  BoardCategoryId,
  BoardData,
} from "../board-data";
import type { EventBoardFilterResult } from "@/lib/event-board/useEventBoardFilter";
import { useKompassStore } from "@/lib/kompass-store";
import type { POI } from "@/lib/types";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={typeof src === "string" ? src : ""} alt={alt} />;
  },
}));

function cat(id: string, label: string, color: string): BoardCategory {
  return {
    id: id as BoardCategoryId,
    label,
    lead: "",
    body: "",
    icon: "MapPin",
    color,
    pois: [],
    topRankedPois: [],
  };
}

function rawPoi(
  id: string,
  catId: string,
  eventDates: string[] | undefined,
  start?: string,
): POI {
  return {
    id,
    name: id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: catId, name: catId, icon: "MapPin", color: "#000" },
    eventDates,
    eventTimeStart: start,
  };
}

const boardData: BoardData = {
  home: { name: "Kulturnatt", coordinates: { lat: 0, lng: 0 }, address: "" },
  categories: [],
  poisById: new Map(),
  audioTourEnabled: false,
};

function makeFilter(
  over: Partial<EventBoardFilterResult> = {},
): EventBoardFilterResult {
  return {
    recommended: [],
    visiblePoiIds: new Set(),
    sections: [],
    days: [],
    isSingleDay: false,
    filteredCount: 0,
    hasActiveFilter: false,
    ...over,
  };
}

function renderPanel(
  filter: EventBoardFilterResult,
  categories: BoardCategory[],
) {
  return render(
    <BoardProvider data={boardData}>
      <EventFilterPanel filter={filter} categories={categories} />
    </BoardProvider>,
  );
}

describe("EventFilterPanel (Unit 4)", () => {
  beforeEach(() => {
    useKompassStore.getState().resetKompass();
  });

  it("R13: single-day → read-only dato-label (ikke en velger)", () => {
    const filter = makeFilter({
      days: ["2025-09-12"],
      isSingleDay: true,
      sections: [
        {
          dateKey: "2025-09-12",
          isUndated: false,
          pois: [rawPoi("Konsert", "kn-musikk", ["2025-09-12"], "20:00")],
        },
      ],
      recommended: [rawPoi("Konsert", "kn-musikk", ["2025-09-12"], "20:00")],
      filteredCount: 1,
    });
    const { queryByText, getAllByText } = renderPanel(filter, [
      cat("kn-musikk", "Musikk", "#a855f7"),
    ]);
    // Dato-label vises (Fre 12. sep el.l.) men ingen "Alle dager"-velger.
    expect(queryByText("Alle dager")).toBeNull();
    // Datoen vises både i read-only-labelen og i seksjons-overskriften.
    expect(getAllByText(/12\. sep/).length).toBeGreaterThanOrEqual(1);
  });

  it("fler-dags → 'Alle dager' + klikkbare dag-chips", () => {
    const filter = makeFilter({
      days: ["2026-05-23", "2026-05-25"],
      isSingleDay: false,
      filteredCount: 1,
      recommended: [rawPoi("E", "t", ["2026-05-23"], "10:00")],
      sections: [
        {
          dateKey: "2026-05-23",
          isUndated: false,
          pois: [rawPoi("E", "t", ["2026-05-23"], "10:00")],
        },
      ],
    });
    const { getByText, getByRole } = renderPanel(filter, [
      cat("t", "Tema", "#000"),
    ]);
    expect(getByText("Alle dager")).toBeTruthy();
    // Klikk på dag-chippen (button) setter selectedDay i kompass-store.
    // (Datoen vises også i seksjons-overskriften (h3), så vi targeter rollen.)
    fireEvent.click(getByRole("button", { name: /23\. mai/ }));
    expect(useKompassStore.getState().selectedDay).toBe("2026-05-23");
  });

  it("R12: 0 treff + aktivt filter → tomtilstand + 'Nullstill filter'-CTA", () => {
    useKompassStore.getState().toggleTheme("finnes-ikke");
    const filter = makeFilter({ filteredCount: 0, hasActiveFilter: true });
    const { getByText } = renderPanel(filter, [cat("t", "Tema", "#000")]);
    expect(getByText(/Ingen arrangementer matcher/)).toBeTruthy();
    const reset = getByText("Nullstill filter");
    fireEvent.click(reset);
    expect(useKompassStore.getState().selectedThemes).toEqual([]);
  });

  it("R12: 0 treff UTEN aktivt filter → ingen nullstill-CTA", () => {
    const filter = makeFilter({ filteredCount: 0, hasActiveFilter: false });
    const { queryByText } = renderPanel(filter, [cat("t", "Tema", "#000")]);
    expect(queryByText("Nullstill filter")).toBeNull();
  });

  it("tema-chip toggler selectedThemes i kompass-store (R3)", () => {
    const filter = makeFilter({ filteredCount: 0, hasActiveFilter: false });
    const { getByText } = renderPanel(filter, [
      cat("kn-musikk", "Musikk", "#a855f7"),
    ]);
    fireEvent.click(getByText("Musikk"));
    expect(useKompassStore.getState().selectedThemes).toEqual(["kn-musikk"]);
  });

  it("R16/D6: rendrer dato-seksjoner med tid på hver event-rad", () => {
    const filter = makeFilter({
      days: ["2025-09-12"],
      isSingleDay: true,
      filteredCount: 2,
      recommended: [
        rawPoi("Tidlig", "t", ["2025-09-12"], "18:00"),
        rawPoi("Sent", "t", ["2025-09-12"], "21:00"),
      ],
      sections: [
        {
          dateKey: "2025-09-12",
          isUndated: false,
          pois: [
            rawPoi("Tidlig", "t", ["2025-09-12"], "18:00"),
            rawPoi("Sent", "t", ["2025-09-12"], "21:00"),
          ],
        },
      ],
    });
    const { getByText } = renderPanel(filter, [cat("t", "Tema", "#000")]);
    expect(getByText("Tidlig")).toBeTruthy();
    expect(getByText("Sent")).toBeTruthy();
    expect(getByText("18:00")).toBeTruthy();
  });
});
