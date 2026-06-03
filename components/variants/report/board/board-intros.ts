import type { IntroPathConfig } from "./board-intro-flythrough";

/**
 * Per-prosjekt tuning av intro-flythrough-en (oval-spiral låst på objektet).
 *
 * Speiler board-models.ts / camera-tours.ts: keyed på prosjekt-slug → DELVIS
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
  // Stasjonskvartalet (Brattøra): fly inn fra Nidarosdomen-retningen (kamera SSW
  // av objektet ved start), litt større range pga. det åpne fjord-/by-tablået.
  stasjonskvartalet: {
    startHeading: 20,
    rangeStart: 1150,
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
