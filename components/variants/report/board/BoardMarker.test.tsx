import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { BoardPOI } from "./board-data";

/**
 * 2D-markørens to lån fra Google-motoren (2026-09-07).
 *
 * Begge var MÅLT som mangler på Wesselsløkka-boardet: 20 ankre bar `+`-merket
 * på Google-motoren og 0 på Mapbox, og 8 markører var demotert til prikk på
 * Google mot 0 på Mapbox. Konsekvensen på kartet var at Valentinlyst Senter
 * — et senter med ti virksomheter inni — så ut som en butikkpinne blant
 * butikkpinner, og at nabolaget rundt det ble en fargeklump.
 *
 * Mapbox-`Marker` er den ENESTE mocken: den krever et kart-context vi ikke har
 * i jsdom. Alt annet (farge-derivasjon, ikon-oppslag, tier-logikk) kjøres ekte,
 * for det er nettopp det som skal måles.
 */
vi.mock("react-map-gl/mapbox", () => ({
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="marker">{children}</div>
  ),
}));

const { BoardMarker, MARKER_DOT_SIZE } = await import("./BoardMarker");
const { REACH_OUTSIDE_OPACITY } = await import("@/lib/board/reach");
const { STORY_EMPHASIS_OPACITY } = await import("./story/story-model");

afterEach(() => cleanup());

function poi(overrides: Partial<BoardPOI> = {}): BoardPOI {
  return {
    id: "p1",
    name: "Valentinlyst Senter",
    coordinates: { lat: 63.4244, lng: 10.4418 },
    categoryId: "hverdag",
    raw: {
      category: { id: "shopping", color: "#7c3aed", icon: "Storefront" },
    },
    ...overrides,
  } as BoardPOI;
}

function renderMarker({
  poi: poiOverrides,
  ...props
}: Record<string, unknown> = {}) {
  return render(
    <BoardMarker
      color="#7c3aed"
      icon="Storefront"
      isActive={false}
      isVisible
      zoomTier="icon"
      suppressLabel={false}
      labelSide="right"
      onClick={() => {}}
      {...props}
      poi={poi(poiOverrides as Partial<BoardPOI>)}
    />,
  );
}

describe("BoardMarker — kjøpesenter-merket", () => {
  it("tegner `+` på et anker", () => {
    const { container } = renderMarker({ poi: { isAnchor: true } });
    const badge = container.querySelector('[data-poi-badge="anchor"]');
    expect(badge).toBeTruthy();
    // Merket er KVALITATIVT. Et tall («10») er FINN-mønsteret vi forkastet.
    expect(badge!.textContent).toBe("+");
  });

  it("tegner ingenting på et vanlig sted", () => {
    const { container } = renderMarker();
    expect(container.querySelector('[data-poi-badge="anchor"]')).toBeNull();
  });

  it("bruker kategorifargen på kanten, så merket hører til pinnen sin", () => {
    const { container } = renderMarker({
      poi: { isAnchor: true },
      color: "#0ea5e9",
    });
    const badge = container.querySelector(
      '[data-poi-badge="anchor"]',
    ) as HTMLElement;
    // jsdom normaliserer hex til rgb().
    expect(badge.style.border).toBe("1.5px solid rgb(14, 165, 233)");
    expect(badge.style.color).toBe("rgb(14, 165, 233)");
  });
});

describe("BoardMarker — utglisning", () => {
  /** Prikken og ikon-sirkelen er begge alltid i DOM; det er `opacity` som
   *  avgjør hvilken som SEES. Vi leser derfor stilen, ikke node-antallet. */
  function discOpacities(container: HTMLElement) {
    const layers = [...container.querySelectorAll("div > div")] as HTMLElement[];
    const dot = layers.find(
      (el) => el.style.width === `${MARKER_DOT_SIZE}px`,
    );
    const circle = layers.find((el) => el.style.borderRadius === "50%" && el !== dot);
    return { dot: dot?.style.opacity, circle: circle?.style.opacity };
  }

  it("faller tilbake til prikk når pinnen ikke fikk plass", () => {
    const { container } = renderMarker({ demoted: true });
    expect(discOpacities(container)).toEqual({ dot: "1", circle: "0" });
  });

  it("står som full pin når den har plass", () => {
    const { container } = renderMarker({ demoted: false });
    expect(discOpacities(container)).toEqual({ dot: "0", circle: "1" });
  });

  it("løfter et demotert punkt tilbake til ikon når brukeren åpner det", () => {
    // R10: den aktive markøren må ha en skive labelen kan stå ved siden av.
    // `BoardMap` gir aldri aktiv POI `demoted`, så dette er sikkerhetsnettet.
    const { container } = renderMarker({ demoted: true, isActive: true });
    expect(discOpacities(container)).toEqual({ dot: "0", circle: "1" });
  });
});

describe("BoardMarker — utenfor rekkevidde", () => {
  /** Ytre container bærer markørens samlede styrke (emphasis × rekkevidde). */
  function shellOpacity(container: HTMLElement) {
    return (container.querySelector('[data-testid="marker"] > div') as HTMLElement)
      .style.opacity;
  }
  function discOpacities(container: HTMLElement) {
    const layers = [...container.querySelectorAll("div > div")] as HTMLElement[];
    const dot = layers.find((el) => el.style.width === `${MARKER_DOT_SIZE}px`);
    const circle = layers.find(
      (el) => el.style.borderRadius === "50%" && el !== dot,
    );
    return { dot: dot?.style.opacity, circle: circle?.style.opacity };
  }

  it("faller til prikk — formen er hovedsignalet", () => {
    // Det er dette som gjør ringene til en grense man SER: fulle ikoner
    // innenfor, prikker utenfor.
    const { container } = renderMarker({ outOfReach: true });
    expect(discOpacities(container)).toEqual({ dot: "1", circle: "0" });
  });

  it("dempes reelt, ikke bare litt", () => {
    const { container } = renderMarker({ outOfReach: true });
    expect(Number(shellOpacity(container))).toBeCloseTo(REACH_OUTSIDE_OPACITY, 5);
  });

  it("er urørt når rekkevidde ikke gjelder punktet", () => {
    const { container } = renderMarker({ outOfReach: false });
    expect(shellOpacity(container)).toBe("1");
    expect(discOpacities(container)).toEqual({ dot: "0", circle: "1" });
  });

  it("fritar det ÅPNE punktet — både form og styrke", () => {
    // Åpner du et sted langt unna, skal det ikke være en blass prikk under
    // popupen din. Samme regel som `demoted`.
    const { container } = renderMarker({ outOfReach: true, isActive: true });
    expect(shellOpacity(container)).toBe("1");
    expect(discOpacities(container)).toEqual({ dot: "0", circle: "1" });
  });

  it("reagerer på at rekkevidde slås PÅ etter at markøren er mountet", () => {
    /* Sammenligneren i `React.memo` er en hvitliste. Uten `outOfReach` i den
       slo toggelen på konturene og bildeteksten mens alle markørene sto igjen
       som fulle pins — målt i nettleseren 2026-09-07: 0 dempede av 973. */
    const { container, rerender } = render(
      <BoardMarker
        color="#7c3aed"
        icon="Storefront"
        isActive={false}
        isVisible
        zoomTier="icon"
        suppressLabel={false}
        labelSide="right"
        onClick={() => {}}
        outOfReach={false}
        poi={poi()}
      />,
    );
    expect(shellOpacity(container)).toBe("1");
    rerender(
      <BoardMarker
        color="#7c3aed"
        icon="Storefront"
        isActive={false}
        isVisible
        zoomTier="icon"
        suppressLabel={false}
        labelSide="right"
        onClick={() => {}}
        outOfReach
        poi={poi()}
      />,
    );
    expect(Number(shellOpacity(container))).toBeCloseTo(REACH_OUTSIDE_OPACITY, 5);
    expect(discOpacities(container)).toEqual({ dot: "1", circle: "0" });
  });

  it("legger seg OPPÅ omvisningens vekting i stedet for å erstatte den", () => {
    // Begge kan være på samtidig, og et punkt som både er kontekst og utenfor
    // rekkevidde er svakere enn hvert av dem alene.
    const { container } = renderMarker({ outOfReach: true, emphasis: "texture" });
    expect(Number(shellOpacity(container))).toBeCloseTo(
      REACH_OUTSIDE_OPACITY * STORY_EMPHASIS_OPACITY.texture,
      5,
    );
  });
});
