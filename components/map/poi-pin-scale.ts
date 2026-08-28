/**
 * Zoom-avhengig skala for POI-markørene i 3D (2026-08-27).
 *
 * Markørene er SKJERM-forankret: Google tegner dem i konstante piksler uansett
 * kamera-avstand. Det er riktig på oversikt — men zoomer man helt inn på ett
 * kvartal, står det færre pins i bildet og hver av dem er den ENESTE teksten på
 * en satellittflate uten stedsnavn. 10 px navn ble da for lite å lese, og disc-en
 * for liten til å bære ikonet sitt (Andreas, samme kveld disc-en gikk 40 → 32).
 *
 * Rampen er derfor: fast {@link PIN_SIZE} gjennom hele oversikts- og
 * nærområde-zoomen, og så en vekst gjennom TOPPEN av label-tieren — der man ser
 * gaten, ikke strøket.
 *
 * ## Hvorfor ekvivalent zoom og ikke `range`
 *
 * Prosjektmarkøren skalerer på rå `range` ({@link scaleForRange}), og det er
 * greit for ÉN markør som bare skal krympe et hakk. Her ville det vært feil:
 * samme `range` gir helt ulik bakke-oppløsning på en 400 px mobil og en 1000 px
 * desktop-flate, så pinsene hadde vokst ved ulike faktiske zoomnivåer. Vi bruker
 * `equivalentZoomForCamera` — samme currency som markør-tierne
 * (`computeZoomTier`s 13 / 16), så terskelen her leser i samme skala som dem.
 *
 * ## Hvorfor kvantisert
 *
 * Skalaen leses når kameraet faller til ro (se `use-3d-marker-declutter`), og
 * hvert nytt tall er en re-render av alle markørene + en ny label-kollisjon.
 * Trinn på {@link POI_PIN_SCALE_STEP} gir ti tilstander gjennom hele rampen i
 * stedet for et kontinuum, så et lite drag ved samme zoom ikke flytter noe.
 */

/**
 * Under dette zoomnivået er markøren alltid {@link POI_PIN_MIN_SCALE}.
 *
 * Ligger et helt hakk OVER label-terskelen (16): hele oversikts- og
 * strøks-zoomen skal ha samme markør som 2D, ellers har vi to ulike
 * basis-størrelser på samme sted i de to motorene.
 */
export const POI_PIN_GROW_START_ZOOM = 17;
/** Over dette zoomnivået er markøren alltid {@link POI_PIN_MAX_SCALE}. */
export const POI_PIN_GROW_END_ZOOM = 19;
/** Basis — 32 px disc, 10 px navn (matcher 2D-markøren). */
export const POI_PIN_MIN_SCALE = 1;
/** Full vekst — 46 px disc, 14,5 px navn. Rundt zoom 18 (der Andreas leste
 *  navnet som for lite) gir rampen ~1,25, altså de 40 px pinnen hadde før. */
export const POI_PIN_MAX_SCALE = 1.45;
/** Trinnstørrelse. Se doc-blokken: skalaen skal ikke være et kontinuum. */
export const POI_PIN_SCALE_STEP = 0.05;

/**
 * Markør-skala for et ekvivalent zoomnivå. Ikke-lesbart kamera (null/NaN) →
 * {@link POI_PIN_MIN_SCALE}: en gjettet oppskalering ved mount ville blinket
 * alle markørene gjennom en størrelses-overgang.
 */
export function poiPinScaleForZoom(zoom: number | null | undefined): number {
  if (zoom == null || !Number.isFinite(zoom)) return POI_PIN_MIN_SCALE;
  const span = POI_PIN_GROW_END_ZOOM - POI_PIN_GROW_START_ZOOM;
  const t = Math.min(1, Math.max(0, (zoom - POI_PIN_GROW_START_ZOOM) / span));
  const raw =
    POI_PIN_MIN_SCALE + t * (POI_PIN_MAX_SCALE - POI_PIN_MIN_SCALE);
  const steps = Math.round(raw / POI_PIN_SCALE_STEP);
  // Trinnet er 0,05 → verdier som 1,3000000000000003 ville brutt både
  // `sameResult`-dedupen og px-tallene i CSS. Rund til to desimaler.
  return Math.round(steps * POI_PIN_SCALE_STEP * 100) / 100;
}
