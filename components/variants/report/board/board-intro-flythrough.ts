/**
 * Gjenbrukbar Marketer-stil intro-flythrough for 3D-rapport-boardet — én oval-
 * spiral LÅST på objektet: kameraet ser ALLTID på bygget (center = target →
 * bygget i senter hele filmen), mens kamera-POSISJONEN starter på en valgt
 * innflyvnings-retning og sveiper en oval rundt mens range spiraler inn til hero-
 * nærbilde. Oval utbuling midtveis (eccentricity) → spenning.
 *
 * Drives FRAME-FOR-FRAME (requestAnimationFrame + direkte camera-props) med ÉN
 * global trapes-easing: ramp opp i start, KONSTANT fart i midten, ramp ned på
 * slutt → ingen ease-in/out PER waypoint (= føles som ekte flyging).
 *
 * SKALERBAR PER PROSJEKT: banen er fullt parametrisert (`IntroPathConfig`) og
 * relativ til `target` (prosjektets home-koordinat). ETHVERT prosjekt får en
 * standard-intro via `DEFAULT_INTRO_PATH` uten config; per-prosjekt-tuning (f.eks.
 * innflyvnings-retning mot et landemerke) ligger i `board-intros.ts`. Spilt live
 * via `?fly=1` (BoardMap3D) og tatt opp av `scripts/capture-3d-flythrough.mjs` —
 * én kilde til banen, ingen duplisert kamera-matte.
 */

/** Den minimale camera-flaten vi driver (cast fra Map3DElement-instansen). */
export interface CameraDrivableMap3D {
  center: { lat: number; lng: number; altitude: number };
  range: number;
  tilt: number;
  heading: number;
}

export type IntroFlythroughPhase = "settling" | "running" | "done";

/** Alle knottene for én intro-bane. Per-prosjekt-config overstyrer delvis (se
 *  board-intros.ts); ikke-satte felt faller tilbake til DEFAULT_INTRO_PATH. */
export interface IntroPathConfig {
  /** Start-range i meter (avstand → lokasjons-innsikt). */
  rangeStart: number;
  /** Hero-range i meter (nærbilde på objektet). */
  rangeEnd: number;
  /** Start-tilt (grader; 0 = rett ned, 90 = horisont). */
  tiltStart: number;
  /** Hero-tilt (grader). */
  tiltEnd: number;
  /** Start-heading (grader) = hvilken retning vi flyr INN fra. Site-spesifikk:
   *  pek mot et landemerke (f.eks. 20 ≈ fra Nidarosdomen for Stasjonskvartalet). */
  startHeading: number;
  /** Total heading-sveip (grader) → størrelsen på ovalen. */
  sweepDeg: number;
  /** Hvor mye range buler ut midtveis (sin-bue) → oval "spenning". 0 = ren spiral. */
  ovalEccentricity: number;
  /** Total bevegelses-varighet (ms). */
  durationMs: number;
  /** ms å la tiles streame inn på start-posituren før bevegelsen. */
  settleMs: number;
}

/** Standard-intro som funker for ETHVERT prosjekt (oval-spiral rundt home-
 *  koordinatet). Validert mot tiles for Stasjonskvartalet; gode generelle verdier. */
export const DEFAULT_INTRO_PATH: IntroPathConfig = {
  rangeStart: 1150,
  rangeEnd: 300,
  tiltStart: 67,
  tiltEnd: 62,
  startHeading: 20,
  sweepDeg: 250,
  ovalEccentricity: 0.15,
  durationMs: 16000,
  settleMs: 3500,
};

/** Nedre grense for flytur-varigheten når den skaleres til velkommen-VO-en
 *  (produkt-koblingen i BoardMap3D). En kort velkomst skal ikke gi en frenetisk
 *  innflyvning — vi gulver heller flyturen og lar director-en overta etterpå. */
export const MIN_INTRO_FLY_MS = 8000;

export interface IntroFlythroughOptions {
  /** Objektet — kameraets låste look-at (typisk prosjektets home-koordinat). */
  target: { lat: number; lng: number };
  /** Per-prosjekt-overstyringer; ikke-satte felt arver DEFAULT_INTRO_PATH. */
  path?: Partial<IntroPathConfig>;
  /** Fase-callback (settling → running → done). Brukes bl.a. for capture-synk. */
  onPhase?: (phase: IntroFlythroughPhase) => void;
  /** prefers-reduced-motion: hopp til den vide etablerings-posituren (s=0) og
   *  HOLD — vis nærområdet uten flytur. Ingen rAF, ingen bevegelse. */
  staticOnly?: boolean;
  /** Lest hver frame. Når den returnerer true fryses flyturen (f.eks. velkommen-
   *  VO pauset) og gjenopptas der den slapp — ingen restart fra start. */
  isPaused?: () => boolean;
}

const EASE_IN = 0.16;
const EASE_OUT = 0.16;

/** Trapes-easing s(t): ramp opp [0,EI], konstant [EI,1-EO], ramp ned [1-EO,1].
 *  Normalisert så s(0)=0, s(1)=1, og farten er konstant i midten. */
function ease(t: number): number {
  const v = 1 / (1 - EASE_IN / 2 - EASE_OUT / 2);
  if (t < EASE_IN) return (v * t * t) / (2 * EASE_IN);
  if (t < 1 - EASE_OUT) return (v * EASE_IN) / 2 + v * (t - EASE_IN);
  const u = t - (1 - EASE_OUT);
  return (
    (v * EASE_IN) / 2 + v * (1 - EASE_OUT - EASE_IN) + v * (u - (u * u) / (2 * EASE_OUT))
  );
}

/** Kamera-positur ved bane-parameter s∈[0,1]. center = target (objektet sentrert).
 *  Ren funksjon — eksportert for enhetstesting. */
export function introPoseAt(
  s: number,
  target: { lat: number; lng: number },
  path: IntroPathConfig,
) {
  const base = path.rangeStart + (path.rangeEnd - path.rangeStart) * s;
  return {
    lat: target.lat,
    lng: target.lng,
    range: base * (1 + path.ovalEccentricity * Math.sin(Math.PI * s)),
    tilt: path.tiltStart + (path.tiltEnd - path.tiltStart) * s,
    heading: ((path.startHeading + path.sweepDeg * s) % 360 + 360) % 360,
  };
}

/**
 * Spill intro-flythrough på en Map3DElement-instans. Setter start-posituren
 * umiddelbart, lar tiles streame inn (settleMs), kjører så oval-spiralen frame-
 * for-frame til hero. Returnerer en `cancel`-funksjon (kall ved unmount eller
 * manuell takeover) som stopper rAF + timere umiddelbart.
 *
 * `staticOnly` (prefers-reduced-motion): hold den vide etablerings-posituren og
 * ferdig — ingen rAF, ingen bevegelse. `isPaused` leses hver frame: når den er
 * true fryses flyturen (akkumulerer ikke tid) og gjenopptas smooth der den slapp
 * — brukes til å fryse innflyvningen når velkommen-VO-en pauses.
 */
export function runIntroFlythrough(
  map: CameraDrivableMap3D,
  opts: IntroFlythroughOptions,
): () => void {
  const { target, onPhase, staticOnly, isPaused } = opts;
  const path: IntroPathConfig = { ...DEFAULT_INTRO_PATH, ...opts.path };
  let cancelled = false;
  let rafId = 0;

  const apply = (s: number) => {
    const p = introPoseAt(s, target, path);
    map.center = { lat: p.lat, lng: p.lng, altitude: 0 };
    map.range = p.range;
    map.tilt = p.tilt;
    map.heading = p.heading;
  };

  apply(0); // hopp til vid etablerings-positur før tile-settle
  onPhase?.("settling");

  // Redusert bevegelse: hold den vide etablerings-posituren (allerede satt via
  // apply(0)) og ferdig — vis nærområdet statisk, ingen flytur.
  if (staticOnly) {
    onPhase?.("done");
    return () => {
      cancelled = true;
    };
  }

  const settleTimer = setTimeout(() => {
    if (cancelled) return;
    onPhase?.("running");
    let last: number | null = null;
    let elapsed = 0; // aktiv (ikke-pauset) tid langs banen
    const frame = (ts: number) => {
      if (cancelled) return;
      if (last === null) last = ts;
      // Akkumuler kun mens IKKE pauset → pause fryser, resume fortsetter smooth.
      if (!isPaused?.()) elapsed += ts - last;
      last = ts;
      const t = Math.min(1, elapsed / path.durationMs);
      apply(ease(t));
      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        onPhase?.("done");
      }
    };
    rafId = requestAnimationFrame(frame);
  }, path.settleMs);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (settleTimer) clearTimeout(settleTimer);
  };
}
