import { describe, it, expect, vi } from "vitest";
import {
  render as rtlRender,
  cleanup,
  fireEvent,
  within,
} from "@testing-library/react";
import { afterEach } from "vitest";
import { useEffect } from "react";
import type { MapCameraApi } from "@/lib/board/board-types";
import type { BoardData, BoardPOI } from "../board/board-data";
import { BoardProvider, useBoard } from "../board/board-state";
import { StoryTourProvider, useStoryTour } from "../board/story/story-tour";
import {
  DISCLOSURE_LABEL,
  DISCLOSURE_ROW,
} from "../board/Disclosure";
import { StoryColumn } from "./DesktopStorySidebar";
import type { RealtimeData } from "@/lib/hooks/useRealtimeData";

/**
 * Desktop-kolonnen ER omvisningen (2026-08-27).
 *
 * Den beige indeksen — «Hele nabolaget», temakortene, drill-in-panelet — er
 * slettet, og testene her holder de sømmene som erstattet den: at kolonnen slår
 * omvisningen på selv og ankommer på OMRÅDET, at raden legger stedet først, at
 * desktop har to faner og ikke tre, og at megler-kortet ligger sist i scrollen
 * i stedet for pinnet.
 */

// Sanntids-hooket mockes: transport-rader (poi != null) får levende data,
// ikke-transport-rader (poi == null) får tom tilstand. Speiler den null-trygge
// kontrakten i PlaceRow (gaten er «utvalgt sted» + «raden står åpen»).
const LIVE: RealtimeData = {
  loading: false,
  error: null,
  lastUpdated: new Date("2026-08-27T12:00:00Z"),
  entur: {
    stopName: "Strindfjordvegen",
    departures: [
      {
        departureTime: "2026-08-27T12:05:00Z",
        isRealtime: true,
        destination: "Grilstad",
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
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={typeof src === "string" ? src : ""} alt={alt} />
  ),
}));

afterEach(() => cleanup());

function poi(
  id: string,
  name: string,
  extra: Partial<BoardPOI["raw"]> = {},
): BoardPOI {
  const coordinates = { lat: 63.43, lng: 10.4 };
  return {
    id: id as BoardPOI["id"],
    name,
    coordinates,
    categoryId: "hverdagsliv" as BoardPOI["categoryId"],
    raw: {
      id,
      name,
      coordinates,
      category: { id: "grocery", name: "Dagligvare", icon: "ShoppingCart", color: "#22c55e" },
      travelTime: { walk: 3 },
      ...extra,
    } as BoardPOI["raw"],
  };
}

function boardData(): BoardData {
  return {
    projectSlug: "test",
    home: {
      name: "Strindfjordvegen 10",
      address: "Strindfjordvegen 10",
      coordinates: { lat: 63.43, lng: 10.4 },
      district: "Ranheim",
      city: "Trondheim",
    },
    categories: [
      {
        id: "hverdagsliv" as never,
        label: "Hverdagsliv",
        question: "Hva kan jeg ordne i nærheten?",
        lead: "Første avsnitt, første setning. Første avsnitt, andre setning. Første avsnitt, tredje setning.",
        body: "",
        icon: "ShoppingCart",
        color: "#22c55e",
        editorial: {
          body:
            "Første avsnitt, første setning. Første avsnitt, andre setning. " +
            "Første avsnitt, tredje setning.\n\nAndre avsnitt står også her.",
          faq: [
            {
              id: "q-butikk",
              question: "Hvor handler jeg dagligvarer?",
              answer: "På Extra Grilstad.",
              source: "deterministic",
            },
          ],
          highlights: [
            { id: "extra" as never, name: "Extra Grilstad", icon: "ShoppingCart", color: "#22c55e" },
            {
              id: "holdeplass" as never,
              name: "Strindfjordvegen",
              icon: "Bus",
              color: "#4d93f8",
              enturStopplaceId: "NSR:StopPlace:60260",
            },
          ],
        },
        pois: [
          poi("extra", "Extra Grilstad"),
          poi("holdeplass", "Strindfjordvegen", {
            enturStopplaceId: "NSR:StopPlace:60260",
          }),
          poi("apotek", "Vitusapotek Ranheim"),
        ],
        topRankedPois: [],
      },
      {
        id: "natur" as never,
        label: "Natur & Friluftsliv",
        question: "Kommer jeg ut i naturen?",
        lead: "Strandlinjen er én sammenhengende akse.",
        body: "",
        icon: "TreePine",
        color: "#2f6f4f",
        pois: [poi("fjaera", "Ranheim fjæra")],
        topRankedPois: [],
      },
    ],
    globalFaq: [
      {
        id: "krets",
        question: "Hva kjennetegner området?",
        answer: "Ranheim er et eget tettsted.",
        source: "deterministic",
      },
      {
        id: "linjer",
        question: "Hvordan kommer jeg meg til byen?",
        answer: "Lokaltoget tar deg til Trondheim S.",
        source: "deterministic",
      },
    ],
    areaIntro:
      "Ranheim ligger mellom fjorden og marka.\n\nIdrettsparken er samlingspunktet.",
    brokers: [
      {
        name: "Frank Robert Bae",
        title: "Eiendomsmegler",
        phone: "911 22 333",
        email: "frank@example.no",
        photoUrl: "",
        officeName: "EiendomsMegler 1",
      },
    ],
    poisById: new Map(),
    audioTourEnabled: false,
  } as unknown as BoardData;
}

/** Kamera-API-et kolonnen rammer inn gjennom. Uten en registrert instans er
 *  hver flytur en stille no-op, og testen kan ikke skille «flyr ikke» fra
 *  «finnes ikke» — se «ankomsten»-testen under. */
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

/** Setter fane-tilstanden mobil kan ha satt. Ingen knapp i kolonnen kan gjøre
 *  det — det er nettopp poenget med tvangen som testes. */
function PaneProbe() {
  const { showPane } = useStoryTour();
  return (
    <button
      type="button"
      data-testid="force-faq-pane"
      onClick={() => showPane("faq")}
    />
  );
}

function CameraProbe({ camera }: { camera: MapCameraApi }) {
  const { setMapCamera } = useBoard();
  useEffect(() => {
    setMapCamera(camera);
    return () => setMapCamera(null);
  }, [setMapCamera, camera]);
  return null;
}

function setup(props: { noBrokers?: boolean } = {}) {
  const camera = makeCamera();
  const utils = rtlRender(
    <BoardProvider data={boardData()}>
      <StoryTourProvider>
        <CameraProbe camera={camera as unknown as MapCameraApi} />
        <PaneProbe />
        <StoryColumn {...props} />
      </StoryTourProvider>
    </BoardProvider>,
  );
  return { ...utils, camera };
}

const rail = (utils: ReturnType<typeof setup>) =>
  utils.getByRole("tablist", { name: "Stopp" });

describe("kolonnen ER omvisningen", () => {
  it("slår den på selv, og har ingen utgang — det finnes ikke noe å gå tilbake til", () => {
    const utils = setup();
    expect(utils.getByTestId("story-card")).not.toBeNull();
    expect(utils.queryByTestId("story-exit")).toBeNull();
    // Indeksen som lå bak utgangen er borte.
    expect(utils.queryByText("Hele nabolaget")).toBeNull();
    expect(utils.queryByTestId("story-play")).toBeNull();
  });

  it("legger transporten INNE i det festede hodet, ikke som en rad over det", () => {
    const utils = setup();
    expect(utils.getByTestId("story-card").contains(rail(utils))).toBe(true);
  });
});

describe("områdestoppet", () => {
  it("er der kolonnen ankommer: strøkets navn som overskrift, dekningen i tall", () => {
    const utils = setup();
    expect(
      utils.getByRole("heading", { level: 3 }).textContent,
    ).toBe("Ranheim");
    // 3 + 1 POI-er, 2 temaer.
    expect(utils.getByTestId("story-area-subline").textContent).toBe(
      "4 steder · 2 temaer",
    );
  });

  it("åpner med strøkets intro i avsnitt — samme form som temaenes prosa", () => {
    const utils = setup();
    const body = utils.getByTestId("story-card").textContent ?? "";
    expect(body).toContain("Ranheim ligger mellom fjorden og marka.");
    expect(body).toContain("Idrettsparken er samlingspunktet.");
    // Introen står OVER svarene.
    expect(body.indexOf("Ranheim ligger mellom")).toBeLessThan(
      body.indexOf("Hva kjennetegner området?"),
    );
  });

  it("bærer strøkets egne spørsmål og svar — det indeksen kalte «Om nabolaget»", () => {
    const utils = setup();
    const faq = utils.getByTestId("story-area-faq");
    expect(within(faq).getByText("Hva kjennetegner området?")).not.toBeNull();
    expect(
      within(faq).getByText("Hvordan kommer jeg meg til byen?"),
    ).not.toBeNull();
  });

  it("rører IKKE kameraet — verken ved ankomst eller ved et brikketrykk", () => {
    const utils = setup();
    expect(utils.camera.flyToPoint).not.toHaveBeenCalled();
    expect(utils.camera.fitCoordinates).not.toHaveBeenCalled();
    // Et stoppbytte bytter pinner, ikke utsnitt (2026-08-28).
    fireEvent.click(within(rail(utils)).getByText("Hverdagsliv"));
    fireEvent.click(within(rail(utils)).getByText("Beliggenhet"));
    expect(utils.camera.flyToPoint).not.toHaveBeenCalled();
    expect(utils.camera.fitCoordinates).not.toHaveBeenCalled();
  });

  it("har ingen faner: det er kartet som er stedslista her", () => {
    const utils = setup();
    expect(utils.queryByRole("tablist", { name: "Svarform" })).toBeNull();
  });
});

describe("raden", () => {
  it("legger området FØRST, foran temaene — med et fast ord, ikke stedsnavnet", () => {
    const utils = setup();
    const tabs = within(rail(utils)).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Beliggenhet",
      "Hverdagsliv",
      "Natur & Friluftsliv",
    ]);
    expect(tabs[0].getAttribute("aria-current")).toBe("true");
  });

  it("bytter til et tema, og tilbake til området igjen", () => {
    const utils = setup();
    fireEvent.click(within(rail(utils)).getByText("Hverdagsliv"));
    expect(utils.getByRole("heading", { level: 3 }).textContent).toBe(
      "Hva kan jeg ordne i nærheten?",
    );
    fireEvent.click(within(rail(utils)).getByText("Beliggenhet"));
    expect(utils.getByRole("heading", { level: 3 }).textContent).toBe(
      "Ranheim",
    );
  });
});

describe("temastoppet på desktop", () => {
  const openTheme = () => {
    const utils = setup();
    fireEvent.click(within(rail(utils)).getByText("Hverdagsliv"));
    return utils;
  };

  it("har TO faner — svarene er ikke en tredje", () => {
    const utils = openTheme();
    const tabs = within(
      utils.getByRole("tablist", { name: "Svarform" }),
    ).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "Om området",
      "Steder (3)",
    ]);
  });

  it("viser svarene i «Om området», under utvalget", () => {
    const utils = openTheme();
    const faq = utils.getByTestId("story-faq");
    expect(
      within(faq).getByText("Hvor handler jeg dagligvarer?"),
    ).not.toBeNull();
    // Utvalget står OVER svarene, ikke under.
    const body = utils.getByTestId("story-card").textContent ?? "";
    expect(body.indexOf("Verdt å merke seg")).toBeLessThan(
      body.indexOf("Hvor handler jeg dagligvarer?"),
    );
  });

  it("lar snarveis-kortet til stedslista stå alene, som én linje i full bredde", () => {
    const utils = openTheme();
    const grid = utils.getByText("Steder i nærheten").closest("div.grid")!;
    // Ett kort, og det er stedslistas: kortet til svarene er borte fordi
    // svarene ligger rett under. (Tittel og undertittel ligger i to søsken-
    // spans, så en sammensatt streng ville aldri matchet noe uansett.)
    expect(grid.children).toHaveLength(1);
    expect(within(grid as HTMLElement).queryByText("Spørsmål og svar")).toBeNull();
    expect(grid.className).toContain("grid-cols-1");
    // Én linje, ikke et stablet kort: ikon, navn og tall på samme rad.
    const rad = utils.getByTestId("story-places-row");
    expect(rad.className).toContain("items-center");
    expect(rad.className).not.toContain("flex-col");
  });

  it("legger stedslista RETT UNDER utvalget, foran svarene", () => {
    const utils = openTheme();
    const body = utils.getByTestId("story-card").textContent ?? "";
    expect(body.indexOf("Verdt å merke seg")).toBeLessThan(
      body.indexOf("Steder i nærheten"),
    );
    expect(body.indexOf("Steder i nærheten")).toBeLessThan(
      body.indexOf("Hvor handler jeg dagligvarer?"),
    );
  });

  it("viser HELE den kuraterte prosaen — kolonnen har ingen drill-in å sende leseren til", () => {
    const utils = openTheme();
    const body = utils.getByTestId("story-card").textContent ?? "";
    expect(body).toContain("Første avsnitt, andre setning.");
    expect(body).toContain("Andre avsnitt står også her.");
  });

  it("leser fane-tilstanden «faq» som «om området» — desktop har ingen svar-fane", () => {
    // Tilstanden er delt med mobil, der svarene ER en tredje fane. En bredde-
    // endring midt i omvisningen tar den med seg, og uten tvangen ville
    // kolonnen rendret en fane som ikke finnes: tom flate.
    const utils = setup();
    fireEvent.click(within(rail(utils)).getByText("Hverdagsliv"));
    fireEvent.click(utils.getByTestId("force-faq-pane"));
    expect(utils.getByText("Verdt å merke seg")).not.toBeNull();
    expect(utils.getByText("Steder i nærheten")).not.toBeNull();
  });

  it("viser sanntid på et utvalgt transport-sted, men bare når raden står åpen", () => {
    openTheme();
    const row = document.querySelector(
      '[data-poi="holdeplass"]',
    ) as HTMLElement;
    const li = row.closest("li")!;
    // «5 min» er den mockede avgangstiden; radens egen gangtid er 3 min.
    expect(li.textContent).not.toContain("5 min");
    fireEvent.click(row);
    expect(li.textContent).toContain("20");
    expect(li.textContent).toContain("Grilstad");
    expect(li.textContent).toContain("5 min");
    // Et utvalgt sted UTEN transport-kobling får ingen sanntidsseksjon, åpent
    // eller ikke: gaten er transport + åpen, ikke «er et utvalg».
    const extra = document.querySelector('[data-poi="extra"]') as HTMLElement;
    fireEvent.click(extra);
    expect(extra.closest("li")!.textContent).not.toContain("5 min");
  });
});

describe("megler-kortet", () => {
  it("ligger SIST i scroll-innholdet, ikke pinnet utenfor det", () => {
    const utils = setup();
    const scroller = utils.getByTestId("story-sidebar");
    const card = utils.getByText("Frank Robert Bae").closest("div.-mx-6");
    expect(card).not.toBeNull();
    // Inne i scroll-containeren, og sist i selve stopp-seksjonen.
    expect(scroller.contains(card!)).toBe(true);
    const section = utils.getByTestId("story-card");
    expect(section.lastElementChild).toBe(card);
  });

  it("står også på områdestoppet — kontakten er ikke bundet til et tema", () => {
    const utils = setup();
    expect(utils.getByText("Ansvarlig megler")).not.toBeNull();
    fireEvent.click(within(rail(utils)).getByText("Hverdagsliv"));
    expect(utils.getByText("Ansvarlig megler")).not.toBeNull();
  });

  it("er borte i event-modus (noBrokers) — ingen megler-strenger", () => {
    const utils = setup({ noBrokers: true });
    expect(utils.queryByText("Ansvarlig megler")).toBeNull();
    expect(utils.queryByText("Frank Robert Bae")).toBeNull();
  });
});

describe("utfoldingslistene har ÉN form", () => {
  /**
   * Regresjonen som utløste runden (Andreas, 2026-08-28): svarene lå som løse
   * kort med gap og en kant på 5 % svart, stedene som nakne rader uten kant —
   * samme handling, trykk og utfold på stedet, i to uttrykk. Formen ligger nå i
   * `Disclosure.tsx`, og testene her holder de to flatene på den.
   *
   * Assertene går på de EKSPORTERTE klassene og ikke på piksler: det som skal
   * være umulig er at én av flatene slutter å bruke den delte formen. Hva formen
   * er, får endre seg.
   */
  const openTheme = () => {
    const utils = setup();
    fireEvent.click(within(rail(utils)).getByText("Hverdagsliv"));
    return utils;
  };

  /** Alle klassene i et token, uavhengig av rekkefølge (twMerge sorterer ikke,
   *  men vi skal ikke være avhengig av at den ikke gjør det). */
  const bruker = (el: Element, token: string) =>
    token.split(" ").every((klasse) => el.classList.contains(klasse));

  it("stedsrad og svarrad deler radens geometri", () => {
    const utils = openTheme();
    const sted = utils.getAllByTestId("story-row")[0];
    const svar = utils.getAllByTestId("faq-question")[0];
    expect(bruker(sted, DISCLOSURE_ROW)).toBe(true);
    expect(bruker(svar, DISCLOSURE_ROW)).toBe(true);
  });

  it("stedsnavn og spørsmål deler radens typografi", () => {
    const utils = openTheme();
    const navn = utils
      .getAllByTestId("story-row")[0]
      .querySelector("span.flex-1")!;
    const sporsmal = utils
      .getAllByTestId("faq-question")[0]
      .querySelector("span.flex-1")!;
    expect(bruker(navn, DISCLOSURE_LABEL)).toBe(true);
    expect(bruker(sporsmal, DISCLOSURE_LABEL)).toBe(true);
  });

  it("hver liste er ÉN ramme med hårstreker, ikke n kort med gap", () => {
    const utils = openTheme();
    const svarliste =
      utils.getAllByTestId("faq-question")[0].parentElement!.parentElement!;
    const stedsliste = utils.getAllByTestId("story-row")[0].closest("ul")!;
    for (const liste of [svarliste, stedsliste]) {
      expect(liste.classList.contains("divide-y")).toBe(true);
      expect(liste.classList.contains("border")).toBe(true);
      // Gapet var det som gjorde settet til n ting i stedet for én liste.
      expect([...liste.classList].some((c) => c.startsWith("gap-"))).toBe(false);
    }
  });
});
