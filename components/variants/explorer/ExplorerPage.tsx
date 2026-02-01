"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Project, POI, Category, TravelMode } from "@/lib/types";
import { useTravelSettings } from "@/lib/store";
import { useCollection } from "@/lib/collection-store";
import { useTravelTimes } from "@/lib/hooks/useTravelTimes";
import { useOpeningHours } from "@/lib/hooks/useOpeningHours";
import { haversineDistance, cn } from "@/lib/utils";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import { Bookmark } from "lucide-react";
import { EXPLORER_PACKAGES } from "./explorer-packages";
import ExplorerMap from "./ExplorerMap";
import ExplorerPanel from "./ExplorerPanel";
import ExplorerBottomSheet from "./ExplorerBottomSheet";
import ExplorerPOIList from "./ExplorerPOIList";
import CollectionDrawer from "./CollectionDrawer";

interface CollectionData {
  slug: string;
  poiIds: string[];
  createdAt?: string;
  email?: string | null;
}

interface ExplorerPageProps {
  project: Project;
  collection?: CollectionData;
}

export default function ExplorerPage({ project, collection }: ExplorerPageProps) {
  const isCollectionView = !!collection;
  const { travelMode, setTravelMode } = useTravelSettings();
  const { collectionPOIs, addToCollection, removeFromCollection, clearCollection } = useCollection();
  const [collectionDrawerOpen, setCollectionDrawerOpen] = useState(false);
  const [collectionFlash, setCollectionFlash] = useState(false);
  const prevCollectionCountRef = useRef(0);
  const [activePOI, setActivePOI] = useState<string | null>(null);
  const [highlightedPOI, setHighlightedPOI] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(project.categories.map((c) => c.id))
  );
  const [viewportPOIIds, setViewportPOIIds] = useState<Set<string>>(new Set());
  const [visibleClusterCount, setVisibleClusterCount] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);
  const [activePackage, setActivePackage] = useState<string | null>("all");

  // Geolocation
  const geo = useGeolocation(project.centerCoordinates);

  // Throttle travel time recalculation for GPS: only when moved >100m and >30s since last calc
  const lastCalcOriginRef = useRef(project.centerCoordinates);
  const lastCalcTimeRef = useRef(0);
  const throttledOrigin = useMemo(() => {
    if (geo.mode !== "gps-near" || !geo.userPosition) {
      // Reset refs when not in GPS-near mode
      lastCalcOriginRef.current = project.centerCoordinates;
      lastCalcTimeRef.current = 0;
      return geo.effectiveOrigin;
    }
    const distMoved = haversineDistance(geo.userPosition, lastCalcOriginRef.current);
    const elapsed = Date.now() - lastCalcTimeRef.current;
    if (distMoved > 100 && elapsed > 30_000) {
      lastCalcOriginRef.current = geo.userPosition;
      lastCalcTimeRef.current = Date.now();
      return geo.userPosition;
    }
    // First GPS fix — always trigger
    if (lastCalcTimeRef.current === 0) {
      lastCalcOriginRef.current = geo.userPosition;
      lastCalcTimeRef.current = Date.now();
      return geo.userPosition;
    }
    return lastCalcOriginRef.current;
  }, [geo.mode, geo.userPosition, geo.effectiveOrigin, project.centerCoordinates]);

  // Route state
  const [routeData, setRouteData] = useState<{
    coordinates: [number, number][];
    travelTime: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Filter POIs if in collection view
  const basePOIs = useMemo(() => {
    if (!collection) return project.pois;
    const collectionSet = new Set(collection.poiIds);
    return project.pois.filter((poi) => collectionSet.has(poi.id));
  }, [project.pois, collection]);

  // Travel times — enriches POIs with walk times (uses GPS origin when near)
  const { pois: poisWithTravelTimes, loading: travelTimesLoading } = useTravelTimes(
    project.id,
    throttledOrigin,
    basePOIs,
    { skipCache: geo.mode === "gps-near" }
  );

  // POI lookup map
  const poiMap = useMemo(() => {
    const map = new Map<string, POI>();
    for (const poi of poisWithTravelTimes) {
      map.set(poi.id, poi);
    }
    return map;
  }, [poisWithTravelTimes]);

  // Filtered POIs by active categories
  const filteredPOIs = useMemo(() => {
    return poisWithTravelTimes.filter((poi) => activeCategories.has(poi.category.id));
  }, [poisWithTravelTimes, activeCategories]);

  // POIs visible in current viewport AND matching active categories
  const visiblePOIs = useMemo(() => {
    return filteredPOIs.filter((poi) => viewportPOIIds.has(poi.id));
  }, [filteredPOIs, viewportPOIIds]);

  // Opening hours for visible POIs
  const { hoursData: openingHoursData } = useOpeningHours(visiblePOIs);

  // Sort visible POIs by walk time (nearest first), fallback to euclidean distance
  const sortedVisiblePOIs = useMemo(() => {
    const center = geo.effectiveOrigin;
    return [...visiblePOIs].sort((a, b) => {
      const timeA = a.travelTime?.walk;
      const timeB = b.travelTime?.walk;
      if (timeA != null && timeB != null) return timeA - timeB;
      if (timeA != null) return -1;
      if (timeB != null) return 1;
      // Fallback to euclidean
      const distA = Math.hypot(a.coordinates.lat - center.lat, a.coordinates.lng - center.lng);
      const distB = Math.hypot(b.coordinates.lat - center.lat, b.coordinates.lng - center.lng);
      return distA - distB;
    });
  }, [visiblePOIs, geo.effectiveOrigin]);

  // Package selection
  const handleSelectPackage = useCallback((packageId: string) => {
    setActivePackage(packageId);
    const pkg = EXPLORER_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return;

    if (pkg.id === "all" || pkg.categoryIds.length === 0) {
      setActiveCategories(new Set(project.categories.map((c) => c.id)));
    } else {
      setActiveCategories(new Set(pkg.categoryIds));
    }
  }, [project.categories]);

  // Category toggle — keeps the active package context
  const toggleCategory = useCallback((categoryId: string) => {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  const toggleAllCategories = useCallback(() => {
    setActivePackage("all");
    setActiveCategories((prev) => {
      if (prev.size === project.categories.length) {
        setActivePackage(null);
        return new Set();
      }
      return new Set(project.categories.map((c) => c.id));
    });
  }, [project.categories]);

  // Collection toggle
  const handleToggleCollection = useCallback((poiId: string) => {
    if (collectionPOIs.includes(poiId)) {
      removeFromCollection(poiId);
    } else {
      addToCollection(poiId);
    }
  }, [collectionPOIs, addToCollection, removeFromCollection]);

  // POI selection (from list click)
  const handlePOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
  }, []);

  // POI selection from map click (with temporary highlight)
  const handleMapPOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
    setHighlightedPOI(poiId);
    setTimeout(() => setHighlightedPOI(null), 2000);
  }, []);

  // Map reports which POIs are in viewport
  const handleViewportPOIs = useCallback(
    (poiIds: Set<string>, clusterCount: number) => {
      setViewportPOIIds(poiIds);
      setVisibleClusterCount(clusterCount);
    },
    []
  );

  const handleZoomChange = useCallback((zoom: number) => {
    setMapZoom(zoom);
  }, []);

  // Fetch route when a POI is selected (from effective origin — GPS or hotel)
  useEffect(() => {
    if (!activePOI) {
      setRouteData(null);
      return;
    }
    const poi = poiMap.get(activePOI);
    if (!poi) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const origin = `${geo.effectiveOrigin.lng},${geo.effectiveOrigin.lat}`;
    const destination = `${poi.coordinates.lng},${poi.coordinates.lat}`;
    const profileMap: Record<TravelMode, string> = {
      walk: "walking",
      bike: "cycling",
      car: "driving",
    };

    fetch(`/api/directions?origin=${origin}&destination=${destination}&profile=${profileMap[travelMode]}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.geometry?.coordinates) {
          setRouteData({
            coordinates: data.geometry.coordinates,
            travelTime: data.duration,
          });
        }
      })
      .catch(() => {
        // Aborted or failed — ignore
      });

    return () => controller.abort();
  }, [activePOI, poiMap, geo.effectiveOrigin, travelMode]);

  // Flash animation when item added to collection
  useEffect(() => {
    if (collectionPOIs.length > prevCollectionCountRef.current) {
      setCollectionFlash(true);
      const timer = setTimeout(() => setCollectionFlash(false), 400);
      return () => clearTimeout(timer);
    }
    prevCollectionCountRef.current = collectionPOIs.length;
  }, [collectionPOIs.length]);

  // Calculate initial bounds for collection view (fit all collection POIs)
  const collectionBounds = useMemo(() => {
    if (!isCollectionView || basePOIs.length === 0) return undefined;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const poi of basePOIs) {
      if (poi.coordinates.lat < minLat) minLat = poi.coordinates.lat;
      if (poi.coordinates.lat > maxLat) maxLat = poi.coordinates.lat;
      if (poi.coordinates.lng < minLng) minLng = poi.coordinates.lng;
      if (poi.coordinates.lng > maxLng) maxLng = poi.coordinates.lng;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [isCollectionView, basePOIs]);

  // Generate contextual hint based on viewport
  const contextHint = useMemo(() => {
    if (visiblePOIs.length === 0 && filteredPOIs.length > 0) {
      return "Panorer kartet for å oppdage steder i nabolaget";
    }

    if (visibleClusterCount > 0 && mapZoom < 15) {
      const hiddenCount = filteredPOIs.length - visiblePOIs.length;
      if (hiddenCount > 10) {
        return `Zoom inn for å oppdage ${hiddenCount}+ steder til`;
      }
    }

    // Category-based hints
    if (visiblePOIs.length > 0) {
      const categoryCounts = new Map<string, number>();
      for (const poi of visiblePOIs) {
        const count = categoryCounts.get(poi.category.name) || 0;
        categoryCounts.set(poi.category.name, count + 1);
      }

      // Find the dominant category
      let maxCategory = "";
      let maxCount = 0;
      categoryCounts.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count;
          maxCategory = name;
        }
      });

      if (maxCount >= 3) {
        const editorialCount = visiblePOIs.filter(
          (p) => p.editorialHook
        ).length;
        if (editorialCount > 0) {
          return `${visiblePOIs.length} steder i dette området — ${editorialCount} med lokaltips`;
        }
        return `${maxCount} ${maxCategory.toLowerCase()} i dette området`;
      }
    }

    if (visiblePOIs.length > 0) {
      return `${visiblePOIs.length} steder i synsfeltet`;
    }

    return null;
  }, [visiblePOIs, filteredPOIs, visibleClusterCount, mapZoom]);

  // Snap points for mobile bottom sheet (px)
  // Peek: enough for header + toolbar (~180px)
  // Half: 50% of viewport
  // Full: 92% of viewport (leaving some map visible)
  const snapPoints = [180, typeof window !== "undefined" ? window.innerHeight * 0.5 : 420, typeof window !== "undefined" ? window.innerHeight * 0.92 : 760];

  // Props shared between mobile panel and desktop POI list
  const poiListProps = {
    pois: sortedVisiblePOIs,
    activePOI,
    highlightedPOI,
    contextHint,
    onPOIClick: handlePOIClick,
    visibleCount: visiblePOIs.length,
    totalCount: filteredPOIs.length,
    travelTimesLoading,
    projectName: project.name,
    openingHoursData,
    travelMode,
    ...(isCollectionView
      ? {}
      : {
          collectionPOIs,
          onToggleCollection: handleToggleCollection,
        }),
  };

  // Mobile panel needs extra props for category filters etc.
  const panelProps = {
    ...poiListProps,
    allPOIs: poisWithTravelTimes,
    categories: project.categories,
    activeCategories,
    onToggleCategory: toggleCategory,
    onToggleAll: toggleAllCategories,
    onSetTravelMode: setTravelMode,
    isCollectionView,
    collectionPoiCount: collection?.poiIds.length,
    collectionCreatedAt: collection?.createdAt,
    collectionEmail: collection?.email,
    explorerUrl: isCollectionView ? `/${project.customer}/${project.id}/v/explorer` : undefined,
    // Package filtering — same as desktop
    packages: EXPLORER_PACKAGES,
    activePackage,
    onSelectPackage: handleSelectPackage,
  };

  const mapProps = {
    center: project.centerCoordinates,
    pois: filteredPOIs,
    allPOIs: poisWithTravelTimes,
    activePOI,
    activeCategories,
    onPOIClick: handleMapPOIClick,
    onViewportPOIs: handleViewportPOIs,
    onZoomChange: handleZoomChange,
    projectName: project.name,
    routeData,
    travelMode,
    initialBounds: collectionBounds,
    // Geolocation
    userPosition: geo.userPosition,
    userAccuracy: geo.accuracy,
    geoMode: geo.mode,
    distanceToProject: geo.distanceToProject,
  };

  // Desktop: map fullscreen with floating sidebar (40%) overlaid on right
  const desktopMapPadding = {
    left: 0,
    top: 0,
    right: typeof window !== "undefined" ? window.innerWidth * 0.4 : 500,
    bottom: 0,
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-white">
      {/* ===== DESKTOP LAYOUT (lg+) ===== */}

      {/* Desktop: fullscreen map + floating glassmorphism sidebar */}
      <div className="hidden lg:block h-full relative">
        {/* Map: full viewport */}
        <div className="absolute inset-0">
          <ExplorerMap
            {...mapProps}
            mapPadding={desktopMapPadding}
          />
        </div>

        {/* Sidebar: floating right panel with glassmorphism */}
        <div className="absolute top-6 right-6 bottom-6 w-[40%] bg-white/90 backdrop-blur-md rounded-2xl border border-white/50 shadow-[-4px_0_24px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col z-10">
          <ExplorerPOIList
            {...poiListProps}
            allPOIs={poisWithTravelTimes}
            packages={EXPLORER_PACKAGES}
            activePackage={activePackage}
            onSelectPackage={handleSelectPackage}
            categories={project.categories}
            activeCategories={activeCategories}
            onToggleCategory={toggleCategory}
            onSetTravelMode={setTravelMode}
          />

          {/* Collection footer — "hangs" at bottom of sidebar */}
          <button
            onClick={collectionPOIs.length > 0 ? () => setCollectionDrawerOpen(true) : undefined}
            className={cn(
              "flex-shrink-0 border-t px-8 py-5 flex items-center gap-3 transition-all duration-200",
              collectionFlash
                ? "bg-sky-500 border-sky-400"
                : "bg-gray-200/50 border-gray-200/40 hover:bg-gray-200/70",
              collectionPOIs.length > 0 ? "cursor-pointer" : "cursor-default"
            )}
          >
            <Bookmark className={cn(
              "w-5 h-5 flex-shrink-0 transition-colors duration-200",
              collectionFlash ? "text-white" : "text-gray-700"
            )} />
            <div className="flex-1 min-w-0 text-left">
              <span className={cn(
                "text-base font-semibold transition-colors duration-200",
                collectionFlash ? "text-white" : "text-gray-800"
              )}>Min samling</span>
              <p className={cn(
                "text-sm mt-0.5 truncate transition-colors duration-200",
                collectionFlash ? "text-sky-100" : "text-gray-500"
              )}>
                {collectionPOIs.length === 0
                  ? "Lagre steder du liker med +"
                  : `${collectionPOIs.length} ${collectionPOIs.length === 1 ? "sted" : "steder"} lagret — trykk for å se`}
              </p>
            </div>
            {collectionPOIs.length > 0 && (
              <span className={cn(
                "w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-all duration-200",
                collectionFlash ? "bg-white text-sky-600 scale-125" : "bg-gray-800 text-white scale-100"
              )}>
                {collectionPOIs.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ===== MOBILE LAYOUT (below lg) ===== */}

      {/* Mobile: Map fullscreen with bottom padding for sheet */}
      <div className="lg:hidden absolute inset-0">
        <ExplorerMap
          {...mapProps}
          mapPadding={{ left: 0, top: 0, right: 0, bottom: snapPoints[0] }}
        />
      </div>

      {/* Mobile: Bottom sheet */}
      <div className="lg:hidden">
        <ExplorerBottomSheet
          snapPoints={snapPoints}
          initialSnap={1}
          onSnapChange={() => {}}
        >
          <ExplorerPanel {...panelProps} />

          {/* Collection footer — matches desktop sidebar footer */}
          {!isCollectionView && (
            <button
              onClick={collectionPOIs.length > 0 ? () => setCollectionDrawerOpen(true) : undefined}
              className={cn(
                "flex-shrink-0 border-t px-4 py-3.5 flex items-center gap-3 transition-all duration-200",
                collectionFlash
                  ? "bg-sky-500 border-sky-400"
                  : "bg-gray-100/80 border-gray-200/40",
                collectionPOIs.length > 0 ? "cursor-pointer" : "cursor-default"
              )}
            >
              <Bookmark className={cn(
                "w-4 h-4 flex-shrink-0 transition-colors duration-200",
                collectionFlash ? "text-white" : "text-gray-600"
              )} />
              <div className="flex-1 min-w-0 text-left">
                <span className={cn(
                  "text-sm font-semibold transition-colors duration-200",
                  collectionFlash ? "text-white" : "text-gray-800"
                )}>Min samling</span>
                <p className={cn(
                  "text-xs mt-0.5 truncate transition-colors duration-200",
                  collectionFlash ? "text-sky-100" : "text-gray-500"
                )}>
                  {collectionPOIs.length === 0
                    ? "Lagre steder du liker"
                    : `${collectionPOIs.length} ${collectionPOIs.length === 1 ? "sted" : "steder"} lagret`}
                </p>
              </div>
              {collectionPOIs.length > 0 && (
                <span className={cn(
                  "w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0 transition-all duration-200",
                  collectionFlash ? "bg-white text-sky-600 scale-125" : "bg-gray-800 text-white scale-100"
                )}>
                  {collectionPOIs.length}
                </span>
              )}
            </button>
          )}
        </ExplorerBottomSheet>
      </div>

      {/* Collection drawer */}
      <CollectionDrawer
        open={collectionDrawerOpen}
        onClose={() => setCollectionDrawerOpen(false)}
        collectionPOIs={collectionPOIs}
        allPOIs={poisWithTravelTimes}
        onRemove={removeFromCollection}
        onClearAll={clearCollection}
        projectId={project.id}
      />
    </div>
  );
}
