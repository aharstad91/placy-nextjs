import { describe, it, expect } from "vitest";
import {
  establishingPoseAt,
  runEstablishingFlythrough,
  type EstablishingPathConfig,
  type EstablishingPhase,
} from "./board-establishing-flythrough";
import type { CameraDrivableMap3D } from "./board-intro-flythrough";
import { getEstablishingShot } from "./board-establishing-shots";

// Rute som buer monotont vestover og så nordover (samme form som Grilstad-sporet).
const CFG: EstablishingPathConfig = {
  waypoints: [
    { lat: 63.4281, lng: 10.5499 },
    { lat: 63.4265, lng: 10.528 },
    { lat: 63.4282, lng: 10.5146 },
    { lat: 63.4303, lng: 10.504 },
    { lat: 63.4336, lng: 10.493 },
    { lat: 63.4378, lng: 10.4933 },
  ],
  rangeStart: 1800,
  rangeEnd: 650,
  tiltStart: 60,
  tiltEnd: 55,
  headingOffset: 0,
  durationMs: 40000,
  settleMs: 3000,
  bloomAtProgress: 0.5,
};

function fakeMap(): CameraDrivableMap3D {
  return { center: { lat: 0, lng: 0, altitude: 0 }, range: 0, tilt: 0, heading: 0 };
}

describe("establishingPoseAt — sammenhengende rute-flyover", () => {
  it("starter på første waypoint + rangeStart/tiltStart ved s=0", () => {
    const p = establishingPoseAt(0, CFG);
    expect(p.lat).toBeCloseTo(CFG.waypoints[0].lat, 6);
    expect(p.lng).toBeCloseTo(CFG.waypoints[0].lng, 6);
    expect(p.range).toBeCloseTo(CFG.rangeStart, 4);
    expect(p.tilt).toBeCloseTo(CFG.tiltStart, 4);
  });

  it("lander på siste waypoint + rangeEnd/tiltEnd ved s=1", () => {
    const p = establishingPoseAt(1, CFG);
    const last = CFG.waypoints[CFG.waypoints.length - 1];
    expect(p.lat).toBeCloseTo(last.lat, 6);
    expect(p.lng).toBeCloseTo(last.lng, 6);
    expect(p.range).toBeCloseTo(CFG.rangeEnd, 4);
    expect(p.tilt).toBeCloseTo(CFG.tiltEnd, 4);
  });

  it("range og tilt eases monotont fra start mot slutt", () => {
    let prevRange = establishingPoseAt(0, CFG).range;
    let prevTilt = establishingPoseAt(0, CFG).tilt;
    for (let s = 0.1; s <= 1; s += 0.1) {
      const p = establishingPoseAt(s, CFG);
      expect(p.range).toBeLessThanOrEqual(prevRange + 1e-6); // synker
      expect(p.tilt).toBeLessThanOrEqual(prevTilt + 1e-6); // synker
      prevRange = p.range;
      prevTilt = p.tilt;
    }
  });

  it("look-at reiser netto VESTOVER og NORDOVER langs ruta, og holder seg nær sporet", () => {
    const lngs = CFG.waypoints.map((w) => w.lng);
    const lats = CFG.waypoints.map((w) => w.lat);
    const latLo = Math.min(...lats);
    const latHi = Math.max(...lats);
    const lngLo = Math.min(...lngs);
    const lngHi = Math.max(...lngs);
    // Netto retning: start øst/sør → slutt vest/nord (sporet snur nordover på slutten)
    const start = establishingPoseAt(0, CFG);
    const end = establishingPoseAt(1, CFG);
    expect(end.lng).toBeLessThan(start.lng); // netto vestover
    expect(end.lat).toBeGreaterThan(start.lat); // netto nordover
    // Hele veien: hold deg nær sporet (Catmull-Rom kan bue litt → liten margin)
    for (let s = 0; s <= 1; s += 0.05) {
      const p = establishingPoseAt(s, CFG);
      expect(p.lat).toBeGreaterThanOrEqual(latLo - 0.002);
      expect(p.lat).toBeLessThanOrEqual(latHi + 0.002);
      expect(p.lng).toBeGreaterThanOrEqual(lngLo - 0.002);
      expect(p.lng).toBeLessThanOrEqual(lngHi + 0.002);
    }
  });

  it("heading holder seg gyldig (0–360) og er definert hele veien", () => {
    for (let s = 0; s <= 1; s += 0.05) {
      const h = establishingPoseAt(s, CFG).heading;
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
      expect(Number.isFinite(h)).toBe(true);
    }
  });

  it("heading peker fremover langs ruta — vestlig (~250–300°) i åpningen", () => {
    const h = establishingPoseAt(0.05, CFG).heading;
    expect(h).toBeGreaterThan(240);
    expect(h).toBeLessThan(310);
  });

  it("headingOffset legges til tangent-headingen", () => {
    const base = establishingPoseAt(0.3, { ...CFG, headingOffset: 0 }).heading;
    const shifted = establishingPoseAt(0.3, { ...CFG, headingOffset: 30 }).heading;
    expect(shifted).toBeCloseTo((base + 30) % 360, 3);
  });

  it("beveger seg i KONSTANT bakke-fart (buelengde-resampling) — jevne steg per Δs", () => {
    // Like store s-steg → tilnærmet like store bakke-avstander. Dette er fiksen mot
    // «rykk»/ujevn fart innad i spline-segmentene.
    const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
      const midLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
      const dx = (b.lng - a.lng) * 111320 * Math.cos(midLat);
      const dy = (b.lat - a.lat) * 110540;
      return Math.hypot(dx, dy);
    };
    const steps: number[] = [];
    let prev = establishingPoseAt(0, CFG);
    for (let s = 0.02; s <= 1.0001; s += 0.02) {
      const p = establishingPoseAt(s, CFG);
      steps.push(meters(prev, p));
      prev = p;
    }
    const mean = steps.reduce((a, b) => a + b, 0) / steps.length;
    // Hvert steg holder seg nær gjennomsnittet — ingen segment-til-segment-sprang.
    for (const d of steps) {
      expect(d).toBeGreaterThan(mean * 0.6);
      expect(d).toBeLessThan(mean * 1.45);
    }
  });
});

describe("runEstablishingFlythrough — staticOnly (prefers-reduced-motion)", () => {
  it("setter første-waypoint-posituren og fyrer done uten rAF", () => {
    const map = fakeMap();
    const phases: EstablishingPhase[] = [];
    const cancel = runEstablishingFlythrough(map, {
      path: CFG,
      staticOnly: true,
      onPhase: (p) => phases.push(p),
    });
    expect(map.center.lat).toBeCloseTo(CFG.waypoints[0].lat, 6);
    expect(map.range).toBeCloseTo(CFG.rangeStart, 4);
    expect(phases).toContain("settling");
    expect(phases).toContain("done");
    cancel();
  });
});

describe("getEstablishingShot — Grilstad-rute", () => {
  it("har en gyldig flyover-rute for byggetrinn-4 (rett, flat dronetur)", () => {
    const shot = getEstablishingShot("byggetrinn-4");
    expect(shot).toBeDefined();
    expect(shot!.waypoints.length).toBeGreaterThanOrEqual(2);
    // Konstant høyde + tilt (ingen descent/zoom) — kjernen i den nye modellen.
    expect(shot!.rangeStart).toBe(shot!.rangeEnd);
    expect(shot!.tiltStart).toBe(shot!.tiltEnd);
    expect(shot!.bloomAtProgress).toBeGreaterThan(0);
    expect(shot!.bloomAtProgress).toBeLessThan(1);
    expect(shot!.durationMs).toBeGreaterThan(0);
  });

  it("returnerer undefined for ukjent slug", () => {
    expect(getEstablishingShot("finnes-ikke")).toBeUndefined();
  });
});
