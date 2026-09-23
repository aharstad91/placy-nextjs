import "server-only";

import { z } from "zod";
import manifest from "@/data/demo/leangenbukta-nettside/pages.json";

/**
 * Sideregisteret for Leangenbukta-kopien (2026-09-23).
 *
 * ## Hvorfor et register
 *
 * Nettsidekopien, Placy-feltene og tekstchatten trenger samme svar på «hvilken
 * side er dette». Chatten får en side-ID fra nettleseren og må kunne avvise alt
 * som ikke er en kjent side; et svar kan bare lenke til en side som står her.
 * Derfor er `pages.json` den ENESTE lista over lokale sider: rutene, CTA-ene og
 * chatten slår opp i den samme fila, og ingen av dem godtar en vilkårlig URL.
 *
 * `pages.json` er runtime-utdraget av det fulle inventaret i
 * `docs/research/leangenbukta-nettside/manifest.json`. Inventaret beskriver
 * alle kilde-URL-er (også eksterne, omdirigerte og døde); denne fila bare de
 * som er bygd som lokale sider.
 */

export const SITE_BASE = "/demo/leangenbukta-nettside";

export const SITE_PAGE_KINDS = [
  "home",
  "location",
  "building",
  "project",
  "article",
  "info",
  "contact",
  "archive",
] as const;

const pageSchema = z
  .object({
    /** Stabil ID: kildens slug, `forside` for forsiden. */
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,80}$/),
    /** Lokal sti under `SITE_BASE`, uten skråstrek til slutt. Tom streng = forsiden. */
    path: z.string().regex(/^(\/[a-z0-9-]+)*$/),
    title: z.string().min(1).max(200),
    kind: z.enum(SITE_PAGE_KINDS),
    /** Kanonisk kilde-URL på leangenbukta.no, eller null for sider Placy har lagt til. */
    sourceUrl: z.string().url().nullable(),
    /**
     * Prosjekttemaet i Leangenbukta-boardet siden handler om
     * (`data/demo/leangenbukta-lokal/topics.json`). Bare byggsider har det.
     */
    boardTopicId: z.string().optional(),
    /** Forslag til spørsmål chatten viser når den åpnes fra denne siden. */
    chatStarters: z.array(z.string().min(1).max(120)).max(4).default([]),
  })
  .strict();

const manifestSchema = z
  .object({
    snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    pages: z.array(pageSchema).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    const paths = new Set<string>();
    for (const page of value.pages) {
      if (ids.has(page.id)) ctx.addIssue({ code: "custom", message: `Dobbel side-ID «${page.id}»` });
      if (paths.has(page.path)) ctx.addIssue({ code: "custom", message: `Dobbel sti «${page.path}»` });
      ids.add(page.id);
      paths.add(page.path);
    }
  });

export type SitePage = z.infer<typeof pageSchema>;
export type SitePageKind = (typeof SITE_PAGE_KINDS)[number];

const parsed = manifestSchema.parse(manifest);

export const SITE_SNAPSHOT_DATE = parsed.snapshotDate;

export function getSitePages(): readonly SitePage[] {
  return parsed.pages;
}

export function getSitePage(id: string): SitePage | null {
  return parsed.pages.find((page) => page.id === id) ?? null;
}

export function getSitePageByPath(path: string): SitePage | null {
  return parsed.pages.find((page) => page.path === path) ?? null;
}

/** Full lokal URL-sti for en side, klar til `href`. */
export function sitePageHref(page: SitePage): string {
  return `${SITE_BASE}${page.path}`;
}
