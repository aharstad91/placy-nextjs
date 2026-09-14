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

describe("BoardMarker — omtalte steder", () => {
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
  const badge = (c: HTMLElement) =>
    c.querySelector('[data-poi-badge="highlight"]') as HTMLElement | null;
  const labelText = (c: HTMLElement) =>
    c.querySelector('[data-testid="marker"] span[aria-hidden="true"]:last-of-type');

  it("tegner rekkefølgetallet", () => {
    const { container } = renderMarker({ highlightIndex: 2 });
    expect(badge(container)!.textContent).toBe("2");
  });

  it("tegner ingen merke uten propen", () => {
    expect(badge(renderMarker().container)).toBeNull();
  });

  it("merket står til VENSTRE — kjøpesenter-merket eier høyre hjørne", () => {
    const { container } = renderMarker({
      highlightIndex: 1,
      poi: { isAnchor: true },
    });
    expect(badge(container)!.style.left).toBe("-6px");
    // Begge påstandene står samtidig: «vi snakker om denne» OG «det er mer inni».
    expect(container.querySelector('[data-poi-badge="anchor"]')).toBeTruthy();
  });

  it("tegner ringen med hvit luft inn mot skiva", () => {
    const { container } = renderMarker({ highlightIndex: 1 });
    const ring = container.querySelector(
      "[data-poi-highlight-ring]",
    ) as HTMLElement | null;
    expect(ring).toBeTruthy();
    expect(ring!.style.borderWidth).toBe("2.5px");
    expect(ring!.style.boxShadow).toContain("inset");
    // Ringen ligger UTENPÅ skiva, ikke oppå den: 38 px skive + 2 px hvit luft
    // på hver side gir en padding-boks på 42, og kanten legger seg utenpå den.
    expect(ring!.style.width).toBe("42px");
  });

  it("faller ALDRI til prikk — verken fra utglisning eller rekkevidde", () => {
    for (const props of [{ demoted: true }, { outOfReach: true }]) {
      const { container } = renderMarker({ ...props, highlightIndex: 1 });
      expect(discOpacities(container)).toEqual({ dot: "0", circle: "1" });
      cleanup();
    }
  });

  it("dempes ikke av rekkevidde — et sted noen nettopp nevnte er ikke avskrudd", () => {
    const { container } = renderMarker({ outOfReach: true, highlightIndex: 1 });
    expect(shellOpacity(container)).toBe("1");
  });

  it("dempes ikke som omvisningens kontekst", () => {
    const { container } = renderMarker({
      emphasis: "texture",
      highlightIndex: 1,
    });
    expect(shellOpacity(container)).toBe("1");
  });

  it("viser navnet også på ikon-tier, der ingen andre markører har det", () => {
    const uten = renderMarker({ zoomTier: "icon" });
    expect((labelText(uten.container) as HTMLElement).style.opacity).toBe("0");
    cleanup();
    const med = renderMarker({ zoomTier: "icon", highlightIndex: 1 });
    expect((labelText(med.container) as HTMLElement).style.opacity).toBe("1");
    expect(labelText(med.container)!.textContent).toBe("Valentinlyst Senter");
  });

  it("respekterer fortsatt suppressLabel (mini-popupen viser navnet)", () => {
    const { container } = renderMarker({
      highlightIndex: 1,
      suppressLabel: true,
    });
    expect((labelText(container) as HTMLElement).style.opacity).toBe("0");
  });

  it("legger seg over nabolaget, men under det åpne punktet", () => {
    const marker = (c: HTMLElement) =>
      (c.querySelector('[data-testid="marker"]') as HTMLElement) ?? null;
    // Mapbox-mocken rendrer ikke `style` på verten, så vi leser propen via
    // markørens egen container-størrelse i stedet: 38 px = omtalt vekt, 32 px =
    // vanlig, 44 px = åpent punkt.
    const vanlig = renderMarker();
    expect(
      (marker(vanlig.container)!.firstElementChild as HTMLElement).style.width,
    ).toBe("32px");
    cleanup();
    const omtalt = renderMarker({ highlightIndex: 1 });
    expect(
      (marker(omtalt.container)!.firstElementChild as HTMLElement).style.width,
    ).toBe("38px");
    cleanup();
    const åpen = renderMarker({ highlightIndex: 1, isActive: true });
    expect(
      (marker(åpen.container)!.firstElementChild as HTMLElement).style.width,
    ).toBe("44px");
  });

  it("reagerer på at en NY gruppe kommer inn etter mount", () => {
    /* Samme hvitliste-felle som `outOfReach`: `React.memo`-sammenligneren må
       nevne propen, ellers skriver assistentens neste svar en ny liste i state
       uten at én eneste markør endrer seg på skjermen. */
    const props = {
      color: "#7c3aed",
      icon: "Storefront",
      isActive: false,
      isVisible: true,
      zoomTier: "icon" as const,
      suppressLabel: false,
      labelSide: "right" as const,
      onClick: () => {},
      poi: poi(),
    };
    const { container, rerender } = render(<BoardMarker {...props} />);
    expect(badge(container)).toBeNull();
    rerender(<BoardMarker {...props} highlightIndex={3} />);
    expect(badge(container)!.textContent).toBe("3");
    rerender(<BoardMarker {...props} highlightIndex={1} />);
    expect(badge(container)!.textContent).toBe("1");
  });
});


it("exposes current speech focus and its label without opening the place", () => {
  const { container } = renderMarker({ narrationFocus: "current" });
  expect(container.querySelector('[data-narration-focus="current"]')).not.toBeNull();
  expect(container.querySelector('[data-poi-label]')?.textContent).toContain("Valentinlyst Senter");
});

/**
 * Valgt sted under panel-policyen (2026-09-15). Popupen er borte fra kartet,
 * så markøren må bære valget selv: ring i kategorifargen, tyngre navn.
 */
describe("BoardMarker — valgt sted (detaljpanelet)", () => {
  const ring = (c: HTMLElement) =>
    c.querySelector("[data-poi-selected-ring]") as HTMLElement | null;
  const labelEl = (c: HTMLElement) =>
    c.querySelector("[data-poi-label]") as HTMLElement;

  it("tegner ringen i KATEGORIFARGEN med hvit luft, og viser navnet", () => {
    const { container } = renderMarker({
      isActive: true,
      selected: true,
      color: "#0ea5e9",
    });
    const r = ring(container);
    expect(r).toBeTruthy();
    // 44 px aktiv skive + 3 px hvit luft på hver side = 50; 3 px kant utenpå.
    expect(r!.style.width).toBe("50px");
    expect(r!.style.borderWidth).toBe("3px");
    expect(r!.style.borderColor).toBe("rgb(14, 165, 233)");
    expect(r!.style.boxShadow).toContain("inset 0 0 0 3px");
    expect(r!.style.pointerEvents).toBe("none");
    expect(r!.getAttribute("aria-hidden")).toBe("true");
    expect(labelEl(container).style.opacity).toBe("1");
    expect(labelEl(container).style.fontWeight).toBe("700");
  });

  it("skilles fra omtalt-ringen — begge kan stå samtidig", () => {
    const { container } = renderMarker({
      isActive: true,
      selected: true,
      highlightIndex: 2,
    });
    expect(ring(container)).toBeTruthy();
    expect(container.querySelector("[data-poi-highlight-ring]")).toBeTruthy();
    // Den fargede ringen ligger UTENPÅ den mørke: 50 mot 48.
    expect(ring(container)!.style.width).toBe("50px");
    expect(
      (container.querySelector("[data-poi-highlight-ring]") as HTMLElement).style.width,
    ).toBe("48px");
  });

  it("ingen ring uten `selected` — også når markøren er aktiv", () => {
    const { container } = renderMarker({ isActive: true });
    expect(ring(container)).toBeNull();
    expect(labelEl(container).style.fontWeight).toBe("600");
  });

  it("ingen ring når `selected` står uten `isActive` — en løs prop tegner ingenting", () => {
    const { container } = renderMarker({ selected: true });
    expect(ring(container)).toBeNull();
  });

  it("ingen puls: én overgang, ingen animasjon i løkke", () => {
    const { container } = renderMarker({ isActive: true, selected: true });
    const r = ring(container)!;
    expect(r.style.animation).toBe("");
    expect(r.style.transition).toContain("180ms");
  });

  it("står stille når leseren har bedt om mindre bevegelse", () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) =>
      ({ matches: q.includes("reduce"), media: q }) as MediaQueryList) as typeof window.matchMedia;
    try {
      const { container } = renderMarker({ isActive: true, selected: true });
      expect(ring(container)!.style.transition).toBe("none");
    } finally {
      window.matchMedia = original;
    }
  });

  it("memo-sammenligneren reagerer på `selected`", () => {
    const props = {
      color: "#7c3aed",
      icon: "Storefront",
      isActive: true,
      isVisible: true,
      zoomTier: "icon" as const,
      suppressLabel: false,
      labelSide: "right" as const,
      onClick: () => {},
      poi: poi(),
    };
    const { container, rerender } = render(<BoardMarker {...props} />);
    expect(ring(container)).toBeNull();
    rerender(<BoardMarker {...props} selected />);
    expect(ring(container)).toBeTruthy();
    rerender(<BoardMarker {...props} selected={false} />);
    expect(ring(container)).toBeNull();
  });
});
