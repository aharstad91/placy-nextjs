"use client";

import { useEffect, useRef } from "react";
import type { ProjectMassing } from "@/lib/map/project-massing";
import type { Map3DInstance } from "@/components/map/map-view-3d";

interface ProjectMassingLayer3DProps {
  map3d: Map3DInstance | null;
  massing: ProjectMassing | null;
}

const SHELL_STROKE_WIDTH = 2.25;
const GROUND_ID = "__site-ground";
const STREET_ID = "__site-street";
const PATH_ID = "__site-path";
/** Grunnflaten skal dekke asfalten, men ikke flate ut jordet. Litt av flisen
 *  under slipper gjennom, så sol og skygge fra fotografiet blir stående — det
 *  er den variasjonen som gjør at kanten ikke leses som en kant. */
const GROUND_ALPHA = 0.8;

/** Gate og sti er de eneste flatene her som skal *dekke* grunnflaten under seg.
 *  Slipper vi det grønne gjennom, får asfalten grønnskjær og forsvinner i
 *  jordet — og da har vi tegnet en gate ingen ser. */
const SURFACE_ALPHA = 0.95;

/** Volumene skal lese som bordmodellen på salgskontoret: hvit akryl.
 *
 *  Nesten tett, ikke gjennomskinnelig. Det er motsatt av hva man skulle tro,
 *  og det er målt: motoren skyggelegger flatene etter retning, og de mørke
 *  flatene lot seg ikke lyse opp av å slippe bakgrunnen gjennom (127 ved full
 *  dekning mot 109 ved 0,55). De lyse flatene taper derimot mye på det — 223
 *  mot 181. Lav dekkevne gjorde altså volumene jevnt over mørkere, ikke lysere.
 *  Et hår av gjennomsiktighet står igjen så de ikke leses som utklipp.
 *
 *  De tre til salgs står et hakk tettere enn resten. */
const SHELL_ALPHA = { sale: 0.95, context: 0.92 } as const;

/** Låven og de andre som allerede står, tegnes nesten tette. Gjennom et
 *  halvgjennomsiktig skall ville taket deres skinne igjennom og gi tilbake
 *  akkurat den rotet volumet skulle rydde bort. Det gir dem samtidig en
 *  lesning som stemmer: det som står er massivt, det som er planlagt er
 *  gjennomskinnelig. */
const STANDING_ALPHA = 0.98;

/** Google-motoren tar bare CSS-farger, ikke Mapbox-paint. Palettens hex får
 *  derfor en alfa-kanal her. */
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
        const paintByRole = {
          sale: {
            fill: withAlpha(massing.palette.shellFill, SHELL_ALPHA.sale),
            stroke: withAlpha(massing.palette.line, 0.95),
          },
          context: {
            fill: withAlpha(massing.palette.shellFill, SHELL_ALPHA.context),
            stroke: withAlpha(massing.palette.shellEdge, 0.92),
          },
        };
        const standing = massing.standingBuildings ?? [];
        // Grunnen, så gatene, så stien — nedenfra og opp, som de ligger i
        // virkeligheten. Stien krysser gatetunene, ikke omvendt.
        const flat = [
          ...(massing.siteStreets ?? []).map((ring, index) => ({
            id: `${STREET_ID}-${index}`,
            color: massing.palette.street,
            ring,
          })),
          ...(massing.sitePaths ?? []).map((ring, index) => ({
            id: `${PATH_ID}-${index}`,
            color: massing.palette.path,
            ring,
          })),
        ];
        const activeIds = new Set(surfaces.map((surface) => surface.id));
        if (massing.siteGround) activeIds.add(GROUND_ID);
        for (const surface of flat) activeIds.add(surface.id);
        for (const building of standing) activeIds.add(building.id);
        for (const [id, polygon] of polygonById) {
          if (!activeIds.has(id) && polygon.parentNode) polygon.remove();
        }

        // Grunnflaten først, så den ligger under volumene i tegnerekkefølgen.
        if (massing.siteGround) {
          let ground = polygonById.get(GROUND_ID);
          if (!ground) {
            ground = new lib.Polygon3DElement();
            polygonById.set(GROUND_ID, ground);
          }
          ground.path = massing.siteGround.map(([lng, lat]) => ({ lat, lng }));
          ground.altitudeMode = lib.AltitudeMode.CLAMP_TO_GROUND;
          ground.extruded = false;
          ground.fillColor = withAlpha(massing.palette.ground, GROUND_ALPHA);
          ground.strokeColor = "rgba(0, 0, 0, 0)";
          ground.strokeWidth = 0;
          ground.drawsOccludedSegments = false;
          if (ground.parentNode && ground.parentNode !== map3d) ground.remove();
          if (!ground.parentNode) map3d.append(ground);
        }

        for (const surface of flat) {
          let polygon = polygonById.get(surface.id);
          if (!polygon) {
            polygon = new lib.Polygon3DElement();
            polygonById.set(surface.id, polygon);
          }
          polygon.path = surface.ring.map(([lng, lat]) => ({ lat, lng }));
          polygon.altitudeMode = lib.AltitudeMode.CLAMP_TO_GROUND;
          polygon.extruded = false;
          polygon.fillColor = withAlpha(surface.color, SURFACE_ALPHA);
          polygon.strokeColor = "rgba(0, 0, 0, 0)";
          polygon.strokeWidth = 0;
          polygon.drawsOccludedSegments = false;
          if (polygon.parentNode && polygon.parentNode !== map3d) polygon.remove();
          if (!polygon.parentNode) map3d.append(polygon);
        }

        // Låven og andre hus som blir stående. De hører til grunnen, ikke til
        // planen, så de tegnes rett etter den og før volumene.
        for (const building of standing) {
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
          polygon.fillColor = withAlpha(massing.palette.shellFill, STANDING_ALPHA);
          polygon.strokeColor = withAlpha(massing.palette.shellEdge, 0.92);
          polygon.strokeWidth = SHELL_STROKE_WIDTH * 0.6;
          polygon.drawsOccludedSegments = false;
          if (polygon.parentNode && polygon.parentNode !== map3d) polygon.remove();
          if (!polygon.parentNode) map3d.append(polygon);
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
          const paint = paintByRole[building.role];
          polygon.fillColor = paint.fill;
          polygon.strokeColor = paint.stroke;
          polygon.strokeWidth =
            building.role === "sale" ? SHELL_STROKE_WIDTH : SHELL_STROKE_WIDTH * 0.6;
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
