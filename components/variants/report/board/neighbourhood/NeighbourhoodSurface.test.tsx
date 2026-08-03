import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import { useEffect } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MapCameraApi, ViewportRect } from "@/lib/board/board-types";
import type { BoardData, BoardPOI } from "../board-data";
import { BoardProvider, useBoard } from "../board-state";
import { NeighbourhoodSurface } from "./NeighbourhoodSurface";

/**
 * Unit 3b + 4 — navigasjonsstakken, mot en EKTE BoardProvider.
 *
 * Det som testes er sømmene mellom delene: at lista scoper markørsettet, at
 * kategorisiden ignorerer utsnittet (R16), at push lagrer og tilbake
 * gjenoppretter kameraet nøyaktig (R18), og at markørene ikke blir stående
 * låst til en kategori etter at man er tilbake (R20).
 */

const CONTAINER_H = 800;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return CONTAINER_H;
    },
  });
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

afterEach(() => cleanup());

/** Utsnitt rundt boligen; `FAR` ligger utenfor. */
const RECT: ViewportRect = {
  west: 10.39,
  east: 10.41,
  south: 63.42,
  north: 63.44,
};
const PANNED: ViewportRect = {
  west: 10.5,
  east: 10.52,
  south: 63.5,
  north: 63.52,
};
const FAR = { lat: 63.505, lng: 10.51 };

function poi(
  id: string,
  opts: { lat?: number; lng?: number; walk?: number; sub?: string } = {},
): BoardPOI {
  const coordinates = { lat: opts.lat ?? 63.43, lng: opts.lng ?? 10.4 };
  return {
    id: id as BoardPOI["id"],
    name: id,
    coordinates,
    categoryId: "mat" as BoardPOI["categoryId"],
    raw: {
      id,
      name: id,
      coordinates,
      category: {
        id: opts.sub ?? "restaurant",
        name: "Restaurant",
        icon: "UtensilsCrossed",
        color: "#c33",
      },
      travelTime: opts.walk === undefined ? undefined : { walk: opts.walk },
    } as BoardPOI["raw"],
  };
}

function boardData(): BoardData {
  return {
    projectSlug: "ferjemannsveien-10",
    home: {
      name: "Ferjemannsveien 10",
      coordinates: { lat: 63.43, lng: 10.4 },
      address: "Ferjemannsveien 10",
    },
    categories: [
      {
        id: "mat" as never,
        label: "Mat & drikke",
        lead: "",
        body: "",
        icon: "UtensilsCrossed",
        color: "#cc3300",
        pois: [
          poi("naer", { walk: 3 }),
          poi("mellom", { walk: 7 }),
          poi("langt", { ...FAR, walk: 25 }),
        ],
        topRankedPois: [],
      },
      {
        id: "natur" as never,
        label: "Natur & friluft",
        lead: "",
        body: "",
        icon: "TreePine",
        color: "#2f6f4f",
        pois: [poi("park", { walk: 9, sub: "park" })],
        topRankedPois: [],
      },
    ],
    poisById: new Map(),
    audioTourEnabled: false,
  };
}

/** Speiler provider-state ut til testen — den ekte kanalen, ikke en mock. */
const spy = {
  visiblePoiIds: undefined as Set<string> | undefined,
  visibleIdsSource: null as string | null,
  activeCategoryId: null as string | null,
};

function Probe({
  rect,
  camera,
}: {
  rect: ViewportRect | null;
  camera: MapCameraApi;
}) {
  const ctx = useBoard();
  spy.visiblePoiIds = ctx.visiblePoiIds;
  spy.visibleIdsSource = ctx.visibleIdsSource;
  spy.activeCategoryId = ctx.state.activeCategoryId;
  const { setViewportRect, setMapCamera } = ctx;
  useEffect(() => {
    setMapCamera(camera);
    return () => setMapCamera(null);
  }, [setMapCamera, camera]);
  useEffect(() => {
    setViewportRect(rect);
  }, [setViewportRect, rect]);
  return null;
}

function makeCamera(): MapCameraApi & {
  restore: ReturnType<typeof vi.fn>;
  fitVisible: ReturnType<typeof vi.fn>;
} {
  let pose = { lng: 10.4, lat: 63.43, zoom: 14, bearing: 0, pitch: 0 };
  return {
    snapshot: vi.fn(() => ({ ...pose })),
    restore: vi.fn((s) => {
      pose = { ...s };
    }),
    fitVisible: vi.fn(),
  } as never;
}

function setup(rect: ViewportRect | null = RECT) {
  const camera = makeCamera();
  const onHeight = vi.fn();
  const utils = render(
    <BoardProvider data={boardData()}>
      <Probe rect={rect} camera={camera} />
      <NeighbourhoodSurface onSurfaceHeightChange={onHeight} />
    </BoardProvider>,
  );
  const rerenderWith = (next: ViewportRect | null) =>
    utils.rerender(
      <BoardProvider data={boardData()}>
        <Probe rect={next} camera={camera} />
        <NeighbourhoodSurface onSurfaceHeightChange={onHeight} />
      </BoardProvider>,
    );
  return { ...utils, camera, onHeight, rerenderWith };
}

describe("NeighbourhoodSurface — nabolagslista", () => {
  it("scoper markørsettet til utsnittet og merker kilden som viewport", () => {
    setup();
    expect(spy.visibleIdsSource).toBe("viewport-scope");
    expect(Array.from(spy.visiblePoiIds!).sort()).toEqual([
      "mellom",
      "naer",
      "park",
    ]);
  });

  it("låser ALDRI markørene til en kategori på lista (R20)", () => {
    setup();
    expect(spy.activeCategoryId).toBeNull();
  });

  it("viser kategorier sortert på nærmeste synlige punkt", () => {
    const { getAllByTestId } = setup();
    expect(
      getAllByTestId("neighbourhood-card").map((el) => el.dataset.category),
    ).toEqual(["mat", "natur"]);
  });

  it("utelater punkter utenfor utsnittet fra dekningsbrøken", () => {
    const { getByText } = setup();
    expect(getByText("2 av 3 synlig · 3–7 min")).toBeTruthy();
  });

  it("degraderer til «vis alt» — ikke tom liste — uten utsnitt", () => {
    const { getAllByTestId } = setup(null);
    expect(spy.visibleIdsSource).toBeNull();
    expect(getAllByTestId("neighbourhood-card")).toHaveLength(2);
  });

  it("viser en tom tilstand, ikke et blankt ark, når ingenting er synlig", () => {
    const { getByTestId, queryAllByTestId } = setup({
      west: 11,
      east: 11.1,
      south: 64,
      north: 64.1,
    });
    expect(queryAllByTestId("neighbourhood-card")).toHaveLength(0);
    expect(getByTestId("neighbourhood-empty")).toBeTruthy();
  });
});

describe("NeighbourhoodSurface — førstegangs-hintet (R28)", () => {
  it("vises ved ankomst", () => {
    const { getByTestId } = setup();
    expect(getByTestId("neighbourhood-hint")).toBeTruthy();
  });

  it("forsvinner ved første kart-gest og kommer ikke tilbake", () => {
    const { queryByTestId, rerenderWith } = setup();
    act(() => rerenderWith(PANNED));
    expect(queryByTestId("neighbourhood-hint")).toBeNull();
    act(() => rerenderWith(RECT));
    expect(queryByTestId("neighbourhood-hint")).toBeNull();
  });

  it("overlever et sheet-drag: bare `south` endrer seg da, ikke kartet", () => {
    // Sheeten okkluderer nedenfra, så en ny hvileposisjon flytter KUN sørkanten.
    const { getByTestId, rerenderWith } = setup();
    act(() => rerenderWith({ ...RECT, south: RECT.south + 0.003 }));
    expect(getByTestId("neighbourhood-hint")).toBeTruthy();
  });
});

describe("NeighbourhoodSurface — kategorisiden (Unit 4)", () => {
  const openMat = (getByText: (t: string) => HTMLElement) =>
    act(() => {
      fireEvent.click(getByText("Mat & drikke"));
    });

  it("viser HELE kategorien, ikke bare de synlige punktene (R16)", () => {
    const { getByText, getByTestId } = setup();
    openMat(getByText);
    const list = getByTestId("category-poi-list");
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(list.textContent).toContain("langt");
  });

  it("slipper viewport-scopet så alle kategoriens markører kan vises (R16)", () => {
    const { getByText } = setup();
    openMat(getByText);
    expect(spy.visibleIdsSource).toBeNull();
    expect(spy.activeCategoryId).toBe("mat");
  });

  it("rammer inn kategorien ved push, uten å re-scope lista", () => {
    const { getByText, camera } = setup();
    openMat(getByText);
    expect(camera.fitVisible).toHaveBeenCalled();
  });

  it("lagrer kameraet ved push og gjenoppretter det EKSAKT ved tilbake (R18)", () => {
    const { getByText, getByLabelText, camera } = setup();
    const before = camera.snapshot();
    openMat(getByText);
    act(() => {
      fireEvent.click(getByLabelText("Tilbake til nabolagslista"));
    });
    expect(camera.restore).toHaveBeenCalledWith(before);
  });

  it("gjenoppretter det PANORERTE utsnittet, ikke ankomst-utsnittet", () => {
    const { getByText, getByLabelText, camera, rerenderWith } = setup();
    act(() => rerenderWith(PANNED));
    const panned = camera.snapshot();
    openMat(getByText);
    act(() => {
      fireEvent.click(getByLabelText("Tilbake til nabolagslista"));
    });
    expect(camera.restore).toHaveBeenCalledWith(panned);
    // Lista står igjen scopet til det panorerte utsnittet.
    expect(spy.visibleIdsSource).toBe("viewport-scope");
    expect(Array.from(spy.visiblePoiIds!)).toEqual(["langt"]);
  });

  it("etterlater ikke markørene låst til kategorien etter tilbake (R20)", () => {
    const { getByText, getByLabelText } = setup();
    openMat(getByText);
    act(() => {
      fireEvent.click(getByLabelText("Tilbake til nabolagslista"));
    });
    expect(spy.activeCategoryId).toBeNull();
  });

  it("fram og tilbake ti ganger ender i samme utsnitt", () => {
    const { getByText, getByLabelText, camera } = setup();
    const start = camera.snapshot();
    for (let i = 0; i < 10; i++) {
      openMat(getByText);
      act(() => {
        fireEvent.click(getByLabelText("Tilbake til nabolagslista"));
      });
    }
    expect(camera.snapshot()).toEqual(start);
  });

  it("rammer inn fornuftig også for en kategori med ett punkt", () => {
    const { getByText, getByTestId, camera } = setup();
    act(() => {
      fireEvent.click(getByText("Natur & friluft"));
    });
    expect(getByTestId("category-poi-list").querySelectorAll("li")).toHaveLength(1);
    expect(camera.fitVisible).toHaveBeenCalled();
  });

  it("gir alltid en synlig vei tilbake (R27)", () => {
    const { getByText, getByLabelText } = setup();
    openMat(getByText);
    expect(getByLabelText("Tilbake til nabolagslista")).toBeTruthy();
  });
});

describe("NeighbourhoodSurface — kategorisiden lager ALDRI sitt eget kart (R2)", () => {
  it("importerer ingen kart-motor — den persistente instansen kan ikke unmountes", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "components/variants/report/board/neighbourhood/CategoryPage.tsx",
      ),
      "utf8",
    );
    // Doc-kommentaren NEVNER motorene (den forklarer nettopp hvorfor de ikke
    // kan monteres to ganger) — guarden ser derfor på importer og elementer.
    const imports = src.match(/^import[\s\S]*?from\s+"[^"]+";$/gm) ?? [];
    expect(imports.join("\n")).not.toMatch(/BoardMap|react-map-gl|vis\.gl/);
    expect(src).not.toMatch(/<(BoardMap|Map|gmp-map-3d)[\s/>]/);
  });
});
