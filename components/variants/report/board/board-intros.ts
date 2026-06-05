import type { IntroPathConfig } from "./board-intro-flythrough";

/**
 * Per-prosjekt tuning av intro-flythrough-en (oval-spiral låst på objektet).
 *
 * Speiler camera-tours.ts: keyed på prosjekt-slug → DELVIS
 * `IntroPathConfig`. ETHVERT prosjekt får en standard-intro fra
 * `DEFAULT_INTRO_PATH` (board-intro-flythrough.ts) UTEN en oppføring her — dette
 * er bare for site-spesifikk tuning. Det vanligste å justere:
 *
 *  • `startHeading` — hvilken retning vi flyr INN fra (pek mot et landemerke).
 *  • `rangeStart` — hvor langt unna vi åpner (større = mer by-kontekst; skaler
 *    med hvor åpent/tett prosjektet ligger).
 *  • `sweepDeg` — størrelsen på ovalen.
 *
 * Legg til et nytt prosjekt = ny linje her (eller la det arve default). BEVISST
 * en lokal fil på prototype-stadiet; prod-promotering til products.config er
 * deferert (mønster som de andre board-*-konfigene).
 */
const BOARD_INTROS: Record<string, Partial<IntroPathConfig>> = {
  // Stasjonskvartalet (Brattøra): roligere, videre innflyvning som etablerer hele
  // nærområdet i stedet for å zoome tett på selve bygget.
  //  • startHeading 20 — fly inn fra Nidarosdomen-retningen (kamera SSW av objektet
  //    ved start). Beholdt.
  //  • rangeStart 1600 — åpner videre enn default (1150) → mer dramatisk etablering
  //    av fjord-/by-tablået. NB: videre = mest tile-hungrig; verifiser pop-in på
  //    kald cache mot den korte velkommen-settlen.
  //  • rangeEnd 480 — lander løsere enn default (300) → hero viser kvartalet/området,
  //    ikke bare fasaden.
  //  • sweepDeg 150 — kortere oval-sveip enn default (250) → roligere, mer rett-inn.
  //    Landing-heading = 20+150 = 170° ≈ vendt sør inn i Midtbyen (der POI-ene er).
  //  • ovalEccentricity 0 — ren spiral uten midtveis-utbuling.
  stasjonskvartalet: {
    startHeading: 20,
    rangeStart: 1600,
    rangeEnd: 480,
    sweepDeg: 150,
    ovalEccentricity: 0,
  },
};

/**
 * Per-prosjekt intro-overstyringer, eller `{}` for ukjent slug (→ ren default-
 * intro). Returnerer alltid et objekt så kalleren trygt kan spre det over
 * DEFAULT_INTRO_PATH.
 */
export function getBoardIntro(slug: string): Partial<IntroPathConfig> {
  return BOARD_INTROS[slug] ?? {};
}
