/**
 * Re-eksport av delte marker-color-utils fra `lib/utils/marker-color`. Eksisterer
 * som tynt board-lokalt shim slik at andre board-filer kan importere relativ
 * uten å bry seg om hvor utilen lever — og slik at vi kan flytte utilen senere
 * uten å oppdatere alle import-stier.
 *
 * Her bor også den ENE derivasjonen av en POI-s visuelle identitet (ikon +
 * farge), slik at kartmarkøren og alle listerader som viser samme sted ser
 * identiske ut.
 */
export {
  hexLightTint,
  hexWithAlpha,
  markerCircleStyle,
} from "@/lib/utils/marker-color";

import { mutedColor } from "@/lib/themes/muted-palette";

/** Minimums-formen en POI må ha for å avlede identitet. Strukturell, så både
 *  `BoardPOI` og en rå `POI` med sub-kategori oppfyller den. */
export interface PoiIdentitySource {
  category: { icon?: string };
}

/** Temaets identitet. Fargen brukes ALLTID; ikonet er fallback når POI-en
 *  mangler et eget. */
export interface CategoryIdentityFallback {
  icon: string;
  color: string;
}

export interface PoiVisualIdentity {
  /** Ikon-NAVN (slås opp med `getFilledIcon`/`getIcon` på render-stedet, så
   *  `lib/`-grensen og komponentlaget holdes adskilt). */
  icon: string;
  /** Ferdig hex — dempet variant der den finnes. */
  color: string;
}

/**
 * En POI-s visuelle identitet: TEMAETS farge, kategoriens ikon.
 *
 * Fargen arves fra temaet, ikke fra underkategorien. Temaraden er det eneste
 * stedet brukeren får en fargenøkkel — «Hverdag» står der i grønt — og en
 * markør som bryter med den nøkkelen er ikke informasjon, den er støy. Ingen
 * lærer at fuchsia betyr frisør, mens alle leser at grønn betyr Hverdag etter
 * ett blikk på raden.
 *
 * Underkategori-fargene løy også (Andreas, 2026-09-07: «en frisør har f.eks
 * en lilla saks ikon, selv om det er på grønn hverdag»). De ble delt ut per
 * kategori i `poi-discovery` uten et felles budsjett, så legesenter fikk
 * `#3b82f6` — nøyaktig Transport-temaets blå. En blå pin midt i Hverdag-
 * visningen leste da som en holdeplass.
 *
 * Forskjellen inni et tema bæres av IKONET, som fortsatt kommer fra
 * underkategorien: saks, handlekurv og pille er umiddelbart lesbare uten at
 * noen må lære en kode. Det er også den eneste kanalen som kan bære 40+
 * kategorier — fargerommet kan ikke.
 *
 * Gevinsten ligger i områdenivået, der alle temaene vises samtidig: da sier
 * fargen HVOR hverdagsbehovene klumper seg mot hvor kollektivet går. Tidligere
 * var den samme visningen konfetti.
 *
 * Fargen dempes til ~450-nivå så den ikke roper mot den lyse kartbakgrunnen.
 *
 * Returnerer PRIMITIVER, ikke et objekt som mates videre som prop: `BoardMarker`
 * er `React.memo`-et på `color`/`icon`-strenger, og et ferskt objekt per render
 * ville gjort at alle markørene re-rendret ved hvert klikk.
 */
export function poiVisualIdentity(
  poi: PoiIdentitySource,
  fallback: CategoryIdentityFallback,
): PoiVisualIdentity {
  return {
    icon: poi.category.icon || fallback.icon,
    color: mutedColor(fallback.color) ?? fallback.color,
  };
}
