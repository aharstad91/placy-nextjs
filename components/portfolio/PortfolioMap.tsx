"use client";

import { useRouter } from "next/navigation";
import { Marker } from "react-map-gl/mapbox";
import { MapView3D } from "@/components/map/map-view-3d";
import { MapView } from "@/components/map/map-view";
import { ProjectSitePin } from "@/components/map/ProjectSitePin";
import { useWebGLCheck } from "@/components/map/use-webgl-check";
import type { PortfolioCamera } from "@/lib/portfolio/fit-camera";
import type { ResolvedPortfolioProject } from "@/lib/portfolio/types";
import { buildPortfolioPins, selectMapEngine } from "./portfolio-pins";

/**
 * Porteføljekartets kartflate: én kjedes prosjekter som chips over hele
 * utstrekningen sin.
 *
 * Bygget på `MapView3D`, ikke på `BoardMap`: boardets kart krever hele
 * `BoardData`, kategori-reduceren og lydsporets tilstand. Her finnes ingen av
 * delene — flaten er en punktliste og en kameraprofil.
 *
 * Kameraet kommer ferdig regnet fra serveren og settes ÉN gang. `freeMode` slår
 * av motorens høyde- og pan-grenser; uten det ville `DEFAULT_CAMERA_LOCK`
 * klampet kameraet til 2 000 m og vist én bydel av en portefølje som spenner
 * titalls mil.
 *
 * Nøyaktig én motor mountes om gangen. To samtidige WebGL-kontekster er den
 * dokumenterte stille krasjen på iOS.
 */

export interface PortfolioMapProps {
  projects: ResolvedPortfolioProject[];
  camera: PortfolioCamera;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

export function PortfolioMap({
  projects,
  camera,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
}: PortfolioMapProps) {
  const router = useRouter();
  const { isAvailable } = useWebGLCheck();
  const engine = selectMapEngine(isAvailable);
  const pins = buildPortfolioPins(projects, { selectedId, hoveredId });

  // Klikk markerer ALLTID, og navigerer i tillegg når prosjektet har et board.
  // Uten markeringen ville et klikk på en pin uten board vært en no-op, og
  // skillet mellom de to tilstandene ulesbart (R4).
  const handleClick = (id: string) => {
    onSelect(id);
    const boardUrl = projects.find((p) => p.id === id)?.boardUrl;
    if (boardUrl) router.push(boardUrl);
  };

  if (engine === "2d") {
    return (
      <MapView
        center={camera.center}
        bounds={camera.bounds}
        pois={[]}
        showCenterMarker={false}
        className="w-full h-full"
      >
        {pins.map((pin) => (
          <Marker
            key={pin.id}
            longitude={pin.lng}
            latitude={pin.lat}
            anchor="bottom"
            onClick={() => handleClick(pin.id)}
          >
            <ProjectSitePin
              name={pin.name}
              subtitle={pin.subtitle}
              scale={pin.scale}
              labelScale={pin.labelScale}
              tone={pin.tone}
              selected={pin.selected}
              showName={pin.showName}
              clickable
              onHoverChange={(hovered) => onHover(hovered ? pin.id : null)}
            />
          </Marker>
        ))}
      </MapView>
    );
  }

  return (
    <MapView3D
      mapId="portefolje-kart"
      center={camera.center}
      cameraLock={{ range: camera.range, tilt: camera.tilt }}
      freeMode
      pois={[]}
      projectSites={pins}
      onProjectSiteClick={handleClick}
      onProjectSiteHover={onHover}
    />
  );
}
