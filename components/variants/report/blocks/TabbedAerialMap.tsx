"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import type { POI } from "@/lib/types";
import { Map as MapIcon, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import ReportMapDrawer from "@/components/variants/report/ReportMapDrawer";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type CompassDirection = "N" | "E" | "S" | "W";

export interface AerialMarker {
  number: number;
  /** CSS top position (e.g. "32%") */
  top: string;
  /** CSS left position (e.g. "55%") */
  left: string;
  title: string;
  subtitle?: string;
  description?: string;
  /** Full POI object — enables the sidebar drawer on click */
  poi?: POI;
}

export interface AerialCategory {
  id: string;
  label: string;
  markers: AerialMarker[];
  color?: string;
}

/** One image per compass direction */
export interface DirectionalImages {
  N: string;
  E: string;
  S: string;
  W: string;
}

export interface TabbedAerialMapProps {
  sectionKicker?: string;
  sectionTitle?: string;
  /** Single image (legacy) — used when `directions` is not provided */
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  /** Four directional images — enables compass control */
  directions?: DirectionalImages;
  /** Default direction. Default "S" (looking south = view from north). */
  defaultDirection?: CompassDirection;
  categories: AerialCategory[];
  showAllTab?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_COLOR = "#3a3530";

const DIRECTION_LABELS: Record<CompassDirection, string> = {
  N: "Nord",
  E: "Øst",
  S: "Sør",
  W: "Vest",
};

const DIRECTIONS: CompassDirection[] = ["N", "E", "S", "W"];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildTabs(categories: AerialCategory[], showAllTab: boolean) {
  const allCategory: AerialCategory | null = showAllTab
    ? {
        id: "__all__",
        label: "Alle",
        markers: categories.flatMap((cat) =>
          cat.markers.map((m) => ({ ...m, _catColor: cat.color })),
        ) as (AerialMarker & { _catColor?: string })[],
      }
    : null;
  return allCategory ? [allCategory, ...categories] : categories;
}

function getMarkerColor(
  m: AerialMarker,
  activeTab: AerialCategory | undefined,
): string {
  return (
    (m as AerialMarker & { _catColor?: string })._catColor ??
    activeTab?.color ??
    DEFAULT_COLOR
  );
}

/* ------------------------------------------------------------------ */
/*  Compass control                                                    */
/* ------------------------------------------------------------------ */

function CompassControl({
  active,
  onChange,
  size = "normal",
}: {
  active: CompassDirection;
  onChange: (dir: CompassDirection) => void;
  size?: "normal" | "compact";
}) {
  const dim = size === "compact" ? 56 : 72;
  const btnDim = size === "compact" ? 18 : 22;
  const fontSize = size === "compact" ? "text-[9px]" : "text-[10px]";

  /* Position each direction button around the compass circle */
  const positions: Record<CompassDirection, { top: number; left: number }> = {
    N: { top: 0, left: dim / 2 - btnDim / 2 },
    S: { top: dim - btnDim, left: dim / 2 - btnDim / 2 },
    E: { top: dim / 2 - btnDim / 2, left: dim - btnDim },
    W: { top: dim / 2 - btnDim / 2, left: 0 },
  };

  return (
    <div
      className="relative shrink-0"
      style={{ width: dim, height: dim }}
    >
      {/* Compass ring */}
      <div
        className="absolute inset-0 rounded-full border-2 border-[#d4cfc8]/60 bg-white/80 backdrop-blur-sm shadow-sm"
      />

      {/* Center dot */}
      <div
        className="absolute rounded-full bg-[#c2553a]"
        style={{
          width: 6,
          height: 6,
          top: dim / 2 - 3,
          left: dim / 2 - 3,
        }}
      />

      {/* Direction buttons */}
      {DIRECTIONS.map((dir) => {
        const pos = positions[dir];
        const isActive = active === dir;

        return (
          <button
            key={dir}
            onClick={() => onChange(dir)}
            className={[
              `absolute flex items-center justify-center rounded-full font-bold transition-all duration-200 ${fontSize}`,
              isActive
                ? "bg-[#3a3530] text-white shadow-md scale-110"
                : "bg-white/90 text-[#8a8279] hover:text-[#3a3530] hover:bg-white border border-[#eae6e1]",
            ].join(" ")}
            style={{
              width: btnDim,
              height: btnDim,
              top: pos.top,
              left: pos.left,
            }}
            title={DIRECTION_LABELS[dir]}
          >
            {dir}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Direction frame — edge hover zones replacing compass buttons       */
/* ------------------------------------------------------------------ */

const EDGE_SIZE = 60; // px

/** Which direction each edge leads to, relative to active direction */
function getEdgeDirection(edge: "top" | "right" | "bottom" | "left", active: CompassDirection): CompassDirection {
  // Edges map to absolute compass directions that make spatial sense:
  // Top edge → the direction you're looking at (active)
  // Right edge → clockwise from active
  // Bottom edge → opposite of active
  // Left edge → counter-clockwise from active
  const order: CompassDirection[] = ["N", "E", "S", "W"];
  const idx = order.indexOf(active);
  const offsets: Record<string, number> = { top: 0, right: 1, bottom: 2, left: 3 };
  // But more intuitively: clicking LEFT means "rotate view left" = show what's to the west if facing south
  // So: left = prev in clockwise, right = next in clockwise
  const map: Record<string, number> = { left: -1, right: 1, top: 2, bottom: 0 };
  // Actually simplest mental model: the edges show adjacent views
  // Left edge → rotate left (counter-clockwise)
  // Right edge → rotate right (clockwise)
  // Top/bottom are less common but let's map top=opposite (flip 180°)
  const edgeOffset: Record<string, number> = { left: 3, right: 1, top: 2, bottom: 0 };
  return order[(idx + edgeOffset[edge]) % 4];
}

/** Arrow SVG pointing in the edge direction */
function EdgeArrow({ edge }: { edge: "top" | "right" | "bottom" | "left" }) {
  const rotation: Record<string, string> = {
    left: "rotate(180deg)",
    right: "rotate(0deg)",
    top: "rotate(-90deg)",
    bottom: "rotate(90deg)",
  };

  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 20 20"
      fill="none"
      className="text-white drop-shadow-md"
      style={{ transform: rotation[edge] }}
    >
      <path
        d="M4 10h12m0 0l-4-4m4 4l-4 4"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DirectionFrame({
  active,
  onChange,
}: {
  active: CompassDirection;
  onChange: (dir: CompassDirection) => void;
}) {
  const edges: Array<{
    edge: "top" | "right" | "bottom" | "left";
    style: React.CSSProperties;
    gradientClass: string;
    labelPosition: string;
  }> = [
    {
      edge: "left",
      style: { top: EDGE_SIZE, left: 0, bottom: EDGE_SIZE, width: EDGE_SIZE },
      gradientClass: "bg-gradient-to-r from-black/50 to-transparent",
      labelPosition: "flex-col items-center justify-center",
    },
    {
      edge: "right",
      style: { top: EDGE_SIZE, right: 0, bottom: EDGE_SIZE, width: EDGE_SIZE },
      gradientClass: "bg-gradient-to-l from-black/50 to-transparent",
      labelPosition: "flex-col items-center justify-center",
    },
    {
      edge: "top",
      style: { top: 0, left: EDGE_SIZE, right: EDGE_SIZE, height: EDGE_SIZE },
      gradientClass: "bg-gradient-to-b from-black/50 to-transparent",
      labelPosition: "flex-row items-center justify-center",
    },
    {
      edge: "bottom",
      style: { bottom: 0, left: EDGE_SIZE, right: EDGE_SIZE, height: EDGE_SIZE },
      gradientClass: "bg-gradient-to-t from-black/50 to-transparent",
      labelPosition: "flex-row items-center justify-center",
    },
  ];

  return (
    <>
      {edges.map(({ edge, style, gradientClass, labelPosition }) => {
        const targetDir = getEdgeDirection(edge, active);
        // Don't show the edge that leads back to current direction
        if (targetDir === active) return null;

        return (
          <button
            key={edge}
            onClick={() => onChange(targetDir)}
            className={[
              "absolute z-10 opacity-0 hover:opacity-100 transition-opacity duration-200",
              "flex",
              labelPosition,
              "group",
            ].join(" ")}
            style={{
              ...style,
              cursor: edge === "left" ? "w-resize" : edge === "right" ? "e-resize" : edge === "top" ? "n-resize" : "s-resize",
            }}
            title={`Sett mot ${DIRECTION_LABELS[targetDir].toLowerCase()}`}
          >
            {/* Gradient backdrop — appears on hover */}
            <div className={`absolute inset-0 ${gradientClass} rounded-xl pointer-events-none`} />

            {/* Arrow + label */}
            <div className="relative flex flex-col items-center gap-1">
              <EdgeArrow edge={edge} />
              <span className="text-[10px] font-semibold text-white/90 uppercase tracking-wider drop-shadow-sm">
                {DIRECTION_LABELS[targetDir]}
              </span>
            </div>
          </button>
        );
      })}

      {/* Active direction indicator — small pill at bottom center */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 bg-black/30 backdrop-blur-sm rounded-full">
          {DIRECTION_LABELS[active]}
        </span>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Tabs bar                                                           */
/* ------------------------------------------------------------------ */

function TabBar({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: AerialCategory[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current.querySelector<HTMLButtonElement>(
      `[data-tab-id="${activeId}"]`,
    );
    if (el) {
      const container = ref.current.getBoundingClientRect();
      const btn = el.getBoundingClientRect();
      setIndicator({
        left: btn.left - container.left + ref.current.scrollLeft,
        width: btn.width,
      });
    }
  }, [activeId]);

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex gap-1 overflow-x-auto scrollbar-hide relative border-b border-[#eae6e1]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-tab-id={tab.id}
            onClick={() => onSelect(tab.id)}
            className={[
              "relative px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors shrink-0",
              activeId === tab.id
                ? "text-[#1a1a1a]"
                : "text-[#8a8279] hover:text-[#5a5147]",
            ].join(" ")}
          >
            {tab.label}
            {tab.markers.length > 0 && (
              <span
                className={[
                  "ml-1.5 text-xs tabular-nums",
                  activeId === tab.id ? "text-[#5a5147]" : "text-[#b5ad9e]",
                ].join(" ")}
              >
                {tab.markers.length}
              </span>
            )}
          </button>
        ))}
        <span
          className="absolute bottom-0 h-[2px] bg-[#1a1a1a] transition-all duration-200 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Markers overlay                                                    */
/* ------------------------------------------------------------------ */

function MarkerOverlay({
  markers,
  activeTab,
  activeId,
  markerSize = "normal",
  selectedNumber,
  onMarkerClick,
}: {
  markers: AerialMarker[];
  activeTab: AerialCategory | undefined;
  activeId: string;
  markerSize?: "normal" | "small";
  selectedNumber?: number | null;
  onMarkerClick?: (marker: AerialMarker) => void;
}) {
  const size = markerSize === "small" ? "w-6 h-6 text-[10px]" : "w-9 h-9 text-sm";
  const interactive = !!onMarkerClick;

  return (
    <>
      {markers.map((m, i) => {
        const color = getMarkerColor(m, activeTab);
        const isSelected = selectedNumber === m.number;

        return (
          <div
            key={`${activeId}-${m.number}-${i}`}
            className={[
              "absolute -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-75 duration-300",
              interactive ? "cursor-pointer" : "",
            ].join(" ")}
            style={{ top: m.top, left: m.left }}
            onClick={interactive ? (e) => { e.stopPropagation(); onMarkerClick(m); } : undefined}
          >
            {/* Halo pulse — persistent for selected, ping for others */}
            <span
              aria-hidden="true"
              className={[
                "absolute inset-0 rounded-full opacity-20",
                isSelected ? "scale-150" : "animate-ping",
              ].join(" ")}
              style={{ backgroundColor: color }}
            />
            {/* Marker bubble */}
            <span
              className={[
                `relative flex items-center justify-center rounded-full text-white font-semibold shadow-lg border-2 ${size}`,
                isSelected ? "border-white ring-2 ring-offset-1 scale-110" : "border-white/80",
                interactive ? "hover:scale-110 transition-transform" : "",
              ].join(" ")}
              style={{
                backgroundColor: color,
                ...(isSelected ? { ringColor: color } : {}),
              }}
              aria-label={`${m.number}. ${m.title}`}
            >
              {m.number}
            </span>
          </div>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Marker list                                                        */
/* ------------------------------------------------------------------ */

function MarkerList({
  markers,
  activeTab,
  activeId,
}: {
  markers: AerialMarker[];
  activeTab: AerialCategory | undefined;
  activeId: string;
}) {
  if (markers.length === 0) {
    return (
      <p className="mt-6 text-sm text-[#8a8279] text-center">
        Ingen steder i denne kategorien ennå.
      </p>
    );
  }

  return (
    <ol className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
      {markers.map((m, i) => {
        const color = getMarkerColor(m, activeTab);
        return (
          <li
            key={`${activeId}-${m.number}-${i}`}
            className="flex items-start gap-3 animate-in fade-in slide-in-from-bottom-1 duration-200"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
          >
            <span
              className="flex items-center justify-center w-7 h-7 shrink-0 rounded-full text-white text-xs font-semibold mt-0.5"
              style={{ backgroundColor: color }}
            >
              {m.number}
            </span>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="font-semibold text-[#1a1a1a] tracking-tight text-[15px]">
                  {m.title}
                </span>
                {m.subtitle && (
                  <span className="text-xs text-[#8a8279]">· {m.subtitle}</span>
                )}
              </div>
              {m.description && (
                <p className="text-sm text-[#5a5147] leading-snug mt-0.5">
                  {m.description}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/*  Marker drawer (lightweight, for markers without full POI)          */
/* ------------------------------------------------------------------ */

function MarkerDrawer({
  marker,
  activeTab,
  onClose,
}: {
  marker: AerialMarker;
  activeTab: AerialCategory | undefined;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const color = getMarkerColor(marker, activeTab);

  useEffect(() => {
    setVisible(false);
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [marker.number]);

  return (
    <>
      {/* Desktop: Left sidebar */}
      <div
        className={`hidden md:flex absolute left-0 top-0 h-full z-20 transition-transform duration-300 ease-out ${
          visible ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[320px] h-full bg-white/95 backdrop-blur-sm border-r border-[#eae6e1] overflow-y-auto">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-50 shadow-sm border border-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>

          <div className="px-4 py-4 space-y-3">
            {/* Header with marker number + title */}
            <div className="flex items-center gap-2.5">
              <span
                className="flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-semibold shrink-0"
                style={{ backgroundColor: color }}
              >
                {marker.number}
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900 truncate">
                  {marker.title}
                </h3>
                {marker.subtitle && (
                  <p className="text-xs text-gray-500">{marker.subtitle}</p>
                )}
              </div>
            </div>

            {/* Description */}
            {marker.description && (
              <p className="text-sm text-gray-600 leading-relaxed">
                {marker.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Bottom drawer */}
      <div
        className={`md:hidden absolute bottom-0 left-0 right-0 z-20 transition-all duration-300 ease-out ${
          visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white border-t border-[#eae6e1] rounded-t-xl max-h-[40vh] overflow-y-auto shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
          </div>
          <button
            onClick={onClose}
            className="absolute top-2 right-3 z-10 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-50 shadow-sm border border-gray-200 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-600" />
          </button>
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: color }}
              >
                {marker.number}
              </span>
              <h3 className="text-sm font-semibold text-gray-900 truncate">{marker.title}</h3>
            </div>
            {marker.subtitle && (
              <p className="text-xs text-gray-500">{marker.subtitle}</p>
            )}
            {marker.description && (
              <p className="text-xs text-gray-600 leading-relaxed">{marker.description}</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Directional image with crossfade                                   */
/* ------------------------------------------------------------------ */

function DirectionalImage({
  directions,
  fallbackImage,
  activeDirection,
  imageWidth,
  imageHeight,
  sizes,
  className,
}: {
  directions?: DirectionalImages;
  fallbackImage?: string;
  activeDirection: CompassDirection;
  imageWidth: number;
  imageHeight: number;
  sizes: string;
  className: string;
}) {
  if (!directions) {
    return fallbackImage ? (
      <Image
        src={fallbackImage}
        alt=""
        aria-hidden="true"
        width={imageWidth}
        height={imageHeight}
        sizes={sizes}
        className={className}
        draggable={false}
      />
    ) : null;
  }

  return (
    <div className="relative w-full">
      {DIRECTIONS.map((dir) => (
        <Image
          key={dir}
          src={directions[dir]}
          alt=""
          aria-hidden="true"
          width={imageWidth}
          height={imageHeight}
          sizes={sizes}
          className={[
            className,
            "transition-opacity duration-500 ease-in-out",
            dir === activeDirection ? "opacity-100" : "opacity-0 absolute inset-0",
          ].join(" ")}
          draggable={false}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Zoomable image container (modal only)                              */
/* ------------------------------------------------------------------ */

function ZoomableIllustration({
  directions,
  fallbackImage,
  activeDirection,
  onDirectionChange,
  imageWidth,
  imageHeight,
  markers,
  activeTab,
  activeId,
  hasDirections,
  selectedNumber,
  onMarkerClick,
}: {
  directions?: DirectionalImages;
  fallbackImage?: string;
  activeDirection: CompassDirection;
  onDirectionChange: (dir: CompassDirection) => void;
  imageWidth: number;
  imageHeight: number;
  markers: AerialMarker[];
  activeTab: AerialCategory | undefined;
  activeId: string;
  hasDirections: boolean;
  selectedNumber?: number | null;
  onMarkerClick?: (marker: AerialMarker) => void;
}) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const clampTranslate = useCallback(
    (x: number, y: number, s: number) => {
      if (s <= 1) return { x: 0, y: 0 };
      const container = containerRef.current;
      if (!container) return { x, y };
      const rect = container.getBoundingClientRect();
      const maxX = (rect.width * (s - 1)) / 2;
      const maxY = (rect.height * (s - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, x)),
        y: Math.max(-maxY, Math.min(maxY, y)),
      };
    },
    [],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setScale((prev) => {
        const next = Math.max(1, Math.min(1.5, prev + delta));
        if (next <= 1) setTranslate({ x: 0, y: 0 });
        else setTranslate((t) => clampTranslate(t.x, t.y, next));
        return next;
      });
    },
    [clampTranslate],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current || scale <= 1) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      lastPos.current = { x: e.clientX, y: e.clientY };
      setTranslate((t) => clampTranslate(t.x + dx, t.y + dy, scale));
    },
    [scale, clampTranslate],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const zoomIn = () => {
    setScale((s) => {
      const next = Math.min(1.5, s + 0.25);
      setTranslate((t) => clampTranslate(t.x, t.y, next));
      return next;
    });
  };

  const zoomOut = () => {
    setScale((s) => {
      const next = Math.max(1, s - 0.25);
      if (next <= 1) setTranslate({ x: 0, y: 0 });
      else setTranslate((t) => clampTranslate(t.x, t.y, next));
      return next;
    });
  };

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      {/* Zoom controls — top right */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-1">
        <button
          onClick={zoomIn}
          disabled={scale >= 1.5}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur shadow-sm border border-[#eae6e1] hover:bg-white transition-colors disabled:opacity-40"
        >
          <ZoomIn className="w-4 h-4 text-[#3a3530]" />
        </button>
        <button
          onClick={zoomOut}
          disabled={scale <= 1}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/90 backdrop-blur shadow-sm border border-[#eae6e1] hover:bg-white transition-colors disabled:opacity-40"
        >
          <ZoomOut className="w-4 h-4 text-[#3a3530]" />
        </button>
      </div>

      {/* Direction frame — 60px hover zones on all 4 edges */}
      {hasDirections && (
        <DirectionFrame
          active={activeDirection}
          onChange={onDirectionChange}
        />
      )}

      {/* Zoomable area */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden rounded-xl bg-[#f5f1ec] cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="relative w-full h-full transition-transform duration-150 ease-out origin-center"
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          }}
        >
          <DirectionalImage
            directions={directions}
            fallbackImage={fallbackImage}
            activeDirection={activeDirection}
            imageWidth={imageWidth}
            imageHeight={imageHeight}
            sizes="90vw"
            className="w-full h-full object-contain pointer-events-none select-none"
          />

          {/* Markers — sit on top of the image, within the transform container */}
          <div className="absolute inset-0">
            <MarkerOverlay
              markers={markers}
              activeTab={activeTab}
              activeId={activeId}
              selectedNumber={selectedNumber}
              onMarkerClick={onMarkerClick}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function TabbedAerialMap({
  sectionKicker,
  sectionTitle,
  image,
  imageWidth = 1200,
  imageHeight = 800,
  directions,
  defaultDirection = "S",
  categories,
  showAllTab = true,
}: TabbedAerialMapProps) {
  const tabs = buildTabs(categories, showAllTab);
  const [activeId, setActiveId] = useState(tabs[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeDirection, setActiveDirection] = useState<CompassDirection>(defaultDirection);
  const [selectedMarker, setSelectedMarker] = useState<AerialMarker | null>(null);

  const hasDirections = !!directions;
  const currentImage = directions ? directions[activeDirection] : image;

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const markers = activeTab?.markers ?? [];

  const selectedPOI = selectedMarker?.poi ?? null;

  const handleMarkerClick = useCallback((m: AerialMarker) => {
    setSelectedMarker((prev) => prev?.number === m.number ? null : m);
  }, []);

  const handleDrawerClose = useCallback(() => {
    setSelectedMarker(null);
  }, []);

  const totalMarkers = categories.reduce((sum, c) => sum + c.markers.length, 0);

  return (
    <div className="my-12">
      {/* Section header */}
      {(sectionKicker || sectionTitle) && (
        <div className="mb-6 text-center">
          {sectionKicker && (
            <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-2">
              {sectionKicker}
            </p>
          )}
          {sectionTitle && (
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1a1a]">
              {sectionTitle}
            </h3>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* PREVIEW — dormant, clickable, opens modal                    */}
      {/* ============================================================ */}
      <div className="relative">
        <button
          onClick={() => setModalOpen(true)}
          className="relative w-full rounded-2xl overflow-hidden bg-[#f5f1ec] border border-[#eae6e1] hover:border-[#d4cfc8] transition-colors group cursor-pointer block"
        >
          {currentImage && (
            <Image
              src={currentImage}
              alt=""
              aria-hidden="true"
              width={imageWidth}
              height={imageHeight}
              sizes="(min-width: 1024px) 800px, 100vw"
              className="w-full h-auto pointer-events-none select-none"
              draggable={false}
            />
          )}

          {/* Small markers on preview */}
          <MarkerOverlay
            markers={markers}
            activeTab={activeTab}
            activeId={activeId}
            markerSize="small"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#f5f1ec] to-transparent pointer-events-none z-10" />

          {/* CTA */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center translate-y-[25%] pointer-events-none">
            <p className="text-sm text-[#2a2a2a] font-semibold mb-3">
              {totalMarkers} steder markert i nabolaget
            </p>
            <div className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-lg border border-[#eae6e1] text-sm font-medium text-[#1a1a1a] group-hover:shadow-xl group-hover:border-[#d4cfc8] transition-all">
              <MapIcon className="w-4 h-4 text-[#7a7062]" />
              Utforsk illustrasjonen
            </div>
          </div>
        </button>

        {/* Compass on preview — bottom left, outside the button click area */}
        {hasDirections && (
          <div className="absolute bottom-4 left-4 z-30">
            <CompassControl
              active={activeDirection}
              onChange={setActiveDirection}
              size="compact"
            />
          </div>
        )}
      </div>

      {/* Tabs below preview */}
      <div className="mt-6">
        <TabBar tabs={tabs} activeId={activeId} onSelect={setActiveId} />
      </div>

      {/* Marker list */}
      <MarkerList markers={markers} activeTab={activeTab} activeId={activeId} />

      {/* ============================================================ */}
      {/* MODAL — full screen, zoomable, with compass                  */}
      {/* ============================================================ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex flex-col !max-w-none p-0 overflow-hidden gap-0 bg-white fixed bottom-0 left-0 right-0 h-[90vh] rounded-t-2xl rounded-b-none md:static md:w-[90vw] md:h-[85vh] md:rounded-2xl"
        >
          <DialogTitle className="sr-only">Nabolaget fra luften</DialogTitle>

          {/* Drag handle — mobile */}
          <div className="flex justify-center pt-2 pb-0 md:hidden">
            <div className="w-8 h-1 rounded-full bg-gray-300" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 md:px-5 md:py-3 border-b border-[#eae6e1] bg-white shrink-0">
            <div className="flex items-center gap-2.5">
              <MapIcon className="w-5 h-5 text-[#7a7062]" />
              <span className="text-sm md:text-base font-semibold text-[#1a1a1a]">
                {sectionTitle ?? "Nabolaget"}
              </span>
              {hasDirections && (
                <span className="text-xs text-[#8a8279] ml-1">
                  · Sett mot {DIRECTION_LABELS[activeDirection].toLowerCase()}
                </span>
              )}
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f3f0] transition-colors"
            >
              <X className="w-4 h-4 text-[#6a6a6a]" />
            </button>
          </div>

          {/* Tabs inside modal */}
          <div className="px-4 md:px-5 bg-white shrink-0">
            <TabBar tabs={tabs} activeId={activeId} onSelect={(id) => { setActiveId(id); setSelectedMarker(null); }} />
          </div>

          {/* Zoomable illustration with compass + drawer */}
          <div className="relative flex-1 min-h-0 p-3 md:p-5">
            <ZoomableIllustration
              directions={directions}
              fallbackImage={image}
              activeDirection={activeDirection}
              onDirectionChange={setActiveDirection}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              markers={markers}
              activeTab={activeTab}
              activeId={activeId}
              hasDirections={hasDirections}
              selectedNumber={selectedMarker?.number}
              onMarkerClick={handleMarkerClick}
            />

            {/* POI drawer — full ReportMapDrawer when POI is available */}
            {selectedPOI && (
              <ReportMapDrawer
                poi={selectedPOI}
                onClose={handleDrawerClose}
              />
            )}

            {/* Lightweight drawer — for markers without full POI data */}
            {selectedMarker && !selectedPOI && (
              <MarkerDrawer marker={selectedMarker} activeTab={activeTab} onClose={handleDrawerClose} />
            )}
          </div>

          {/* Marker list in modal */}
          <div className="px-4 md:px-5 pb-4 md:pb-5 max-h-[30vh] overflow-y-auto border-t border-[#eae6e1] bg-white shrink-0">
            <MarkerList markers={markers} activeTab={activeTab} activeId={activeId} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
