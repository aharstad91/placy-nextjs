import { describe, it, expect } from "vitest";
import {
  decideCameraIntent,
  bearingBetween,
  ORBIT_RANGE,
  POI_RANGE,
  DEFAULT_CINEMATIC_MS,
  type CameraDecisionInputs,
  type CameraIntent,
} from "./board-3d-camera-director";
import type { CategoryCameraConfig } from "@/lib/types";

const home = { lat: 63.435, lng: 10.398 };

const baseInput = (
  overrides: Partial<CameraDecisionInputs> = {},
): CameraDecisionInputs => ({
  cameraMode: "auto",
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
