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

describe("getCameraTour (DATA-accessor — rå record)", () => {
  it("returnerer undefined for ukjent slug", () => {
    expect(getCameraTour("ukjent-prosjekt")).toBeUndefined();
  });

  it("returnerer et (muligens tomt) objekt for kjent slug", () => {
    expect(getCameraTour("stasjonskvartalet")).toBeDefined();
  });

  // AC1/demo-data-integritet: live-demo-boardet (stasjonskvartalet, has_3d_addon)
  // har en autorert `transport`-tur — vernet mot utilsiktet sletting av DATA.
  it("stasjonskvartalet har en autorert 'transport'-tur (live-demo-board)", () => {
    const tour = getCameraTour("stasjonskvartalet");
    expect(tour?.transport).toBeDefined();
    expect(tour!.transport.b, "transport mangler B-pose (A→B-kino)").toBeDefined();
  });

  // AC2: getCameraTour er DATA-accessoren — den returnerer den RÅ recorden uten
  // å klampe. getCategoryCamera (mekanisme-accessoren) klamper. Lås distinksjonen
  // ved å bevise at getCameraTour ikke normaliserer headingen til [0,360).
  it("returnerer RÅ poser (klamper IKKE — i motsetning til getCategoryCamera)", () => {
    const raw = getCameraTour("byggetrinn-4")!["marina-batliv"];
    expect(raw.a.heading).toBe(340); // urørt rå-verdi
    // getCategoryCamera ville klampet en out-of-range heading; her er rå == klampet
    // fordi DATA-en allerede er gyldig, men accessoren har ulik kontrakt.
    expect(raw.moveDurationMs).toBe(9000);
  });
});

describe("getCategoryCamera (mekanisme-accessor — klampet kopi)", () => {
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

  // AC2: mekanisme-accessoren returnerer NYE (klampede) pose-objekter, ikke
  // referansen til den rå DATA-recorden — så orkestreringen i BoardMap3D aldri
  // muterer kilden. Bevises ved referanse-ulikhet mot getCameraTour-recorden.
  it("returnerer klampede KOPIER (ikke samme referanse som rå DATA)", () => {
    const raw = getCameraTour("byggetrinn-4")!["marina-batliv"];
    const cam = getCategoryCamera("byggetrinn-4", "marina-batliv")!;
    expect(cam).not.toBe(raw);
    expect(cam.a).not.toBe(raw.a);
    expect(cam.b).not.toBe(raw.b);
    // verdi-paritet bevart for allerede-gyldig DATA
    expect(cam.a).toEqual(raw.a);
  });

  // AC1: moveDurationMs slippes uendret gjennom accessoren (audio-uavhengig
  // override-akse — eies ikke av klampen).
  it("bevarer moveDurationMs gjennom accessoren", () => {
    const cam = getCategoryCamera("byggetrinn-4", "marina-batliv")!;
    expect(cam.moveDurationMs).toBe(9000);
  });
});
