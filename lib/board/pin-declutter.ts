/**
 * Pin-utglisning: hvilke markører får være hele ikon-pins, og hvilke faller
 * tilbake til en prikk (2026-08-23, Strindfjordvegen-runden på 3D-kartet).
 *
 * Problemet label-kullingen ikke løser: i 3D er markørene skjerm-forankret og
 * 40 px brede uansett kamera-avstand. Fem steder i samme kjøpesenter ligger
 * 10–25 m fra hverandre, som på nært hold blir ~20 px — altså fem 40 px-skiver
 * stablet oppå hverandre. Da er det ikke teksten som er uleselig, det er
 * PINNENE: man ser en fargeklump, ikke fem steder.
 *
 * 2D slipper unna med et rent zoom-svar (prikk under zoom 13) fordi markøren
 * der er 32 px OG fordi `computeSpreadCoordinates` allerede har viftet ut de
 * samlokaliserte punktene. 3D trenger i tillegg dette steget: når to hele pins
 * ikke får plass ved siden av hverandre, beholder den viktigste ikonet og resten
 * demoteres til prikk. Prikken står fortsatt der, er fortsatt klikkbar, og
 * forfremmes tilbake til full pin så snart brukeren zoomer inn og det blir plass.
 *
 * Ren funksjon over skjerm-koordinater, samme kontrakt som `label-collision`:
 * konsumenten projiserer, denne bestemmer. Deterministisk — samme kandidater
 * gir samme svar uavhengig av rekkefølge.
 */

export interface PinCandidate {
  id: string;
  /** Markørsenter i skjerm-px. */
  x: number;
  y: number;
  /**
   * Høyere vinner plassen. Aktiv POI sendes med
   * `Number.POSITIVE_INFINITY` og demoteres aldri.
   */
  priority: number;
}

/**
 * Flate som ikke er en markør, men som en full pin ikke bør legge seg oppå —
 * i praksis prosjekt-chipen, som er stor, alltid synlig og bærer sin egen tekst.
 * En POI-pin bak den er ikke lesbar uansett; den blir prikk i stedet.
 */
export interface PinBlocker {
  x: number;
  y: number;
  halfWidth: number;
  halfHeight: number;
}

export interface PinDeclutterOptions {
  /**
   * Minste senter-til-senter-avstand (px) mellom to fulle ikon-pins. Under
   * dette demoteres den med lavest prioritet.
   *
   * Default 34 mot en 40 px pin: skivene får så vidt tangere (6 px overlapp av
   * skygge/ring), som leses som «to naboer», mens 20 px overlapp leses som
   * «én ødelagt markør». Tallet er ment å justeres på følelse.
   */
  minSeparationPx?: number;
}

/** Se {@link PinDeclutterOptions.minSeparationPx}. */
export const DEFAULT_PIN_SEPARATION_PX = 34;

/**
 * Returnerer IDene som skal demoteres til prikk.
 *
 * Greedy i prioritetsrekkefølge (tiebreak på id, så resultatet er stabilt på
 * tvers av render-rekkefølge og pan-retning): den første som gjør krav på et
 * område beholder ikonet, alle senere som ikke får nok klaring demoteres.
 * En demotert pin BLOKKERER IKKE videre — prikken er 14 px og lar naboer med
 * lavere prioritet fortsatt få ikon hvis det er plass. Ellers ville én tett
 * klynge kunnet demotere hele nabolaget rundt seg.
 *
 * Kandidater med `Infinity`-prioritet (aktiv POI) demoteres aldri, og de
 * blokkerer som vanlig — brukerens fokuspunkt eier plassen sin.
 */
export function computePinDemotions(
  candidates: readonly PinCandidate[],
  blockers: readonly PinBlocker[] = [],
  options: PinDeclutterOptions = {},
): Set<string> {
  const minSeparation = options.minSeparationPx ?? DEFAULT_PIN_SEPARATION_PX;
  const minSeparationSq = minSeparation * minSeparation;
  const sorted = [...candidates].sort(
    (a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1),
  );

  const kept: PinCandidate[] = [];
  const demoted = new Set<string>();

  for (const c of sorted) {
    if (c.priority === Number.POSITIVE_INFINITY) {
      kept.push(c);
      continue;
    }
    const blocked = blockers.some(
      (b) =>
        Math.abs(c.x - b.x) < b.halfWidth && Math.abs(c.y - b.y) < b.halfHeight,
    );
    const crowded = kept.some((k) => {
      const dx = c.x - k.x;
      const dy = c.y - k.y;
      return dx * dx + dy * dy < minSeparationSq;
    });
    if (blocked || crowded) {
      demoted.add(c.id);
      continue;
    }
    kept.push(c);
  }

  return demoted;
}
