import type { CategoryCameraConfig } from "@/lib/types";

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
/** Tilt under orbit (grader; 0 = rett ned, 90 = horisont). */
export const ORBIT_TILT = 60;
/** Start-heading for orbiten (orbiten går 360°, så dette er bare startpunkt). */
export const ORBIT_HEADING = 0;
/** Varighet for én full orbit-revolusjon (ms). Looper evig (repeatCount: Infinity). */
export const ORBIT_ROUND_MS = 90000;
/** Inn-fly-varighet til orbit-hero før orbiten (gjen)starter (ms). */
export const REAIM_FLY_MS = 1600;
/** Range/tilt + fly-varighet ved åpnet POI (tett og skrått). */
export const POI_RANGE = 300;
export const POI_TILT = 60;
export const POI_FLY_MS = 900;
/** Fallback A→B-varighet når verken config-override eller audio-lengde finnes (ms). */
export const DEFAULT_CINEMATIC_MS = 16000;

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
  | { kind: "orbit"; hero: Hero3DCamera }
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
 *  1. `free` — brukeren styrer; ingen programmatisk bevegelse.
 *  2. `poi` — en POI er åpen; fly tett inn.
 *  3. `cinematic` — auto + aktiv kategori MED waypoints; A→B (eller hold).
 *  4. `orbit` — fallback (auto, ingen kategori, eller kategori uten waypoints).
 */
export function decideCameraIntent(input: CameraDecisionInputs): CameraIntent {
  const { cameraMode, home, activePOI, activeCategoryId, categoryConfig } = input;

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

  return {
    kind: "orbit",
    hero: {
      center: { lat: home.lat, lng: home.lng, altitude: 0 },
      range: ORBIT_RANGE,
      tilt: ORBIT_TILT,
      heading: ORBIT_HEADING,
    },
  };
}
