import type { BrokerInfo, ProjectAssetFlags } from "@/lib/types";

// Prosjekt-spesifikke brand-assets (logo + splash-hero + splash-video) for
// velkomst-skjermen. Opt-in via Supabase `reportConfig.assets.brand` (erstatter
// den gamle hardkodede slug-Set-en) — et nytt prosjekt skrur på flagget når
// filene er lastet opp, uten kodeendring. Filer følger slug-konvensjonen
// `/illustrations/<slug>-logo.svg`, `-splash.jpg`, `-splash-video.mp4`. Når
// flagget mangler returneres undefined, og splash-skjermen faller tilbake
// (tekst-wordmark i stedet for logo, home.heroImage i stedet for splash-render).
import { STASJONSKVARTALET_PIN_THUMB } from "./stasjonskvartalet-pin-thumb";

// Slug-keyede data-URI-er for 3D-pin-thumbnails. Data-URI fordi markøren
// rasteriseres til en WebGL-tekstur (kan ikke være en slug-path-fil som de andre
// assetene). Nytt prosjekt legger til sin egen URI her og setter
// `assets.pinThumbnail` i Supabase.
const PIN_THUMBNAILS: Record<string, string> = {
  stasjonskvartalet: STASJONSKVARTALET_PIN_THUMB,
};

/** Logo-fil for prosjektet (SVG), eller undefined → splash viser tekst-wordmark. */
export function getProjectLogoSrc(
  slug: string | undefined,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (slug && assets?.brand) {
    return `/illustrations/${slug}-logo.svg`;
  }
  return undefined;
}

/** Dedikert splash-render (bredformat hero), eller undefined → fall tilbake til home.heroImage. */
export function getProjectSplashImage(
  slug: string | undefined,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (slug && assets?.brand) {
    return `/illustrations/${slug}-splash.jpg`;
  }
  return undefined;
}

/** Dedikert splash-video (16:9) som spilles i høyre panel i stedet for et
 *  stillbilde. Poster avledes ved å bytte `.mp4` → `.jpg` (samme filnavn).
 *  Gates av enten `brand` (full pakke) eller `splashVideo` (kun video, uten
 *  logo/splash-hero) — sistnevnte lar et prosjekt få levende splash uten å måtte
 *  ha logo. Undefined → høyre panel faller tilbake til splash-render/heroImage. */
export function getProjectSplashVideo(
  slug: string | undefined,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (slug && (assets?.splashVideo || assets?.brand)) {
    return `/illustrations/${slug}-splash-video.mp4`;
  }
  return undefined;
}

// Demo-megler-fallback for kjente prosjekter, brukt INNTIL ekte data finnes i
// reportConfig.brokers (Supabase). Speiler district/city-hardkodingen i
// adaptBoardData — ekte data overstyrer alltid (se board-data.ts).
const PROJECT_BROKERS: Record<string, BrokerInfo[]> = {
  stasjonskvartalet: [
    {
      name: "Tonje Følstad",
      title: "Prosjektmegler",
      phone: "980 40 191",
      email: "tonje.folstad@dnbeiendom.no",
      photoUrl: "/illustrations/stasjonskvartalet-broker-tonje.jpg",
      officeName: "DNB Eiendom",
    },
  ],
};

/** Demo-meglere for kjente prosjekter. Tom liste når ingen finnes. */
export function getProjectBrokers(slug: string | undefined): BrokerInfo[] {
  return (slug && PROJECT_BROKERS[slug]) || [];
}

/** Kvadratisk thumbnail (data-URI) for prosjekt-markøren på 3D-kartet, eller
 *  undefined → ProjectSitePin faller tilbake til bygnings-glyph. Opt-in via
 *  `assets.pinThumbnail`; selve data-URI-en slås opp i PIN_THUMBNAILS per slug. */
export function getProjectPinThumbnail(
  slug: string | undefined,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (slug && assets?.pinThumbnail) {
    return PIN_THUMBNAILS[slug];
  }
  return undefined;
}
