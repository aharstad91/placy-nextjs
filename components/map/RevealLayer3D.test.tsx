import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import type { POI } from "@/lib/types";
import { RevealLayer3D, type RevealItem } from "./RevealLayer3D";

// Marker3D er bare en posisjonsbærer her — render barna direkte.
vi.mock("@vis.gl/react-google-maps", () => ({
  Marker3D: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="m3d">{children}</div>
  ),
  AltitudeMode: { RELATIVE_TO_GROUND: "rel" },
}));

// Fang scale-propen + om opacity I DET HELE TATT sendes inn (AC1: aldri opacity).
vi.mock("./Marker3DPin", () => ({
  Marker3DPin: (props: { scale?: number; opacity?: number }) => (
    <div
      data-kind="pin"
      data-scale={String(props.scale)}
      data-has-opacity={String(props.opacity !== undefined)}
    />
  ),
}));
vi.mock("./BlobMarker3D", () => ({
  BlobMarker3D: (props: { scale?: number; opacity?: number }) => (
    <div
      data-kind="blob"
      data-scale={String(props.scale)}
      data-has-opacity={String(props.opacity !== undefined)}
    />
  ),
}));
vi.mock("@/lib/utils/map-icons-filled", () => ({
  getFilledIcon: () => () => null,
}));
vi.mock("@/lib/utils/marker-color", () => ({ hexLightTint: () => "#eee" }));

function poi(id: string): POI {
  return {
    id,
    coordinates: { lat: 0, lng: 0 },
    category: { id: "cat", color: "#abc", icon: "MapPin" },
  } as unknown as POI;
}

// Kontrollerbar rAF: fang callbacks, driv dem manuelt med valgt timestamp.
let rafCbs: FrameRequestCallback[] = [];
let rafCount = 0;
let cancelled: number[] = [];

beforeEach(() => {
  rafCbs = [];
  rafCount = 0;
  cancelled = [];
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCbs.push(cb);
    return ++rafCount;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    cancelled.push(id);
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Driv den nyeste planlagte rAF-callbacken med absolutt timestamp `ts`. */
function tick(ts: number) {
  const cb = rafCbs[rafCbs.length - 1];
  act(() => {
    cb(ts);
  });
}

function markers(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-kind]"));
}

describe("RevealLayer3D — full-opacity-mount, scale-only (AC1)", () => {
  it("animate=false: alle markører vises umiddelbart på scale 1, uten rAF", () => {
    const items: RevealItem[] = [
      { kind: "blob", poi: poi("a") },
      { kind: "pin", poi: poi("b") },
    ];
    const { container } = render(<RevealLayer3D items={items} animate={false} />);
    const ms = markers(container);
    expect(ms).toHaveLength(2);
    for (const m of ms) {
      expect(m.getAttribute("data-scale")).toBe("1"); // full skala
      expect(m.getAttribute("data-has-opacity")).toBe("false"); // ALDRI opacity
    }
    expect(rafCount).toBe(0); // ingen rAF når animate=false
  });

  it("animerer KUN kvantisert scale (Math.round(raw*100)/100), aldri opacity", () => {
    const items: RevealItem[] = [{ kind: "blob", poi: poi("a") }];
    const { container } = render(<RevealLayer3D items={items} />);
    tick(0); // start-frame: startRef=0, elapsed=0
    tick(1040); // 140 ms inn i bouncen (appearAt=900, BOUNCE_MS=280)
    const m = markers(container)[0];
    const scale = Number(m.getAttribute("data-scale"));
    expect(Number.isFinite(scale)).toBe(true);
    // allerede kvantisert til 2 desimaler → idempotent
    expect(Math.round(scale * 100) / 100).toBe(scale);
    expect(scale).toBeGreaterThan(0);
    expect(m.getAttribute("data-has-opacity")).toBe("false");
  });
});

describe("RevealLayer3D — rAF-disiplin + begge stagger-moduser (AC2)", () => {
  it("stopper rAF når siste markør har settlet (e >= total)", () => {
    const items: RevealItem[] = [{ kind: "pin", poi: poi("a") }];
    const { container } = render(<RevealLayer3D items={items} />);
    tick(0);
    // total = appearAt(900) + BOUNCE_MS(280) = 1180
    const before = rafCount;
    tick(1180); // e = 1180 == total → IKKE < total → ingen ny rAF planlegges
    expect(rafCount).toBe(before);
    // markøren har settlet på scale 1
    expect(markers(container)[0].getAttribute("data-scale")).toBe("1");
  });

  it("indeks-stagger: markører monteres sekvensielt, ikke alle samtidig", () => {
    const items: RevealItem[] = [
      { kind: "blob", poi: poi("a") },
      { kind: "blob", poi: poi("b") },
      { kind: "blob", poi: poi("c") },
    ];
    // default windowMs=4200 → staggerMs klamret til 220 → appearAts [900,1120,1340]
    const { container } = render(<RevealLayer3D items={items} />);
    tick(0);
    tick(1000); // > 900 (item0) men < 1120 (item1)
    expect(markers(container)).toHaveLength(1);
  });

  it("positional-modus (alle items har `at`): lavere `at` tegnes inn først", () => {
    const items: RevealItem[] = [
      { kind: "blob", poi: poi("early"), at: 0.1 },
      { kind: "pin", poi: poi("late"), at: 0.9 },
    ];
    // windowMs=1000 → appearAt = 900 + at*1000 = [1000, 1800]
    const { container } = render(<RevealLayer3D items={items} windowMs={1000} />);
    tick(0);
    tick(1200); // > 1000 (early) men < 1800 (late)
    const ms = markers(container);
    expect(ms).toHaveLength(1);
    expect(ms[0].getAttribute("data-kind")).toBe("blob"); // 'early' (at=0.1)
  });

  it("rydder opp rAF ved unmount (cancelAnimationFrame)", () => {
    const items: RevealItem[] = [{ kind: "blob", poi: poi("a") }];
    const { unmount } = render(<RevealLayer3D items={items} />);
    expect(rafCount).toBeGreaterThan(0);
    unmount();
    expect(cancelled.length).toBeGreaterThan(0);
  });
});
