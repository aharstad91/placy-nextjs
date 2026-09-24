import "server-only";

import type { ResolvedLink } from "@/lib/demo/site-chat/profile";
import { getSitePage, getSitePages, SITE_BASE, sitePageHref } from "@/lib/demo/leangenbukta-site/pages";

/**
 * Oversetter modellens `link_ids` til faktiske lenker (KTD6, R9).
 *
 * Modellen ser ALDRI en URL — den kan bare navngi en ID fra et lukket
 * alfabet (`page:<id>` for et sideregister-oppslag, `board`, `contact`). Alt
 * annet, inkludert forsøk på vilkårlige URL-er eller `javascript:`-strenger,
 * faller stille bort her: enten er strengen en av de tre formene, eller den
 * blir aldri en lenke.
 */

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
      // Leangenbukta har ingen egen kontaktside; salgsteamet står i
      // kontaktraden på forsiden (samme som menyens «Meld interesse»).
      const contactPage = getSitePages().find((page) => page.kind === "contact");
      resolved.push(contactPage
        ? { id: "contact", label: contactPage.title, href: sitePageHref(contactPage) }
        : { id: "contact", label: "Kontakt salgsteamet", href: `${SITE_BASE}#kontakt` });
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

/** Veien videre når chatten ikke kan svare: Boardet og salgsteamet (AE5). */
export function fallbackLinks(): ResolvedLink[] {
  return resolveLinkIds(["board", "contact"]);
}
