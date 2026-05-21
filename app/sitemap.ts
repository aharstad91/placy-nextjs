import type { MetadataRoute } from "next";

// Pre-launch: tom sitemap. Den forrige genererte én URL per POI × område × locale
// (tusenvis av URLer) med changeFrequency=weekly, som ba aktivt om bot-crawl.
// Reverser ved lansering — original implementasjon ligger i git-historikk.
export default function sitemap(): MetadataRoute.Sitemap {
  return [];
}
