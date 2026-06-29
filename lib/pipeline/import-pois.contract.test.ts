import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * PRD 3 Unit 3 (r03.3) kildekontrakt-guard. tsc fanger v2-typene, men ikke
 * disse to arkitektur-reglene — låses som regresjonsvern (jf. r04.7 AC5-guard).
 */

const DIR = dirname(fileURLToPath(import.meta.url));
const importPois = readFileSync(join(DIR, "import-pois.ts"), "utf8");
const enrichPois = readFileSync(join(DIR, "enrich-report-pois.ts"), "utf8");

describe("import-pois v2-skrivesti (AC8)", () => {
  it("targeter v2-schemaet (.schema('v2'))", () => {
    expect(importPois).toContain('.schema("v2")');
  });

  it("sender schema:'v2' til de delte mutations (wrapper-eierskap bevart)", () => {
    expect(importPois).toMatch(/upsertCategories\([^)]*\{\s*schema:\s*"v2"\s*\}/);
    expect(importPois).toMatch(/upsertPOIsWithEditorialPreservation\([\s\S]*?schema:\s*"v2"/);
  });

  it("importerer discovery fra lib/pipeline/, ikke lib/generators/", () => {
    expect(importPois).toContain('from "./poi-discovery"');
    expect(importPois).not.toContain("lib/generators/poi-discovery");
  });
});

describe("cache-isolasjon (AC2): ingen revalidatePath-kobling", () => {
  // Sjekker faktiske kode-former (import + kall), ikke prosa-kommentarer som
  // forklarer HVORFOR revalidatePath ble fjernet.
  it("import-pois importerer ikke next/cache og kaller ikke revalidatePath()", () => {
    expect(importPois).not.toMatch(/from\s+["']next\/cache["']/);
    expect(importPois).not.toMatch(/revalidatePath\(/);
  });

  it("enrich-report-pois importerer ikke next/cache og kaller ikke revalidatePath()", () => {
    // (Svelge-fraværet bevises også behaviorelt i enrich-report-pois.test.ts.)
    expect(enrichPois).not.toMatch(/from\s+["']next\/cache["']/);
    expect(enrichPois).not.toMatch(/revalidatePath\(/);
  });
});
