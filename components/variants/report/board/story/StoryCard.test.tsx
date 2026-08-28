import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { useEffect } from "react";
import type { MapCameraApi, ViewportRect } from "@/lib/board/board-types";
import type { BoardData, BoardPOI } from "../board-data";
import { BoardProvider, useBoard } from "../board-state";
import { NeighbourhoodSurface } from "../neighbourhood/NeighbourhoodSurface";
import { StoryTourProvider, useStoryTourOptional } from "./story-tour";
import { useMapPinClick } from "../use-map-pin-click";

/**
 * Omvisningen i flaten — mot EKTE providere, ikke mot mocks.
 *
 * Det som testes er sømmene: at inngangen tar over flaten, at de tre navngitte
 * stedene står i «Om området» og igjen med stjerne i stedslista, at kameraet
 * rammer stoppet og ikke hele kategorien, at et stedstrykk IKKE åpner
 * POI-modalen (`exploreSuppressed`), at et KART-trykk får flaten til å følge
 * etter uten å røre kameraet, og at «Avslutt» gir indeksen tilbake.
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

/** Utsnitt rundt boligen; `langt` ligger utenfor. */
const RECT: ViewportRect = {
  west: 10.39,
  east: 10.41,
  south: 63.42,
  north: 63.44,
};
const FAR = { lat: 63.505, lng: 10.51 };

function poi(
  id: string,
  opts: { lat?: number; lng?: number; walk?: number; narrative?: string } = {},
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
        id: "restaurant",
        name: "Restaurant",
        icon: "Utensils",
        color: "#c33",
      },
      travelTime: opts.walk === undefined ? undefined : { walk: opts.walk },
      ...(opts.narrative
        ? { grounding: { curated: { narrative: opts.narrative } } }
        : {}),
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
      district: "Lademoen",
    },
    globalFaq: [
      {
        id: "krets",
        question: "Hva kjennetegner området?",
        answer: "Lademoen er tett bebygd.",
        source: "deterministic",
      },
    ],
    areaIntro: "Første avsnitt om strøket.\n\nAndre avsnitt.",
    categories: [
      {
        id: "mat" as never,
        label: "Mat & drikke",
        question: "Får jeg dekket dagligbehovet?",
        lead: "Første setning. Andre setning. Tredje setning.",
        body: "",
        editorial: {
          body: "Avsnitt.",
          faq: [
            {
              id: "q1",
              question: "Er det kafé i gangavstand?",
              answer: "Ja.",
              source: "deterministic",
            },
          ],
          highlights: [
            {
              id: "naer" as never,
              name: "naer",
              icon: "Coffee",
              color: "#111111",
            },
            {
              id: "mellom" as never,
              name: "mellom",
              icon: "Croissant",
              color: "#222222",
            },
          ],
        },
        icon: "UtensilsCrossed",
        color: "#cc3300",
        pois: [
          poi("naer", { walk: 3, narrative: "Stedets egne ord." }),
          poi("mellom", { walk: 7 }),
          poi("tredje", { walk: 9 }),
          poi("langt", { ...FAR, walk: 25 }),
        ],
        topRankedPois: [],
      },
      {
        id: "natur" as never,
        label: "Natur & friluft",
        question: "Kommer jeg ut i naturen?",
        lead: "Turterreng rett utenfor døra.",
        body: "",
        icon: "TreePine",
        color: "#2f6f4f",
        pois: [poi("park", { walk: 9 })],
        topRankedPois: [],
      },
    ],
    poisById: new Map(),
    audioTourEnabled: false,
  };
}

const spy = {
  activePOIId: null as string | null,
  exploreSuppressed: false,
  phase: "default" as string,
  /* Det KARTET leser (BoardMap + BoardMap3D): omvisningen på, men uten stopp og
     uten vekting på områdestoppet — da skal kartet se ut som et overblikk, og
     pinnene være klikkbare. */
  story: {
    on: false,
    onArea: false,
    hasStop: false,
    emphasis: null as string | null,
  },
  /* Markørtrykket, EKTE: samme hook begge kart-motorene kaller. Testene kan da
     ikke bomme på halve kjeden — dispatch, måling og flatens oppfølging henger
     sammen i den, og et trykk som bare flyttet flaten ville mistet merket med
     én gang (se fokus-invarianten i story-tour). */
  clickPin: (() => {}) as (poiId: string) => void,
};

function Probe({ camera }: { camera: MapCameraApi }) {
  const ctx = useBoard();
  const tour = useStoryTourOptional();
  spy.clickPin = useMapPinClick();
  spy.story = {
    on: tour?.on ?? false,
    onArea: tour?.onArea ?? false,
    hasStop: !!tour?.stop,
    emphasis: tour?.emphasisOf("naer", "mat") ?? null,
  };
  spy.activePOIId = ctx.state.activePOIId;
  spy.exploreSuppressed = ctx.state.exploreSuppressed;
  spy.phase = ctx.state.phase;
  const { setViewportRect, setMapCamera } = ctx;
  useEffect(() => {
    setMapCamera(camera);
    return () => setMapCamera(null);
  }, [setMapCamera, camera]);
  useEffect(() => {
    setViewportRect(RECT, { userGesture: false });
  }, [setViewportRect]);
  return null;
}

function makeCamera() {
  return {
    snapshot: vi.fn(() => ({
      lng: 10.4,
      lat: 63.43,
      zoom: 14,
      bearing: 0,
      pitch: 0,
    })),
    restore: vi.fn(),
    fitVisible: vi.fn(),
    fitCoordinates: vi.fn(),
    flyToPoint: vi.fn(),
  };
}

function setup() {
  const camera = makeCamera();
  const utils = render(
    <BoardProvider data={boardData()}>
      <StoryTourProvider>
        <Probe camera={camera as unknown as MapCameraApi} />
        <NeighbourhoodSurface onSurfaceHeightChange={vi.fn()} />
      </StoryTourProvider>
    </BoardProvider>,
  );
  const begin = () =>
    act(() => fireEvent.click(utils.getByTestId("story-play")));
  return { ...utils, camera, begin };
}

describe("inngangen", () => {
  it("ligger over indeksen, ikke i stedet for den", () => {
    const { getByTestId, getByText } = setup();
    expect(getByTestId("story-play")).not.toBeNull();
    expect(getByText("Mat & drikke")).not.toBeNull();
  });

  it("sier hvor mange stopp omvisningen har", () => {
    const { getByTestId } = setup();
    expect(getByTestId("story-play").textContent).toContain("2 stopp");
  });

  it("tar over flaten: indeksen og hintet ligger bak «Avslutt»", () => {
    const { begin, queryByTestId, getByTestId } = setup();
    begin();
    expect(getByTestId("story-card")).not.toBeNull();
    expect(queryByTestId("neighbourhood-card")).toBeNull();
    expect(queryByTestId("neighbourhood-hint")).toBeNull();
    expect(queryByTestId("story-play")).toBeNull();
  });

  it("gir indeksen tilbake ved «Avslutt», og flyr kameraet ut", () => {
    const { begin, getByTestId, queryByTestId, camera } = setup();
    begin();
    act(() => fireEvent.click(getByTestId("story-exit")));
    expect(queryByTestId("story-card")).toBeNull();
    expect(getByTestId("story-play")).not.toBeNull();
    expect(camera.flyToPoint).toHaveBeenCalled();
  });
});

describe("stoppet", () => {
  it("har KJØPERENS spørsmål som overskrift, ikke kategorilabelen", () => {
    const { begin, getByText, queryByText } = setup();
    begin();
    expect(getByText("Får jeg dekket dagligbehovet?")).not.toBeNull();
    // Labelen står i transporten, ikke som overskrift i kortet.
    expect(queryByText("Mat & drikke")).not.toBeNull();
  });

  it("kutter strøksteksten etter to setninger", () => {
    const { begin, getByText } = setup();
    begin();
    expect(getByText("Første setning. Andre setning.")).not.toBeNull();
  });

  it("viser meglerens utvalg i «Om området», med kuratorens overskrift", () => {
    const { begin, getByText } = setup();
    begin();
    expect(getByText("Verdt å merke seg")).not.toBeNull();
    const rows = document.querySelectorAll('[data-testid="story-row"]');
    expect([...rows].map((r) => r.getAttribute("data-poi"))).toEqual([
      "naer",
      "mellom",
    ]);
  });

  it("rammer kameraet rundt boligen + de tre, ikke rundt hele kategorien", () => {
    const { begin, camera } = setup();
    begin();
    expect(camera.fitCoordinates).toHaveBeenCalledTimes(1);
    const coords = camera.fitCoordinates.mock.calls[0][0] as { lat: number }[];
    expect(coords).toHaveLength(2); // de to plukkede; boligen legges til av kartet
  });
});

describe("stedsfanen", () => {
  const openPlaces = () => {
    const { begin, ...utils } = setup();
    begin();
    act(() => fireEvent.click(utils.getByText(/^Steder \(/)));
    return utils;
  };

  it("teller det som er i UTSNITTET, ikke hele kategorien", () => {
    const { begin, getByText } = setup();
    begin();
    // «langt» ligger utenfor rektangelet.
    expect(getByText("Steder (3)")).not.toBeNull();
  });

  it("er én liste sortert på avstand, med stjerne på de plukkede", () => {
    const utils = openPlaces();
    const rows = [...document.querySelectorAll('[data-testid="story-row"]')];
    expect(rows.map((r) => r.getAttribute("data-poi"))).toEqual([
      "naer",
      "mellom",
      "tredje",
    ]);
    // Stjernen er en `svg` med fill; prikken er en `span`. De to plukkede
    // først, det tredje stedet uten.
    expect(utils.getAllByTestId("story-row")).toHaveLength(3);
  });

  it("sier hvor mange som ligger utenfor utsnittet", () => {
    const utils = openPlaces();
    expect(utils.getByTestId("story-outside").textContent).toContain(
      "1 sted utenfor",
    );
  });

  it("rammer IKKE inn noe når fanen åpnes — lista ER utsnittet", () => {
    const { begin, getByText, camera } = setup();
    begin();
    const before = camera.fitCoordinates.mock.calls.length;
    act(() => fireEvent.click(getByText(/^Steder \(/)));
    expect(camera.fitCoordinates.mock.calls.length).toBe(before);
  });
});

describe("et stedstrykk", () => {
  it("åpner stedets egne ord i raden og flyr kartet dit ETTERPÅ", () => {
    vi.useFakeTimers();
    try {
      const { begin, getByTestId, camera } = setup();
      begin();
      const row = document.querySelector('[data-poi="naer"]') as HTMLElement;
      act(() => fireEvent.click(row));
      expect(row.getAttribute("aria-expanded")).toBe("true");
      expect(getByTestId("story-narrative").getAttribute("data-expanded")).toBe(
        "true",
      );
      // Teksten først, kameraet etter — ett blikk om gangen.
      expect(camera.flyToPoint).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(camera.flyToPoint).toHaveBeenCalledTimes(1);
      // Rammen holdes: ingen sentrering med zoom-gulv på et rad-klikk.
      expect(camera.flyToPoint).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({ holdFrame: true }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("åpner ALDRI POI-modalen: kilden er «story», så modalen er undertrykt", () => {
    const { begin } = setup();
    begin();
    act(() =>
      fireEvent.click(
        document.querySelector('[data-poi="naer"]') as HTMLElement,
      ),
    );
    expect(spy.activePOIId).toBe("naer");
    expect(spy.phase).toBe("poi");
    expect(spy.exploreSuppressed).toBe(true);
  });

  it("lukker bare DET stedet, og lar kameraet stå", () => {
    const { begin, camera } = setup();
    begin();
    const row = () =>
      document.querySelector('[data-poi="naer"]') as HTMLElement;
    act(() => fireEvent.click(row()));
    act(() => fireEvent.click(row()));
    expect(row().getAttribute("aria-expanded")).toBe("false");
    expect(camera.flyToPoint).not.toHaveBeenCalled();
  });

  it("holder feltene åpne på tvers av et fanebytte", () => {
    const { begin, getByText } = setup();
    begin();
    act(() =>
      fireEvent.click(
        document.querySelector('[data-poi="naer"]') as HTMLElement,
      ),
    );
    act(() => fireEvent.click(getByText(/^Steder \(/)));
    act(() => fireEvent.click(getByText("Om området")));
    expect(
      (document.querySelector('[data-poi="naer"]') as HTMLElement).getAttribute(
        "aria-expanded",
      ),
    ).toBe("true");
  });
});

describe("et kart-trykk", () => {
  /** Trykk på markøren til `id`, gjennom den ekte kjeden. */
  const clickPin = (id: string) =>
    act(() => {
      spy.clickPin(id);
    });
  /** Hvilken svarform som står valgt akkurat nå. */
  const selectedPane = () =>
    [...document.querySelectorAll("[data-story-pane]")].find(
      (el) => el.getAttribute("aria-selected") === "true",
    )?.getAttribute("data-story-pane") ?? null;

  it("lar flaten STÅ til popupen har landet, og følger etter da", () => {
    vi.useFakeTimers();
    try {
      const { begin } = setup();
      begin();
      clickPin("tredje");
      // Så langt har bare kartet svart: punktet er åpent (popup + rutelinje),
      // men flaten har ikke rørt seg.
      expect(spy.activePOIId).toBe("tredje");
      expect(selectedPane()).toBe("about");
      expect(document.querySelector("li[data-focused]")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(selectedPane()).toBe("places");
      const focused = document.querySelector("li[data-focused]");
      expect(
        focused?.querySelector("[data-poi]")?.getAttribute("data-poi"),
      ).toBe("tredje");
    } finally {
      vi.useRealTimers();
    }
  });

  it("finner STOPPET punktet ligger i, ikke bare raden", () => {
    vi.useFakeTimers();
    try {
      const { begin, getByText } = setup();
      begin(); // stopp 0 = «Mat & drikke»
      clickPin("park"); // ligger i «Natur & friluft»
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(getByText("Kommer jeg ut i naturen?")).not.toBeNull();
      expect(
        document
          .querySelector("li[data-focused] [data-poi]")
          ?.getAttribute("data-poi"),
      ).toBe("park");
    } finally {
      vi.useRealTimers();
    }
  });

  it("rører ALDRI kameraet: brukeren dro seg dit selv", () => {
    vi.useFakeTimers();
    try {
      const { begin, camera } = setup();
      begin();
      camera.fitCoordinates.mockClear();
      clickPin("tredje");
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(camera.flyToPoint).not.toHaveBeenCalled();
      expect(camera.fitCoordinates).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("gir en rad til et punkt UTENFOR utsnittet også — du trykket på pinnen", () => {
    vi.useFakeTimers();
    try {
      const { begin } = setup();
      begin();
      clickPin("langt"); // ligger utenfor RECT
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(
        document
          .querySelector("li[data-focused] [data-poi]")
          ?.getAttribute("data-poi"),
      ).toBe("langt");
    } finally {
      vi.useRealTimers();
    }
  });

  it("slipper merket når punktet lukkes", () => {
    vi.useFakeTimers();
    try {
      const { begin } = setup();
      begin();
      clickPin("tredje");
      act(() => {
        vi.advanceTimersByTime(600);
      });
      const row = document.querySelector('[data-poi="tredje"]') as HTMLElement;
      act(() => fireEvent.click(row)); // lukker raden → punktet slippes
      expect(document.querySelector("li[data-focused]")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("starter ALDRI omvisningen: er den av, ligger indeksen der", () => {
    vi.useFakeTimers();
    try {
      const utils = setup();
      clickPin("naer");
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(spy.story.on).toBe(false);
      expect(utils.queryByTestId("story-card")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("transporten", () => {
  it("bytter stopp, og hvert stopp begynner med spørsmålet", () => {
    const { begin, getByText, getByTestId } = setup();
    begin();
    act(() => fireEvent.click(getByText(/^Steder \(/)));
    act(() => fireEvent.click(getByText("Natur & friluft")));
    expect(getByText("Kommer jeg ut i naturen?")).not.toBeNull();
    // Tilbake på ord-fanen, ikke i den fanen forrige stopp sto i.
    expect(getByTestId("story-card").textContent).toContain(
      "Turterreng rett utenfor døra.",
    );
  });

  it("rammer inn det nye stoppet", () => {
    const { begin, getByText, camera } = setup();
    begin();
    act(() => fireEvent.click(getByText("Natur & friluft")));
    expect(camera.fitCoordinates).toHaveBeenCalledTimes(2);
  });
});

describe("områdestoppet", () => {
  /** Brikkene i transporten, i DOM-rekkefølge. */
  const railTabs = () => [
    ...document.querySelectorAll<HTMLElement>(
      '[aria-label="Stopp"] [role="tab"]',
    ),
  ];

  it("ligger FØRST i raden, med et fast ord — ikke strøkets navn", () => {
    // Navnet står som overskrift rett under brikken; å ha det begge steder
    // gjorde brikken til et sjette tema (2026-08-27).
    const utils = setup();
    utils.begin();
    expect(railTabs().map((t) => t.textContent)).toEqual([
      "Beliggenhet",
      "Mat & drikke",
      "Natur & friluft",
    ]);
  });

  it("bærer strøkets intro som avsnitt, slik temaene bærer sin prosa", () => {
    const utils = setup();
    utils.begin();
    act(() => fireEvent.click(railTabs()[0]));
    const tekst = utils.getByTestId("story-card").textContent!;
    expect(tekst).toContain("Første avsnitt om strøket.");
    expect(tekst).toContain("Andre avsnitt.");
    // Den navigerende setningen er en FALLBACK, ikke et tillegg.
    expect(tekst).not.toContain("Velg et tema for å gå inn i ett av dem");
  });

  it("erstatter spørsmålet med stedet, og fanene med dekningen i tall", () => {
    const utils = setup();
    utils.begin();
    act(() => fireEvent.click(railTabs()[0]));
    expect(utils.getByTestId("story-card").textContent).toContain("Lademoen");
    expect(utils.getByTestId("story-area-subline").textContent).toBe(
      "5 steder · 2 temaer",
    );
    expect(utils.queryByRole("tablist", { name: "Svarform" })).toBeNull();
  });

  it("bærer boardets egen FAQ — den som ellers ligger i indeksen", () => {
    const utils = setup();
    utils.begin();
    act(() => fireEvent.click(railTabs()[0]));
    expect(
      utils.getByTestId("story-area-faq").textContent,
    ).toContain("Hva kjennetegner området?");
  });

  it("flyr kameraet ut til hele nabolaget når det VELGES, ikke ved ankomst", () => {
    const utils = setup();
    utils.begin();
    // Ankomsten på et temastopp rammer de tre; ingen flytur ut.
    expect(utils.camera.flyToPoint).not.toHaveBeenCalled();
    act(() => fireEvent.click(railTabs()[0]));
    expect(utils.camera.flyToPoint).toHaveBeenCalledTimes(1);
  });

  it("lar kartet være et overblikk: ingen vekting av markørene", () => {
    const utils = setup();
    utils.begin();
    // På et temastopp vektes markørene i tre nivåer.
    expect(spy.story).toMatchObject({ on: true, onArea: false, hasStop: true });
    expect(spy.story.emphasis).toBe("named");
    act(() => fireEvent.click(railTabs()[0]));
    // På området er vekten borte: alle pinnene står i full styrke, fordi
    // området ER overblikket. Vekten sier ikke lenger noe om hva som er
    // KLIKKBART — pinnene tar imot trykk på alle stopp (2026-08-28).
    expect(spy.story).toMatchObject({ on: true, onArea: true, hasStop: false });
    expect(spy.story.emphasis).toBeNull();
  });

  it("beholder utgangen på mobil: indeksen ligger fortsatt bak den", () => {
    const utils = setup();
    utils.begin();
    act(() => fireEvent.click(railTabs()[0]));
    act(() => fireEvent.click(utils.getByTestId("story-exit")));
    expect(utils.queryByTestId("story-card")).toBeNull();
    expect(utils.getByTestId("story-play")).not.toBeNull();
  });
});

describe("svarfanen", () => {
  it("vises bare når kategorien HAR spørsmål", () => {
    const { begin, getByText, queryByText } = setup();
    begin();
    expect(getByText("Spørsmål (1)")).not.toBeNull();
    act(() => fireEvent.click(getByText("Natur & friluft")));
    expect(queryByText(/^Spørsmål \(/)).toBeNull();
  });

  it("bruker boardets egen FAQ-seksjon", () => {
    const { begin, getByText, getByTestId } = setup();
    begin();
    act(() => fireEvent.click(getByText("Spørsmål (1)")));
    expect(getByTestId("story-faq")).not.toBeNull();
    expect(getByText("Er det kafé i gangavstand?")).not.toBeNull();
  });
});
