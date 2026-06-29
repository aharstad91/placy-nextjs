/**
 * «Establishing shot»-flythrough for 3D-rapport-boardet — én SAMMENHENGENDE
 * helikopter-flyover langs en RUTE (waypoints) som etablerer strøket.
 *
 * Grammatikk (etter feedback: ingen jump-cuts, ingen ujevn fart):
 *  • Kameraet flyr en RUTE definert av ordnede waypoints (look-at-punkter). Ruta
 *    glattes med en CENTRIPETAL Catmull-Rom-spline → myke svinger uten overshoot/
 *    cusp selv i skarpe hjørner (f.eks. U-vendinger).
 *  • Banen RESAMPLES etter EKTE BUELENGDE: anker-punktene gjøres om til en tett
 *    poly-linje (~48 steg/segment) med kumulativ buelengde, og kameraet beveger seg
 *    i KONSTANT bakke-fart langs den. Det fjerner «rykket» som oppstår når farten
 *    varierer innad i et spline-segment eller bremser i hjørner.
 *  • Heading utledes fra rutas tangent (reise-retningen): kameraet ser ALLTID dit
 *    det flyr og trekker bak look-at-punktet → heading svinger aldri vilt.
 *  • Range/tilt eases mykt høyt → lavt.
 *
 * Drives FRAME-FOR-FRAME (requestAnimationFrame + direkte camera-props) med ÉN
 * global trapes-easing (ramp opp, KONSTANT fart i midten, ramp ned). Kombinert med
 * buelengde-resamplingen gir den konstante midten ekte konstant bakke-fart. Ingen
 * voice-over/lyd — ren visuell komposisjon. Ruter per strøk: board-establishing-shots.ts.
 */

import type { CameraDrivableMap3D } from "./board-intro-flythrough";

export type EstablishingPhase = "settling" | "running" | "done";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface EstablishingPathConfig {
  /** Ordnet RUTE helikopteret flyr over (look-at-punkter på bakken). ≥ 2 punkter.
   *  Ankere — motoren resampler dem til en tett, jevn-fart-kurve. Kameraet starter
   *  bak første punkt og lander på siste. */
  waypoints: LatLng[];
  /** Start-range i meter (vidt etablerings-blikk fra kanten). */
  rangeStart: number;
  /** Hero-range i meter (nær landing på slutten av ruta). */
  rangeEnd: number;
  /** Start-tilt (grader; 0 = rett ned, 90 = horisont). */
  tiltStart: number;
  /** Hero-tilt (grader). */
  tiltEnd: number;
  /** Konstant tillegg til den auto-utledede tangent-headingen (grader). Default 0
   *  = se rett fremover langs ruta. Positiv = «bank» med klokka. */
  headingOffset?: number;
  /** Total bevegelses-varighet (ms). */
  durationMs: number;
  /** ms å la tiles streame inn på start-posituren før bevegelsen. */
  settleMs: number;
  /** 0–1: bane-parameter der reveal-en (blobs + pins) skal fyre — typisk midtveis
   *  når strøket er etablert, før kameraet strammer inn mot landing. */
  bloomAtProgress: number;
}

export interface EstablishingFlythroughOptions {
  path: EstablishingPathConfig;
  onPhase?: (phase: EstablishingPhase) => void;
  /** Kalt hver frame med global bane-parameter s∈[0,1] (etter easing). Brukes til
   *  å fyre reveal-kaskaden ved bloom-punktet. */
  onProgress?: (s: number) => void;
  /** prefers-reduced-motion: hopp til start-posituren og HOLD — ingen flytur. */
  staticOnly?: boolean;
  /** Lest hver frame; true fryser flyturen og gjenopptar smooth (ingen restart). */
  isPaused?: () => boolean;
}

const EASE_IN = 0.14;
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

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const norm360 = (deg: number) => ((deg % 360) + 360) % 360;

const METERS_PER_DEG_LAT = 110540;
const METERS_PER_DEG_LNG_AT = (latDeg: number) =>
  111320 * Math.cos((latDeg * Math.PI) / 180);

/** Plan avstand i meter mellom to lat/lng (equirektangulær — god nok i ett strøk). */
function chordMeters(a: LatLng, b: LatLng): number {
  const midLat = (a.lat + b.lat) / 2;
  const dx = (b.lng - a.lng) * METERS_PER_DEG_LNG_AT(midLat);
  const dy = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}

/** Kompass-bearing (0=nord, 90=øst) fra a mot b. */
function bearingDeg(a: LatLng, b: LatLng): number {
  const midLat = (a.lat + b.lat) / 2;
  const east = (b.lng - a.lng) * METERS_PER_DEG_LNG_AT(midLat);
  const north = (b.lat - a.lat) * METERS_PER_DEG_LAT;
  return norm360((Math.atan2(east, north) * 180) / Math.PI);
}

interface XY {
  x: number;
  y: number;
}
const lerpXY = (a: XY, b: XY, u: number): XY => ({
  x: a.x + (b.x - a.x) * u,
  y: a.y + (b.y - a.y) * u,
});

/** Centripetal Catmull-Rom (alpha=0.5) for ett segment p1→p2 (p0/p3 = naboer),
 *  lokal t∈[0,1]. Barry-Goldman-pyramiden — gir myke svinger uten cusp/loop selv
 *  ved skarpe vinkler. Punktene er i projisert meter-rom (XY). */
function centripetalPoint(p0: XY, p1: XY, p2: XY, p3: XY, t: number): XY {
  const knot = (ti: number, a: XY, b: XY) => {
    const d = Math.pow(Math.hypot(b.x - a.x, b.y - a.y), 0.5);
    return ti + (d < 1e-9 ? 1e-6 : d); // unngå degenererte (sammenfallende) knoter
  };
  const t0 = 0;
  const t1 = knot(t0, p0, p1);
  const t2 = knot(t1, p1, p2);
  const t3 = knot(t2, p2, p3);
  const tt = t1 + (t2 - t1) * t;
  const A1 = lerpXY(p0, p1, (tt - t0) / (t1 - t0));
  const A2 = lerpXY(p1, p2, (tt - t1) / (t2 - t1));
  const A3 = lerpXY(p2, p3, (tt - t2) / (t3 - t2));
  const B1 = lerpXY(A1, A2, (tt - t0) / (t2 - t0));
  const B2 = lerpXY(A2, A3, (tt - t1) / (t3 - t1));
  return lerpXY(B1, B2, (tt - t1) / (t2 - t1));
}

/** Tett, buelengde-indeksert poly-linje bygget fra waypoint-ankrene (centripetal
 *  Catmull-Rom, projisert til lokalt meter-rom for korrekt knot-spacing). */
export interface DensePath {
  pts: LatLng[];
  /** Kumulativ buelengde i meter; cum[0]=0, cum[i]=Σ chord(pts[0..i]). */
  cum: number[];
  total: number;
}

const SAMPLES_PER_SEGMENT = 48;

export function buildDensePath(wps: LatLng[]): DensePath {
  if (wps.length === 0) return { pts: [{ lat: 0, lng: 0 }], cum: [0], total: 0 };
  if (wps.length === 1) return { pts: [wps[0]], cum: [0], total: 0 };

  const ref = wps[0];
  const mLng = METERS_PER_DEG_LNG_AT(ref.lat);
  const mLat = METERS_PER_DEG_LAT;
  const proj = (p: LatLng): XY => ({
    x: (p.lng - ref.lng) * mLng,
    y: (p.lat - ref.lat) * mLat,
  });
  const unproj = (q: XY): LatLng => ({
    lat: ref.lat + q.y / mLat,
    lng: ref.lng + q.x / mLng,
  });

  const P = wps.map(proj);
  const n = P.length;
  const pts: LatLng[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[i - 1] ?? P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] ?? P[i + 1];
    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      pts.push(unproj(centripetalPoint(p0, p1, p2, p3, s / SAMPLES_PER_SEGMENT)));
    }
  }
  pts.push(wps[n - 1]); // eksakt siste anker

  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + chordMeters(pts[i - 1], pts[i]));
  }
  return { pts, cum, total: cum[cum.length - 1] };
}

/** Posisjon på den tette banen ved buelengde `dist` (meter), lineær interp mellom
 *  to nabo-samples → konstant fart når `dist` skrider jevnt. */
function lookupAt(path: DensePath, dist: number): LatLng {
  const { pts, cum, total } = path;
  if (pts.length === 1 || total === 0) return pts[0];
  const d = dist < 0 ? 0 : dist > total ? total : dist;
  let lo = 1;
  let hi = cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] < d) lo = mid + 1;
    else hi = mid;
  }
  const i = lo;
  const seg = cum[i] - cum[i - 1] || 1;
  const f = (d - cum[i - 1]) / seg;
  const a = pts[i - 1];
  const b = pts[i];
  return { lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f };
}

/** Kamera-positur ved global bane-parameter s∈[0,1] gitt en ferdigbygget DensePath.
 *  Heading fra et lite buelengde-look-ahead (alltid fremover). */
export function poseAt(
  path: DensePath,
  cfg: EstablishingPathConfig,
  s: number,
): { lat: number; lng: number; range: number; tilt: number; heading: number } {
  const u = clamp01(s);
  const total = path.total;
  const dist = u * total;
  const pos = lookupAt(path, dist);

  const eps = Math.max(3, total * 0.003);
  let d0 = dist - eps;
  let d1 = dist + eps;
  if (d0 < 0) {
    d0 = 0;
    d1 = Math.min(total, 2 * eps);
  } else if (d1 > total) {
    d1 = total;
    d0 = Math.max(0, total - 2 * eps);
  }
  const a = lookupAt(path, d0);
  const b = lookupAt(path, d1);

  return {
    lat: pos.lat,
    lng: pos.lng,
    range: cfg.rangeStart + (cfg.rangeEnd - cfg.rangeStart) * u,
    tilt: cfg.tiltStart + (cfg.tiltEnd - cfg.tiltStart) * u,
    heading: norm360(bearingDeg(a, b) + (cfg.headingOffset ?? 0)),
  };
}

/** Kamera-positur ved s∈[0,1]. Ren funksjon — eksportert for enhetstesting.
 *  Bygger DensePath på nytt hver gang (greit for test/få kall); run-loopen bygger
 *  den ÉN gang og kaller poseAt direkte. */
export function establishingPoseAt(
  s: number,
  cfg: EstablishingPathConfig,
): { lat: number; lng: number; range: number; tilt: number; heading: number } {
  return poseAt(buildDensePath(cfg.waypoints), cfg, s);
}

/**
 * Spill establishing-flythrough på en Map3DElement-instans. Bygger den tette banen
 * én gang, setter start-posituren, lar tiles streame inn (settleMs), kjører så
 * flyoveren frame-for-frame i konstant fart til landing. Returnerer en `cancel`-
 * funksjon (kall ved unmount eller manuell takeover) som stopper rAF + timere.
 */
export function runEstablishingFlythrough(
  map: CameraDrivableMap3D,
  opts: EstablishingFlythroughOptions,
): () => void {
  const { path: cfg, onPhase, onProgress, staticOnly, isPaused } = opts;
  const dense = buildDensePath(cfg.waypoints);
  let cancelled = false;
  let rafId = 0;

  const apply = (s: number) => {
    const p = poseAt(dense, cfg, s);
    map.center = { lat: p.lat, lng: p.lng, altitude: 0 };
    map.range = p.range;
    map.tilt = p.tilt;
    map.heading = p.heading;
  };

  apply(0); // hopp til vid kant-positur før tile-settle
  onPhase?.("settling");

  if (staticOnly) {
    onProgress?.(0);
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
      if (!isPaused?.()) elapsed += ts - last;
      last = ts;
      const t = Math.min(1, elapsed / cfg.durationMs);
      const s = ease(t);
      apply(s);
      onProgress?.(s);
      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        onPhase?.("done");
      }
    };
    rafId = requestAnimationFrame(frame);
  }, cfg.settleMs);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (settleTimer) clearTimeout(settleTimer);
  };
}
