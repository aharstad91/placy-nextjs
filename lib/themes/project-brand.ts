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
// TODO(supabase): demo-data — flytt pin-thumbnail-URI-ene til provisjon/Supabase
// (per-prosjekt asset-rad) så nye prosjekter ikke krever kodeendring. Beholdt
// verbatim i denne porten (prototype).
const PIN_THUMBNAILS: Record<string, string> = {
  stasjonskvartalet: STASJONSKVARTALET_PIN_THUMB,
};

function configuredAsset(value: string | undefined, fallback: string): string | undefined {
  if (value === undefined) return fallback;
  if (!/^\/(?!\/)[A-Za-z0-9/_\-.]+$/.test(value)) return undefined;
  if (value.split("/").some((segment) => segment === "." || segment === "..")) {
    return undefined;
  }
  return value;
}

/** Logo-fil for prosjektet (SVG), eller undefined → splash viser tekst-wordmark. */
export function getProjectLogoSrc(
  slug: string | undefined,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (slug && assets?.brand) {
    return configuredAsset(assets.logoUrl, `/illustrations/${slug}-logo.svg`);
  }
  return undefined;
}

/** Kvadratisk logo til prosjektmarkøren. Må konfigureres eksplisitt fordi en
 * horisontal headerlogo vanligvis blir beskåret eller uleselig i en sirkel. */
export function getProjectPinLogoSrc(
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (!assets?.brand || !assets.pinLogoUrl) return undefined;
  return configuredAsset(assets.pinLogoUrl, assets.pinLogoUrl);
}

/** Dedikert splash-render (bredformat hero), eller undefined → fall tilbake til home.heroImage. */
export function getProjectSplashImage(
  slug: string | undefined,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (slug && assets?.brand) {
    return configuredAsset(assets.splashImageUrl, `/illustrations/${slug}-splash.jpg`);
  }
  return undefined;
}

/** Dedikert splash-video (16:9) som spilles i høyre panel i stedet for et
 *  stillbilde. Poster avledes ved å bytte `.mp4` → `.jpg` (samme filnavn).
 *  Undefined → høyre panel faller tilbake til splash-render/heroImage.
 *
 *  `splashVideo`-flagget BETYR at slug-konvensjonsfila finnes, og bare da
 *  gjettes stien. `brand` alene gjør det ikke: et brandet prosjekt uten film
 *  pekte tidligere på en `{slug}-splash-video.mp4` som ikke var lastet opp, og
 *  splash-skjermen fikk et tomt videoelement i stedet for stillbildet
 *  (funnet under Lillebytunet-gjenbrukstesten 2026-09-20). */
export function getProjectSplashVideo(
  slug: string | undefined,
  assets: ProjectAssetFlags | undefined,
): string | undefined {
  if (!slug) return undefined;
  if (assets?.splashVideoUrl && (assets.brand || assets.splashVideo)) {
    return configuredAsset(assets.splashVideoUrl, assets.splashVideoUrl);
  }
  if (assets?.splashVideo) {
    return `/illustrations/${slug}-splash-video.mp4`;
  }
  return undefined;
}

// Demo-megler-fallback for kjente prosjekter, brukt INNTIL ekte data finnes i
// reportConfig.brokers (Supabase). Speiler district/city-hardkodingen i
// adaptBoardData — ekte data overstyrer alltid (se board-data.ts).
// TODO(supabase): demo-data — flytt megler-fallback til provisjon/Supabase
// (reportConfig.brokers), så denne hardkodede slug-tabellen kan slettes. Beholdt
// verbatim i denne porten (prototype).
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
