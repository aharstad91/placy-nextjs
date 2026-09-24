/** Root namespaces owned by the existing website, which remains on www. */
export const WEBSITE_NAMESPACES = [
  "eiendom", "event", "kart", "midtbyen", "pitch", "portefolje", "prototype",
  "for", "generer", "klp-eiendom", "visitnorway", "strawberry", "scandic", "thon",
] as const;

/** Project slugs share the root URL namespace with application infrastructure. */
export const RESERVED_PROJECT_SLUGS: readonly string[] = [
  ...WEBSITE_NAMESPACES, "api", "admin", "demo", "dev", "p", "_next", "_vercel", ".well-known",
  "audio", "brand-fonts", "embed", "illustrations", "images", "models", "projects", "prototypes", "reels", "trips",
];

export function isPublicProjectSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) && !RESERVED_PROJECT_SLUGS.includes(slug);
}
