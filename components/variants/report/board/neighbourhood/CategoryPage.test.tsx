import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import type { BoardCategory, BoardData, BoardPOI } from "../board-data";
import { BoardProvider, useBoard, type BoardState } from "../board-state";
import type { FaqEntry } from "@/lib/generators/faq-generator";
import { CategoryPage } from "./CategoryPage";

/**
 * Mobil-drill-in: samme FAQ-innhold som desktop, men med panelet som viker for
 * kartet når et stedsnavn i et svar trykkes. Det er den ene affordansen som
 * DIVERGERER mellom flatene — innholdet er delt (samme komponent, samme data).
 */

const CONTAINER_H = 800;

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return CONTAINER_H;
    },
  });
});

afterEach(() => cleanup());

const STOP_POI: BoardPOI = {
  id: "entur-NSR-StopPlace-60260" as BoardPOI["id"],
  name: "Strindfjordvegen bussholdeplass",
  coordinates: { lat: 63.4351, lng: 10.5053 },
  categoryId: "transport" as BoardPOI["categoryId"],
  raw: {
    id: "entur-NSR-StopPlace-60260",
    name: "Strindfjordvegen bussholdeplass",
    coordinates: { lat: 63.4351, lng: 10.5053 },
    category: { id: "bus", name: "Buss", icon: "Bus", color: "#4d93f8" },
    travelTime: { walk: 1 },
  } as BoardPOI["raw"],
};

const FAQ: FaqEntry[] = [
  {
    id: "naermeste-holdeplass",
    question: "Hvor er nærmeste holdeplass?",
    answer: "[Strindfjordvegen](poi:entur-NSR-StopPlace-60260) ligger 30 meter fra boligen.",
    source: "deterministic",
  },
];

function category(over: Partial<BoardCategory> = {}): BoardCategory {
  return {
    id: "transport" as BoardCategory["id"],
    label: "Transport & Mobilitet",
    lead: "Kollektiv i nærheten",
    body: "",
    editorial: {
      body: "Kollektivdekningen er god.",
      highlights: [],
      faq: FAQ,
    },
    icon: "Bus",
    color: "#4d93f8",
    pois: [STOP_POI],
    topRankedPois: [],
    ...over,
  } as BoardCategory;
}

function boardData(cat: BoardCategory): BoardData {
  return {
    projectSlug: "strindfjordvegen-10",
    home: {
      name: "Strindfjordvegen 10",
      coordinates: { lat: 63.4351, lng: 10.5053 },
      address: "Strindfjordvegen 10",
    },
    categories: [cat],
    // Nøklene er lowercased, verdien bærer POI-ens egen skrivemåte — nøyaktig
    // som adaptBoardData bygger mappen.
    poisById: new Map([["entur-nsr-stopplace-60260", STOP_POI.raw]]),
    audioTourEnabled: false,
  } as unknown as BoardData;
}

const spy = { state: null as BoardState | null };

function Probe() {
  const { state, setMapCamera } = useBoard();
  spy.state = state;
  useEffect(() => {
    setMapCamera({ snapshot: () => null, restore: () => {}, fitVisible: () => {} } as never);
    return () => setMapCamera(null);
  }, [setMapCamera]);
  return null;
}

function setup(cat: BoardCategory = category()) {
  const onBack = vi.fn();
  const onHeightChange = vi.fn();
  const utils = render(
    <BoardProvider data={boardData(cat)}>
      <Probe />
      <CategoryPage category={cat} onBack={onBack} onHeightChange={onHeightChange} />
    </BoardProvider>,
  );
  return { ...utils, onBack, onHeightChange };
}

/* ---------- Reisemåte-kontrollen i sidens overskriftsrad ---------- */

/** Samme holdeplass, men med tider for alle tre modus. `STOP_POI` har bare
 *  gangtid, og da er det ikke noe valg å ta. */
const MULTI_STOP: BoardPOI = {
  ...STOP_POI,
  raw: { ...STOP_POI.raw, travelTime: { walk: 12, bike: 5, car: 3 } } as BoardPOI["raw"],
};

const multiCategory = () => category({ pois: [MULTI_STOP] });

describe("CategoryPage — reisemåte som enhet over minutt-kolonnen", () => {
  it("rendrer kontrollen i overskriftsraden i normal tilstand", () => {
    setup(multiCategory());
    expect(screen.getByTestId("travel-mode-header-control")).toBeTruthy();
  });

  it("tallene følger aktiv modus, ikke gangtid", () => {
    // Regresjonen dette låser: siden leste aldri state.travelMode, så
    // buildNeighbourhoodList falt tilbake på «walk» og et modusbytte gjorde
    // ingenting synlig her.
    setup(multiCategory());
    expect(screen.getByTestId("category-poi-list").textContent).toContain("12 min");

    fireEvent.click(screen.getByTestId("travel-mode-header-control"));
    fireEvent.click(screen.getByRole("button", { name: /Bil/ }));

    const lista = screen.getByTestId("category-poi-list").textContent ?? "";
    expect(lista).toContain("3 min");
    expect(lista).not.toContain("12 min");
  });

  it("undertittelen under kategorinavnet følger samme modus", () => {
    const { container } = setup(multiCategory());
    fireEvent.click(screen.getByTestId("travel-mode-header-control"));
    fireEvent.click(screen.getByRole("button", { name: /Sykkel/ }));

    const subline = container.querySelector("h2")?.nextElementSibling?.textContent ?? "";
    expect(subline).toContain("5 min");
  });

  it("ingen kontroll i kikk-tilstand, og gjenåpning er fortsatt ett trykk", () => {
    setup(multiCategory());
    // Kikk-tilstanden nås via et stedsnavn i et FAQ-svar.
    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByRole("button", { name: /Strindfjordvegen/ }));

    expect(screen.queryByTestId("travel-mode-header-control")).toBeNull();
    const restore = screen.getByTestId("panel-peek-restore");
    fireEvent.click(restore);
    expect(screen.getByTestId("travel-mode-header-control")).toBeTruthy();
  });

  it("overskriftsraden har ingen nøstede knapper i noen av de to grenene", () => {
    const { container } = setup(multiCategory());
    expect(container.querySelector("button button")).toBeNull();

    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByRole("button", { name: /Strindfjordvegen/ }));
    expect(container.querySelector("button button")).toBeNull();
  });

  it("kategori uten data for valgt modus viser ingen tall — aldri «undefined min»", () => {
    setup(multiCategory());
    fireEvent.click(screen.getByTestId("travel-mode-header-control"));
    fireEvent.click(screen.getByRole("button", { name: /Bil/ }));
    expect(screen.getByTestId("category-poi-list").textContent).not.toContain("undefined");
  });
});



describe("CategoryPage — FAQ", () => {
  it("rendrer samme FAQ-innhold som desktop for samme kategori", () => {
    setup();
    expect(screen.getByTestId("faq-section")).toBeTruthy();
    expect(screen.getByTestId("faq-question").textContent).toContain(
      "Hvor er nærmeste holdeplass?",
    );
  });

  it("plasserer FAQ-en mellom prosaen og stedslista — samme rekkefølge som desktop", () => {
    const { container } = setup();
    const order = Array.from(
      container.querySelectorAll<HTMLElement>(
        "[data-testid='category-prose'],[data-testid='faq-section'],[data-testid='category-poi-list']",
      ),
    ).map((el) => el.dataset.testid);
    expect(order).toEqual(["category-prose", "faq-section", "category-poi-list"]);
  });

  it("viser ingen seksjon når kategorien mangler svar — paritet med desktop", () => {
    setup(category({ editorial: { body: "Tekst.", highlights: [] } }));
    expect(screen.queryByTestId("faq-section")).toBeNull();
  });
});

describe("CategoryPage — panelet viker for kartet", () => {
  it("starter utfoldet", () => {
    setup();
    expect(screen.getByTestId("category-panel").dataset.peeked).toBe("false");
    expect(screen.queryByTestId("panel-peek-restore")).toBeNull();
  });

  it("POI-klikk i et svar åpner POI-en OG kollapser panelet til peek", () => {
    setup();
    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-poi-link"));

    expect(spy.state?.activePOIId).toBe("entur-NSR-StopPlace-60260");
    expect(spy.state?.phase).toBe("poi");
    expect(screen.getByTestId("category-panel").dataset.peeked).toBe("true");
  });

  it("merker POI-åpningen som tekst-utløst så utforsk-modalen ikke tar over", () => {
    // Uten flagget ville mobilens modal (som gater på phase === "poi") dekket
    // kartflyten i samme øyeblikk den startet.
    setup();
    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-poi-link"));
    expect(spy.state?.exploreSuppressed).toBe(true);
  });

  it("beholder kategori-konteksten når panelet viker", () => {
    setup();
    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-poi-link"));
    expect(spy.state?.activeCategoryId).toBe("transport");
  });

  it("gjenåpner panelet med ETT trykk på peek-stripa", () => {
    setup();
    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-poi-link"));
    fireEvent.click(screen.getByTestId("panel-peek-restore"));
    expect(screen.getByTestId("category-panel").dataset.peeked).toBe("false");
  });

  it("gjenoppretter scroll-posisjonen når panelet kommer opp igjen", () => {
    // Panelet krymper til en femtedel, og nettleseren klipper scrollTop mot
    // den nye høyden. Uten å legge den tilbake ville brukeren kommet opp et
    // helt annet sted i lista enn der hun trykket.
    const { container } = setup();
    const scroller = container.querySelector<HTMLElement>(".overflow-y-auto")!;
    scroller.scrollTop = 240;

    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-poi-link"));
    scroller.scrollTop = 0; // nettleseren klipper ved krympingen

    fireEvent.click(screen.getByTestId("panel-peek-restore"));
    expect(scroller.scrollTop).toBe(240);
  });

  it("melder fra om den nye høyden så kartets padding følger med", () => {
    const { onHeightChange } = setup();
    expect(onHeightChange).toHaveBeenLastCalledWith(Math.round(CONTAINER_H * 0.58));

    fireEvent.click(screen.getByTestId("faq-question"));
    fireEvent.click(screen.getByTestId("faq-poi-link"));
    expect(onHeightChange).toHaveBeenLastCalledWith(Math.round(CONTAINER_H * 0.2));
  });
});
