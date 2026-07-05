import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * PRD 7 Unit 7 (r07.7) kildekontrakt-guard for kuraterings-orkestratoren.
 *
 * `curate-narrative.ts` er en verbatim-portet build-time CLI (samme mønster som
 * søsteren `gemini-grounding.ts` / r07.3). tsc + lint fanger typene og import-
 * stiene, men IKKE de fem AC-invariantene under — de låses her som regresjonsvern
 * (jf. import-pois.contract.test.ts og r07.6 AC-invariant-låsing). Vi leser kilden
 * som tekst i stedet for å importere modulen, fordi top-level CLI-koden kaller
 * `process.exit()` på manglende argv.
 */

const DIR = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(DIR, "curate-narrative.ts"), "utf8");

describe("curate-narrative AC1 — prepare→skill→apply build-time-dans", () => {
  it("prepare saniterer Gemini-narrativet via sanitizeGeminiInput (Unit 6)", () => {
    expect(src).toMatch(/sanitizeGeminiInput\(grounding\.narrative\)/);
    expect(src).toContain('from "../lib/curation/sanitize-input"');
  });

  it("prepare skriver .context.json per tema og rydder gammel .curated.md", () => {
    expect(src).toMatch(/`\$\{themeId\}\.context\.json`/);
    expect(src).toMatch(/`\$\{themeId\}\.curated\.md`/);
    // fresh state: gammel curated.md slettes ved ny prepare
    expect(src).toMatch(/fs\.unlinkSync\(cp\)/);
  });

  it("apply kjører validateCuratedNarrative (Unit 6) + linkPoisInMarkdown (Unit 5)", () => {
    expect(src).toMatch(/validateCuratedNarrative\(\s*curatedRaw/);
    expect(src).toMatch(/linkPoisInMarkdown\(\s*curatedRaw/);
    expect(src).toContain('from "../lib/curation/validator"');
    expect(src).toContain('from "../lib/curation/poi-linker"');
  });
});

describe("curate-narrative AC2 — IKKE runtime-LLM (build-time skill-dans)", () => {
  it("importerer ikke @anthropic-ai/sdk (Claude kjøres via skill-mellomsteg)", () => {
    expect(src).not.toContain("@anthropic-ai/sdk");
    expect(src).not.toMatch(/new\s+Anthropic\(/);
  });

  it("dokumenterer den split prepare/apply-dansen med skill-utført mellomsteg", () => {
    // Flow-kommentaren (linje 5–13) beskriver at Claude IKKE kalles som API.
    expect(src).toMatch(/Claude kan ikke kalles som API/);
    expect(src).toMatch(/skill-utf(ø|o)rt mellomsteg/i);
  });
});

describe("curate-narrative AC3 — idempotens (skip hvis curatedAt >= fetchedAt)", () => {
  it("hopper over kuratert tema med mindre --force", () => {
    expect(src).toMatch(/const FORCE = args\.includes\("--force"\)/);
    expect(src).toMatch(
      /!FORCE[\s\S]*?groundingVersion === 2[\s\S]*?new Date\(grounding\.curatedAt\) >= new Date\(grounding\.fetchedAt\)/,
    );
  });
});

describe("curate-narrative AC4 — PATCH: v2-bump + optimistic lock + revalidate", () => {
  it("hever grounding til groundingVersion: 2 med v2-feltene", () => {
    expect(src).toMatch(/curatedNarrative: outcome\.curatedNarrative/);
    expect(src).toMatch(/curatedAt: now/);
    expect(src).toMatch(/poiLinksUsed: outcome\.poiLinksUsed/);
    expect(src).toMatch(/groundingVersion: 2/);
  });

  it("PATCH-er med updated_at=eq optimistic lock", () => {
    // Låsen bor nå i den delte modulen (eksekverings-testet i
    // lib/pipeline/patch-product-config.test.ts); scriptet sender lest verdi.
    expect(src).toMatch(/patchThenRevalidate\(/);
    expect(src).toMatch(/updatedAt: product\.updated_at/);
  });

  it("0-rad PATCH → abort (ingen stille suksess ved concurrent write)", () => {
    expect(src).toMatch(/patchResult\.reason === "http"/);
    expect(src).toMatch(/0 rader[\s\S]*?concurrent write/);
  });

  it("revaliderer product:${projectId}-taggen etter write", () => {
    expect(src).toMatch(/`product:\$\{projectId\}`/);
    expect(src).toMatch(/\/api\/revalidate\?tag=/);
  });

  it("tar backup FØR final PATCH (verner prod-config-IP)", () => {
    expect(src).toMatch(/Backup FØR noen mutations/);
    expect(src).toMatch(/fs\.writeFileSync\(backupPath/);
  });
});

describe("curate-narrative AC5 — v1 og v2 coexister per tema", () => {
  it("per-tema version-bump: tema uten suksess returneres uendret (beholder v1)", () => {
    // themes.map: bare tema med vellykket outcome heves; resten passerer uberørt.
    expect(src).toMatch(/themes\.map\(\(t\) =>/);
    expect(src).toMatch(/if \(!outcome \|\| !t\.grounding\) return t;/);
  });

  it("aborterer uten write hvis 0 temaer lyktes (beholder all v1)", () => {
    expect(src).toMatch(/successCount === 0/);
    expect(src).toMatch(/Ingen write/);
  });
});
