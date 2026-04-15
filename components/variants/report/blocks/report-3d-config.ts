import type { POI } from "@/lib/types";
import { DEFAULT_THEMES } from "@/lib/themes/default-themes";

/**
 * Generell konfig for rapportens 3D-kart.
 * Erstatter wesselslokka-3d-config.ts — kamera og tabs er generelle,
 * POI-data hentes fra ekte prosjektdata via props (ikke dummy-data).
 */

/**
 * Kameraprofil. Bounds beregnes dynamisk rundt faktisk center i MapView3D.
 */
export const DEFAULT_CAMERA_LOCK = {
  range: 900,
  tilt: 45,
  minTilt: 15,
  maxTilt: 75,
  minAltitude: 200,
  maxAltitude: 3000,
  panHalfSideKm: 1.5,
} as const;

/** Rapportens tab-kategorier (i visningsrekkefølge). */
export const MAP3D_TAB_IDS = [
  "alle",
  "oppvekst",
  "mat",
  "natur",
  "transport",
  "trening",
] as const;

export type Map3DTabId = (typeof MAP3D_TAB_IDS)[number];

export const MAP3D_TAB_LABELS: Record<Map3DTabId, string> = {
  alle: "Alle",
  oppvekst: "Oppvekst",
  mat: "Mat & Drikke",
  natur: "Natur",
  transport: "Transport",
  trening: "Trening",
};

/** Mapping fra tab-ID til DEFAULT_THEMES.id */
const THEME_BY_TAB: Record<string, string> = {
  mat: "mat-drikke",
  oppvekst: "barnefamilier",
  natur: "kultur-opplevelser",
  transport: "transport",
  trening: "trening-velvare",
};

/** Filtrér POIer basert på aktiv tab, mot ekte kategori-IDs fra DEFAULT_THEMES. */
export function filterPoisByTab(pois: POI[], tabId: Map3DTabId): POI[] {
  if (tabId === "alle") return pois;
  const themeId = THEME_BY_TAB[tabId];
  const theme = DEFAULT_THEMES.find((t) => t.id === themeId);
  if (!theme) return pois;
  const catSet = new Set(theme.categories);
  return pois.filter((poi) => catSet.has(poi.category.id));
}
