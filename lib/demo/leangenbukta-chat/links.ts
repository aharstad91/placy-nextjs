import "server-only";

import { getSitePage, getSitePages, sitePageHref } from "@/lib/demo/leangenbukta-site/pages";

/**
 * Oversetter modellens `link_ids` til faktiske lenker (KTD6, R9).
 *
 * Modellen ser ALDRI en URL — den kan bare navngi en ID fra et lukket
 * alfabet (`page:<id>` for et sideregister-oppslag, `board`, `contact`). Alt
 * annet, inkludert forsøk på vilkårlige URL-er eller `javascript:`-strenger,
 * faller stille bort her: enten er strengen en av de tre formene, eller den
 * blir aldri en lenke.
 */
export interface ResolvedLink {
  id: string;
  label: string;
  href: string;
}

const MAX_LINKS = 4;

export function resolveLinkIds(linkIds: readonly unknown[]): ResolvedLink[] {
  const resolved: ResolvedLink[] = [];
  const seen = new Set<string>();
  for (const raw of linkIds) {
    if (resolved.length >= MAX_LINKS) break;
    if (typeof raw !== "string" || seen.has(raw)) continue;
    seen.add(raw);
    if (raw === "board") {
      resolved.push({ id: "board", label: "Åpne Board", href: "/demo/leangenbukta-lokal" });
      continue;
    }
    if (raw === "contact") {
      const contactPage = getSitePages().find((page) => page.kind === "contact");
      if (contactPage) resolved.push({ id: "contact", label: contactPage.title, href: sitePageHref(contactPage) });
      continue;
    }
    if (raw.startsWith("page:")) {
      const page = getSitePage(raw.slice("page:".length));
      if (page) resolved.push({ id: raw, label: page.title, href: sitePageHref(page) });
      continue;
    }
    // Ukjent form (bl.a. forsøk på en vilkårlig URL): droppes stille.
  }
  return resolved;
}
