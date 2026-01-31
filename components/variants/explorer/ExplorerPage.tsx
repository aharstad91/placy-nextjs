"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Project, POI, Category, TravelMode } from "@/lib/types";
import { useTravelSettings } from "@/lib/store";
import { useCollection } from "@/lib/collection-store";
import { useTravelTimes } from "@/lib/hooks/useTravelTimes";
import { useOpeningHours } from "@/lib/hooks/useOpeningHours";
import { haversineDistance } from "@/lib/utils";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import { EXPLORER_PACKAGES } from "./explorer-packages";
import ExplorerMap from "./ExplorerMap";
import ExplorerPanel from "./ExplorerPanel";
import ExplorerBottomSheet from "./ExplorerBottomSheet";
import ExplorerNavbar from "./ExplorerNavbar";
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

  // Category toggle — clears active package since user is fine-tuning
  const toggleCategory = useCallback((categoryId: string) => {
    setActivePackage(null);
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
  const snapPoints = [140, typeof window !== "undefined" ? window.innerHeight * 0.5 : 400, typeof window !== "undefined" ? window.innerHeight * 0.9 : 720];

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

  // Desktop map padding to compensate for panel overlay
  const desktopMapPadding = {
    left: 380, // panel width (map already offset by navbar via pl-[60px])
    top: 0,
    right: 0,
    bottom: 0,
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-white">
      {/* ===== DESKTOP LAYOUT (lg+) ===== */}

      {/* Map — fullscreen behind everything, offset for navbar */}
      <div className="absolute inset-0 lg:pl-[60px]">
        <ExplorerMap
          {...mapProps}
          mapPadding={desktopMapPadding}
        />
      </div>

      {/* Desktop: Navbar (left edge) */}
      {!isCollectionView && (
        <div className="hidden lg:block">
          <ExplorerNavbar
            travelMode={travelMode}
            onSetTravelMode={setTravelMode}
            packages={EXPLORER_PACKAGES}
            activeCategories={activeCategories}
            categories={project.categories}
            onSelectPackage={handleSelectPackage}
            onToggleCategory={toggleCategory}
            collectionCount={collectionPOIs.length}
            onOpenCollection={() => setCollectionDrawerOpen(true)}
          />
        </div>
      )}

      {/* Desktop: POI list — flush with navbar, full height */}
      <div className="hidden lg:flex flex-col absolute top-0 bottom-0 left-[60px] w-[380px] bg-white border-r border-gray-200 z-30 overflow-hidden">
        <ExplorerPOIList {...poiListProps} />
      </div>

      {/* ===== MOBILE LAYOUT (below lg) ===== */}

      {/* Mobile: Map fullscreen (already rendered above via absolute inset-0) */}

      {/* Mobile: Bottom sheet */}
      <div className="lg:hidden">
        <ExplorerBottomSheet
          snapPoints={snapPoints}
          initialSnap={1}
          onSnapChange={() => {}}
        >
          <ExplorerPanel {...panelProps} />
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
