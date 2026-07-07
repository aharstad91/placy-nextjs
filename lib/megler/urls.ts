/**
 * URL-helpere for megler-flyten (Unit 3). Én kilde for delings-side- og board-
 * URL-mønstrene slik at route, delings-side og e-post ikke driver fra hverandre.
 *
 * VIKTIG (R11): disse mønstrene er en eksplisitt pilot-constraint — delte
 * delings-side- og board-URLer får redirect-garanti (301) ved enhver URL-
 * omlegging, inkl. sommer-rebuild-cutoveren. Se docs/rebuild/CARRY-OVER-MANIFEST.md.
 */

/** Delings-siden (megler-vendt leveranse-flate). Nøkles på prosjekt-slug. */
export function shareUrl(customer: string, slug: string): string {
  return `/megler/deling/${customer}/${slug}`;
}

/** Selve boardet (kjøper-vendt). Kanonisk board-sti. */
export function boardPath(customer: string, slug: string): string {
  return `/eiendom/${customer}/${slug}/rapport-board`;
}

/** Absolutt base for kopier-/iframe-/QR-artefakter (må være produksjon i pilot). */
export function siteBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://placy.no";
}
