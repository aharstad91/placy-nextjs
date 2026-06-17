import type { CameraPose, CategoryCameraConfig } from "@/lib/types";

/**
 * Prototype-lokal kilde til per-kategori kamera-waypoints for 3D-rapport-boardet.
 *
 * Keyed på prosjekt-slug → kategori-id → {a, b?, moveDurationMs?}. Dette er
 * BEVISST en lokal fil (ikke Supabase) på prototype-stadiet: enkel å iterere på
 * (rediger + reload), null DB-plumbing. Prod-promotering til
 * `ReportThemeConfig.camera` i `products.config` er deferert (se planen
 * docs/plans/2026-06-02-001-...). Autorer nye punkt via `?author=1`-modus i
 * 3D-visningen (CameraWaypointAuthor) og lim JSON-en inn her.
 *
 * MERK: kun prosjekter som står oppført her får cinematic A→B; alle andre
 * faller tilbake til drone-orbit (graceful, se BoardMap3D-director).
 */
const CAMERA_TOURS: Record<string, Record<string, CategoryCameraConfig>> = {
  stasjonskvartalet: {
    // Tomte-landing (Unit 3): under "transport"-kapittelet flyr kameraet fra
    // vid by-kontekst (A) og lander tett på prosjekt-tomta (B) ved
    // kollektivknutepunktet. Begge poser er sentrert på prosjekt-koordinatet
    // (Sjøgangen 7) → en ren "senk kameraet ned på tomta"-bevegelse.
    // Autorert mot tiles i browser (?author=1). MERK: reduced-motion → director
    // holder statisk på A (vid) — utenfor scope å endre her.
    //
    // Disse lat/lng er prosjektets home-koordinat (data.home.coordinates ←
    // Supabase projects.center_lat/lng for stasjonskvartalet). Verifisert
    // 2026-06-03 (63.436523, 10.400747). Endres prosjekt-senteret i Supabase
    // bør disse oppdateres så kameraet fortsatt lander på tomta.
    // Establishing → settle: åpner vidt (A, range 1150) og senker seg til et
    // oversiktsnivå (B, range 810) ved kollektivknutepunktet. B-range matcher
    // gulvet de deriverte kategoriene bruker (DERIVE_RANGE_MIN) så transport ikke
    // lander tettere enn resten — POI-ene (stasjon, holdeplasser, hurtigbåt) blir
    // synlige. NB: var range 260 (dramatisk dykk helt ned på tomta); hevet for
    // konsistent zoom-gulv på alle kategorier. Senk B igjen for å få dykket tilbake.
    transport: {
      a: { lat: 63.436523, lng: 10.400747, range: 1150, tilt: 50, heading: 200 },
      b: { lat: 63.436523, lng: 10.400747, range: 810, tilt: 52, heading: 200 },
      moveDurationMs: 9000,
    },
  },
  // Grilstad Marina (byggetrinn 4, Fullriggerøya). STARTPOSER — autorert mot
  // prosjekt-koordinatet (63.43826, 10.50872), IKKE verifisert mot 3D-tiles
  // ennå. Signatur-kategoriene (sjø/marina) får A→B "senk kameraet ned mot
  // vannet"; resten faller tilbake til orbit. Finjuster via ?author=1 i browser
  // (CameraWaypointAuthor) og lim inn de eksakte posene her. Headingene peker
  // mot fjorden/marinaen (nord-/nordvest-vendt) — verifiser retning visuelt.
  "byggetrinn-4": {
    "natur-friluftsliv": {
      a: { lat: 63.43826, lng: 10.50872, range: 1100, tilt: 50, heading: 20 },
      b: { lat: 63.43826, lng: 10.50872, range: 760, tilt: 55, heading: 20 },
      moveDurationMs: 9000,
    },
    "marina-batliv": {
      a: { lat: 63.43826, lng: 10.50872, range: 1000, tilt: 48, heading: 340 },
      b: { lat: 63.43826, lng: 10.50872, range: 700, tilt: 53, heading: 340 },
      moveDurationMs: 9000,
    },
  },
};

/** Normaliserer en pose defensivt: tilt klampes 0–90, heading til [0,360),
 *  range til minst 1 m. lat/lng er absolutte koordinater og slippes gjennom.
 *  Eksportert for enhetstesting. */
export function clampPose(pose: CameraPose): CameraPose {
  return {
    lat: pose.lat,
    lng: pose.lng,
    range: Math.max(1, pose.range),
    tilt: Math.min(90, Math.max(0, pose.tilt)),
    heading: ((pose.heading % 360) + 360) % 360,
  };
}

/** Hele kamera-turen for et prosjekt, eller `undefined` for ukjent slug. */
export function getCameraTour(
  slug: string,
): Record<string, CategoryCameraConfig> | undefined {
  return CAMERA_TOURS[slug];
}

/**
 * Kamera-konfigen for én kategori i ett prosjekt, med clampede poser.
 * Returnerer `undefined` for ukjent slug/kategori (→ orbit-fallback i directoren).
 */
export function getCategoryCamera(
  slug: string,
  categoryId: string,
): CategoryCameraConfig | undefined {
  const raw = CAMERA_TOURS[slug]?.[categoryId];
  if (!raw) return undefined;
  return {
    a: clampPose(raw.a),
    b: raw.b ? clampPose(raw.b) : undefined,
    moveDurationMs: raw.moveDurationMs,
  };
}
