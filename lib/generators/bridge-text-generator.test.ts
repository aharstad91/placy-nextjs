import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateBridgeText } from "./bridge-text-generator";
import type { POI, Coordinates } from "@/lib/types";

// PRD 5 Unit 5 (r05.5): bridge-text-generator is a template-based, build-time
// port — NO LLM. It produces S&J-style bridge text from actual POI names +
// estimated distances. Owned here, but called from PRD 3's production path
// (report-data.ts:584, `themeDef.bridgeText || generateBridgeText(...)`).
// These tests lock the verbatim-port contract: undefined-guards, determinism,
// the excludePOIIds (hero-card) contract, and source purity.

const CENTER: Coordinates = { lat: 63.43, lng: 10.39 };

function poi(id: string, name: string, catId: string, lat = 63.431, lng = 10.391): POI {
  return {
    id,
    name,
    coordinates: { lat, lng },
    category: { id: catId, name: catId, icon: "MapPin", color: "#000000" },
  };
}

describe("generateBridgeText — undefined guards", () => {
  it("returns undefined for an unknown theme-id (missing generator)", () => {
    expect(
      generateBridgeText("does-not-exist", [poi("p1", "Stadsparken", "natur")], CENTER),
    ).toBeUndefined();
  });

  it("returns undefined for an empty POI list even with a valid theme-id", () => {
    expect(generateBridgeText("natur-friluftsliv", [], CENTER)).toBeUndefined();
  });
});

describe("generateBridgeText — named, template-based output", () => {
  it("names actual POIs for a known theme (no generic placeholder)", () => {
    const text = generateBridgeText(
      "natur-friluftsliv",
      [poi("p1", "Stadsparken", "park"), poi("p2", "Marinen", "park")],
      CENTER,
    );
    expect(text).toBeTruthy();
    expect(text).toContain("Stadsparken");
    expect(text).toContain("Marinen");
  });

  it("is deterministic — identical input yields identical output", () => {
    const pois = [poi("p1", "Stadsparken", "park"), poi("p2", "Marinen", "park")];
    const a = generateBridgeText("natur-friluftsliv", pois, CENTER);
    const b = generateBridgeText("natur-friluftsliv", pois, CENTER);
    expect(a).toBe(b);
  });
});

describe("generateBridgeText — excludePOIIds (hero-card) contract", () => {
  it("never names a POI already shown in the hero insight card", () => {
    const pois = [poi("hero", "Stadsparken", "park"), poi("p2", "Marinen", "park")];
    const text = generateBridgeText(
      "natur-friluftsliv",
      pois,
      CENTER,
      new Set(["hero"]),
    );
    expect(text).toBeTruthy();
    expect(text).not.toContain("Stadsparken");
    expect(text).toContain("Marinen");
  });
});

describe("source purity (template-based, build-time only)", () => {
  it("contains no network/env/LLM access", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/generators/bridge-text-generator.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/process\.env/);
    expect(src).not.toMatch(/\b(anthropic|gemini|openai)\b/i);
  });

  it("keeps the GENERATORS map module-private (declared, never exported)", () => {
    const src = readFileSync(
      join(process.cwd(), "lib/generators/bridge-text-generator.ts"),
      "utf8",
    );
    expect(src).toMatch(/^const GENERATORS\b/m);
    expect(src).not.toMatch(/export\s+(const|default)?\s*GENERATORS\b/);
  });
});

describe("generateBridgeText — «i gangavstand» står bare én gang", () => {
  // Regresjon (Wesselsløkka, 2026-09-01): hverdagsliv-templaten interpolerte
  // `prox()` OG hadde «i gangavstand» som fast ledd på slutten. Under tre
  // minutter returnerer `prox()` nettopp den frasen, så setningen ble «SUMART
  // Dagligvare og Bunnpris Angelltrøa i gangavstand gir godt utvalg i
  // gangavstand». Kollisjonen traff bare boards der nærmeste butikk lå tettest
  // på — altså den beste geometrien fikk den dårligste setningen.
  it("dobler ikke frasen når nærmeste butikk ligger under tre minutter", () => {
    const text = generateBridgeText(
      "hverdagsliv",
      [
        // ~120 m fra CENTER → prox() gir «i gangavstand»
        poi("s1", "SUMART Dagligvare", "supermarket", 63.4309, 10.3912),
        poi("s2", "Bunnpris Angelltrøa", "supermarket", 63.4318, 10.3925),
      ],
      CENTER,
    );
    expect(text).toBeDefined();
    expect(text!).toContain("i gangavstand");
    expect(text!.match(/i gangavstand/g)).toHaveLength(1);
  });

  it("beholder minutt-formen når butikken ligger lenger unna", () => {
    const text = generateBridgeText(
      "hverdagsliv",
      [
        poi("s1", "Coop Mega", "supermarket", 63.4385, 10.3985),
        poi("s2", "Bunnpris", "supermarket", 63.4390, 10.3990),
      ],
      CENTER,
    );
    expect(text).toBeDefined();
    expect(text!).toMatch(/minutters gange/);
    expect(text!).not.toContain("i gangavstand");
  });
});

describe("generateBridgeText — «i gangavstand» teller bare det som er det", () => {
  // Regresjon (Wesselsløkka, 2026-09-01): barn-oppvekst brukte HELE
  // barnehage-importen innenfor discovery-radien (3 km) som tall for «i
  // gangavstand». Boardet skrev «med 64 barnehager i gangavstand».
  it("teller bare barnehagene innenfor gangavstand, ikke hele importen", () => {
    const naere = [1, 2, 3].map((n) =>
      poi(`b${n}`, `Nær barnehage ${n}`, "barnehage", 63.4305, 10.3905),
    );
    // ~7 km unna — innenfor en romslig discovery-radius, langt utenfor gange
    const fjerne = [1, 2, 3, 4, 5].map((n) =>
      poi(`f${n}`, `Fjern barnehage ${n}`, "barnehage", 63.49, 10.45),
    );
    const text = generateBridgeText(
      "barn-oppvekst",
      [...naere, ...fjerne, poi("l1", "Lekeplassen", "lekeplass", 63.4306, 10.3906)],
      CENTER,
    );
    expect(text).toBeDefined();
    expect(text!).toContain("3 barnehager i gangavstand");
    expect(text!).not.toContain("8 barnehager");
  });
});
