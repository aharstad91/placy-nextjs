import { deriveCategoryCamera } from "./board-3d-camera-director";
import { getCategoryCamera } from "./camera-tours";
import type { CategoryCameraConfig } from "@/lib/types";

type Coordinates = { lat: number; lng: number };

/**
 * Minimal strukturell input-form av en board-kategori for kamera-komposisjonen.
 * Bevisst IKKE `BoardCategory` — funksjonen trenger kun `id` + de to POI-listene,
 * og en smal strukturell type lar den enhetstestes uten tunge `BoardPOI`-fixtures.
 * `BoardCategory` er strukturelt assignerbar hit (id ⊆ string, POI-ene har coordinates).
 */
export interface CategoryCameraInput {
  id: string;
  /** Score-rangerte topp-POI-er — foretrukket anker-sett for den utledede A→B-buen. */
  topRankedPois: { coordinates: Coordinates }[];
  /** Alle (distanse-sorterte) POI-er — fallback når `topRankedPois` er tom. */
  pois: { coordinates: Coordinates }[];
}

/**
 * PRD 10 Unit 4 — autorert kategori-tour-komposisjon (G4).
 *
 * Komponerer den autorerte DATA-en (PRD 9 `getCategoryCamera`/`camera-tours`) med
 * MEKANISMEN (PRD 6 `deriveCategoryCamera` i `board-3d-camera-director`) til én
 * kamera-config som mates til `useBoard3DCamera`. PRD 10 KONSUMERER begge — det
 * re-hjemler INGEN av dem (eierskaps-grense, Unit 4 AC3). Ekstrahert fra
 * `BoardMap3D`s `categoryConfig`-useMemo så forrangs-logikken (AC1) er enhetstestbar
 * (samme «hjemle ren beslutnings-funksjon fra closuren»-balanse som Unit 1s
 * `deriveIntroFlightPlan`) — atferd er byte-identisk med den tidligere inline-koden.
 *
 * Forrang (AC1):
 *   1. Eksplisitt autorert tur (`getCategoryCamera`) — har forrang når den finnes.
 *   2. Ellers utledet A→B-bue (`deriveCategoryCamera`) fra kategoriens
 *      `topRankedPois` (foretrukket), eller `pois` når topRanked er tom.
 *   3. Ellers `undefined` → graceful orbit-fallback i directoren (ingen POI-er).
 *
 * `undefined` også ved manglende `activeCategory`: kategori-skifte uten waypoints
 * rører IKKE kameraet — orbiten går uavbrutt videre (AC2).
 */
export function deriveCategoryCameraConfig(
  activeCategory: CategoryCameraInput | null | undefined,
  projectSlug: string,
  home: Coordinates,
): CategoryCameraConfig | undefined {
  if (!activeCategory) return undefined;
  const explicit = getCategoryCamera(projectSlug, activeCategory.id);
  if (explicit) return explicit;
  const src =
    activeCategory.topRankedPois.length > 0
      ? activeCategory.topRankedPois
      : activeCategory.pois;
  const coords = src.map((p) => p.coordinates);
  return deriveCategoryCamera(home, coords) ?? undefined;
}
