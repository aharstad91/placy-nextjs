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

/** Alle kilde-.ts i lib/google-places (ekskl. test-filer). */
function sourceFiles(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => join(DIR, f));
}

describe("AC5 (a): GOOGLE_PLACES_API_KEY ALDRI i URL-querystring (lib/google-places/**)", () => {
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
    // fetch-place-details + photo-api treffer Google API direkte → må bruke header.
    for (const name of ["fetch-place-details.ts", "photo-api.ts"]) {
      const src = readFileSync(join(DIR, name), "utf8");
      expect(src, `${name} mangler header-auth`).toContain("X-Goog-Api-Key");
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
