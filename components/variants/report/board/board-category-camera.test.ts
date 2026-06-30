import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  deriveCategoryCameraConfig,
  type CategoryCameraInput,
} from "./board-category-camera";
import { getCategoryCamera } from "./camera-tours";
import { deriveCategoryCamera } from "./board-3d-camera-director";

// Hjemmet brukt i de utledede testene (≈ Stasjonskvartalet, men irrelevant for
// forrangs-logikken — getCategoryCamera bryr seg ikke om home).
const HOME = { lat: 63.4305, lng: 10.395 };

const poi = (lat: number, lng: number) => ({ coordinates: { lat, lng } });

/** Bygg en minimal kategori-input. */
function cat(
  id: string,
  topRankedPois: CategoryCameraInput["topRankedPois"],
  pois: CategoryCameraInput["pois"],
): CategoryCameraInput {
  return { id, topRankedPois, pois };
}

describe("deriveCategoryCameraConfig — forrang (AC1)", () => {
  it("returnerer undefined når activeCategory mangler (null) — AC2 orbit uavbrutt", () => {
    expect(deriveCategoryCameraConfig(null, "stasjonskvartalet", HOME)).toBeUndefined();
  });

  it("returnerer undefined når activeCategory er undefined", () => {
    expect(
      deriveCategoryCameraConfig(undefined, "stasjonskvartalet", HOME),
    ).toBeUndefined();
  });

  it("eksplisitt autorert tur (getCategoryCamera) har FORRANG over utledning", () => {
    // 'transport' finnes i CAMERA_TOURS for stasjonskvartalet → eksplisitt vinner,
    // selv om topRankedPois ville gitt en (annen) utledet bue.
    const topRanked = [poi(63.45, 10.46), poi(63.46, 10.47)];
    const result = deriveCategoryCameraConfig(
      cat("transport", topRanked, [poi(63.2, 10.2)]),
      "stasjonskvartalet",
      HOME,
    );
    const explicit = getCategoryCamera("stasjonskvartalet", "transport");
    expect(explicit).toBeDefined();
    expect(result).toEqual(explicit);

    // Bevis at utledningen IKKE ble brukt (forrang, ikke sammenfall): den ville
    // gitt et annet resultat enn den eksplisitte turen.
    const derived = deriveCategoryCamera(
      HOME,
      topRanked.map((p) => p.coordinates),
    );
    expect(result).not.toEqual(derived);
  });

  it("uten eksplisitt tur: utleder fra topRankedPois (foretrukket anker-sett)", () => {
    const topRanked = [poi(63.45, 10.46)];
    const pois = [poi(63.2, 10.2), poi(63.25, 10.25)];
    const result = deriveCategoryCameraConfig(
      cat("barn-oppvekst", topRanked, pois),
      "ukjent-slug", // ingen eksplisitt tur → utledning
      HOME,
    );
    expect(result).toEqual(
      deriveCategoryCamera(
        HOME,
        topRanked.map((p) => p.coordinates),
      ) ?? undefined,
    );
    // ...og IKKE fra det (distanse-sorterte) pois-settet.
    expect(result).not.toEqual(
      deriveCategoryCamera(
        HOME,
        pois.map((p) => p.coordinates),
      ),
    );
  });

  it("uten eksplisitt tur og tom topRankedPois: faller tilbake til pois", () => {
    const pois = [poi(63.44, 10.44), poi(63.45, 10.45)];
    const result = deriveCategoryCameraConfig(
      cat("barn-oppvekst", [], pois),
      "ukjent-slug",
      HOME,
    );
    expect(result).toEqual(
      deriveCategoryCamera(
        HOME,
        pois.map((p) => p.coordinates),
      ) ?? undefined,
    );
  });

  it("uten eksplisitt tur og INGEN POI-er: undefined → graceful orbit-fallback", () => {
    expect(
      deriveCategoryCameraConfig(cat("barn-oppvekst", [], []), "ukjent-slug", HOME),
    ).toBeUndefined();
  });

  it("tom prosjekt-slug (\"\") → ingen eksplisitt tur, faller til utledning", () => {
    const topRanked = [poi(63.45, 10.46)];
    const result = deriveCategoryCameraConfig(
      cat("transport", topRanked, []),
      "",
      HOME,
    );
    expect(result).toEqual(
      deriveCategoryCamera(
        HOME,
        topRanked.map((p) => p.coordinates),
      ) ?? undefined,
    );
  });
});

// ── Kilde-invarianter (AC2 wiring + AC3 eierskaps-grense) ──────────────────────
// Les filene som tekst (process.cwd(), ikke import.meta.url — kaster under jsdom).
const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8");

const BOARDMAP3D = "components/variants/report/board/BoardMap3D.tsx";
const HELPER = "components/variants/report/board/board-category-camera.ts";

describe("kategori-tour-komposisjon — kilde-invarianter", () => {
  it("AC2: BoardMap3D mater categoryConfig inn i useBoard3DCamera", () => {
    const src = read(BOARDMAP3D);
    // categoryConfig avledes via den rene komposisjons-funksjonen ...
    expect(src).toMatch(
      /categoryConfig\s*=\s*useMemo[\s\S]*?deriveCategoryCameraConfig\(/,
    );
    // ... og mates til kamera-directoren.
    expect(src).toMatch(/useBoard3DCamera\(\{[\s\S]*?categoryConfig,[\s\S]*?\}\)/);
  });

  it("AC3: BoardMap3D re-hjemler ikke mekanismen/DATAen (konsumerer kun via helper)", () => {
    const src = read(BOARDMAP3D);
    // Konsumpsjonen skjer i helperen, ikke ved direkte import i skall-komponenten.
    expect(src).toContain('from "./board-category-camera"');
    expect(src).not.toMatch(/import\s*\{[^}]*\bgetCategoryCamera\b[^}]*\}\s*from/);
    expect(src).not.toMatch(/import\s*\{[^}]*\bderiveCategoryCamera\b[^}]*\}\s*from/);
  });

  it("AC3: helperen KONSUMERER PRD 6-mekanismen + PRD 9-DATAen (re-hjemler ingen)", () => {
    const src = read(HELPER);
    // PRD 6-mekanisme (deriveCategoryCamera) importeres fra directoren, ikke redefineres.
    expect(src).toMatch(
      /import\s*\{\s*deriveCategoryCamera\s*\}\s*from\s*"\.\/board-3d-camera-director"/,
    );
    // PRD 9-DATA (getCategoryCamera) importeres fra camera-tours, ikke redefineres.
    expect(src).toMatch(
      /import\s*\{\s*getCategoryCamera\s*\}\s*from\s*"\.\/camera-tours"/,
    );
    expect(src).not.toContain("function deriveCategoryCamera(");
    expect(src).not.toContain("function getCategoryCamera(");
  });
});
