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
  category: { icon?: string; color?: string };
}

/** Kategoriens identitet — fallback når POI-en mangler sub-kategori-verdier. */
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
 * En POI-s visuelle identitet: sub-kategorien vinner, temaet er fallback.
 *
 * Sub-kategorien differensierer bar (lilla), bakeri (gul) og restaurant (rød)
 * innen Mat-temaet — det er dette som gjør kartet lesbart. Fargen dempes til
 * ~450-nivå så den ikke roper mot den lyse kartbakgrunnen.
 *
 * Fantes tidligere kun inne i `BoardMap.markerStates`, mens sidebar-radene
 * hardkodet et nål-ikon i temafargen. Samme sted så da ulikt ut på kartet og i
 * lista (rød knivgaffel mot rød nål). Derivasjonen bor her nå så en ny liste
 * ikke kan drifte fra kartet på nytt.
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
    color: mutedColor(poi.category.color) ?? fallback.color,
  };
}
