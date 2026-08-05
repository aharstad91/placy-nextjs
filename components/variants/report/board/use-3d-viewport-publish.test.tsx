import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, act, fireEvent } from "@testing-library/react";
import type { ViewportRect } from "@/lib/board/board-types";
import type { BoardData } from "./board-data";
import { BoardProvider, useBoard } from "./board-state";
import { use3DViewportPublish } from "./use-3d-viewport-publish";

/**
 * 3D-halvdelen av viewport-publiseringen, mot en EKTE BoardProvider.
 *
 * Det som testes er kontrakten mot `gmp-map-3d`, ikke matten (den ligger i
 * `board-camera-fit.test.ts`): at ro-signalet leses riktig vei, at KUN
 * brukergester re-scoper lista (R12 — ellers ville drone-orbiten dratt lista
 * med seg rundt), og at instansen tier når Mapbox er den fremste motoren.
 */

afterEach(() => cleanup());

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

/** Ro-hendelsen fra Google. `isSteady: false` = «bevegelse startet». */
function steady(el: HTMLElement, isSteady = true) {
  act(() => {
    const e = new Event("gmp-steadychange");
    (e as Event & { isSteady?: boolean }).isSteady = isSteady;
    el.dispatchEvent(e);
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
    el.center = { lat: 63.5, lng: 10.6 };
    steady(el);
    expect(spy.rect).toBe(initial);
    expect(spy.gestures).toBe(0);
  });

  it("etter et kart-grep følger lista kameraet, og hintet avvises", () => {
    const { el } = setup();
    const initial = spy.rect;

    fireEvent.pointerDown(el);
    el.center = { lat: 63.5, lng: 10.6 };
    steady(el);

    expect(spy.rect).not.toBe(initial);
    expect(spy.rect!.north).toBeGreaterThan(initial!.north);
    expect(spy.gestures).toBeGreaterThan(0);
  });

  it("marker-tapp er innholds-interaksjon, ikke et kamera-grep", () => {
    const { el } = setup();
    const initial = spy.rect;

    const marker = document.createElement("gmp-marker-3d-interactive");
    el.appendChild(marker);
    fireEvent.pointerDown(marker);
    el.center = { lat: 63.5, lng: 10.6 };
    steady(el);

    expect(spy.rect).toBe(initial);
  });

  it("tier når Mapbox er den fremste motoren", () => {
    const { el } = setup({ enabled: false });
    expect(spy.rect).toBeNull();

    fireEvent.pointerDown(el);
    steady(el);
    expect(spy.rect).toBeNull();
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
