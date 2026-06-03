import { describe, it, expect, vi } from "vitest";
import {
  introPoseAt,
  runIntroFlythrough,
  DEFAULT_INTRO_PATH,
  type IntroPathConfig,
  type IntroFlythroughPhase,
  type CameraDrivableMap3D,
} from "./board-intro-flythrough";
import { getBoardIntro } from "./board-intros";

const target = { lat: 63.4365, lng: 10.4007 };
const path: IntroPathConfig = DEFAULT_INTRO_PATH;

function fakeMap(): CameraDrivableMap3D {
  return { center: { lat: 0, lng: 0, altitude: 0 }, range: 0, tilt: 0, heading: 0 };
}

describe("introPoseAt — oval-spiral låst på objektet", () => {
  it("holder objektet i senter (center = target) for hele banen", () => {
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const p = introPoseAt(s, target, path);
      expect(p.lat).toBe(target.lat);
      expect(p.lng).toBe(target.lng);
    }
  });

  it("starter på rangeStart/tiltStart/startHeading ved s=0", () => {
    const p = introPoseAt(0, target, path);
    // sin(0) = 0 → ingen oval-utbuling i endene
    expect(p.range).toBeCloseTo(path.rangeStart, 5);
    expect(p.tilt).toBeCloseTo(path.tiltStart, 5);
    expect(p.heading).toBeCloseTo(path.startHeading, 5);
  });

  it("lander på rangeEnd/tiltEnd og startHeading+sweep (mod 360) ved s=1", () => {
    const p = introPoseAt(1, target, path);
    expect(p.range).toBeCloseTo(path.rangeEnd, 5);
    expect(p.tilt).toBeCloseTo(path.tiltEnd, 5);
    const expected = ((path.startHeading + path.sweepDeg) % 360 + 360) % 360;
    expect(p.heading).toBeCloseTo(expected, 5);
  });

  it("buler ut midtveis (range > lineær interpolasjon) når eccentricity > 0", () => {
    const linMid = path.rangeStart + (path.rangeEnd - path.rangeStart) * 0.5;
    const p = introPoseAt(0.5, target, path);
    expect(p.range).toBeGreaterThan(linMid);
  });

  it("holder heading i [0,360) selv ved stort sveip", () => {
    const wide: IntroPathConfig = { ...path, startHeading: 350, sweepDeg: 320 };
    for (const s of [0, 0.3, 0.6, 1]) {
      const h = introPoseAt(s, target, wide).heading;
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });
});

describe("getBoardIntro — per-prosjekt skalerbarhet", () => {
  it("gir per-prosjekt-overstyringer for kjent slug", () => {
    const cfg = getBoardIntro("stasjonskvartalet");
    expect(cfg.startHeading).toBe(20);
    expect(cfg.rangeStart).toBe(1150);
  });

  it("gir tomt objekt (→ ren default-intro) for ukjent slug", () => {
    expect(getBoardIntro("ukjent-prosjekt")).toEqual({});
  });

  it("default-intro funker for ETHVERT prosjekt (merge {} over default)", () => {
    const merged: IntroPathConfig = {
      ...DEFAULT_INTRO_PATH,
      ...getBoardIntro("nytt-prosjekt-uten-config"),
    };
    expect(merged).toEqual(DEFAULT_INTRO_PATH);
    // og posituren er fortsatt sentrert på target
    expect(introPoseAt(0.5, target, merged).lat).toBe(target.lat);
  });
});

describe("runIntroFlythrough — staticOnly (prefers-reduced-motion)", () => {
  it("setter den vide etablerings-posituren (s=0), fyrer settling→done uten flytur", () => {
    const map = fakeMap();
    const phases: IntroFlythroughPhase[] = [];
    const cancel = runIntroFlythrough(map, {
      target,
      staticOnly: true,
      onPhase: (p) => phases.push(p),
    });
    const start = introPoseAt(0, target, DEFAULT_INTRO_PATH);
    // Vidt nærområde: rangeStart, ingen hero-nærbilde.
    expect(map.range).toBeCloseTo(start.range, 5);
    expect(map.heading).toBeCloseTo(start.heading, 5);
    expect(map.center.lat).toBe(target.lat);
    // Hopper rett til "done" — aldri "running" (ingen rAF-bevegelse).
    expect(phases).toEqual(["settling", "done"]);
    cancel();
  });
});

describe("runIntroFlythrough — pause fryser flyturen (isPaused)", () => {
  it("akkumulerer ikke bane-tid mens isPaused() er true, gjenopptar der den slapp", () => {
    vi.useFakeTimers();
    // Driv requestAnimationFrame manuelt så vi kontrollerer tidsstemplene.
    let rafCb: ((ts: number) => void) | null = null;
    vi.stubGlobal("requestAnimationFrame", (cb: (ts: number) => void) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});

    const map = fakeMap();
    let paused = false;
    const cancel = runIntroFlythrough(map, {
      target,
      path: { settleMs: 100, durationMs: 1000 },
      isPaused: () => paused,
    });

    // Forbi settle → første frame scheduleres.
    vi.advanceTimersByTime(100);
    expect(rafCb).toBeTruthy();
    const frame = (ts: number) => rafCb!(ts);

    frame(0); // etablerer "last"
    const headingStart = map.heading;
    frame(200); // ikke pauset → banen beveger seg
    const headingMoving = map.heading;
    expect(headingMoving).not.toBeCloseTo(headingStart, 3);

    // Pauset: store tidshopp skal IKKE flytte banen videre.
    paused = true;
    frame(700);
    const headingPaused = map.heading;
    frame(1200);
    expect(map.heading).toBeCloseTo(headingPaused, 5);

    // Resume: banen fortsetter der den slapp (ikke et hopp = hele pause-spennet).
    paused = false;
    frame(1300);
    expect(map.heading).not.toBeCloseTo(headingPaused, 3);

    cancel();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
