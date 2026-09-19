import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import type { BoardData, BoardPOI } from "../board-data";
import type { POI } from "@/lib/types";
import { BoardProvider, useBoard } from "../board-state";
import type { BoardAction } from "../board-state";
import { StoryTourProvider, useStoryTour } from "./story-tour";
import { StoryCard } from "./StoryCard";
import { StoryPoiPanel } from "./StoryPoiPanel";

/**
 * Stedet i kolonnen — den ene delingen som avgjør formen (2026-08-28).
 *
 * Regelen som testes er ikke «mye innhold» (den er ikke avgjørbar), men om
 * stedet INNEHOLDER andre steder: et anker peker videre til sin egen side,
 * alt annet folder seg ut der raden står. Testene bevises mot EKTE providere,
 * ikke mot mocks — det er sømmen mellom rad, board-state og lag som er verdt
 * å holde fast.
 *
 * Google-attribusjonen står med vilje som en egen test: vilkårene krever at
 * `searchEntryPointHtml` følger leverandør-teksten, og etter at teksten flyttet
 * fra modalen ned i raden er dette den flaten som kan miste den.
 */

/**
 * 2026-09-15: panelet bærer nå ALLE steder når boardet ber om det
 * (`placePanel` + desktop). Testene under «det felles detaljpanelet» beviser
 * den kompakte siden, bildet, byttet mellom steder, lukkingen under og uten
 * policy, og fokus — alt mot de samme ekte providerne.
 */

afterEach(() => cleanup());

/* `useIsDesktop` leser `window.matchMedia`, som jsdom ikke har. Default er
   mobil-bredde (ingen policy); testene som trenger desktop setter `desktop`. */
let desktop = false;
beforeEach(() => {
  desktop = false;
  window.matchMedia = ((query: string) =>
    ({
      matches: query === "(min-width: 1024px)" && desktop,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
});

// next/image krever Next-runtime i jsdom. `onError` sendes videre så testene
// kan utløse bildefeil.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, src, onError } = props as {
      alt: string;
      src: string;
      onError?: () => void;
    };
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} onError={onError} />;
  },
}));

vi.mock("@/lib/hooks/useRealtimeData", () => ({
  useRealtimeData: (place: { enturStopplaceId?: string } | null) =>
    place?.enturStopplaceId
      ? {
          entur: {
            stopName: "Dora",
            departures: [
              {
                departureTime: new Date(Date.now() + 5 * 60_000).toISOString(),
                isRealtime: true,
                destination: "Trondheim S",
                lineCode: "20",
                transportMode: "bus",
              },
            ],
          },
          loading: false,
          error: null,
          lastUpdated: new Date(),
        }
      : { loading: false, error: null, lastUpdated: null },
}));

const CATEGORY = {
  id: "restaurant",
  name: "Restaurant",
  icon: "Utensils",
  color: "#cc3300",
};

function raw(id: string, extra: Partial<POI> = {}): POI {
  return {
    id,
    name: id,
    coordinates: { lat: 63.43, lng: 10.4 },
    category: CATEGORY,
    travelTime: { walk: 5 },
    ...extra,
  } as POI;
}

function poi(id: string, opts: { body?: string; extra?: Partial<POI> } = {}) {
  return {
    id: id as BoardPOI["id"],
    name: id,
    coordinates: { lat: 63.43, lng: 10.4 },
    categoryId: "mat" as BoardPOI["categoryId"],
    ...(opts.body ? { body: opts.body } : {}),
    raw: raw(id, opts.extra),
  } as BoardPOI;
}

/** Ankeret: `isAnchor` + medlemmene registeret lever av. */
function anchor(): BoardPOI {
  const member: POI = raw("Extra Grilstad", {
    category: {
      id: "supermarket",
      name: "Dagligvare",
      icon: "ShoppingCart",
      color: "#22aa55",
    },
  });
  return {
    ...poi("Grilstad mall"),
    isAnchor: true,
    childPOIs: [member],
    raw: raw("Grilstad mall", {
      anchorSummary: "dagligvare, apotek og frisør",
    }),
  } as BoardPOI;
}

const GEMINI: Partial<POI> = {
  grounding: {
    poiGroundingVersion: 1,
    generated: {
      provider: "gemini-search-grounding",
      narrative: "Leverandørens tekst om stedet.",
      sources: [
        {
          title: "Kilden",
          domain: "eksempel.no",
          url: "https://eksempel.no/a",
          redirectUrl: "https://vertex/redirect/a",
        },
      ],
      searchEntryPointHtml: '<div class="chip">Google-forslag</div>',
      searchQueries: ["osteria trondheim"],
      model: "gemini-2.5-flash",
      fetchedAt: "2026-08-01T00:00:00.000Z",
      qualityGate: { passed: true, charCount: 30, sourceCount: 1 },
    },
  },
};

function boardData(extraPlaces: BoardPOI[] = []): BoardData {
  const solo = {
    ...poi("Ensom kiosk", { extra: { travelTime: { walk: 9 } } }),
    categoryId: "solo" as BoardPOI["categoryId"],
  } as BoardPOI;
  return {
    projectSlug: "ranheim",
    home: {
      name: "Strindfjordvegen 10",
      coordinates: { lat: 63.43, lng: 10.4 },
      address: "Strindfjordvegen 10",
      district: "Ranheim",
    },
    globalFaq: [],
    areaIntro: "Om strøket.",
    categories: [
      {
        id: "mat" as never,
        label: "Mat & drikke",
        question: "Er det et levende nabolag?",
        lead: "Prosa.",
        body: "",
        icon: "UtensilsCrossed",
        color: "#cc3300",
        pois: [
          poi("Flipper Kafe", {
            body: "Første avsnitt om kafeen.\n\nAndre avsnitt om kafeen.",
            extra: { googleRating: 4.2, googleReviewCount: 709 },
          }),
          poi("Kiosken", {
            extra: { googleRating: 4.5, googleReviewCount: 12 },
          }),
          poi("Osteria", { extra: GEMINI }),
          poi("Kaia", {
            body: "Kort om kaia.",
            extra: { featuredImage: "https://img.test/kaia.jpg" },
          }),
          poi("Verkstedet", {
            body: "Kort om verkstedet.",
            extra: { featuredImage: "https://img.test/verkstedet.jpg" },
          }),
          // Det tomme stedet: bare navn, kategori og minutter.
          poi("Bua", { extra: { travelTime: { walk: 4, bike: 2 } } }),
          anchor(),
          ...extraPlaces,
        ],
        topRankedPois: [],
      },
      {
        id: "solo" as never,
        label: "Alene",
        question: "Er det noe mer?",
        lead: "Ett sted.",
        body: "",
        icon: "MapPin",
        color: "#3355cc",
        pois: [solo],
        topRankedPois: [],
      },
    ],
    poisById: new Map(),
    audioTourEnabled: false,
  };
}

const spy = {
  exploreOpen: false,
  phase: "default" as string,
  activePOIId: null as string | null,
  dispatch: (() => {}) as (a: BoardAction) => void,
  goto: (() => {}) as (n: number) => void,
};

function Probe({ onBegin }: { onBegin: (fn: () => void) => void }) {
  const { state, dispatch } = useBoard();
  const { begin, goto } = useStoryTour();
  spy.goto = goto;
  spy.exploreOpen = state.exploreOpen;
  spy.phase = state.phase;
  spy.activePOIId = state.activePOIId ? String(state.activePOIId) : null;
  spy.dispatch = dispatch;
  onBegin(() => begin(0));
  return null;
}

function setup(opts: { placePanel?: boolean; places?: BoardPOI[] } = {}) {
  let start = () => {};
  const utils = render(
    <BoardProvider data={boardData(opts.places)} placePanel={opts.placePanel}>
      <StoryTourProvider>
        <Probe onBegin={(fn) => (start = fn)} />
        <StoryCard variant="column" />
        <StoryPoiPanel />
      </StoryTourProvider>
    </BoardProvider>,
  );
  act(() => start());
  // Stedslista, ikke «Om området»: der ligger alle radene. På desktop-bredde
  // finnes ikke fanen (området er første stopp i raden), og radene står alt.
  const placesPane = utils.container.querySelector('[data-story-pane="places"]');
  if (placesPane) act(() => fireEvent.click(placesPane));
  const row = (name: string) =>
    [...utils.container.querySelectorAll('[data-testid="story-row"]')].find(
      (el) => el.textContent?.includes(name),
    ) as HTMLElement;
  return { ...utils, row };
}

describe("den vanlige raden", () => {
  it("bærer HELE stedets tekst, ikke bare kroken", () => {
    const { row, getByText } = setup();
    act(() => fireEvent.click(row("Flipper Kafe")));
    // Avsnitt to lå tidligere bare i modalen (Andreas, 2026-08-28).
    expect(getByText("Første avsnitt om kafeen.")).not.toBeNull();
    expect(getByText("Andre avsnitt om kafeen.")).not.toBeNull();
  });

  it("tar Google-faktaene med ned i raden", () => {
    const { row, container } = setup();
    act(() => fireEvent.click(row("Flipper Kafe")));
    const facts = container.querySelector('[data-testid="poi-facts"]');
    expect(facts).not.toBeNull();
    expect(facts!.textContent).toContain("709");
  });

  it("er utfoldbar på fakta ALENE — et sted uten tekst har også noe å vise", () => {
    const { row } = setup();
    const kiosk = row("Kiosken");
    expect(kiosk.getAttribute("aria-expanded")).toBe("false");
    act(() => fireEvent.click(kiosk));
    expect(kiosk.getAttribute("aria-expanded")).toBe("true");
  });

  it("tar Google-attribusjonen MED seg inn i raden (ToS)", () => {
    const { row, getByText, container } = setup();
    act(() => fireEvent.click(row("Osteria")));
    expect(getByText("Hentet via Google Søk")).not.toBeNull();
    // searchEntryPoint rendres verbatim — kravet som følger leverandør-teksten.
    expect(container.innerHTML).toContain("Google-forslag");
  });
});

describe("ankerets rad", () => {
  it("folder seg IKKE ut — den peker til en side", () => {
    const { row } = setup();
    const el = row("Grilstad mall");
    expect(el.getAttribute("aria-haspopup")).toBe("dialog");
    expect(el.getAttribute("aria-expanded")).toBeNull();
  });

  it("åpner stedets egen side over kolonnen", () => {
    const { row, getByTestId, queryByTestId } = setup();
    // Laget finnes ikke i DOM før det har vært brukt — kolonnen bærer ingen
    // usynlig side i bakgrunnen.
    expect(queryByTestId("story-poi-panel")).toBeNull();
    act(() => fireEvent.click(row("Grilstad mall")));
    expect(getByTestId("story-poi-panel").dataset.open).toBe("true");
    expect(spy.exploreOpen).toBe(true);
  });

  it("bærer registeret på siden — det er innholdet om senteret", () => {
    const { row, getByTestId } = setup();
    act(() => fireEvent.click(row("Grilstad mall")));
    const panel = getByTestId("story-poi-panel");
    expect(panel.textContent).toContain("I senteret");
    expect(panel.textContent).toContain("Extra Grilstad");
  });

  it("legger siden bort igjen ved tilbakeknappen, uten å forlate stoppet", () => {
    const { row, getByTestId } = setup();
    act(() => fireEvent.click(row("Grilstad mall")));
    act(() => fireEvent.click(getByTestId("story-poi-panel-close")));
    expect(getByTestId("story-poi-panel").dataset.open).toBe("false");
    // Stoppet står: omvisningen bak laget er urørt.
    expect(getByTestId("story-card")).not.toBeNull();
  });
});

/** Åpner et sted i panelet slik desktop-policyen gjør det: valg + detaljflate i én gest. */
function openInPanel(id: string) {
  act(() =>
    spy.dispatch({
      type: "OPEN_POI",
      id: id as BoardPOI["id"],
      categoryId: "mat" as BoardPOI["categoryId"],
      detail: true,
    }),
  );
}

describe("det felles detaljpanelet (2026-09-15)", () => {
  it("viser sanntidsavganger for et Entur-koblet stoppested", () => {
    const { getByTestId } = setup({
      places: [
        poi("Dora bussholdeplass", {
          extra: { enturStopplaceId: "NSR:StopPlace:41613" },
        }),
      ],
    });
    openInPanel("Dora bussholdeplass");
    const panel = getByTestId("story-poi-panel");
    expect(panel.textContent).toContain("20");
    expect(panel.textContent).toContain("Trondheim S");
  });

  it("gir det tomme stedet en kompakt side: navn, kategori, minutter — ingen tom hero, ingen beklagelse", () => {
    const { getByTestId, queryByTestId } = setup();
    openInPanel("Bua");
    const panel = getByTestId("story-poi-panel");
    expect(panel.dataset.open).toBe("true");
    expect(panel.querySelector("h2")?.textContent).toBe("Bua");
    expect(panel.textContent).toContain("Restaurant");
    expect(getByTestId("story-poi-panel-minutes").textContent).toBe("4 min til fots");
    expect(queryByTestId("story-poi-panel-image")).toBeNull();
    expect(panel.querySelector("img")).toBeNull();
    expect(panel.textContent).not.toMatch(/innhold|mangler|ikke noe redaksjonelt/i);
  });

  it("bruker reisemåtens ord i minuttlinja", () => {
    const { getByTestId } = setup();
    act(() => spy.dispatch({ type: "SET_TRAVEL_MODE", mode: "bike" }));
    openInPanel("Bua");
    expect(getByTestId("story-poi-panel-minutes").textContent).toBe("2 min på sykkel");
  });

  it("viser hovedbildet, og faller tilbake til den bildefrie siden når det feiler", () => {
    const { getByTestId, queryByTestId } = setup();
    openInPanel("Kaia");
    const box = getByTestId("story-poi-panel-image");
    const img = box.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://img.test/kaia.jpg");
    act(() => {
      fireEvent.error(img);
    });
    expect(queryByTestId("story-poi-panel-image")).toBeNull();
    // Resten av siden står.
    expect(getByTestId("story-poi-panel").textContent).toContain("Kort om kaia.");
  });

  it("bytter sted i samme panel: innholdet scroller til toppen og A sitt bilde er borte", () => {
    const setScroll = vi.fn();
    const desc = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
    Object.defineProperty(Element.prototype, "scrollTop", {
      configurable: true,
      get: () => 0,
      set: setScroll,
    });
    try {
      const { getByTestId } = setup();
      openInPanel("Kaia");
      setScroll.mockClear();
      openInPanel("Verkstedet");
      const panel = getByTestId("story-poi-panel");
      expect(panel.dataset.open).toBe("true");
      expect(panel.querySelector("h2")?.textContent).toBe("Verkstedet");
      const imgs = [...panel.querySelectorAll("img")].map((i) => i.getAttribute("src"));
      expect(imgs).toEqual(["https://img.test/verkstedet.jpg"]);
      expect(setScroll).toHaveBeenCalledWith(0);
    } finally {
      if (desc) Object.defineProperty(Element.prototype, "scrollTop", desc);
    }
  });

  it("holder på markøren ved lukking UTEN policy (ankerpanelet på andre boards)", () => {
    const { row, getByTestId } = setup();
    act(() => fireEvent.click(row("Grilstad mall")));
    expect(spy.activePOIId).toBe("Grilstad mall");
    act(() => fireEvent.click(getByTestId("story-poi-panel-close")));
    expect(getByTestId("story-poi-panel").dataset.open).toBe("false");
    expect(spy.activePOIId).toBe("Grilstad mall");
  });

  it("slipper markøren ved lukking UNDER policy — tilbakeknapp", () => {
    desktop = true;
    const { getByTestId } = setup({ placePanel: true });
    openInPanel("Kiosken");
    expect(spy.activePOIId).toBe("Kiosken");
    act(() => fireEvent.click(getByTestId("story-poi-panel-close")));
    expect(getByTestId("story-poi-panel").dataset.open).toBe("false");
    expect(spy.activePOIId).toBeNull();
  });

  it("slipper markøren ved lukking UNDER policy — Escape", () => {
    desktop = true;
    const { getByTestId } = setup({ placePanel: true });
    openInPanel("Kiosken");
    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(getByTestId("story-poi-panel").dataset.open).toBe("false");
    expect(spy.activePOIId).toBeNull();
  });

  it("er en region uten fokusfelle, med fokus på tilbakeknappen ved åpning og tilbake til utløseren ved lukking", () => {
    const { row, getByTestId } = setup();
    const trigger = row("Grilstad mall");
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    act(() => fireEvent.click(trigger));
    const panel = getByTestId("story-poi-panel");
    expect(panel.getAttribute("role")).toBe("region");
    expect(panel.getAttribute("aria-labelledby")).toBe(panel.querySelector("h2")!.id);
    expect(panel.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(getByTestId("story-poi-panel-close"));
    act(() => fireEvent.click(getByTestId("story-poi-panel-close")));
    expect(document.activeElement).toBe(trigger);
  });
});

describe("kolonnen skifter innhold — ikke et kort over den (2026-09-15)", () => {
  it("er én flat flate: ingen skygge, ring, radius eller innrykk, og ingen dimmet bakgrunn", () => {
    const { getByTestId } = setup();
    openInPanel("Bua");
    const panel = getByTestId("story-poi-panel");
    expect(panel.className).toContain("inset-0");
    expect(panel.className).not.toMatch(/shadow|ring-|rounded|inset-x-|inset-y-|backdrop/);
    expect(panel.querySelector("[class*='backdrop-blur']")).toBeNull();
  });

  it("tilbakeknappen sier hvor du kommer tilbake — temaets navn", () => {
    const { getByTestId } = setup();
    openInPanel("Bua");
    expect(getByTestId("story-poi-panel-close").textContent).toBe("Tilbake til Mat & drikke");
  });

  it("«Se mer på Google» er en rad blant lenkene i faktalista, ikke en egen knapp nederst", () => {
    const { getByTestId, queryByTestId } = setup();
    openInPanel("Kiosken");
    const link = getByTestId("poi-search-link");
    expect(link.textContent).toBe("Se mer på Google");
    expect(link.closest('[data-testid="poi-facts"]')).not.toBeNull();
    expect(getByTestId("story-poi-panel").querySelectorAll("a[href*='google.com/search']")).toHaveLength(1);
    // Med grounded narrativ er kildelenkene utveien — ingen Google-rad.
    openInPanel("Osteria");
    expect(queryByTestId("poi-search-link")).toBeNull();
  });

  it("forbeholdet om kartpunktet ligger bak et infoikon ved adressen, ikke som egen linje", () => {
    const { getByTestId, queryByTestId } = setup({
      places: [
        poi("Brygga", {
          extra: {
            address: "Kaia 1",
            locationPrecision: "approximate",
            locationNote: "Plassert omtrentlig ut fra kildens beskrivelse.",
          },
        }),
      ],
    });
    openInPanel("Brygga");
    expect(queryByTestId("precision-note")).toBeNull();
    const toggle = getByTestId("story-poi-panel-note-toggle");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    act(() => fireEvent.click(toggle));
    expect(getByTestId("precision-note").textContent).toContain("omtrentlig");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    // Et sted uten forbehold har ikke ikonet.
    openInPanel("Bua");
    expect(queryByTestId("story-poi-panel-note-toggle")).toBeNull();
    expect(queryByTestId("precision-note")).toBeNull();
  });
});

describe("«Lignende steder» under stedsinnholdet (2026-09-15)", () => {
  const rows = (utils: ReturnType<typeof setup>) =>
    [...utils.container.querySelectorAll('[data-testid="story-similar-row"]')] as HTMLElement[];

  it("viser opptil fem andre steder fra gjeldende kategori, sortert på reisetid og navn, uten det valgte", () => {
    desktop = true;
    const utils = setup({ placePanel: true });
    openInPanel("Bua");
    const list = rows(utils);
    expect(list).toHaveLength(5);
    expect(list.map((r) => r.getAttribute("data-poi"))).toEqual([
      "Flipper Kafe",
      "Grilstad mall",
      "Kaia",
      "Kiosken",
      "Osteria",
    ]);
    expect(list.map((r) => r.getAttribute("data-poi"))).not.toContain("Bua");
    expect(list[0].textContent).toContain("5 min");
    // Ingen utfolding — radene er innganger.
    expect(list[0].getAttribute("aria-expanded")).toBeNull();
  });

  it("sorterer på valgt reisemåte, og viser ikke tider vi mangler", () => {
    desktop = true;
    const utils = setup({
      placePanel: true,
      places: [poi("Tidløs", { extra: { travelTime: {} } })],
    });
    act(() => spy.dispatch({ type: "SET_TRAVEL_MODE", mode: "bike" }));
    openInPanel("Flipper Kafe");
    const list = rows(utils);
    // Bua har 2 min på sykkel og går først; de andre har ingen sykkeltid og
    // sorteres på navn etterpå — uten estimat.
    expect(list[0].getAttribute("data-poi")).toBe("Bua");
    expect(list[0].textContent).toContain("2 min");
    expect(list[1].textContent).not.toMatch(/\d+ min/);
  });

  it("et trykk bytter sted i samme panel, beholder kategorien og starter på toppen", () => {
    desktop = true;
    const utils = setup({ placePanel: true });
    openInPanel("Bua");
    const scroller = utils.getByTestId("story-poi-panel").querySelector(".overflow-y-auto") as HTMLElement;
    scroller.scrollTop = 150;
    act(() => fireEvent.click(rows(utils)[0]));
    expect(spy.activePOIId).toBe("Flipper Kafe");
    expect(spy.exploreOpen).toBe(true);
    expect(utils.getByTestId("story-poi-panel").querySelector("h2")?.textContent).toBe("Flipper Kafe");
    expect(utils.getByTestId("story-poi-panel-close").textContent).toBe("Tilbake til Mat & drikke");
    expect(scroller.scrollTop).toBe(0);
    expect(rows(utils).map((r) => r.getAttribute("data-poi"))).toContain("Bua");
  });

  it("finnes ikke uten policyen — ankerpanelet på andre boards er urørt", () => {
    const utils = setup();
    openInPanel("Bua");
    expect(utils.queryByTestId("story-poi-panel-similar")).toBeNull();
  });

  it("skjules når kategorien ikke har andre steder", () => {
    desktop = true;
    const utils = setup({ placePanel: true });
    act(() => spy.goto(1));
    act(() =>
      spy.dispatch({
        type: "OPEN_POI",
        id: "Ensom kiosk" as BoardPOI["id"],
        categoryId: "solo" as BoardPOI["categoryId"],
        detail: true,
      }),
    );
    expect(utils.getByTestId("story-poi-panel").querySelector("h2")?.textContent).toBe("Ensom kiosk");
    expect(utils.queryByTestId("story-poi-panel-similar")).toBeNull();
  });
});
