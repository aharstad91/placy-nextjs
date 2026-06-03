import { describe, it, expect } from "vitest";
import {
  introPoseAt,
  DEFAULT_INTRO_PATH,
  type IntroPathConfig,
} from "./board-intro-flythrough";
import { getBoardIntro } from "./board-intros";

const target = { lat: 63.4365, lng: 10.4007 };
const path: IntroPathConfig = DEFAULT_INTRO_PATH;

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
