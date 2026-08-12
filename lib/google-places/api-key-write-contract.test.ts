import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

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
//
// SAMME LÆRDOM IGJEN, 2026-08-12: `scripts/` var heller ikke skannet, og der lå
// `refresh-opening-hours.ts` med nøkkelen i querystringen mot legacy
// Place-Details-endepunktet. Denne testen var grønn hele tiden. `scripts/` er nå
// med, rekursivt.
const REPO_ROOT = join(DIR, "..", "..");
const SCANNED_DIRS = [DIR, join(DIR, "..", "pipeline"), join(REPO_ROOT, "scripts")];

/**
 * KJENT GJELD, bevisst tillatt — men låst til nøyaktig disse filene.
 *
 * Alle tre legger en GEMINI/Imagen/Veo-nøkkel i querystringen, altså samme
 * CLAUDE.md-brudd, men mot et annet API enn Places. De ble funnet da `scripts/`
 * ble tatt inn i skannet 2026-08-12 (PRD Unit 4), og migrering av
 * generativelanguage-stien er egen jobb — den deler ingen klient med
 * Places-stien og hører ikke i en Places-fakta-backfill.
 *
 * Poenget med en eksplisitt liste framfor å utelate mappa: enhver NY fil, og
 * enhver Places-fil, feiler umiddelbart. Gjelden er synlig i stedet for usett.
 * Fjern oppføringene når generativelanguage-kallene migreres til
 * `x-goog-api-key`-header.
 */
const KNOWN_QUERYSTRING_KEY_DEBT = new Set([
  "scripts/animate-scene-veo.ts",
  "scripts/generate-image-imagen.ts",
  "scripts/poc-gemini-grounding.mjs",
]);

/** Alle kilde-.ts/.mjs i de skannede mappene, rekursivt (ekskl. test-filer). */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (
        (full.endsWith(".ts") || full.endsWith(".mjs")) &&
        !full.endsWith(".test.ts") &&
        !full.endsWith(".test.mjs")
      ) {
        out.push(full);
      }
    }
  };
  for (const dir of SCANNED_DIRS) walk(dir);
  return out;
}

describe("AC5 (a): API-nøkkel ALDRI i URL-querystring (lib/google-places/** + lib/pipeline/** + scripts/**)", () => {
  it("ingen kildefil interpolerer nøkkelen inn i en ?key=/&key=-querystring", () => {
    for (const file of sourceFiles()) {
      const rel = relative(REPO_ROOT, file).split("\\").join("/");
      if (KNOWN_QUERYSTRING_KEY_DEBT.has(rel)) continue;

      const src = readFileSync(file, "utf8");
      // Den farlige legacy-formen var `...&key=${apiKey}` mot maps.googleapis.com.
      // Treffer querystring-key med interpolasjon eller streng-konkat — ikke
      // backtick-omsluttede kommentarer (`key=`), som ikke har ? eller & foran.
      expect(src, `${rel} har key i querystring`).not.toMatch(/[?&]key=\$\{/);
      expect(src, `${rel} har key i querystring`).not.toMatch(/[?&]key=["'+]/);
    }
  });

  it("gjeld-listen er ikke råtnet — hver oppføring finnes og har fortsatt bruddet", () => {
    // En allowlist som peker på filer som ikke finnes lenger, eller som er
    // ryddet, skjuler at vernet er svakere enn det ser ut. Da skal oppføringen
    // fjernes, og denne testen sier fra.
    const scanned = new Set(
      sourceFiles().map((f) => relative(REPO_ROOT, f).split("\\").join("/")),
    );
    for (const rel of KNOWN_QUERYSTRING_KEY_DEBT) {
      expect(scanned.has(rel), `${rel} er ikke lenger skannet — fjern fra gjeld-listen`).toBe(true);
      const src = readFileSync(join(REPO_ROOT, rel), "utf8");
      expect(
        /[?&]key=\$\{/.test(src) || /[?&]key=["'+]/.test(src),
        `${rel} er ryddet — fjern fra gjeld-listen`,
      ).toBe(true);
    }
  });

  it("refresh-opening-hours.ts går via Places-New-klienten, ikke legacy-endepunktet", () => {
    // Det konkrete bruddet denne uniten lukket. Legacy-verten skal ikke lenger
    // finnes som kall — kun som forklaring i doc-kommentaren.
    const src = readFileSync(join(REPO_ROOT, "scripts/refresh-opening-hours.ts"), "utf8");
    expect(src).not.toMatch(/fetch\([^)]*maps\.googleapis\.com/);
    expect(src).toContain("places-backfill-lib");
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
