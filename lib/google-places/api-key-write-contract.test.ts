import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * PRD 4 Unit 7 AC5 — to EKSPLISITTE, verifiserbare assertions som lint IKKE
 * fanger (`eslint.config.mjs` har kun `no-restricted-imports` på
 * `@supabase/supabase-js`; den ser verken `key=`-querystring eller rå-REST).
 * «Grønn lint» beviser derfor IKKE disse to reglene — denne testen gjør det.
 */

const DIR = dirname(fileURLToPath(import.meta.url));

// Audit-lærdom 2026-07-05: testen skannet KUN sin egen mappe mens et reelt
// `&key=${apiKey}`-brudd lå i lib/pipeline/poi-discovery.ts — grønn test ga
// falsk trygghet. Skann derfor ALLE mapper som gjør Google-API-kall.
const SCANNED_DIRS = [DIR, join(DIR, "..", "pipeline")];

/** Alle kilde-.ts i de skannede mappene (ekskl. test-filer). */
function sourceFiles(): string[] {
  return SCANNED_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f) => join(dir, f)),
  );
}

describe("AC5 (a): GOOGLE_PLACES_API_KEY ALDRI i URL-querystring (lib/google-places/** + lib/pipeline/**)", () => {
  it("ingen kildefil interpolerer nøkkelen inn i en ?key=/&key=-querystring", () => {
    for (const file of sourceFiles()) {
      const src = readFileSync(file, "utf8");
      // Den farlige legacy-formen var `...&key=${apiKey}` mot maps.googleapis.com.
      // Treffer querystring-key med interpolasjon eller streng-konkat — ikke
      // backtick-omsluttede kommentarer (`key=`), som ikke har ? eller & foran.
      expect(src, `${file} har key i querystring`).not.toMatch(/[?&]key=\$\{/);
      expect(src, `${file} har key i querystring`).not.toMatch(/[?&]key=["'+]/);
    }
  });

  it("Google-API-kallende filer bruker X-Goog-Api-Key header-auth", () => {
    // Filer som treffer Google API direkte → må bruke header.
    const headerAuthFiles = [
      join(DIR, "fetch-place-details.ts"),
      join(DIR, "photo-api.ts"),
      join(DIR, "..", "pipeline", "poi-discovery.ts"),
    ];
    for (const file of headerAuthFiles) {
      const src = readFileSync(file, "utf8");
      expect(src, `${file} mangler header-auth`).toContain("X-Goog-Api-Key");
    }
  });
});

describe("AC5 (b): enrichment-skriving går via godkjent path (wrapper)", () => {
  it("trust-enrichment.ts skriver via @/lib/supabase-wrapperen, ikke rå REST", () => {
    const src = readFileSync(join(DIR, "trust-enrichment.ts"), "utf8");
    // Godkjent path: createServerClient-instans (.from(...).update(...)).
    expect(src).toMatch(/\.from\(["']pois["']\)/);
    expect(src).toMatch(/\.update\(/);
    // Ikke rå REST-skriving med service-role i header (det er foto-pathens
    // dokumenterte unntak, Unit 4 — IKKE enrichment-pathen).
    expect(src).not.toContain("/rest/v1/");
  });
});
