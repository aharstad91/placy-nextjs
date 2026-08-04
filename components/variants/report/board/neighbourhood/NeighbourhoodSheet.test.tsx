import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { useState } from "react";
import { render, cleanup, act, fireEvent, createEvent } from "@testing-library/react";
import { NeighbourhoodSheet } from "./NeighbourhoodSheet";

/**
 * Unit 3a — sheet-skallet.
 *
 * Gest-følelsen (glir draget jevnt? kolliderer det med kart-pan?) kan IKKE
 * måles i jsdom; den ligger under Verification og avgjøres på iPhone. Det
 * disse testene låser er kontraktene rundt gesten: at høyden MÅLES og
 * rapporteres oppover, at kun HVILEPOSISJONEN rapporteres (aldri mellomverdier
 * fra draget — R12), og at scroll-containeren aldri får `touch-none` (iOS
 * Safari kansellerer da touchen og dreper både scroll og drag).
 */

const CONTAINER_H = 800;

beforeAll(() => {
  // jsdom gir alltid clientHeight 0. Sheeten måler sin egen ramme for å regne
  // ut hvileposisjonene, så uten dette blir alle høyder 0.
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return CONTAINER_H;
    },
  });
  // jsdom implementerer ikke pointer capture.
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = () => {};
    HTMLElement.prototype.releasePointerCapture = () => {};
  }
});

afterEach(() => cleanup());

const EXPECTED_MAX = Math.round(CONTAINER_H * 0.86); // 688
const EXPECTED_MIN = Math.round(CONTAINER_H * 0.34); // 272

function setup(onHeightChange = vi.fn()) {
  const utils = render(
    <NeighbourhoodSheet onHeightChange={onHeightChange}>
      <div data-testid="content">innhold</div>
    </NeighbourhoodSheet>,
  );
  const sheet = utils.getByTestId("neighbourhood-sheet") as HTMLElement;
  const grab = utils.getByTestId("neighbourhood-grab") as HTMLElement;
  return { ...utils, sheet, grab, onHeightChange };
}

/** Sheetens layout-høyde ER dens synlige høyde (se komponent-doccen om hvorfor
 *  vi animerer height og ikke transform). Den skrives imperativt. */
const visibleHeightOf = (el: HTMLElement) => Number.parseFloat(el.style.height);

/**
 * Sender én peker-hendelse med EKSPLISITT `timeStamp`.
 *
 * jsdom stempler hendelser med millisekund-oppløsning, så tre `fireEvent`
 * etter hverandre lander typisk i samme millisekund. Da er `dt` null, farten
 * beholder sin forrige verdi, og resultatet av et slipp avhenger av om
 * maskinen tilfeldigvis krysset et millisekundskille midt i gesten. Med
 * styrte stempler er både «rolig slipp» og «kast» eksakt reproduserbare.
 */
function send(
  grab: HTMLElement,
  type: "pointerDown" | "pointerMove" | "pointerUp",
  clientY: number,
  t: number,
) {
  const event = createEvent[type](grab, { pointerId: 1, isPrimary: true, clientY });
  Object.defineProperty(event, "timeStamp", { value: t });
  act(() => {
    fireEvent(grab, event);
  });
}

/** Et drag som slippes UTEN fart: siste `pointermove` og `pointerup` deler Y,
 *  så farten er nøyaktig 0 og sheeten hviler der fingeren slapp. */
function drag(grab: HTMLElement, fromY: number, toY: number) {
  send(grab, "pointerDown", fromY, 0);
  send(grab, "pointerMove", toY, 16);
  send(grab, "pointerUp", toY, 32);
}

/** Et kast: pekeren er fortsatt i bevegelse når den slippes, så farten blir
 *  positiv oppover. */
function flick(grab: HTMLElement, fromY: number, viaY: number, toY: number) {
  send(grab, "pointerDown", fromY, 0);
  send(grab, "pointerMove", viaY, 16);
  send(grab, "pointerUp", toY, 32);
}

describe("NeighbourhoodSheet — måling og rapportering (R5)", () => {
  it("måler tilgjengelig høyde selv i stedet for å anta en viewport", () => {
    // `EventMobileSheet` hardkoder 700 px og bommer på alt annet. Her er
    // høyden avledet av den faktiske containeren.
    const { sheet, grab } = setup();
    drag(grab, 600, 100); // helt opp
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MAX);
  });

  it("starter i laveste posisjon og rapporterer den høyden oppover", () => {
    const { sheet, onHeightChange } = setup();
    expect(sheet.dataset.rest).toBe("low");
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN);
    expect(onHeightChange).toHaveBeenCalledWith(EXPECTED_MIN);
  });

  it("holder kartet synlig — sheeten dekker aldri hele flaten (R3)", () => {
    const { sheet, grab } = setup();
    drag(grab, 600, 100);
    expect(visibleHeightOf(sheet)).toBeLessThan(CONTAINER_H);
  });

  it("scroll-regionen er sheetens FAKTISKE høyde, ikke maks-høyden", () => {
    // Med fast maks-høyde + translateY ville lista i laveste posisjon hatt en
    // scrollport under skjermkanten — innholdet der ville vært helt unåbart.
    const { sheet } = setup();
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN);
  });
});

describe("NeighbourhoodSheet — fri posisjonering", () => {
  it("følger fingeren under draget UTEN å rapportere mellomverdier (R12)", () => {
    const { sheet, grab, onHeightChange } = setup();
    onHeightChange.mockClear();

    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: 500 });
    });
    act(() => {
      fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: 420 });
    });

    // Høyden har fulgt fingeren …
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN + 80);
    // … men ingenting er rapportert oppover: kartet skal ikke re-scope og ikke
    // publisere utsnitt 60 ganger i sekundet.
    expect(onHeightChange).not.toHaveBeenCalled();
  });

  it("hviler DER fingeren slapp — ikke i nærmeste ytterpunkt", () => {
    // Kjernen i Citymapper-oppførselen, og hele grunnen til at
    // to-hvileposisjons-modellen ble kastet: brukeren bestemmer fordelingen
    // mellom kart og liste, ikke vi.
    const { sheet, grab } = setup();
    drag(grab, 600, 472); // 128 px opp → 400, langt fra begge ytterpunkter
    expect(visibleHeightOf(sheet)).toBe(400);
    expect(sheet.dataset.rest).toBe("free");
  });

  it("går helt inn når slippet lander nær et ytterpunkt", () => {
    // Uten magnetisme blir «vis meg mest mulig kart» en presisjonsøvelse.
    const { sheet, grab } = setup();
    drag(grab, 600, 200); // 400 px opp → 672, 16 px unna taket
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MAX);
    expect(sheet.dataset.rest).toBe("high");
  });

  it("går helt ned når slippet lander nær bunnen", () => {
    const { sheet, grab } = setup();
    drag(grab, 600, 200); // opp til taket først
    drag(grab, 200, 590); // 390 px ned → 298, 26 px over gulvet
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN);
    expect(sheet.dataset.rest).toBe("low");
  });

  it("kastet bærer sheeten forbi punktet der fingeren slapp", () => {
    const { sheet, grab } = setup();
    // Slippes mens pekeren fortsatt går oppover: rå slipp-posisjon er
    // 272 + (600 − 400) = 472, men farten skal kaste den videre.
    flick(grab, 600, 500, 400);
    expect(visibleHeightOf(sheet)).toBeGreaterThan(472);
  });

  it("klamrer draget mellom ytterpunktene — kartet skjules aldri helt", () => {
    const { sheet, grab } = setup();
    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: 500 });
    });
    act(() => {
      // Langt over toppen av skjermen.
      fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: -900 });
    });
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MAX);
    act(() => {
      // Langt under bunnen.
      fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: 2000 });
    });
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN);
  });

  it("tapp på håndtaket hopper til motsatt ytterpunkt", () => {
    const { sheet, grab } = setup();
    drag(grab, 400, 402); // under tapp-slop → tapp, ikke drag
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MAX);

    drag(grab, 400, 402); // og tilbake igjen
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN);
  });

  it("ignorerer bevegelse fra en annen peker enn den som startet draget", () => {
    const { sheet, grab } = setup();
    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: 500 });
    });
    act(() => {
      fireEvent.pointerMove(grab, { pointerId: 2, isPrimary: false, clientY: 100 });
    });
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN);
  });
});

describe("NeighbourhoodSheet — okklusjonen som rapporteres", () => {
  it("rapporterer hvileminimumet, aldri høyden sheeten står i", () => {
    const { sheet, grab, onHeightChange } = setup();
    drag(grab, 600, 472); // fri posisjon på 400
    expect(visibleHeightOf(sheet)).toBe(400);
    // Kartet skal ha sett ÉN verdi gjennom hele livsløpet: hvileminimumet.
    expect(new Set(onHeightChange.mock.calls.map(([h]) => h))).toEqual(
      new Set([EXPECTED_MIN]),
    );
  });

  it("rapporterer det samme selv når sheeten dras helt opp", () => {
    const { sheet, grab, onHeightChange } = setup();
    drag(grab, 600, 100);
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MAX);
    expect(onHeightChange).toHaveBeenLastCalledWith(EXPECTED_MIN);
  });
});

describe("NeighbourhoodSheet — løkken mellom liste og sheet-høyde", () => {
  /** Innholdshøyden, styrt av testen. Header og wrapper deler den likt, så
   *  `header.offsetHeight + content.offsetHeight` blir nøyaktig `contentH`. */
  let contentH = 0;

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return contentH / 2;
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 0;
      },
    });
  });

  it("svinger ikke når lista krymper av sin egen okklusjon", () => {
    // Reproduserer buggen fra opptaket 2026-08-04 i miniatyr: forelderen
    // korter ned lista når rapportert okklusjon vokser — nøyaktig det kartets
    // utsnitt gjorde da færre POI-er ble liggende utenfor sheeten. Rapporterte
    // sheeten sin egen høyde, hadde de to retningene motsatt fortegn og
    // systemet svingte i det uendelige (React: «Maximum update depth»).
    contentH = 600;
    const reported: number[] = [];

    function Harness() {
      const [, setOccluded] = useState(0);
      return (
        <NeighbourhoodSheet
          onHeightChange={(h) => {
            reported.push(h);
            contentH = h > EXPECTED_MIN ? 200 : 600;
            setOccluded(h);
          }}
        >
          <div data-testid="content">innhold</div>
        </NeighbourhoodSheet>
      );
    }

    const utils = render(<Harness />);
    const grab = utils.getByTestId("neighbourhood-grab");
    const sheet = utils.getByTestId("neighbourhood-sheet");
    drag(grab, 600, 200); // så langt opp gesten rekker

    expect(new Set(reported)).toEqual(new Set([EXPECTED_MIN]));
    // Taket er innholdet (600), ikke flate-andelen (688) — og det står stille.
    expect(visibleHeightOf(sheet)).toBe(600);
  });
});

describe("NeighbourhoodSheet — taket følger innholdet", () => {
  const CONTENT_H = 150;

  beforeAll(() => {
    // jsdom gir alltid offsetHeight 0, som gjør innholdstaket inaktivt i de
    // andre testene (og det er meningen — de tester grensene, ikke taket).
    // Her slås det på: header + innhold måler 150 hver → tak på 300.
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return CONTENT_H;
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return 0;
      },
    });
  });

  it("lar seg ikke dra ut i tomrom under siste rad", () => {
    // Uten taket kunne en liste med to kort dras til 688 px og etterlate et
    // dødt felt under innholdet — det leste som en layout-bug.
    const { sheet, grab } = setup();
    drag(grab, 600, 0); // så langt opp gesten rekker
    expect(visibleHeightOf(sheet)).toBe(CONTENT_H * 2);
  });

  it("senker taket, aldri gulvet (R3 står)", () => {
    // Kort innhold skal krympe det man kan dra OPP til — ikke minstehøyden.
    // Ellers ville et smalt utsnitt gitt en sheet som er for lav til å lese.
    const { sheet, grab } = setup();
    drag(grab, 200, 900); // så langt ned gesten rekker
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_MIN);
  });
});

describe("NeighbourhoodSheet — iOS-fellene", () => {
  it("setter ALDRI touch-none på scroll-containeren (Safari dreper touchen)", () => {
    const { getByTestId } = setup();
    const scroll = getByTestId("neighbourhood-scroll");
    expect(scroll.className).not.toContain("touch-none");
    expect(scroll.className).toContain("overscroll-contain");
  });

  it("setter touch-none på GRIPEFLATEN — der er den påkrevd for at draget skal leve", () => {
    const { grab } = setup();
    expect(grab.className).toContain("touch-none");
  });

  it("animerer kun høyden (aldri top/bottom/transform) ved snap", () => {
    const { sheet, grab } = setup();
    drag(grab, 600, 250);
    expect(sheet.style.transition).toMatch(/^height /);
    expect(sheet.style.transition).not.toMatch(/transform|top|bottom/);
  });

  it("animerer ikke den FØRSTE posisjoneringen (skal ikke gli ned ved ankomst)", () => {
    const { sheet } = setup();
    expect(sheet.style.transition).toBe("none");
  });

  it("lar kart-gester passere utenfor sheeten (rammen er pointer-events-none)", () => {
    const { getByTestId, sheet } = setup();
    expect(getByTestId("neighbourhood-frame").className).toContain(
      "pointer-events-none",
    );
    expect(sheet.className).toContain("pointer-events-auto");
  });

  it("rendrer barna i scroll-regionen", () => {
    const { getByTestId } = setup();
    expect(getByTestId("neighbourhood-scroll")).toContainElement(
      getByTestId("content"),
    );
  });
});
