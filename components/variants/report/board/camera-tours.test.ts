import { describe, it, expect } from "vitest";
import { clampPose, getCameraTour, getCategoryCamera } from "./camera-tours";
import type { CameraPose } from "@/lib/types";

const pose = (overrides: Partial<CameraPose> = {}): CameraPose => ({
  lat: 63.43,
  lng: 10.39,
  range: 500,
  tilt: 60,
  heading: 200,
  ...overrides,
});

describe("clampPose", () => {
  it("slipper gyldige verdier gjennom uendret", () => {
    const p = pose();
    expect(clampPose(p)).toEqual(p);
  });

  it("klamper tilt til 0–90", () => {
    expect(clampPose(pose({ tilt: 120 })).tilt).toBe(90);
    expect(clampPose(pose({ tilt: -10 })).tilt).toBe(0);
  });

  it("normaliserer heading til [0,360)", () => {
    expect(clampPose(pose({ heading: 400 })).heading).toBe(40);
    expect(clampPose(pose({ heading: -90 })).heading).toBe(270);
    expect(clampPose(pose({ heading: 360 })).heading).toBe(0);
  });

  it("klamper range til minst 1 m", () => {
    expect(clampPose(pose({ range: -50 })).range).toBe(1);
    expect(clampPose(pose({ range: 0 })).range).toBe(1);
  });

  it("lar lat/lng være urørt", () => {
    const p = clampPose(pose({ lat: 12.34, lng: -56.78 }));
    expect(p.lat).toBe(12.34);
    expect(p.lng).toBe(-56.78);
  });
});

describe("getCameraTour", () => {
  it("returnerer undefined for ukjent slug", () => {
    expect(getCameraTour("ukjent-prosjekt")).toBeUndefined();
  });

  it("returnerer et (muligens tomt) objekt for kjent slug", () => {
    expect(getCameraTour("stasjonskvartalet")).toBeDefined();
  });
});

describe("getCategoryCamera", () => {
  it("returnerer undefined for ukjent slug", () => {
    expect(getCategoryCamera("ukjent", "mat-drikke")).toBeUndefined();
  });

  it("returnerer undefined for ukjent kategori i kjent prosjekt", () => {
    expect(getCategoryCamera("stasjonskvartalet", "finnes-ikke")).toBeUndefined();
  });

  it("Grilstad (byggetrinn-4) har A→B-poser for signatur-kategoriene", () => {
    for (const cat of ["natur-friluftsliv", "marina-batliv"]) {
      const cam = getCategoryCamera("byggetrinn-4", cat);
      expect(cam, cat).toBeDefined();
      expect(cam!.b, `${cat} mangler B-pose (A→B-kino)`).toBeDefined();
    }
  });

  it("Grilstad-poser klampes gyldig (tilt 0–90, heading 0–360, range ≥1)", () => {
    const cam = getCategoryCamera("byggetrinn-4", "marina-batliv")!;
    for (const pose of [cam.a, cam.b!]) {
      expect(pose.tilt).toBeGreaterThanOrEqual(0);
      expect(pose.tilt).toBeLessThanOrEqual(90);
      expect(pose.heading).toBeGreaterThanOrEqual(0);
      expect(pose.heading).toBeLessThan(360);
      expect(pose.range).toBeGreaterThanOrEqual(1);
    }
  });
});
