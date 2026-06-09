import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { Category, POI, Project } from "@/lib/types";
import type { BoardData } from "@/components/variants/report/board/board-data";

// === Mocks ===
// Server-komponenten henter data via data-server og rendrer det tunge
// ReportReelsPage-treet (mapbox/WebGL). Vi mocker begge: data-server styres per
// test, og ReportReelsPage byttes mot en lett stub som eksponerer boardData +
// eventMode-signalet (om `boardData`-prop er satt) til assertions.

const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({
  notFound: () => notFoundMock(),
}));

const getProductAsyncMock = vi.fn();
const getProjectAsyncMock = vi.fn();
vi.mock("@/lib/data-server", () => ({
  getProductAsync: (...args: unknown[]) => getProductAsyncMock(...args),
  getProjectAsync: (...args: unknown[]) => getProjectAsyncMock(...args),
}));

// getBransjeprofil beholdes ekte (ren funksjon, ingen IO) — adapteren bruker
// features kun for paritet. Vi mocker den ikke.

// Lett ReportReelsPage-stub: rendrer boardData-kategoriene + et flagg for om
// `boardData`-prop ble levert (= event-modus D2/D3). Slik kan route-testen
// verifisere at event-data faktisk når skallet, uten å mounte mapbox.
vi.mock("@/components/variants/report/reels/ReportReelsPage", () => ({
  default: ({
    boardData,
    project,
  }: {
    boardData?: BoardData;
    project: Project;
  }) => (
    <div data-testid="reels-stub" data-event-mode={boardData !== undefined}>
      <span data-testid="project-name">{project.name}</span>
      {boardData?.categories.map((c) => (
        <span key={c.id} data-testid="board-category">
          {c.label} — {c.pois.length} steder
        </span>
      ))}
      {/* Ingen megler/eiendoms-chrome rendres av stubben — D3-akseptanse
          verifiseres på det faktiske skallet i DesktopStorySidebar.test.tsx. */}
    </div>
  ),
}));

import EventBoardPage from "./page";

// === Fixtures ===

const KN_CATEGORIES: Category[] = [
  { id: "kn-musikk", name: "Musikk", icon: "Music", color: "#a855f7" },
  { id: "kn-kunst", name: "Kunst & Utstilling", icon: "Palette", color: "#f59e0b" },
];

function makeEventPOI(id: string, categoryId: string): POI {
  const cat = KN_CATEGORIES.find((c) => c.id === categoryId)!;
  return {
    id,
    name: `Event ${id}`,
    coordinates: { lat: 63.43, lng: 10.39 },
    category: cat,
    eventDates: ["2025-09-12"],
    eventTimeStart: "18:00",
    eventTimeEnd: "23:00",
  };
}

function makeKulturnattProject(): Project {
  return {
    id: "kulturnatt-2025",
    name: "Kulturnatt Trondheim 2025",
    customer: "kulturnatt-trondheim",
    urlSlug: "kulturnatt-2025",
    productType: "explorer",
    centerCoordinates: { lat: 63.4305, lng: 10.3951 },
    story: {
      id: "kulturnatt-2025",
      title: "Kulturnatt Trondheim 2025",
      introText: "En kveld med kultur",
      sections: [],
      themeStories: [],
    },
    pois: [
      makeEventPOI("p1", "kn-musikk"),
      makeEventPOI("p2", "kn-musikk"),
      makeEventPOI("p3", "kn-kunst"),
    ],
    categories: KN_CATEGORIES,
    tags: ["Event"],
    venueType: null,
  };
}

function makeParams(customer: string, project: string) {
  return Promise.resolve({ customer, project });
}

describe("EventBoardPage (rute, D1)", () => {
  beforeEach(() => {
    notFoundMock.mockClear();
    getProductAsyncMock.mockReset();
    getProjectAsyncMock.mockReset();
  });

  it("rendrer board-skallet med event-data via eventToBoardData (event-modus)", async () => {
    getProductAsyncMock.mockResolvedValue(makeKulturnattProject());

    const ui = await EventBoardPage({
      params: makeParams("kulturnatt-trondheim", "kulturnatt-2025"),
    });
    const { getByTestId, getAllByTestId } = render(ui);

    // D2/D3: boardData er levert som prop → event-modus aktiv.
    expect(getByTestId("reels-stub").getAttribute("data-event-mode")).toBe("true");
    expect(getByTestId("project-name").textContent).toBe(
      "Kulturnatt Trondheim 2025",
    );

    // eventToBoardData → korrekte kategorier med POI-antall.
    const cats = getAllByTestId("board-category").map((el) => el.textContent);
    expect(cats).toEqual(["Musikk — 2 steder", "Kunst & Utstilling — 1 steder"]);
  });

  it("ingen megler/eiendoms-strenger i route-output (D3)", async () => {
    getProductAsyncMock.mockResolvedValue(makeKulturnattProject());

    const ui = await EventBoardPage({
      params: makeParams("kulturnatt-trondheim", "kulturnatt-2025"),
    });
    const { container } = render(ui);

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/megler/i);
    expect(text).not.toMatch(/eiendom/i);
    expect(text).not.toMatch(/Ansvarlig/i);
    expect(text).not.toMatch(/Kontaktinfo/i);
  });

  it("faller tilbake til legacy explorer-prosjekt når getProductAsync er tom", async () => {
    getProductAsyncMock.mockResolvedValue(null);
    getProjectAsyncMock.mockResolvedValue(makeKulturnattProject());

    const ui = await EventBoardPage({
      params: makeParams("kulturnatt-trondheim", "kulturnatt-2025"),
    });
    const { getByTestId } = render(ui);
    expect(getByTestId("reels-stub").getAttribute("data-event-mode")).toBe("true");
  });

  it("ukjent prosjekt → notFound()", async () => {
    getProductAsyncMock.mockResolvedValue(null);
    getProjectAsyncMock.mockResolvedValue(null);

    await expect(
      EventBoardPage({ params: makeParams("ukjent", "finnes-ikke") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("legacy-prosjekt med feil productType → notFound()", async () => {
    getProductAsyncMock.mockResolvedValue(null);
    getProjectAsyncMock.mockResolvedValue({
      ...makeKulturnattProject(),
      productType: "report",
    });

    await expect(
      EventBoardPage({ params: makeParams("x", "y") }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalled();
  });
});
