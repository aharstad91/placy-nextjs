/**
 * Gaten som skiller «brukeren tok i kartet» fra «brukeren traff en markør».
 *
 * Google-eventene i 3D bærer ingen `originalEvent`, så diskriminatoren
 * Mapbox-stien bruker finnes ikke. I stedet leses event-målet: ligger det inne i
 * en markør, er trykket innholds-interaksjon og ikke et kamera-grep. Tre
 * kjørende steder spør om nøyaktig det:
 *
 *  - `BoardMap3D` — `gmp-click` på bakgrunnen lukker POI-popupen. Matcher gaten
 *    ikke, lukkes popupen i samme trykk som åpnet den.
 *  - `BoardMap3D` — drag-takeover auto → fri, pluss Satelitt-drift-vakten. Matcher
 *    gaten ikke, flipper kameramodus ved hvert markør-trykk.
 *  - `use-3d-viewport-publish` — marker-tapp skal ikke re-scope nabolagslista
 *    (R12). Matcher gaten ikke, hopper lista under fingeren.
 *
 * ## Hvorfor et eget attributt og ikke bare tagnavnet
 *
 * Google har to markør-generasjoner, og fire tagnavn: de rasteriserte
 * `gmp-marker-3d` / `gmp-marker-3d-interactive`, og HTML-markørene
 * `gmp-marker` / `gmp-marker-interactive`. FELLEN er at `gmp-marker` IKKE er et
 * prefiks-treff på `gmp-marker-interactive` — `closest("gmp-marker")` matcher
 * bare det ene elementet. En selektor bygget på tagnavn alene slipper derfor
 * gjennom halvparten, stille.
 *
 * Derfor bærer alle markør-verter {@link MARKER_3D_ATTR}, og det er den
 * primære gaten. Tagnavnene står som fallback så markører vi ikke selv monterer
 * (eller som mister attributtet i en refaktorering) fortsatt fanges.
 */

/** Attributtet alle markør-verter bærer. Verdien er uinteressant. */
export const MARKER_3D_ATTR = "data-placy-marker";

/**
 * Alle tagnavn Google bruker for 3D-markører, begge generasjoner.
 *
 * Rekkefølgen er uten betydning — men merk at hvert navn må stå eksplisitt:
 * `gmp-marker` dekker ikke `gmp-marker-interactive`.
 */
const MARKER_3D_TAGS = [
  "gmp-marker-3d",
  "gmp-marker-3d-interactive",
  "gmp-marker",
  "gmp-marker-interactive",
] as const;

/** Selektor som treffer en markør-vert, uansett generasjon. */
export const MARKER_3D_SELECTOR = [
  `[${MARKER_3D_ATTR}]`,
  ...MARKER_3D_TAGS,
].join(",");

/**
 * Ligger dette event-målet inne i en 3D-markør?
 *
 * Tar `EventTarget | null` fordi det er det `Event.target` faktisk er — da
 * slipper kallstedene å caste, og en tekstnode eller `window` gir `false` i
 * stedet for et kast.
 */
export function isMarker3DTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof Element)) return false;
  return target.closest(MARKER_3D_SELECTOR) !== null;
}
