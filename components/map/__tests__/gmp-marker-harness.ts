/**
 * jsdom-harness for Googles HTML-markører.
 *
 * ## Hvorfor POJO-fakene ikke kan gjenbrukes
 *
 * `route-layer-3d.test.tsx` faker både kartet og polylinen som objekt-literaler
 * (`class FakeMarker { append() {} }`). Det virker der fordi laget aldri
 * behandler dem som DOM-noder. Et DOM-markørlag MÅ ha ekte `Element`-er:
 * `isMarker3DTarget` kaller `closest()`, kartet får `append()`, og barna går inn
 * via `createPortal`.
 *
 * Og i jsdom kaster `new (class extends HTMLElement {})()` med «Invalid
 * constructor, the constructor is not part of the custom element registry» med
 * mindre klassen er registrert. Registrering av samme navn to ganger kaster
 * `NotSupportedError`, så definisjonen må stå bak en guard — testfiler kjører i
 * samme jsdom-instans.
 *
 * ## Hva jsdom IKKE kan bevise
 *
 * - `document.elementFromPoint` finnes ikke i det hele tatt → hit-testing kan
 *   bare verifiseres i browser.
 * - `getBoundingClientRect()` på et element med `transform: matrix(...)`
 *   returnerer bare nuller → layout og posisjon skal ALDRI asserteres her.
 *   Det er også grunnen til at kollisjonsgeometrien beholder sitt px-anslag
 *   (`LABEL_CHAR_W`) i stedet for å måle DOM: en DOM-målt bredde ville gitt
 *   grønne tester og tull-geometri.
 *
 * Assertér derfor på STRUKTUR (tagnavn, attributter, tekstinnhold, properties
 * satt på elementet), aldri på piksler.
 */

/** Definerer et custom element én gang. Trygg å kalle flere ganger. */
function defineOnce(tag: string) {
  if (customElements.get(tag)) return;
  customElements.define(tag, class extends HTMLElement {});
}

/**
 * Registrerer begge HTML-markør-tagnavnene, og returnerer konstruktørene i
 * samme form som `google.maps.importLibrary("maps3d")` gir dem.
 */
export function defineGmpMarkerElements() {
  defineOnce("gmp-marker");
  defineOnce("gmp-marker-interactive");
  return {
    MarkerElement: customElements.get("gmp-marker")!,
    MarkerInteractiveElement: customElements.get("gmp-marker-interactive")!,
  };
}

/** Minimalt `AltitudeMode`-oppslag, samme nøkler som Googles enum. */
export const FAKE_ALTITUDE_MODE = {
  ABSOLUTE: "ABSOLUTE",
  CLAMP_TO_GROUND: "CLAMP_TO_GROUND",
  RELATIVE_TO_GROUND: "RELATIVE_TO_GROUND",
  RELATIVE_TO_MESH: "RELATIVE_TO_MESH",
} as const;

/**
 * Stubber `google.maps.importLibrary("maps3d")` med ekte, registrerte
 * custom-element-konstruktører.
 *
 * `omit` dropper navngitte eksporter, slik at «denne Maps-versjonen har ikke
 * MarkerElement» kan testes — den upinnede kanalen gjør det til en reell
 * tilstand, ikke en hypotetisk.
 */
export function stubMaps3DLibrary(omit: readonly string[] = []) {
  const ctors = defineGmpMarkerElements();
  const lib: Record<string, unknown> = {
    ...ctors,
    AltitudeMode: FAKE_ALTITUDE_MODE,
  };
  for (const key of omit) delete lib[key];

  (globalThis as unknown as { google: unknown }).google = {
    maps: {
      importLibrary: async (name: string) => {
        if (name !== "maps3d") throw new Error(`uventet bibliotek: ${name}`);
        return lib;
      },
    },
  };
  return lib;
}

/** Kart-element markørene appendes til. Ekte Element, så `closest()` virker. */
export function makeFakeMap3D(): HTMLElement {
  if (!customElements.get("gmp-map-3d")) {
    customElements.define("gmp-map-3d", class extends HTMLElement {});
  }
  return document.createElement("gmp-map-3d");
}
