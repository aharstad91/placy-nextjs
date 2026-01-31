"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Project, POI, Category, TravelMode } from "@/lib/types";
import { useTravelSettings } from "@/lib/store";
import { useCollection } from "@/lib/collection-store";
import { useTravelTimes } from "@/lib/hooks/useTravelTimes";
import { useOpeningHours } from "@/lib/hooks/useOpeningHours";
import { isWithinTimeBudget } from "@/lib/utils";
import { EXPLORER_PACKAGES } from "./explorer-packages";
import ExplorerMap from "./ExplorerMap";
import ExplorerPanel from "./ExplorerPanel";
import ExplorerBottomSheet from "./ExplorerBottomSheet";
import CollectionDrawer from "./CollectionDrawer";

interface CollectionData {
  slug: string;
  poiIds: string[];
}

interface ExplorerPageProps {
  project: Project;
  collection?: CollectionData;
}

export default function ExplorerPage({ project, collection }: ExplorerPageProps) {
  const isCollectionView = !!collection;
  const { travelMode, timeBudget, setTravelMode, setTimeBudget } = useTravelSettings();
  const { collectionPOIs, addToCollection, removeFromCollection, clearCollection } = useCollection();
  const [collectionDrawerOpen, setCollectionDrawerOpen] = useState(false);
  const [activePOI, setActivePOI] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedPOI, setHighlightedPOI] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(project.categories.map((c) => c.id))
  );
  const [viewportPOIIds, setViewportPOIIds] = useState<Set<string>>(new Set());
  const [visibleClusterCount, setVisibleClusterCount] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);
  const [activePackage, setActivePackage] = useState<string | null>("all");

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

  // Travel times — enriches POIs with walk times
  const { pois: poisWithTravelTimes, loading: travelTimesLoading } = useTravelTimes(
    project.id,
    project.centerCoordinates,
    basePOIs
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

  // Search filtering (applied after category filter, before viewport)
  const searchFilteredPOIs = useMemo(() => {
    if (!searchQuery) return filteredPOIs;
    return filteredPOIs.filter((poi) =>
      poi.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [filteredPOIs, searchQuery]);

  // POIs visible in current viewport AND matching active categories AND search
  const visiblePOIs = useMemo(() => {
    return searchFilteredPOIs.filter((poi) => viewportPOIIds.has(poi.id));
  }, [searchFilteredPOIs, viewportPOIIds]);

  // Opening hours for visible POIs
  const { hoursData: openingHoursData } = useOpeningHours(visiblePOIs);

  // Sort visible POIs by walk time (nearest first), fallback to euclidean distance
  const sortedVisiblePOIs = useMemo(() => {
    const center = project.centerCoordinates;
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
  }, [visiblePOIs, project.centerCoordinates]);

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

  // Count POIs within time budget
  const poisWithinBudget = useMemo(() => {
    return searchFilteredPOIs.filter((poi) =>
      isWithinTimeBudget(poi.travelTime?.[travelMode], timeBudget)
    );
  }, [searchFilteredPOIs, travelMode, timeBudget]);

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

  // Fetch walking route when a POI is selected
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

    const origin = `${project.centerCoordinates.lng},${project.centerCoordinates.lat}`;
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
  }, [activePOI, poiMap, project.centerCoordinates, travelMode]);

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

  const panelProps = {
    pois: sortedVisiblePOIs,
    allPOIs: poisWithTravelTimes,
    categories: project.categories,
    activeCategories,
    activePOI,
    highlightedPOI,
    contextHint,
    onPOIClick: handlePOIClick,
    onToggleCategory: toggleCategory,
    onToggleAll: toggleAllCategories,
    visibleCount: visiblePOIs.length,
    totalCount: searchFilteredPOIs.length,
    travelTimesLoading,
    projectName: project.name,
    openingHoursData,
    activePackage,
    onSelectPackage: handleSelectPackage,
    travelMode,
    timeBudget,
    onSetTravelMode: setTravelMode,
    onSetTimeBudget: setTimeBudget,
    poisWithinBudgetCount: poisWithinBudget.length,
    searchQuery,
    onSearchChange: setSearchQuery,
    // Collection props — hidden in collection view (read-only)
    ...(isCollectionView
      ? {}
      : {
          collectionPOIs,
          onToggleCollection: handleToggleCollection,
          onOpenCollection: () => setCollectionDrawerOpen(true),
        }),
    isCollectionView,
    collectionPoiCount: collection?.poiIds.length,
  };

  const mapProps = {
    center: project.centerCoordinates,
    pois: searchFilteredPOIs,
    allPOIs: poisWithTravelTimes,
    activePOI,
    activeCategories,
    onPOIClick: handleMapPOIClick,
    onViewportPOIs: handleViewportPOIs,
    onZoomChange: handleZoomChange,
    projectName: project.name,
    routeData,
    travelMode,
    timeBudget,
    initialBounds: collectionBounds,
  };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-white">
      {/* Map — fullscreen on mobile, left half on desktop */}
      <div className="absolute inset-0 md:relative md:w-1/2 md:h-full md:float-left">
        <ExplorerMap {...mapProps} />
      </div>

      {/* Desktop panel — right half */}
      <div className="hidden md:flex md:flex-col md:w-1/2 md:h-full md:float-right overflow-hidden">
        <ExplorerPanel {...panelProps} />
      </div>

      {/* Mobile bottom sheet */}
      <div className="md:hidden">
        <ExplorerBottomSheet
          snapPoints={snapPoints}
          initialSnap={1}
          onSnapChange={(snapIndex) => {
            // When opening a POI, move to half if in peek
            // This is handled elsewhere via active POI
          }}
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
