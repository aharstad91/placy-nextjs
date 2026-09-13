import { describe, expect, it } from "vitest";
import { nyhavnaKnowledge } from "@/lib/demo/nyhavna-leve/knowledge";
import {
  nyhavnaSiteKnowledge,
  searchSiteKnowledge,
  siteKnowledgeForTheme,
} from "@/lib/demo/nyhavna-leve/site-knowledge";

const { entries, sources, coverage } = nyhavnaSiteKnowledge;

/** Board-kategoriene demoen kan feste en post til, pluss områdenivået. */
const ALLOWED_THEMES = [
  "leve-servering",
  "leve-park",
  "leve-kultur",
  "hverdagsliv",
  "barn-oppvekst",
  "mat-drikke",
  "natur-friluftsliv",
  "transport",
  "trening-aktivitet",
  "opplevelser",
  "nyhavna",
] as const;

/** Markørene som allerede finnes i demoen. Nye markører skal aldri oppstå her. */
const ALLOWED_MAP_POI_IDS = [
  "leve-dora-kaffebar",
  "leve-monkey-brew",
  "leve-elvepromenaden",
  "leve-kulturaksen",
  "leve-fyringsbunkeren",
  "leve-dora2",
  "leve-bunkerparken",
] as const;

const ALLOWED_ENTITY_IDS = new Set<string>([
  ...nyhavnaKnowledge.entities.map((entity) => entity.id),
  "nyhavna",
]);

describe("Nyhavna site knowledge", () => {
  it("har unike ider med site-prefiks", () => {
    const ids = entries.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^site-[a-z0-9-]+$/);
    }
  });

  it("bruker bare tillatte board-kategorier", () => {
    for (const entry of entries) {
      expect(entry.themes.length).toBeGreaterThan(0);
      for (const theme of entry.themes) {
        expect(ALLOWED_THEMES).toContain(theme);
      }
      expect(new Set(entry.themes).size).toBe(entry.themes.length);
    }
  });

  it("peker på en registrert kilde med https-url og kontrolldato", () => {
    const byId = new Map(sources.map((s) => [s.id, s]));
    expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);

    for (const source of sources) {
      expect(source.label).toBe("nyhavna.no");
      expect(source.url.startsWith("https://nyhavna.no")).toBe(true);
      expect(source.checkedAt).toBe(nyhavnaSiteKnowledge.checkedAt);
      expect(source.page.length).toBeGreaterThan(0);
    }

    for (const entry of entries) {
      expect(byId.has(entry.sourceId)).toBe(true);
    }
  });

  it("refererer bare til entiteter og markører som finnes fra før", () => {
    for (const entry of entries) {
      for (const entityId of entry.relatedEntityIds ?? []) {
        expect(ALLOWED_ENTITY_IDS.has(entityId)).toBe(true);
      }
      for (const poiId of entry.mapPoiIds ?? []) {
        expect(ALLOWED_MAP_POI_IDS).toContain(poiId);
      }
    }
  });

  it("holder tekstene innenfor 40 til 400 tegn", () => {
    for (const entry of entries) {
      expect(entry.text.length).toBeGreaterThanOrEqual(40);
      expect(entry.text.length).toBeLessThanOrEqual(400);
      expect(entry.keywords.length).toBeGreaterThan(0);
      for (const keyword of entry.keywords) {
        expect(keyword).toBe(keyword.toLocaleLowerCase("nb"));
      }
    }
  });

  it("skriver ikke planspråk i poster merket som eksisterende", () => {
    // Leksikalsk sjekk, ikke semantisk: den fanger ordene «planlagt» og «skal»,
    // ikke alle måter en framtidspåstand kan formuleres på. Poster med
    // framtidsinnhold skal derfor merkes planned, adopted-plan, vision eller
    // unresolved, som denne sjekken bevisst lar stå urørt.
    const futureWords = /\b(planlagt|skal)\b/i;
    for (const entry of entries.filter((e) => e.status === "existing")) {
      expect(futureWords.test(entry.text), `${entry.id}: ${entry.text}`).toBe(false);
    }
  });

  it("returnerer aldri mer enn seks treff", () => {
    for (const limit of [1, 4, 6, 25]) {
      const hits = searchSiteKnowledge("nyhavna park kultur plan bolig", { limit });
      expect(hits.length).toBeLessThanOrEqual(6);
      expect(hits.length).toBeLessThanOrEqual(limit);
    }
    expect(searchSiteKnowledge("")).toEqual([]);
  });

  it("finner riktig post for fem vanlige spørsmål", () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ["hvem står bak Nyhavna", "site-eierskap"],
      ["hva er visjonen for Nyhavna", "site-visjon"],
      ["hvor mange boliger blir det", "site-transittkaia-innhold"],
      ["når er det ferdig", "site-utbyggingsperiode"],
      ["hva er Nyhavna", "site-hva-er-nyhavna"],
    ];

    for (const [query, expectedId] of cases) {
      const ids = searchSiteKnowledge(query).map((entry) => entry.id);
      expect(ids, `${query} -> ${ids.join(", ")}`).toContain(expectedId);
    }
  });

  it("er deterministisk og lar tematreff gå foran", () => {
    const first = searchSiteKnowledge("park ved vannet");
    const second = searchSiteKnowledge("park ved vannet");
    expect(first.map((e) => e.id)).toEqual(second.map((e) => e.id));

    const themed = searchSiteKnowledge("barnehage og lek", {
      themes: ["barn-oppvekst"],
      limit: 6,
    });
    expect(themed.length).toBeGreaterThan(0);
    expect(themed[0].themes).toContain("barn-oppvekst");

    const firstMiss = themed.findIndex((entry) => !entry.themes.includes("barn-oppvekst"));
    if (firstMiss !== -1) {
      const laterHit = themed
        .slice(firstMiss)
        .some((entry) => entry.themes.includes("barn-oppvekst"));
      expect(laterHit).toBe(false);
    }
  });

  it("gir treff per board-kategori", () => {
    expect(siteKnowledgeForTheme("nyhavna").length).toBeGreaterThan(0);
    expect(siteKnowledgeForTheme("nyhavna", 2)).toHaveLength(2);
    expect(siteKnowledgeForTheme("nyhavna", 0)).toEqual([]);

    for (const theme of ALLOWED_THEMES) {
      const hits = siteKnowledgeForTheme(theme);
      for (const hit of hits) {
        expect(hit.themes).toContain(theme);
      }
    }
  });

  it("stemmer med dekningsoversikten", () => {
    const usedSources = new Set(entries.map((entry) => entry.sourceId));
    expect(usedSources.size).toBe(sources.length);
    expect(coverage.incorporated).toBeGreaterThanOrEqual(usedSources.size);
    expect(coverage.discovered).toBe(
      coverage.incorporated + coverage.excluded + 4, // 4 Leve-sider dekkes av knowledge.ts
    );
    expect(coverage.reviewed).toBe(coverage.discovered);
    expect(coverage.openGaps.length).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThanOrEqual(20);
    expect(entries.length).toBeLessThanOrEqual(60);
  });
});
