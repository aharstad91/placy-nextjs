import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSitePage, getSitePageByPath, getSitePages, sitePageHref } from "@/lib/demo/leangenbukta-site/pages";

/**
 * Dekningsregnskapet for Leangenbukta-kopien (R1, AE1) og rensingen av
 * fragmentene (R2/R3). Testen leser de samme filene som byggeskriptet skriver,
 * så en side som faller ut av inventaret, et fragment som mangler eller et
 * fragment med kjørbart innhold stopper testsuiten.
 */

const ROOT = process.cwd();
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/research/leangenbukta-nettside/manifest.json"), "utf8"));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/demo/leangenbukta-site/pages-config.json"), "utf8"));
const topics = JSON.parse(fs.readFileSync(path.join(ROOT, "data/demo/leangenbukta-lokal/topics.json"), "utf8")) as Array<{ id: string }>;
const fragment = (id: string) => fs.readFileSync(path.join(ROOT, "data/demo/leangenbukta-nettside/pages", `${id}.html`), "utf8");
const disposition = (entry: { id: string; disposition: string }) => config.dispositionOverrides[entry.id]?.disposition ?? entry.disposition;

describe("inventaret", () => {
  it("har en disposisjon for hver oppdaget URL", () => {
    expect(manifest.discoveredUrlCount).toBe(manifest.disposedUrlCount);
    for (const entry of manifest.entries) {
      expect(["local", "duplicate", "redirect", "external", "unavailable"]).toContain(disposition(entry));
    }
  });

  it("bygger hver lokal side, og bare dem", () => {
    const local = manifest.entries.filter((entry: { id: string; disposition: string }) => disposition(entry) === "local").map((entry: { id: string }) => entry.id).sort();
    expect(getSitePages().map((page) => page.id).sort()).toEqual(local);
  });

  it("lar hvert duplikat peke på en side som faktisk bygges", () => {
    for (const entry of manifest.entries.filter((e: { id: string; disposition: string }) => disposition(e) === "duplicate")) {
      const target = config.dispositionOverrides[entry.id]?.duplicateOf ?? entry.duplicateOf;
      const resolved = config.dispositionOverrides[target]?.disposition === "duplicate" ? config.dispositionOverrides[target].duplicateOf : target;
      expect(getSitePage(resolved), `${entry.id} → ${resolved}`).not.toBeNull();
    }
  });
});

describe("sideregisteret", () => {
  it("speiler kildens stier og slår opp begge veier", () => {
    const knutepunktet = getSitePage("knutepunktet")!;
    expect(knutepunktet.path).toBe("/knutepunktet");
    expect(getSitePageByPath("/knutepunktet")?.id).toBe("knutepunktet");
    expect(sitePageHref(knutepunktet)).toBe("/demo/leangenbukta-nettside/knutepunktet");
    expect(getSitePage("finnes-ikke")).toBeNull();
  });

  it("gir hver byggside et Placy-felt høyt og et gyldig boardtema når det finnes", () => {
    const buildings = getSitePages().filter((page) => page.kind === "building");
    expect(buildings.length).toBeGreaterThanOrEqual(12);
    for (const page of buildings) {
      expect(config.pages[page.id]?.placement, page.id).toBe("building");
      expect(fragment(page.id), page.id).toContain('data-placy-slot="building"');
      if (page.boardTopicId) expect(topics.some((topic) => topic.id === page.boardTopicId), page.boardTopicId).toBe(true);
      expect(page.chatStarters.length, page.id).toBeGreaterThan(0);
    }
  });

  it("gir ikke juridiske sider, arkiv eller kundeportal et Placy-felt", () => {
    for (const id of ["personvern", "retningslinjer-for-informasjonskapsler", "apenhetsloven", "aktuelt", "kundeportal", "salgsmateriell"]) {
      expect(fragment(id)).not.toContain("data-placy-slot");
    }
  });
});

describe("fragmentene", () => {
  const pages = getSitePages().filter((page) => page.id !== "forside");

  it("inneholder ikke skript, skjemaer, iframes eller hendelsesattributter", () => {
    for (const page of pages) {
      const html = fragment(page.id);
      expect(html, page.id).not.toMatch(/<script|<form|<iframe|\son[a-z]+=|javascript:/i);
    }
  });

  it("lenker aldri til en første-parts side hos originalen uten å merke den som ekstern", () => {
    for (const page of pages) {
      const unmarked = [...fragment(page.id).matchAll(/<a\b[^>]*href="https?:\/\/(?:www\.)?leangenbukta\.no[^"]*"[^>]*>/g)]
        .map((m) => m[0])
        .filter((tag) => !tag.includes('data-demo-external="true"'));
      expect(unmarked, page.id).toEqual([]);
    }
  });

  it("henter ingen medier fra leangenbukta.no ved lasting", () => {
    for (const page of pages) {
      expect(fragment(page.id), page.id).not.toMatch(/(src|poster)="https?:\/\/(www\.)?leangenbukta\.no/);
      expect(fragment(page.id), page.id).not.toMatch(/url\(\s*['"]?https?:\/\/(www\.)?leangenbukta\.no/);
    }
  });
});
