import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import type { BoardData, BoardPOI } from "../board-data";
import type { POI } from "@/lib/types";
import { BoardProvider, useBoard } from "../board-state";
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

afterEach(() => cleanup());

// next/image krever Next-runtime i jsdom.
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const { alt, src } = props as { alt: string; src: string };
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} />;
  },
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

function boardData(): BoardData {
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
          anchor(),
        ],
        topRankedPois: [],
      },
    ],
    poisById: new Map(),
    audioTourEnabled: false,
  };
}

const spy = { exploreOpen: false, phase: "default" as string };

function Probe({ onBegin }: { onBegin: (fn: () => void) => void }) {
  const { state } = useBoard();
  const { begin } = useStoryTour();
  spy.exploreOpen = state.exploreOpen;
  spy.phase = state.phase;
  onBegin(() => begin(0));
  return null;
}

function setup() {
  let start = () => {};
  const utils = render(
    <BoardProvider data={boardData()}>
      <StoryTourProvider>
        <Probe onBegin={(fn) => (start = fn)} />
        <StoryCard variant="column" />
        <StoryPoiPanel />
      </StoryTourProvider>
    </BoardProvider>,
  );
  act(() => start());
  // Stedslista, ikke «Om området»: der ligger alle fire radene.
  act(() =>
    fireEvent.click(
      utils.container.querySelector('[data-story-pane="places"]')!,
    ),
  );
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

  it("legger siden bort igjen ved krysset, uten å forlate stoppet", () => {
    const { row, getByTestId } = setup();
    act(() => fireEvent.click(row("Grilstad mall")));
    act(() => fireEvent.click(getByTestId("story-poi-panel-close")));
    expect(getByTestId("story-poi-panel").dataset.open).toBe("false");
    // Stoppet står: omvisningen bak laget er urørt.
    expect(getByTestId("story-card")).not.toBeNull();
  });
});
