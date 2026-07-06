import type { MetadataRoute } from "next";

// Pre-launch: tom sitemap. Den forrige genererte én URL per POI × område × locale
// (tusenvis av URLer) med changeFrequency=weekly, som ba aktivt om bot-crawl.
// Reverser ved lansering — original implementasjon ligger i git-historikk.
//
// Ved lansering: generer board-URLene (/eiendom|/event/[customer]/[project]/…)
// fra v2-prosjektlista server-side med service-role — ALDRI anon (v2 har ingen
// anon-tilgang etter moat-nedlåsningen 2026-07-06). Merk at en offentlig
// sitemap også enumererer kunde-demoene — vurder hvilke boards som skal listes.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
