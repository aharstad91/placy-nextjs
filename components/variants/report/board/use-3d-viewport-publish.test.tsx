import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import type { ViewportRect } from "@/lib/board/board-types";
import type { BoardData } from "./board-data";
import { BoardProvider, useBoard } from "./board-state";
import {
  MIN_SETTLE_MS,
  SETTLE_GAP_FACTOR,
  use3DViewportPublish,
} from "./use-3d-viewport-publish";

/**
 * 3D-halvdelen av viewport-publiseringen, mot en EKTE BoardProvider.
 *
 * Det som testes er kontrakten mot `gmp-map-3d`, ikke matten (den ligger i
 * `board-camera-fit.test.ts`): at ro-signalet leses fra kamera-telemetrien og
 * ikke fra scenens render-signal (ellers ligger lista ~1 s bak Mapbox), at KUN
 * brukergester re-scoper lista (R12 — ellers ville drone-orbiten dratt lista
 * med seg rundt), og at instansen tier når Mapbox er den fremste motoren.
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const HOME = { lat: 63.43, lng: 10.4 };

function boardData(): BoardData {
  return {
    projectSlug: "ferjemannsveien-10",
    home: {
      name: "Ferjemannsveien 10",
      coordinates: HOME,
      address: "Ferjemannsveien 10",
    },
    categories: [],
    poisById: new Map(),
    audioTourEnabled: false,
  };
}

/** Kamera-feltene vi leser fra Map3DElement, satt på et vanlig element. */
interface FakeMap3D extends HTMLElement {
  center: { lat: number; lng: number } | null;
  range: number | null;
  heading: number;
  fov: number;
}

function fakeMap3d({ ready = true } = {}): FakeMap3D {
  const el = document.createElement("div") as unknown as FakeMap3D;
  // Google deriverer kamera-feltene; før første scene er rendret er de ikke
  // lesbare. `ready: false` modellerer nettopp det.
  el.center = ready ? { ...HOME } : null;
  el.range = ready ? 900 : null;
  el.heading = 0;
  el.fov = 35;
  el.getBoundingClientRect = () =>
    ({ width: 390, height: 800, top: 0, left: 0 }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

/** Scenens render-signal. `isSteady: false` = «bevegelse startet». */
function steady(el: HTMLElement, isSteady = true) {
  act(() => {
    const e = new Event("gmp-steadychange");
    (e as Event & { isSteady?: boolean }).isSteady = isSteady;
    el.dispatchEvent(e);
  });
}

/** Kamera-telemetrien. Fyrer per frame mens kameraet beveger seg. */
function cameraMoved(el: HTMLElement) {
  act(() => {
    el.dispatchEvent(new Event("gmp-camerapositionchange"));
  });
}

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const spy = {
  rect: null as ViewportRect | null,
  gestures: 0,
};

function Harness({
  map3d,
  enabled,
  occluded,
}: {
  map3d: unknown;
  enabled: boolean;
  occluded: number;
}) {
  const ctx = useBoard();
  spy.rect = ctx.viewportRect;
  spy.gestures = ctx.viewportGestures;
  use3DViewportPublish({ map3d, enabled, occludedBottomPx: occluded });
  return null;
}

function setup({
  ready = true,
  enabled = true,
  occluded = 272,
} = {}) {
  const el = fakeMap3d({ ready });
  const utils = render(
    <BoardProvider data={boardData()}>
      <Harness map3d={el} enabled={enabled} occluded={occluded} />
    </BoardProvider>,
  );
  const rerender = (next: { enabled?: boolean; occluded?: number }) =>
    utils.rerender(
      <BoardProvider data={boardData()}>
        <Harness
          map3d={el}
          enabled={next.enabled ?? enabled}
          occluded={next.occluded ?? occluded}
        />
      </BoardProvider>,
    );
  return { el, rerender };
}

describe("use3DViewportPublish", () => {
  it("publiserer utsnittet så snart kameraet er lesbart", () => {
    setup();
    expect(spy.rect).not.toBeNull();
    // Ingen gest har skjedd — hintet skal fortsatt stå.
    expect(spy.gestures).toBe(0);
  });

  it("venter på første ro-hendelse når kameraet ikke er lesbart ved mount", () => {
    const { el } = setup({ ready: false });
    expect(spy.rect).toBeNull();

    // Google har rendret scenen og derivert kamera-feltene.
    el.center = { ...HOME };
    el.range = 900;
    steady(el);
    expect(spy.rect).not.toBeNull();
    // Første avlesning er ikke en gest — den er ankomsten.
    expect(spy.gestures).toBe(0);
  });

  it("«bevegelse startet» (isSteady: false) publiserer ingenting", () => {
    const { el } = setup({ ready: false });
    el.center = { ...HOME };
    el.range = 900;
    steady(el, false);
    expect(spy.rect).toBeNull();
  });

  it("drone-orbiten re-scoper ALDRI lista (R12)", () => {
    const { el } = setup();
    const initial = spy.rect;

    // Kameraet har flyttet seg av seg selv — ingen bruker har tatt i kartet.
    // Verken telemetrien eller render-signalet skal føre til ny scoping.
    el.center = { lat: 63.5, lng: 10.6 };
    cameraMoved(el);
    tick(MIN_SETTLE_MS * 10);
    steady(el);

    expect(spy.rect).toBe(initial);
    expect(spy.gestures).toBe(0);
  });

  it("etter et kart-grep følger lista kameraet, og hintet avvises", () => {
    const { el } = setup();
    const initial = spy.rect;

    fireEvent.pointerDown(el);
    el.center = { lat: 63.5, lng: 10.6 };
    cameraMoved(el);
    tick(MIN_SETTLE_MS + 1);

    expect(spy.rect).not.toBe(initial);
    expect(spy.rect!.north).toBeGreaterThan(initial!.north);
    expect(spy.gestures).toBeGreaterThan(0);
  });

  it("venter IKKE på at scenen er ferdig rendret — det er hele forsinkelsen", () => {
    const { el } = setup();
    const initial = spy.rect;

    fireEvent.pointerDown(el);
    el.center = { lat: 63.5, lng: 10.6 };
    cameraMoved(el);
    tick(MIN_SETTLE_MS + 1);

    // Ingen `steadychange` har fyrt ennå — den kommer 590–950 ms senere — og
    // lista er likevel oppdatert.
    expect(spy.rect).not.toBe(initial);
  });

  it("en strøm av kamera-hendelser gir ÉN publisering, ikke én per frame", () => {
    const { el } = setup();

    fireEvent.pointerDown(el);
    // 20 frames med bevegelse, ~10 ms fra hverandre slik ekte telemetri kommer.
    for (let i = 1; i <= 20; i++) {
      el.center = { lat: 63.43 + i * 0.001, lng: 10.4 };
      cameraMoved(el);
      tick(10);
    }
    expect(spy.gestures).toBe(0); // ingenting publisert mens draget pågår
    tick(MIN_SETTLE_MS + 1);
    expect(spy.gestures).toBe(1);
    expect(spy.rect!.north).toBeGreaterThan(63.44);
  });

  it("ro-vinduet vokser når telemetrien kommer tregere (svak enhet)", () => {
    const { el } = setup();
    const SLOW_GAP = 150;

    fireEvent.pointerDown(el);
    el.center = { lat: 63.5, lng: 10.6 };
    cameraMoved(el);
    // Første vindu er kort (ingen luker målt ennå) og fyrer underveis.
    tick(SLOW_GAP);
    const midDrag = spy.rect;
    expect(midDrag).not.toBeNull();

    // Andre hendelse: nå ER luka målt, og vinduet skal ha vokst med den.
    el.center = { lat: 63.6, lng: 10.7 };
    cameraMoved(el);
    tick(MIN_SETTLE_MS + 1);
    expect(spy.rect).toBe(midDrag); // ville publisert for tidlig med fast vindu
    tick(SLOW_GAP * SETTLE_GAP_FACTOR);
    expect(spy.rect).not.toBe(midDrag);
  });

  it("render-signalet teller ikke gesten på nytt når fast-stien alt har landet", () => {
    const { el } = setup();

    fireEvent.pointerDown(el);
    el.center = { lat: 63.5, lng: 10.6 };
    cameraMoved(el);
    tick(MIN_SETTLE_MS + 1);
    const afterFastPath = spy.rect;
    expect(spy.gestures).toBe(1);

    // Scenen blir ferdig rendret ~1 s senere. Rektangelet dedupes, men
    // gest-telleren gjør IKKE det — derfor må backstopen holde seg unna.
    tick(1000);
    steady(el);
    expect(spy.rect).toBe(afterFastPath);
    expect(spy.gestures).toBe(1);
  });

  it("backstop: et grep uten kamera-telemetri publiseres likevel", () => {
    const { el } = setup();
    const initial = spy.rect;

    // Ingen `gmp-camerapositionchange` i det hele tatt — modellerer at Google
    // skulle slutte å levere telemetri for en gest-type.
    fireEvent.pointerDown(el);
    el.center = { lat: 63.5, lng: 10.6 };
    tick(1000);
    steady(el);

    expect(spy.rect).not.toBe(initial);
    expect(spy.gestures).toBe(1);
  });

  // Begge markør-generasjoner: rasterisert `gmp-marker-3d-interactive` og
  // HTML-markøren `gmp-marker-interactive`. Gaten er usynlig når den svikter —
  // et markør-tapp ville re-scopet nabolagslista under fingeren — så den må
  // bevises for tagnavnet vi bytter TIL, ikke bare det vi bytter fra.
  for (const tag of ["gmp-marker-3d-interactive", "gmp-marker-interactive"]) {
    it(`marker-tapp er innholds-interaksjon, ikke et kamera-grep (${tag})`, () => {
      const { el } = setup();
      const initial = spy.rect;

      const marker = document.createElement(tag);
      el.appendChild(marker);
      fireEvent.pointerDown(marker);
      el.center = { lat: 63.5, lng: 10.6 };
      cameraMoved(el);
      tick(MIN_SETTLE_MS * 10);
      steady(el);

      expect(spy.rect).toBe(initial);
    });
  }

  it("tapp på et BARN av markøren teller heller ikke som grep", () => {
    // Klikket lander på labelen eller disc-en, ikke på verts-elementet.
    const { el } = setup();
    const initial = spy.rect;

    const marker = document.createElement("gmp-marker-interactive");
    const inner = document.createElement("span");
    marker.appendChild(inner);
    el.appendChild(marker);
    fireEvent.pointerDown(inner);
    el.center = { lat: 63.5, lng: 10.6 };
    cameraMoved(el);
    tick(MIN_SETTLE_MS * 10);
    steady(el);

    expect(spy.rect).toBe(initial);
  });

  it("tier når Mapbox er den fremste motoren", () => {
    const { el } = setup({ enabled: false });
    expect(spy.rect).toBeNull();

    fireEvent.pointerDown(el);
    cameraMoved(el);
    tick(MIN_SETTLE_MS * 10);
    steady(el);
    expect(spy.rect).toBeNull();
  });

  it("en ventende publisering avlyses når 3D slutter å være fremste motor", () => {
    const { el, rerender } = setup();
    const initial = spy.rect;

    fireEvent.pointerDown(el);
    el.center = { lat: 63.5, lng: 10.6 };
    cameraMoved(el);
    // Brukeren bytter til Kart-fanen før vinduet har løpt ut.
    rerender({ enabled: false });
    tick(MIN_SETTLE_MS * 10);

    // Mapbox eier kanalen nå — 3D skal ikke skrive over den i etterkant.
    expect(spy.rect).toBe(initial);
  });

  it("ny sheet-hvileposisjon re-publiserer uten å telle som gest", () => {
    const { rerender } = setup({ occluded: 272 });
    const initial = spy.rect!;

    rerender({ occluded: 500 });
    // Mer okkludert flate → båndet krymper bort fra brukeren: sør-kanten
    // trekkes nordover, nord-kanten står stille.
    expect(spy.rect!.south).toBeGreaterThan(initial.south);
    expect(spy.rect!.north).toBeCloseTo(initial.north, 9);
    expect(spy.gestures).toBe(0);
  });

  it("glemmer brukergrepet når 3D slutter å være fremste motor", () => {
    const { el, rerender } = setup();
    fireEvent.pointerDown(el);

    // Bytt til 2D og tilbake: Mapbox eide kanalen i mellomtiden.
    rerender({ enabled: false });
    rerender({ enabled: true });
    const afterReturn = spy.rect;

    // Orbiten skal ikke arve «brukeren eier kameraet» fra forrige økt.
    el.center = { lat: 63.5, lng: 10.6 };
    steady(el);
    expect(spy.rect).toBe(afterReturn);
  });
});
