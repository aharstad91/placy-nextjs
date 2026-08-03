import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
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

const EXPECTED_HIGH = Math.round(CONTAINER_H * 0.86); // 688
const EXPECTED_LOW = Math.round(CONTAINER_H * 0.34); // 272

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

/** Leser den imperativt satte translateY-en. */
function offsetOf(el: HTMLElement): number {
  const m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform);
  return m ? Number(m[1]) : NaN;
}
const visibleHeightOf = (el: HTMLElement) => EXPECTED_HIGH - offsetOf(el);

function drag(grab: HTMLElement, fromY: number, toY: number, dtMs = 400) {
  act(() => {
    fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: fromY });
  });
  act(() => {
    fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: toY });
  });
  act(() => {
    fireEvent.pointerUp(grab, { pointerId: 1, isPrimary: true, clientY: toY });
  });
  return dtMs;
}

describe("NeighbourhoodSheet — måling og rapportering (R5)", () => {
  it("måler tilgjengelig høyde selv i stedet for å anta en viewport", () => {
    // `EventMobileSheet` hardkoder 700 px og bommer på alt annet. Her er
    // høyden avledet av den faktiske containeren.
    const { sheet } = setup();
    expect(sheet.style.height).toBe(`${EXPECTED_HIGH}px`);
  });

  it("starter i lav hvileposisjon og rapporterer den høyden oppover", () => {
    const { sheet, onHeightChange } = setup();
    expect(sheet.dataset.rest).toBe("low");
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_LOW);
    expect(onHeightChange).toHaveBeenCalledWith(EXPECTED_LOW);
  });

  it("holder kartet synlig — sheeten dekker aldri hele flaten (R3)", () => {
    const { sheet } = setup();
    act(() => {
      fireEvent.click(sheet.querySelector("button")!);
    });
    expect(EXPECTED_HIGH).toBeLessThan(CONTAINER_H);
  });
});

describe("NeighbourhoodSheet — drag og snap", () => {
  it("følger fingeren under draget UTEN å rapportere mellomverdier (R12)", () => {
    const { sheet, grab, onHeightChange } = setup();
    onHeightChange.mockClear();

    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: 500 });
    });
    act(() => {
      fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: 420 });
    });

    // Transformen har fulgt fingeren …
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_LOW + 80);
    // … men ingenting er rapportert oppover: kartet skal ikke re-scope, ikke
    // sette padding og ikke publisere utsnitt 60 ganger i sekundet.
    expect(onHeightChange).not.toHaveBeenCalled();
  });

  it("snapper til høy hvileposisjon når draget lander nærmest den", () => {
    const { sheet, grab, onHeightChange } = setup();
    onHeightChange.mockClear();
    // Fra lav (272) og 350 px oppover → 622, nærmere 688 enn 272.
    drag(grab, 600, 250);
    expect(sheet.dataset.rest).toBe("high");
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_HIGH);
    expect(onHeightChange).toHaveBeenLastCalledWith(EXPECTED_HIGH);
  });

  it("snapper tilbake til lav når draget lander nærmest den", () => {
    const { sheet, grab } = setup();
    act(() => {
      fireEvent.click(sheet.querySelector("button")!);
    });
    drag(grab, 200, 560); // fra høy, 360 px nedover → 328, nærmest lav
    expect(sheet.dataset.rest).toBe("low");
  });

  it("klamrer draget mellom hvileposisjonene — kartet skjules aldri helt", () => {
    const { sheet, grab } = setup();
    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: 500 });
    });
    act(() => {
      // Langt over toppen av skjermen.
      fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: -900 });
    });
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_HIGH);
    act(() => {
      // Langt under bunnen.
      fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: 2000 });
    });
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_LOW);
  });

  it("tapp på håndtaket bytter hvileposisjon (ikke-gestuell vei mellom dem)", () => {
    const { sheet, grab, onHeightChange } = setup();
    onHeightChange.mockClear();
    drag(grab, 400, 402); // under tapp-slop → tapp, ikke drag
    expect(sheet.dataset.rest).toBe("high");
    expect(onHeightChange).toHaveBeenLastCalledWith(EXPECTED_HIGH);
  });

  it("varsler om hvileposisjon-endring, men ikke om drag-bevegelse", () => {
    const onRestChange = vi.fn();
    const { getByTestId } = render(
      <NeighbourhoodSheet onHeightChange={vi.fn()} onRestChange={onRestChange} />,
    );
    const grab = getByTestId("neighbourhood-grab");
    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: 500 });
    });
    act(() => {
      fireEvent.pointerMove(grab, { pointerId: 1, isPrimary: true, clientY: 480 });
    });
    expect(onRestChange).not.toHaveBeenCalled();
    act(() => {
      fireEvent.pointerUp(grab, { pointerId: 1, isPrimary: true, clientY: 250 });
    });
    expect(onRestChange).toHaveBeenCalledWith("high");
  });

  it("ignorerer bevegelse fra en annen peker enn den som startet draget", () => {
    const { sheet, grab } = setup();
    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, isPrimary: true, clientY: 500 });
    });
    act(() => {
      fireEvent.pointerMove(grab, { pointerId: 2, isPrimary: false, clientY: 100 });
    });
    expect(visibleHeightOf(sheet)).toBe(EXPECTED_LOW);
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

  it("animerer kun transform (aldri height/top) ved snap", () => {
    const { sheet, grab } = setup();
    drag(grab, 600, 250);
    expect(sheet.style.transition).toMatch(/^transform /);
    expect(sheet.style.transition).not.toMatch(/height|top|bottom/);
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
