"use client";

import { Marker } from "react-map-gl/mapbox";
import React from "react";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import type { BoardPOI } from "./board-data";
import { hexLightTint, markerCircleStyle } from "./marker-style";
import type { BoardZoomTier } from "./use-board-zoom-tier";

interface Props {
  poi: BoardPOI;
  color: string;
  icon: string;
  isActive: boolean;
  /**
   * Når false fader markøren ut (opacity + scale) i stedet for å unmounte.
   * Beholder DOM-identitet på tvers av kategori-skifter så Mapbox ikke må
   * re-projisere markører og fade kan animeres i CSS.
   */
  isVisible: boolean;
  /**
   * Unit 5: event-board "Min samling". Når true tegnes en egen highlight-ring
   * rundt markøren (uavhengig av `isActive`/`isVisible`) så et lagret event
   * skiller seg ut på kartet — også når et tema/dag/tid-filter er aktivt.
   * Default false (boligrapporter har ingen samling-highlight).
   */
  inCollection?: boolean;
  /**
   * Zoom-tier fra `useBoardZoomTier`. Styrer hvilken sub-element som er
   * synlig: `dot` viser kun farget prikk, `icon` viser ikon-sirkel,
   * `icon+label` viser ikon-sirkel + POI-navn.
   */
  zoomTier: BoardZoomTier;
  /**
   * Når true, undertrykk inline-label selv om aktiv. Brukes når
   * `popupMode === "mini"` for aktiv POI — `BoardPOIMiniPopup` viser
   * allerede navnet, så vi unngår dobbel-rendering (R10c i planen).
   */
  suppressLabel: boolean;
  onClick: () => void;
}

function BoardMarkerImpl({
  poi,
  color,
  icon,
  isActive,
  isVisible,
  inCollection = false,
  zoomTier,
  suppressLabel,
  onClick,
}: Props) {
  const Icon = getFilledIcon(poi.raw.category.icon || icon);
  const circle = markerCircleStyle(color);
  // Lysere border (~50% hvit-blanding) demper rammen så ikonet får primær
  // visuell vekt — mindre detaljer per markør, men hue-identitet bevart.
  // Aktiv markør beholder full farge for tydelig fokus-signal.
  const inactiveBorder = hexLightTint(color, 0.5);

  // R10: aktiv markør på `dot`-tier promoteres visuelt til `icon`-tier-størrelse
  // så label har et anker å stå ved siden av.
  const effectiveTier: BoardZoomTier =
    isActive && zoomTier === "dot" ? "icon" : zoomTier;

  const showDot = effectiveTier === "dot";
  const showIconCircle = !showDot;
  const showLabel =
    (effectiveTier === "icon+label" || isActive) && !suppressLabel;

  // Container-størrelse styres av isActive (uavhengig av tier). Aktiv = 44 px
  // (matcher dagens `w-11 h-11`), inaktiv = 32 px (matcher `w-8 h-8`). Dot og
  // IconCircle er absolute-sentrert i samme container, så tap-koordinaten flytter
  // seg ikke når R10-promotion skjer.
  const containerSize = isActive ? 44 : 32;

  return (
    <Marker
      longitude={poi.coordinates.lng}
      latitude={poi.coordinates.lat}
      anchor="bottom"
      offset={[0, 0]}
      onClick={(e) => {
        if (!isVisible) return;
        e.originalEvent.stopPropagation();
        onClick();
      }}
      style={{
        cursor: isVisible ? "pointer" : "default",
        zIndex: isActive ? 5 : 1,
        pointerEvents: isVisible ? "auto" : "none",
      }}
    >
      {/* Inner container: bærer kategori-fade (isVisible) og overflow:visible
          så aktiv ikon-sirkel (44 px) ikke klippes av container-bbox når den
          vokser. Label sitter absolute utenfor container-edge til høyre. */}
      <div
        style={{
          position: "relative",
          width: containerSize,
          height: containerSize,
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "scale(1)" : "scale(0.5)",
          transition:
            "opacity 300ms ease-out, transform 300ms ease-out, width 200ms ease-out, height 200ms ease-out",
          overflow: "visible",
        }}
      >
        {/* Unit 5: "Min samling"-ring. Tegnes BAK ikon-sirkelen/prikken (lavere i
            stacking-rekkefølgen, pointer-events:none) som en bookmark-aksent rundt
            markøren. Skalerer med container så den omkranser både dot- og icon-
            tier. Kun synlig for lagrede events. */}
        {inCollection && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: containerSize + 10,
              height: containerSize + 10,
              borderRadius: "50%",
              border: "2.5px solid #0ea5e9",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
              pointerEvents: "none",
              opacity: isVisible ? 1 : 0,
              transition: "opacity 200ms ease-out",
            }}
          />
        )}

        {/* Dot — absolute centered. Vises ved effectiveTier="dot" (kun
            inaktive markører ved lav zoom). Tap-koordinat = container-senter
            (samme som IconCircle), så promotion til icon flytter ikke
            klikk-anker horisontalt. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: color,
            opacity: showDot ? 1 : 0,
            transition: "opacity 200ms ease-out",
            pointerEvents: "none",
          }}
        />

        {/* IconCircle — eksisterende sirkel-design, absolute centered.
            Vises ved alle andre effectiveTier-states. */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: containerSize,
            height: containerSize,
            borderRadius: "50%",
            borderWidth: isActive ? 3 : 2,
            borderStyle: "solid",
            borderColor: isActive ? circle.borderColor : inactiveBorder,
            backgroundColor: circle.backgroundColor,
            color: circle.borderColor,
            boxShadow: "0 2px 4px rgba(0, 0, 0, 0.15)",
            opacity: showIconCircle ? 1 : 0,
            transition:
              "opacity 200ms ease-out, width 200ms ease-out, height 200ms ease-out, border-width 200ms ease-out",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <Icon className={isActive ? "w-5 h-5" : "w-4 h-4"} weight="fill" />
        </div>

        {/* Label — absolute til høyre for container. `pointer-events: none` +
            `aria-hidden="true"` så ikon-sirkelen er eneste klikk-target og
            skjermlesere ikke leser navnet dobbelt. Truncates ved 120 px med
            ellipsis. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "100%",
            top: "50%",
            transform: "translateY(-50%)",
            marginLeft: 8,
            fontSize: 10,
            fontWeight: 600,
            color: "#1c1917",
            textShadow:
              "0 0 3px rgba(255, 255, 255, 0.9), 0 0 6px rgba(255, 255, 255, 0.6)",
            WebkitFontSmoothing: "antialiased",
            whiteSpace: "nowrap",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            pointerEvents: "none",
            opacity: showLabel ? 1 : 0,
            transition: "opacity 200ms ease-out",
          }}
        >
          {poi.name}
        </span>
      </div>
    </Marker>
  );
}

export const BoardMarker = React.memo(
  BoardMarkerImpl,
  (prev, next) =>
    prev.poi.id === next.poi.id &&
    prev.color === next.color &&
    prev.icon === next.icon &&
    prev.isActive === next.isActive &&
    prev.isVisible === next.isVisible &&
    prev.inCollection === next.inCollection &&
    prev.zoomTier === next.zoomTier &&
    prev.suppressLabel === next.suppressLabel,
);
