import "server-only";

import type { ResolvedLink } from "@/lib/demo/leangenbukta-chat/links";
import { getNhSitePage, NH_SITE_BASE, nhSitePageHref } from "@/lib/demo/nyhavna-chat/pages";

/**
 * Modellens `link_ids` for Nyhavna-kopien, i samme lukkede alfabet som
 * Leangenbukta (`board`, `contact`, `page:<id>`). Alt annet faller stille bort.
 *
 * Kopien har ingen egen kontaktside; `contact` peker til bunnfeltet med
 * Nyhavna Utviklings adresse og e-post (`#kontakt` i layouten).
 */
const MAX_LINKS = 4;

export const NH_BOARD_HREF = "/demo/nyhavna-lokal";

export function resolveNhLinkIds(linkIds: readonly unknown[]): ResolvedLink[] {
  const resolved: ResolvedLink[] = [];
  const seen = new Set<string>();
  for (const raw of linkIds) {
    if (resolved.length >= MAX_LINKS) break;
    if (typeof raw !== "string" || seen.has(raw)) continue;
    seen.add(raw);
    if (raw === "board") {
      resolved.push({ id: "board", label: "Utforsk Nyhavna med Placy", href: NH_BOARD_HREF });
      continue;
    }
    if (raw === "contact") {
      resolved.push({ id: "contact", label: "Kontakt Nyhavna Utvikling", href: `${NH_SITE_BASE}#kontakt` });
      continue;
    }
    if (raw.startsWith("page:")) {
      const page = getNhSitePage(raw.slice("page:".length));
      if (page) resolved.push({ id: raw, label: page.title, href: nhSitePageHref(page) });
    }
  }
  return resolved;
}

/** Veien videre når chatten ikke kan svare: Placy-kartet og Nyhavna Utvikling. */
export function nhFallbackLinks(): ResolvedLink[] {
  return resolveNhLinkIds(["board", "contact"]);
}
