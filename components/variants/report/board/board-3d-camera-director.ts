import type { CameraPose, CategoryCameraConfig } from "@/lib/types";

/** Et 3D-kamera klart for flyCameraTo / flyCameraAround. */
export interface Hero3DCamera {
  center: { lat: number; lng: number; altitude: number };
  range: number;
  tilt: number;
  heading: number;
}

/** Den imperative Map3DElement-flaten vi bruker (cast fra map3dInstance). */
export type FlyCapableMap = {
  flyCameraTo?: (opts: { endCamera: Hero3DCamera; durationMillis: number }) => void;
  flyCameraAround?: (opts: {
    camera: Hero3DCamera;
    durationMillis: number;
    repeatCount?: number;
  }) => void;
  stopCameraAnimation?: () => void;
};

// ── Kamera-konstanter ───────────────────────────────────────────────────────
/** FAST avstand (m) fra prosjektet under orbit. Kameraet zoomer ALDRI ut for å
 *  ramme alle pins — det står på fast avstand der man relaterer til innholdet. */
export const ORBIT_RANGE = 650;
/** Tilt under orbit (grader; 0 = rett ned, 90 = horisont). Bevisst høyt
 *  vinklet (mer ovenfra) → mindre horisont/fjern-geometri i bildet = færre
 *  tiles å hente og mindre å tegne, uten å miste nærområde-konteksten. */
export const ORBIT_TILT = 50;
/** Start-heading for orbiten (orbiten går 360°, så dette er bare startpunkt). */
export const ORBIT_HEADING = 0;
/** Varighet for én full orbit-revolusjon (ms). Looper evig (repeatCount: Infinity).
 *  Bevisst rolig (140s/runde) — idle-orbiten skal være knapt merkbar drift, ikke
 *  en bevegelse man "følger med på" oppå video + voice-over (kognitiv ro). */
export const ORBIT_ROUND_MS = 140000;
/** Inn-fly-varighet til orbit-hero før orbiten (gjen)starter (ms). */
export const REAIM_FLY_MS = 1600;
/** Range/tilt + fly-varighet ved åpnet POI (tett og skrått). */
export const POI_RANGE = 300;
export const POI_TILT = 60;
export const POI_FLY_MS = 900;
/** Oppsummerings-positur ("Oppsummert"-beaten): kameraet trekkes litt ut til et
 *  rolig oversiktsbilde av hele nabolaget, og kontrollen gis til brukeren (fri).
 *  Range bevisst videre enn orbit (650) men ikke fugleperspektiv. Drevet
 *  imperativt fra BoardMap3D (director-en er no-op i fri), så ingen orbit
 *  overstyrer den. */
export const SUMMARY_RANGE = 1100;
export const SUMMARY_TILT = 52;
export const SUMMARY_FLY_MS = 2500;
/** Fallback A→B-varighet når verken config-override eller audio-lengde finnes (ms). */
export const DEFAULT_CINEMATIC_MS = 16000;
/** Cut-transition: fade inn/ut-varighet (ms). Eneste sannhetskilde — CameraCutOverlay
 *  leser denne og setter CSS-transition-varigheten fra den, så fade og kamera-hopp
 *  aldri kan desynke (hopper skjer ved t = CUT_FADE_MS, når laget er helt dekkende).
 *  Bevisst rolig (myk inn/ut) så kapittel-skiftet leses, ikke oppfattes som et kutt. */
export const CUT_FADE_MS = 550;
/** Cut-transition: hold svart etter instant-hopp så tiles rekker å laste (ms). */
export const CUT_SETTLE_MS = 300;

/** Bearing (grader, 0 = nord) fra punkt A mot punkt B. Ren. */
export function bearingBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** Avstand i meter mellom to lat/lng-punkt (haversine). Ren. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ── Auto-utledet framing ────────────────────────────────────────────────────
// Når en kategori IKKE har eksplisitte waypoints, utleder vi A/B fra kategoriens
// POI-tyngdepunkt + hjemmet. Kameraet sentreres på midtpunktet mellom hjem og
// innhold (så BEGGE er i bildet — R1), og svinger en rolig bue (heading ±DRIFT)
// rundt det punktet under voice-overen — «dronen flyr rundt nabolaget». Range
// skaleres med hjem→innhold-avstanden, men KLAMPES så en spredt kategori aldri
// havner i orbit-høyde (den lærdommen). Eksplisitt config overstyrer alltid.
// Mer ovenfra (lavere tilt) enn før (var 60) → høyere blikk, mindre horisont/
// fjern-geometri = færre tiles. Matcher ORBIT_TILT for et koherent 3D-look.
const DERIVE_TILT = 50;
/** Heading-drift (grader) til hver side av hjem→innhold-bæringen. A→B-sveipet
 *  blir 2×denne. Bevisst lav (12° → 24° totalt) så den auto-utledede dronen gir
 *  rolig parallakse/dybde uten å bli en bevegelse man må følge kognitivt oppå
 *  video + voice-over. Eksportert så testen kan utlede sveip-spennet herfra. */
export const DERIVE_DRIFT_DEG = 12;
// Gulvet er bevisst høyt (≈ mat-drikke/hverdagsliv sitt nivå, målt mot ekte
// data): tett-klyngede kategorier (få meter fra hjemmet) traff før et lavt gulv
// (350) og endte FOR NÆRE objektet — POI-ene falt utenfor bildet. Hele poenget
// med kategori-kameraet er å vise nærområdet, så vi holder alle kategoriene minst
// like vidt som de spredte (mat-drikke 850 / hverdagsliv 811). Maks holdes på 850.
const DERIVE_RANGE_MIN = 810;
const DERIVE_RANGE_MAX = 850;

/**
 * Utleder en CategoryCameraConfig (A→B-bue) fra hjem + kategoriens POI-er.
 * Returnerer null når det ikke er noen POI-er (→ orbit-fallback i directoren).
 */
export function deriveCategoryCamera(
  home: { lat: number; lng: number },
  poiCoords: { lat: number; lng: number }[],
): CategoryCameraConfig | null {
  if (poiCoords.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  for (const p of poiCoords) {
    latSum += p.lat;
    lngSum += p.lng;
  }
  const centroid = { lat: latSum / poiCoords.length, lng: lngSum / poiCoords.length };
  const mid = {
    lat: (home.lat + centroid.lat) / 2,
    lng: (home.lng + centroid.lng) / 2,
  };
  const dist = haversineMeters(home, centroid);
  const range = Math.min(
    DERIVE_RANGE_MAX,
    Math.max(DERIVE_RANGE_MIN, Math.round(dist * 1.6 + 200)),
  );
  const base = bearingBetween(home, centroid);
  const pose = (headingOffset: number): CameraPose => ({
    lat: Number(mid.lat.toFixed(6)),
    lng: Number(mid.lng.toFixed(6)),
    range,
    tilt: DERIVE_TILT,
    heading: ((base + headingOffset) % 360 + 360) % 360,
  });
  return { a: pose(-DERIVE_DRIFT_DEG), b: pose(DERIVE_DRIFT_DEG) };
}

/** Gjør en autorert CameraPose om til et Hero3DCamera (altitude alltid 0). */
function poseToHero(pose: CategoryCameraConfig["a"]): Hero3DCamera {
  return {
    center: { lat: pose.lat, lng: pose.lng, altitude: 0 },
    range: pose.range,
    tilt: pose.tilt,
    heading: pose.heading,
  };
}

/**
 * Resultatet av kamera-beslutningen — HVA kameraet skal gjøre. Det imperative
 * laget (hooken) oversetter dette til flyCameraTo/flyCameraAround-kall.
 */
export type CameraIntent =
  | { kind: "free" }
  | { kind: "poi"; pose: Hero3DCamera }
  | {
      kind: "orbit";
      hero: Hero3DCamera;
      /** Sann når vi går INN i orbit fra en annen kamera-kontekst (velkommen-
       *  innflyvningen [free] eller et cinematic kategori-skifte) → krever en cut-
       *  transition som maskerer fly-overen fra det fjerne kameraet til orbit-
       *  startpunktet. Usann ved orbit→orbit (uavbrutt), kald første-mount, eller
       *  retur fra en åpnet POI (myk fly-tilbake). */
      cut: boolean;
    }
  | {
      kind: "cinematic";
      /** Hvilken kategori denne cinematic-beaten gjelder (for cut-deteksjon). */
      categoryId: string;
      /** Start-positur (alltid satt). */
      a: Hero3DCamera;
      /** Slutt-positur. `null` = hold/orbit ved A (A-only eller redusert bevegelse). */
      b: Hero3DCamera | null;
      /** A→B-varighet (ms). 0 ved redusert bevegelse (statisk hold). */
      durationMs: number;
      /** Sann når kamera-konteksten endret seg → krever cut-transition (Unit 4). */
      cut: boolean;
      /** Brukeren foretrekker redusert bevegelse → statisk hold, ingen fade. */
      reducedMotion: boolean;
      /** Audio er pauset → frys bevegelsen (ikke (re)start A→B). */
      paused: boolean;
    };

export interface CameraDecisionInputs {
  cameraMode: "auto" | "free";
  /** Intro-flythrough eier kameraet (velkommen-beat i produktet eller ?fly=1-
   *  capture) → director-en yield-er; den frame-drevne innflyvningen styrer. */
  introActive: boolean;
  home: { lat: number; lng: number };
  /** Aktiv POI sine koordinater, eller null. */
  activePOI: { lat: number; lng: number } | null;
  activeCategoryId: string | null;
  /** Per-kategori waypoints, eller undefined (→ orbit-fallback). */
  categoryConfig: CategoryCameraConfig | undefined;
  /** Voice-over-lengde (ms) for den aktive kategorien, eller undefined. */
  audioDurationMs: number | undefined;
  /** Audio pauset midt i et beat. */
  audioPaused: boolean;
  /** prefers-reduced-motion. */
  reducedMotion: boolean;
  /** Forrige intent (for cut-deteksjon). */
  prevIntent: CameraIntent | null;
}

/**
 * Ren beslutnings-funksjon for 3D-board-kameraet. Synkron og side-effektfri →
 * enhetstestbar uten et kart. Det imperative laget (use-board-3d-camera) kaller
 * denne og utfører resultatet.
 *
 * Prioritet:
 *  0. `introActive` — intro-flythrough eier kameraet; director-en no-op'er (free).
 *  1. `free` — brukeren styrer; ingen programmatisk bevegelse.
 *  2. `poi` — en POI er åpen; fly tett inn.
 *  3. `cinematic` — auto + aktiv kategori MED waypoints; A→B (eller hold).
 *  4. `orbit` — fallback (auto, ingen kategori, eller kategori uten waypoints).
 */
export function decideCameraIntent(input: CameraDecisionInputs): CameraIntent {
  const { cameraMode, home, activePOI, activeCategoryId, categoryConfig } = input;

  // Intro-flythrough kjører (velkommen-beat / ?fly=1) → den frame-for-frame-
  // drevne innflyvningen i BoardMap3D eier kameraet. Director-en må ikke røre
  // det (ellers kjemper orbit/cinematic mot flyturen). Free = ren no-op.
  if (input.introActive) return { kind: "free" };

  if (cameraMode === "free") return { kind: "free" };

  if (activePOI) {
    return {
      kind: "poi",
      pose: {
        center: { lat: activePOI.lat, lng: activePOI.lng, altitude: 0 },
        range: POI_RANGE,
        tilt: POI_TILT,
        heading: bearingBetween(home, activePOI),
      },
    };
  }

  if (activeCategoryId && categoryConfig) {
    const reduced = input.reducedMotion;
    const a = poseToHero(categoryConfig.a);
    const b = reduced ? null : categoryConfig.b ? poseToHero(categoryConfig.b) : null;
    const durationMs = reduced
      ? 0
      : categoryConfig.moveDurationMs ?? input.audioDurationMs ?? DEFAULT_CINEMATIC_MS;
    // cut når vi IKKE allerede var cinematic på samme kategori (kategori-skifte,
    // idle→første, free→resume) — ikke ved en ren re-render av samme beat.
    const prev = input.prevIntent;
    const cut = !(prev?.kind === "cinematic" && prev.categoryId === activeCategoryId);
    return {
      kind: "cinematic",
      categoryId: activeCategoryId,
      a,
      b,
      durationMs,
      cut,
      reducedMotion: reduced,
      paused: input.audioPaused,
    };
  }

  // Cut INN i orbit når forrige kamera-kontekst var noe annet enn orbit/POI:
  //  • free → orbit: velkommen-innflyvningen er ferdig og nabolaget (uten
  //    waypoints) overtar — ELLER bruker re-engasjerer auto etter manuell pan.
  //  • cinematic → orbit: kategori-skifte fra en waypoint-kategori til en uten.
  // Orbit→orbit holder vi uavbrutt (ingen cut), og prev=null (kald første-mount)
  // + retur fra en åpnet POI fly-er mykt inn uten cream-flash.
  const prev = input.prevIntent;
  const cut = prev != null && prev.kind !== "orbit" && prev.kind !== "poi";
  return {
    kind: "orbit",
    cut,
    hero: {
      center: { lat: home.lat, lng: home.lng, altitude: 0 },
      range: ORBIT_RANGE,
      tilt: ORBIT_TILT,
      heading: ORBIT_HEADING,
    },
  };
}
