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
