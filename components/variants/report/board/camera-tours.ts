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
  // stasjonskvartalet fylles i Unit 7 via authoring-modus.
  stasjonskvartalet: {},
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
