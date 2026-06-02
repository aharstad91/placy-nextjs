// Prosjekt-spesifikke brand-assets (logo + splash-hero) for velkomst-skjermen.
// Speiler mønsteret i `category-illustrations.ts`: kjente prosjekter har egne
// filer under `/illustrations/<slug>-logo.svg` og `/illustrations/<slug>-splash.jpg`.
// Når et prosjekt mangler egne assets returneres undefined, og splash-skjermen
// faller tilbake (tekst-wordmark i stedet for logo, home.heroImage i stedet for
// dedikert splash-render). ProjectTheme.logoUrl kan overstyre i fremtiden.
const PROJECTS_WITH_BRAND = new Set(["stasjonskvartalet"]);

/** Logo-fil for prosjektet (SVG), eller undefined → splash viser tekst-wordmark. */
export function getProjectLogoSrc(slug: string | undefined): string | undefined {
  if (slug && PROJECTS_WITH_BRAND.has(slug)) {
    return `/illustrations/${slug}-logo.svg`;
  }
  return undefined;
}

/** Dedikert splash-render (bredformat hero), eller undefined → fall tilbake til home.heroImage. */
export function getProjectSplashImage(slug: string | undefined): string | undefined {
  if (slug && PROJECTS_WITH_BRAND.has(slug)) {
    return `/illustrations/${slug}-splash.jpg`;
  }
  return undefined;
}

/** Dedikert splash-video (16:9) som spilles i høyre panel i stedet for et
 *  stillbilde. Poster avledes ved å bytte `.mp4` → `.jpg` (samme filnavn).
 *  Undefined → høyre panel faller tilbake til splash-render/heroImage. */
export function getProjectSplashVideo(slug: string | undefined): string | undefined {
  if (slug && PROJECTS_WITH_BRAND.has(slug)) {
    return `/illustrations/${slug}-splash-video.mp4`;
  }
  return undefined;
}
