import { describe, it, expect } from "vitest";
import {
  decideCameraIntent,
  bearingBetween,
  haversineMeters,
  deriveCategoryCamera,
  computeSpreadRadiusM,
  orbitRangeForSpread,
  ORBIT_RANGE,
  POI_RANGE,
  DEFAULT_CINEMATIC_MS,
  DERIVE_DRIFT_DEG,
  type CameraDecisionInputs,
  type CameraIntent,
} from "./board-3d-camera-director";
import type { CategoryCameraConfig } from "@/lib/types";

const home = { lat: 63.435, lng: 10.398 };

const baseInput = (
  overrides: Partial<CameraDecisionInputs> = {},
): CameraDecisionInputs => ({
  cameraMode: "auto",
  introActive: false,
  home,
  activePOI: null,
  activeCategoryId: null,
  categoryConfig: undefined,
  audioDurationMs: undefined,
  audioPaused: false,
  reducedMotion: false,
  prevIntent: null,
  ...overrides,
});

const config = (
  overrides: Partial<CategoryCameraConfig> = {},
): CategoryCameraConfig => ({
  a: { lat: 63.43, lng: 10.39, range: 500, tilt: 60, heading: 200 },
  b: { lat: 63.432, lng: 10.395, range: 450, tilt: 62, heading: 240 },
  ...overrides,
});

describe("decideCameraIntent", () => {
  it("free-modus → free (ingen programmatisk bevegelse)", () => {
    expect(decideCameraIntent(baseInput({ cameraMode: "free" }))).toEqual({
      kind: "free",
    });
  });

  it("introActive → free (intro-flythrough eier kameraet, director yield-er)", () => {
    expect(decideCameraIntent(baseInput({ introActive: true }))).toEqual({
      kind: "free",
    });
  });

  it("introActive vinner over auto + aktiv kategori (ingen orbit/cinematic-kamp)", () => {
    const intent = decideCameraIntent(
      baseInput({
        introActive: true,
        cameraMode: "auto",
        activeCategoryId: "mat-drikke",
        categoryConfig: config(),
      }),
    );
    expect(intent.kind).toBe("free");
  });

  it("aktiv POI → poi-pose tett inn, heading mot POI", () => {
    const poi = { lat: 63.44, lng: 10.41 };
    const intent = decideCameraIntent(baseInput({ activePOI: poi }));
    expect(intent.kind).toBe("poi");
    if (intent.kind === "poi") {
      expect(intent.pose.center).toEqual({ lat: 63.44, lng: 10.41, altitude: 0 });
      expect(intent.pose.range).toBe(POI_RANGE);
      expect(intent.pose.heading).toBeCloseTo(bearingBetween(home, poi), 5);
    }
  });

  it("POI vinner over aktiv kategori", () => {
    const intent = decideCameraIntent(
      baseInput({
        activePOI: { lat: 63.44, lng: 10.41 },
        activeCategoryId: "mat-drikke",
        categoryConfig: config(),
      }),
    );
    expect(intent.kind).toBe("poi");
  });

  it("auto + kategori uten config → orbit-fallback rundt hjemmet", () => {
    const intent = decideCameraIntent(
      baseInput({ activeCategoryId: "mat-drikke", categoryConfig: undefined }),
    );
    expect(intent.kind).toBe("orbit");
    if (intent.kind === "orbit") {
      expect(intent.hero.center).toEqual({ lat: home.lat, lng: home.lng, altitude: 0 });
      expect(intent.hero.range).toBe(ORBIT_RANGE);
    }
  });

  it("auto + ingen kategori → orbit", () => {
    expect(decideCameraIntent(baseInput()).kind).toBe("orbit");
  });

  it("cut INN i orbit fra free (velkommen-innflyvning → nabolaget uten waypoints)", () => {
    const intent = decideCameraIntent(
      baseInput({
        activeCategoryId: "nabolaget",
        categoryConfig: undefined,
        prevIntent: { kind: "free" },
      }),
    );
    expect(intent.kind).toBe("orbit");
    if (intent.kind === "orbit") expect(intent.cut).toBe(true);
  });

  it("cut INN i orbit fra cinematic (kategori-skifte til en uten waypoints)", () => {
    const prev: CameraIntent = {
      kind: "cinematic",
      categoryId: "mat-drikke",
      a: { center: { lat: home.lat, lng: home.lng, altitude: 0 }, range: 500, tilt: 60, heading: 200 },
      b: null,
      durationMs: 16000,
      cut: false,
      reducedMotion: false,
      paused: false,
    };
    const intent = decideCameraIntent(baseInput({ prevIntent: prev }));
    expect(intent.kind).toBe("orbit");
    if (intent.kind === "orbit") expect(intent.cut).toBe(true);
  });

  it("orbit→orbit holder uavbrutt (ingen cut)", () => {
    const prev: CameraIntent = {
      kind: "orbit",
      cut: false,
      hero: { center: { lat: home.lat, lng: home.lng, altitude: 0 }, range: ORBIT_RANGE, tilt: 50, heading: 0 },
    };
    const intent = decideCameraIntent(baseInput({ prevIntent: prev }));
    expect(intent.kind).toBe("orbit");
    if (intent.kind === "orbit") expect(intent.cut).toBe(false);
  });

  it("kald første-mount (prevIntent null) → orbit uten cut (ingen cream-flash)", () => {
    const intent = decideCameraIntent(baseInput());
    expect(intent.kind).toBe("orbit");
    if (intent.kind === "orbit") expect(intent.cut).toBe(false);
  });

  it("retur fra åpnet POI → orbit uten cut (myk fly-tilbake)", () => {
    const prev: CameraIntent = {
      kind: "poi",
      pose: { center: { lat: home.lat, lng: home.lng, altitude: 0 }, range: POI_RANGE, tilt: 60, heading: 0 },
    };
    const intent = decideCameraIntent(baseInput({ prevIntent: prev }));
    expect(intent.kind).toBe("orbit");
    if (intent.kind === "orbit") expect(intent.cut).toBe(false);
  });

  it("auto + kategori MED config → cinematic A→B, cut:true ved første beat", () => {
    const intent = decideCameraIntent(
      baseInput({
        activeCategoryId: "mat-drikke",
        categoryConfig: config(),
        audioDurationMs: 22000,
      }),
    );
    expect(intent.kind).toBe("cinematic");
    if (intent.kind === "cinematic") {
      expect(intent.categoryId).toBe("mat-drikke");
      expect(intent.a.center.lat).toBe(63.43);
      expect(intent.b?.center.lat).toBe(63.432);
      expect(intent.durationMs).toBe(22000);
      expect(intent.cut).toBe(true);
    }
  });

  it("samme kategori re-render → cut:false (ingen ny cut)", () => {
    const prevIntent = decideCameraIntent(
      baseInput({ activeCategoryId: "mat-drikke", categoryConfig: config() }),
    ) as CameraIntent;
    const intent = decideCameraIntent(
      baseInput({ activeCategoryId: "mat-drikke", categoryConfig: config(), prevIntent }),
    );
    expect(intent.kind).toBe("cinematic");
    if (intent.kind === "cinematic") expect(intent.cut).toBe(false);
  });

  it("kategori-skifte fra en annen cinematic → cut:true", () => {
    const prevIntent = decideCameraIntent(
      baseInput({ activeCategoryId: "transport", categoryConfig: config() }),
    ) as CameraIntent;
    const intent = decideCameraIntent(
      baseInput({ activeCategoryId: "mat-drikke", categoryConfig: config(), prevIntent }),
    );
    if (intent.kind === "cinematic") expect(intent.cut).toBe(true);
  });

  it("A-only config → cinematic med b=null (hold/orbit ved A)", () => {
    const intent = decideCameraIntent(
      baseInput({
        activeCategoryId: "mat-drikke",
        categoryConfig: config({ b: undefined }),
      }),
    );
    if (intent.kind === "cinematic") expect(intent.b).toBeNull();
  });

  it("ukjent duration → DEFAULT_CINEMATIC_MS", () => {
    const intent = decideCameraIntent(
      baseInput({ activeCategoryId: "x", categoryConfig: config(), audioDurationMs: undefined }),
    );
    if (intent.kind === "cinematic") expect(intent.durationMs).toBe(DEFAULT_CINEMATIC_MS);
  });

  it("moveDurationMs-override slår audio-lengde", () => {
    const intent = decideCameraIntent(
      baseInput({
        activeCategoryId: "x",
        categoryConfig: config({ moveDurationMs: 9000 }),
        audioDurationMs: 22000,
      }),
    );
    if (intent.kind === "cinematic") expect(intent.durationMs).toBe(9000);
  });

  it("redusert bevegelse → b=null, durationMs=0 (statisk hold)", () => {
    const intent = decideCameraIntent(
      baseInput({
        activeCategoryId: "x",
        categoryConfig: config(),
        reducedMotion: true,
        audioDurationMs: 22000,
      }),
    );
    if (intent.kind === "cinematic") {
      expect(intent.b).toBeNull();
      expect(intent.durationMs).toBe(0);
      expect(intent.reducedMotion).toBe(true);
    }
  });

  it("audio pauset → cinematic.paused=true (frys i hooken)", () => {
    const intent = decideCameraIntent(
      baseInput({ activeCategoryId: "x", categoryConfig: config(), audioPaused: true }),
    );
    if (intent.kind === "cinematic") expect(intent.paused).toBe(true);
  });
});

describe("haversineMeters", () => {
  it("er 0 for samme punkt", () => {
    expect(haversineMeters(home, home)).toBe(0);
  });

  it("gir ~111 m per 0.001° breddegrad", () => {
    const d = haversineMeters({ lat: 63.0, lng: 10.0 }, { lat: 63.001, lng: 10.0 });
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(118);
  });
});

describe("deriveCategoryCamera", () => {
  it("returnerer null uten POI-er", () => {
    expect(deriveCategoryCamera(home, [])).toBeNull();
  });

  it("sentrerer A og B på midtpunktet mellom hjem og POI-tyngdepunkt", () => {
    const poi = { lat: 63.425, lng: 10.41 };
    const cfg = deriveCategoryCamera(home, [poi])!;
    const expectedMid = {
      lat: Number(((home.lat + poi.lat) / 2).toFixed(6)),
      lng: Number(((home.lng + poi.lng) / 2).toFixed(6)),
    };
    expect(cfg.a.lat).toBe(expectedMid.lat);
    expect(cfg.a.lng).toBe(expectedMid.lng);
    expect(cfg.b!.lat).toBe(expectedMid.lat);
  });

  it("A og B svinger en bue (ulik heading, ±DRIFT rundt hjem→innhold)", () => {
    const cfg = deriveCategoryCamera(home, [{ lat: 63.42, lng: 10.42 }])!;
    expect(cfg.a.heading).not.toBe(cfg.b!.heading);
    // Sveip-spennet er 2×DERIVE_DRIFT_DEG (±drift) — utledet fra konstanten så
    // den følger med når vi justerer kamera-roen. Tar høyde for 360-wrap.
    const diff = Math.abs(((cfg.a.heading - cfg.b!.heading + 540) % 360) - 180);
    expect(diff).toBeCloseTo(2 * DERIVE_DRIFT_DEG, 0);
  });

  it("klamper range innenfor [810, 850] (tett-klyngede kat aldri for nære)", () => {
    const near = deriveCategoryCamera(home, [{ lat: home.lat + 0.0005, lng: home.lng }])!;
    expect(near.a.range).toBeGreaterThanOrEqual(810);
    const far = deriveCategoryCamera(home, [{ lat: home.lat + 0.2, lng: home.lng + 0.2 }])!;
    expect(far.a.range).toBeLessThanOrEqual(850);
  });

  it("bruker tyngdepunktet av flere POI-er", () => {
    const cfg = deriveCategoryCamera(home, [
      { lat: 63.42, lng: 10.4 },
      { lat: 63.44, lng: 10.42 },
    ])!;
    // tyngdepunkt = (63.43, 10.41); midt mot hjem (63.435,10.398) ≈ (63.4325, 10.404)
    expect(cfg.a.lat).toBeCloseTo(63.4325, 3);
    expect(cfg.a.lng).toBeCloseTo(10.404, 3);
  });
});

describe("computeSpreadRadiusM", () => {
  it("faller tilbake til 800 m uten POI-er", () => {
    expect(computeSpreadRadiusM(home, [])).toBe(800);
  });

  it("klamper til minst 400 m for en tett klynge", () => {
    const tight = Array.from({ length: 10 }, (_, i) => ({
      lat: home.lat + i * 0.00005,
      lng: home.lng,
    }));
    expect(computeSpreadRadiusM(home, tight)).toBe(400);
  });

  it("klamper til maks 2500 m for ekstremt spredte punkter", () => {
    const wide = [{ lat: home.lat + 0.5, lng: home.lng + 0.5 }];
    expect(computeSpreadRadiusM(home, wide)).toBe(2500);
  });

  it("ignorerer uteliggere via persentil (85% som default)", () => {
    // 9 punkter ~500 m unna + én ekstrem utligger; 85-persentilen treffer ikke
    // utliggeren, så radiusen reflekterer klyngen, ikke den fjerne POI-en.
    const cluster = Array.from({ length: 9 }, () => ({
      lat: home.lat + 0.0045,
      lng: home.lng,
    }));
    const withOutlier = [...cluster, { lat: home.lat + 0.3, lng: home.lng }];
    const r = computeSpreadRadiusM(home, withOutlier);
    expect(r).toBeLessThan(1000);
  });
});

describe("orbitRangeForSpread", () => {
  it("holder ORBIT_RANGE-gulvet for tette nabolag", () => {
    expect(orbitRangeForSpread(400)).toBe(ORBIT_RANGE);
  });

  it("trekker ut (større range) for spredte forsteder", () => {
    expect(orbitRangeForSpread(1200)).toBeGreaterThan(ORBIT_RANGE);
  });

  it("klamper til maks 1600 m", () => {
    expect(orbitRangeForSpread(2500)).toBe(1600);
  });
});

describe("decideCameraIntent — skalert orbit-range", () => {
  it("bruker orbitRange i orbit-hero når satt", () => {
    const intent = decideCameraIntent({
      cameraMode: "auto",
      introActive: false,
      home,
      activePOI: null,
      activeCategoryId: null,
      categoryConfig: undefined,
      audioDurationMs: undefined,
      audioPaused: false,
      reducedMotion: false,
      orbitRange: 1400,
      prevIntent: null,
    });
    expect(intent.kind).toBe("orbit");
    if (intent.kind === "orbit") expect(intent.hero.range).toBe(1400);
  });

  it("faller tilbake til ORBIT_RANGE uten orbitRange", () => {
    const intent = decideCameraIntent({
      cameraMode: "auto",
      introActive: false,
      home,
      activePOI: null,
      activeCategoryId: null,
      categoryConfig: undefined,
      audioDurationMs: undefined,
      audioPaused: false,
      reducedMotion: false,
      prevIntent: null,
    });
    if (intent.kind === "orbit") expect(intent.hero.range).toBe(ORBIT_RANGE);
  });
});

describe("decideCameraIntent — autoOrbit:false (basic-tier hold)", () => {
  const idleAuto = {
    cameraMode: "auto" as const,
    introActive: false,
    home,
    activePOI: null,
    activeCategoryId: null,
    categoryConfig: undefined,
    audioDurationMs: undefined,
    audioPaused: false,
    reducedMotion: false,
    prevIntent: null,
  };

  it("idle holder kameraet (free) i stedet for å orbitere", () => {
    expect(decideCameraIntent({ ...idleAuto, autoOrbit: false }).kind).toBe("free");
  });

  it("orbiterer fortsatt når autoOrbit ikke er satt", () => {
    expect(decideCameraIntent(idleAuto).kind).toBe("orbit");
  });

  it("åpnet POI flyr fortsatt inn selv med autoOrbit:false", () => {
    const intent = decideCameraIntent({
      ...idleAuto,
      autoOrbit: false,
      activePOI: { lat: 63.42, lng: 10.41 },
    });
    expect(intent.kind).toBe("poi");
  });
});
