"use client";

import { useEffect, useRef } from "react";
import type { ProjectMassing } from "@/lib/map/project-massing";
import type { Map3DInstance } from "@/components/map/map-view-3d";

interface ProjectMassingLayer3DProps {
  map3d: Map3DInstance | null;
  massing: ProjectMassing | null;
}

const SHELL_STROKE_WIDTH = 2.25;

/** Google-motoren tar bare CSS-farger, ikke Mapbox-paint. Palettens hex får
 *  derfor en alfa-kanal her: flatene må være gjennomsiktige nok til at
 *  fotoflisene under fortsatt leses som terreng. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Enkle, ekstruderte prosjektvolumer i Google Photorealistic 3D Tiles.
 *
 * Polygonene lever like lenge som den persistente Map3DElement-instansen.
 * Ved dataendring muteres path/stil; de remountes ikke. Det følger samme
 * WebGL-forsiktige lifecycle som rute- og konturlagene i denne kartmotoren.
 */
export function ProjectMassingLayer3D({
  map3d,
  massing,
}: ProjectMassingLayer3DProps) {
  const polygonByIdRef = useRef(
    new Map<string, google.maps.maps3d.Polygon3DElement>(),
  );

  useEffect(() => {
    if (!map3d) return;

    let cancelled = false;
    const polygonById = polygonByIdRef.current;

    if (!massing) {
      for (const polygon of polygonById.values()) {
        if (polygon.parentNode) polygon.remove();
      }
      return;
    }

    (async () => {
      try {
        const lib = (await google.maps.importLibrary(
          "maps3d",
        )) as google.maps.Maps3DLibrary;
        if (cancelled) return;

        const surfaces = massing.buildings;
        const fillColor = withAlpha(massing.palette.fill, 0.5);
        const strokeColor = withAlpha(massing.palette.line, 0.95);
        const activeIds = new Set(surfaces.map((surface) => surface.id));
        for (const [id, polygon] of polygonById) {
          if (!activeIds.has(id) && polygon.parentNode) polygon.remove();
        }

        for (const building of surfaces) {
          let polygon = polygonById.get(building.id);
          if (!polygon) {
            polygon = new lib.Polygon3DElement();
            polygonById.set(building.id, polygon);
          }

          polygon.path = building.footprint.map(([lng, lat]) => ({
            lat,
            lng,
            altitude: building.heightMeters,
          }));
          polygon.altitudeMode = lib.AltitudeMode.RELATIVE_TO_GROUND;
          polygon.extruded = true;
          polygon.fillColor = fillColor;
          polygon.strokeColor = strokeColor;
          polygon.strokeWidth = SHELL_STROKE_WIDTH;
          polygon.drawsOccludedSegments = false;

          if (polygon.parentNode && polygon.parentNode !== map3d) polygon.remove();
          if (!polygon.parentNode) map3d.append(polygon);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[ProjectMassingLayer3D] massing failed:", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [map3d, massing]);

  useEffect(() => {
    const polygonById = polygonByIdRef.current;
    return () => {
      for (const polygon of polygonById.values()) {
        if (polygon.parentNode) polygon.remove();
      }
      polygonById.clear();
    };
  }, []);

  return null;
}
