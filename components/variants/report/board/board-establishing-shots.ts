import type { EstablishingPathConfig } from "./board-establishing-flythrough";

/**
 * Per-strøk «establishing shot»-ruter (sammenhengende helikopter-flyover, board-
 * establishing-flythrough). Keyed på prosjekt-slug. Kameraet flyr en RUTE av
 * waypoints over strøket — ser alltid fremover langs ruta (auto-heading fra
 * tangenten), eases høyt→lavt, og lander på siste punkt. BEVISST en lokal fil på
 * prototype-stadiet (samme mønster som camera-tours.ts / board-intros.ts).
 *
 * Spilt live via `?establishing=1` (BoardMap3D), uten voice-over/lyd — ren visuell
 * komposisjon vi itererer på. Waypoints er forankret i nabolaget; tune dem visuelt.
 */
const ESTABLISHING_SHOTS: Record<string, EstablishingPathConfig> = {
  // ── Grilstad Marina (byggetrinn-4) — RETT, FLAT dronetur tvers over strøket.
  // Etter feedback: spline-gjennom-mange-punkter ble «taggete» (kurven jobber seg
  // anker-til-anker) og høyde/retnings-endring ga høy kognitiv last. Ny modell:
  // ÉN rett linje fra øst til vest, KONSTANT høyde + KONSTANT retning (ingen sving,
  // ingen zoom) — «som å fly en drone rett fra den ene siden til den andre». Lav
  // bevegelse → ro. Poenget er at sirkelpunktene (POI-blobs) nær flylinja tegnes
  // inn FORTLØPENDE etter hvert som kameraet passerer dem (se selectFlyoverBlobs +
  // RevealLayer3D positional-modus i BoardMap3D). To waypoints = ren rett linje.
  "byggetrinn-4": {
    waypoints: [
      { lat: 63.425595326472845, lng: 10.558926886929122 }, // start (øst)
      { lat: 63.434914964484854, lng: 10.494121356381857 }, // slutt (vest)
    ],
    rangeStart: 1700, // KONSTANT høyde (rangeStart === rangeEnd → ingen descent)
    rangeEnd: 1700,
    tiltStart: 58, // KONSTANT tilt (forover-skrå dronevinkel)
    tiltEnd: 58,
    headingOffset: 0, // konstant heading = bearing(start→slutt), ren rett kurs
    durationMs: 34000, // rolig kryssing (~3,4 km)
    settleMs: 2500,
    bloomAtProgress: 0.02, // reveal mountes straks flyturen starter (progressiv kaskade)
  },
};

/**
 * Establishing-rute for en slug, eller `undefined` om strøket ikke har en (→
 * ?establishing=1 er da en no-op).
 */
export function getEstablishingShot(
  slug: string,
): EstablishingPathConfig | undefined {
  return ESTABLISHING_SHOTS[slug];
}
