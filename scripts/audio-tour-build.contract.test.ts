import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * PRD 14 Unit 3 (r14.3) kildekontrakt-guard for de to tour-byggerne.
 *
 * `audio-tour-build.ts` (DB) og `audio-tour-build-local.ts` (lokal-JSON) er
 * port-with-rewrite build-time CLI-er. tsc + lint fanger typene og import-
 * stiene, men IKKE de seks AC-invariantene under — to-fase-mønsteret, den
 * optimistiske låsen, audioVersion=5-aksen på tvers av alle tre byggere,
 * reelsAudio-vernet og revalidate-taggen. Vi leser kilden som tekst i stedet
 * for å importere modulene, fordi top-level CLI-koden kaller `process.exit()`
 * på manglende argv (samme mønster som curate-narrative.contract.test.ts).
 */

const DIR = dirname(fileURLToPath(import.meta.url));
const buildSrc = readFileSync(join(DIR, "audio-tour-build.ts"), "utf8");
const patchModuleSrc = readFileSync(
  join(process.cwd(), "lib/pipeline/patch-product-config.ts"),
  "utf8",
);
const localSrc = readFileSync(join(DIR, "audio-tour-build-local.ts"), "utf8");
const manusSrc = readFileSync(join(DIR, "audio-manus-write.ts"), "utf8");

describe("r14.3 AC1 — to-fase: Phase 1 TTS parallelt in-memory + MIN_BYTES, abort før disk-write", () => {
  it("PARALLEL_LIMIT=2 (ElevenLabs free-plan-tak) i begge byggere", () => {
    expect(buildSrc).toMatch(/const PARALLEL_LIMIT = 2;/);
    expect(localSrc).toMatch(/const PARALLEL_LIMIT = 2;/);
  });

  it("MIN_BYTES-validering før noe skrives (empty/rate-limit-vern)", () => {
    expect(buildSrc).toMatch(/const MIN_BYTES = 5000;/);
    expect(localSrc).toMatch(/const MIN_BYTES = 5000;/);
    expect(buildSrc).toMatch(/bytes\.length < MIN_BYTES/);
    expect(localSrc).toMatch(/bytes\.length < MIN_BYTES/);
  });

  it("Phase 1 buffrer TTS i minne via Promise.allSettled + pLimit (ingen disk-write enda)", () => {
    expect(buildSrc).toMatch(/Promise\.allSettled\(/);
    expect(buildSrc).toMatch(/limit\(\(\) => ttsTrack\(t\)\)/);
  });

  it("feil i Phase 1 → exit non-zero, ingen disk-write, ingen PATCH", () => {
    expect(buildSrc).toMatch(/const errorCount = outcomes\.filter\(\(o\) => o\.status === "error"\)\.length;/);
    expect(buildSrc).toMatch(/Ingen disk-write, ingen PATCH/);
    expect(buildSrc).toMatch(/process\.exit\(2\)/);
    // lokal: failed>0 → JSON IKKE skrevet
    expect(localSrc).toMatch(/JSON IKKE skrevet/);
    expect(localSrc).toMatch(/process\.exit\(2\)/);
  });

  it("Phase 2 = batch disk-write + single PATCH (DB-byggeren)", () => {
    expect(buildSrc).toMatch(/Phase 2: disk-write \+ PATCH/);
  });
});

describe("r14.3 AC2 — optimistisk lås på updated_at (via delt modul, whp)", () => {
  // Selve låsen + 0-rad-atferden er EKSEKVERINGS-testet i
  // lib/pipeline/patch-product-config.test.ts. Her pinner vi kun at
  // scriptet konsumerer modulen med lest updated_at.
  it("scriptet sender lest updated_at inn i patchThenRevalidate", () => {
    expect(buildSrc).toMatch(/patchThenRevalidate\(/);
    expect(buildSrc).toMatch(/updatedAt: product\.updated_at/);
  });

  it("0-rad PATCH → concurrent-write-abort med re-kjør-instruks (ingen stille suksess)", () => {
    expect(patchModuleSrc).toMatch(/patched\.length === 0/);
    expect(buildSrc).toMatch(/concurrent write/);
    expect(buildSrc).toMatch(/Kj(ø|o)r scriptet p(å|a) nytt/i);
  });
});

describe("r14.3 AC3 — audioVersion=5 konsistent på tvers av alle tre byggere", () => {
  it("DB-byggeren skriver audioVersion: 5", () => {
    expect(buildSrc).toMatch(/audioVersion: 5,/);
  });

  it("lokal-byggeren skriver audioVersion = 5", () => {
    expect(localSrc).toMatch(/rc\.audioVersion = 5;/);
  });

  it("manus-write skriver audioVersion: 5", () => {
    expect(manusSrc).toMatch(/audioVersion: 5,/);
  });

  it("ingen stale audioVersion = 1 igjen i manus-write doc-comment", () => {
    expect(manusSrc).not.toMatch(/audioVersion = 1\b/);
    expect(manusSrc).not.toMatch(/audioVersion: 1\b/);
  });
});

describe("r14.3 AC4 — lokal-byggeren bygger KUN tour-spor, rører aldri reelsAudio", () => {
  it("reelsAudio finnes kun som «rører ikke»-kommentar, aldri som write", () => {
    const reelsHits = localSrc.match(/reelsAudio/g) ?? [];
    expect(reelsHits.length).toBe(1);
    expect(localSrc).toMatch(/reelsAudio r(ø|o)res ikke/);
    // ingen tilordning til reelsAudio
    expect(localSrc).not.toMatch(/reelsAudio\s*=/);
    expect(localSrc).not.toMatch(/\.reelsAudio\b\s*=/);
  });

  it("kun tour-spor pushes: welcome/home/themes/outro", () => {
    expect(localSrc).toMatch(/rc\.welcomeAudio/);
    expect(localSrc).toMatch(/rc\.heroAudio/);
    expect(localSrc).toMatch(/rc\.themes/);
    expect(localSrc).toMatch(/rc\.outroAudio/);
  });
});

describe("r14.3 AC5 — PATCH via rå fetch med service-role i header + bevart error-handling", () => {
  it("service-role-nøkkel i apikey + Authorization-header (ikke querystring)", () => {
    expect(buildSrc).toMatch(/apikey: SUPABASE_KEY!/);
    expect(buildSrc).toMatch(/Authorization: `Bearer \$\{SUPABASE_KEY\}`/);
    expect(buildSrc).not.toMatch(/apikey=\$\{SUPABASE_KEY\}/);
  });

  it("PATCH-feil (!ok) håndteres med eksplisitt exit, ikke stille svelg", () => {
    expect(patchModuleSrc).toMatch(/if \(!patchRes\.ok\)/);
    expect(buildSrc).toMatch(/if \(!patchResult\.ok\)/);
    expect(buildSrc).toMatch(/process\.exit\(1\)/);
  });
});

describe("r14.3 AC6 — revalidateTag(product:{customer}_{slug}) etter PATCH", () => {
  it("DB-byggeren revaliderer product:${projectId} (== product:{customer}_{slug} per PRD 7 K1)", () => {
    expect(buildSrc).toMatch(/revalidate: \(\) => revalidate\(`product:\$\{projectId\}`\)/);
    expect(buildSrc).toMatch(/\/api\/revalidate\?tag=/);
  });

  it("revalidate skjer ETTER vellykket PATCH (ikke før) — EKSEKVERINGS-testet", () => {
    // Sekvensen bevises med mock.invocationCallOrder i
    // lib/pipeline/patch-product-config.test.ts (auditens mutasjon fanges der).
    // Kilde-pinning her: scriptet går via patchThenRevalidate, aldri egen sekvens.
    expect(buildSrc).toMatch(/patchThenRevalidate\(/);
  });
});
