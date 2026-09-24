import "server-only";

import type { SiteChatPage } from "@/lib/demo/site-chat/profile";

/**
 * Sideregisteret for Nyhavna-kopien (2026-09-24).
 *
 * Kopien har to lokale sider: forsiden og Beliggenhet
 * (`app/demo/nyhavna-nettside/`). Andre menypunkter peker til originalen på
 * nyhavna.no og er ikke sider chatten kan stå på eller lenke til. Chatten får
 * side-ID-en fra `data-placy-page-id` i nettleseren og avviser alt som ikke
 * står her; et svar kan bare lenke til en side i denne lista.
 *
 * Forslagene er spørsmål datasettet `data/demo/nyhavna-lokal` faktisk dekker
 * (temaer og steder), ikke løfter om salg eller tidspunkter.
 */

export const NH_SITE_BASE = "/demo/nyhavna-nettside";

/** Snapshot av nyhavna.no som kopien er bygd fra (docs/demos/nyhavna-nettside.md). */
export const NH_SITE_SNAPSHOT_DATE = "2026-09-14";

export interface NhSitePage extends SiteChatPage {
  /** Sti under `NH_SITE_BASE`; tom streng = forsiden. */
  path: string;
}

const PAGES: readonly NhSitePage[] = [
  {
    id: "forside",
    path: "",
    title: "Nyhavna",
    kind: "home",
    chatStarters: [
      "Hva planlegges på Nyhavna?",
      "Hvilke delområder har Nyhavna?",
      "Hva finnes i nærområdet i dag?",
    ],
  },
  {
    id: "beliggenhet",
    path: "/beliggenhet",
    title: "Beliggenhet",
    kind: "location",
    chatStarters: [
      "Hvor handler vi dagligvarer?",
      "Hvordan kommer vi oss til sentrum?",
      "Hvilke barnehager finnes i nærområdet?",
    ],
  },
];

export function getNhSitePages(): readonly NhSitePage[] {
  return PAGES;
}

export function getNhSitePage(id: string): NhSitePage | null {
  return PAGES.find((page) => page.id === id) ?? null;
}

export function nhSitePageHref(page: NhSitePage): string {
  return `${NH_SITE_BASE}${page.path}`;
}
