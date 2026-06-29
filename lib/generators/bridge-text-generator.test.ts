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
