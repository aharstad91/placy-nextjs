"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Project, POI, Category, TravelMode, OriginMode } from "@/lib/types";
import { DEFAULT_THEMES, CATEGORY_TO_THEME } from "@/lib/themes";

// Loading state machine for skeleton loading
type LoadState = "initial" | "loading" | "loaded" | "error" | "refreshing";
import { useTravelSettings } from "@/lib/store";
import { useCollection } from "@/lib/collection-store";
import { useTravelTimes } from "@/lib/hooks/useTravelTimes";
import { useOpeningHours } from "@/lib/hooks/useOpeningHours";
import { haversineDistance, cn } from "@/lib/utils";
import { useGeolocation } from "@/lib/hooks/useGeolocation";
import type { GeolocationMode } from "@/lib/hooks/useGeolocation";
import { Bookmark } from "lucide-react";
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
  areaSlug?: string | null;
  collection?: CollectionData;
  initialPOI?: string;
  initialCategories?: string[];
}

export default function ExplorerPage({ project, areaSlug, collection, initialPOI, initialCategories }: ExplorerPageProps) {
  const isCollectionView = !!collection;
  const { travelMode, setTravelMode } = useTravelSettings();
  const { collectionPOIs, setProject, addToCollection, removeFromCollection, clearCollection } = useCollection();
  // Scope collection to current project — clears stale POIs from other projects
  useEffect(() => { setProject(project.id); }, [project.id, setProject]);
  const [collectionDrawerOpen, setCollectionDrawerOpen] = useState(false);
  const [collectionFlash, setCollectionFlash] = useState(false);
  const prevCollectionCountRef = useRef(0);
  const [activePOI, setActivePOI] = useState<string | null>(initialPOI ?? null);
  const [highlightedPOI, setHighlightedPOI] = useState<string | null>(null);
  // Category-based filtering via disabled set
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(() => {
    // If initialCategories provided, disable everything else
    if (initialCategories && initialCategories.length > 0) {
      const validIds = new Set(project.categories.map((c) => c.id));
      const enabled = new Set(initialCategories.filter((id) => validIds.has(id)));
      if (enabled.size > 0) {
        const allCats = new Set(DEFAULT_THEMES.flatMap((t) => t.categories));
        const disabled = new Set<string>();
        allCats.forEach((c) => { if (!enabled.has(c)) disabled.add(c); });
        return disabled;
      }
    }
    return new Set();
  });

  // Derived: active categories = all theme categories minus disabled ones
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const theme of DEFAULT_THEMES) {
      for (const catId of theme.categories) {
        if (!disabledCategories.has(catId)) {
          cats.add(catId);
        }
      }
    }
    // Include project-specific categories not mapped to any theme (e.g. architecture prizes)
    for (const cat of project.categories) {
      if (!CATEGORY_TO_THEME[cat.id] && !disabledCategories.has(cat.id)) {
        cats.add(cat.id);
      }
    }
    return cats;
  }, [disabledCategories, project.categories]);

  const [viewportPOIIds, setViewportPOIIds] = useState<Set<string>>(new Set());
  const [visibleClusterCount, setVisibleClusterCount] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);

  // Origin mode determines geolocation behavior
  const originMode: OriginMode = project.originMode ?? "geolocation-with-fallback";

  // Geolocation — enabled immediately for "geolocation" mode, deferred for others
  const geoEnabledByDefault = originMode === "geolocation";
  const geo = useGeolocation(project.centerCoordinates, { enabled: geoEnabledByDefault });

  // Show geo widget: only for geolocation-with-fallback mode (not fixed, not auto)
  const showGeoWidget = originMode === "geolocation-with-fallback";

  const handleEnableGeolocation = useCallback(() => {
    geo.enable();
  }, [geo]);

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
  const { pois: poisWithTravelTimes, loading: travelTimesLoading, error: travelTimesError } = useTravelTimes(
    project.id,
    throttledOrigin,
    basePOIs,
    { skipCache: geo.mode === "gps-near" }
  );

  // Loading state machine for skeleton loading
  const [loadState, setLoadState] = useState<LoadState>("initial");
  const hasShownContentRef = useRef(false);
  const loadStartTimeRef = useRef<number>(0);
  const MIN_SKELETON_DISPLAY_MS = 400;

  // State machine transitions
  useEffect(() => {
    if (travelTimesError) {
      setLoadState("error");
      return;
    }

    if (travelTimesLoading) {
      if (hasShownContentRef.current) {
        // We've shown content before, this is a refresh (e.g., travel mode change)
        setLoadState("refreshing");
      } else {
        // First load — track start time for minimum display
        if (loadState === "initial") {
          loadStartTimeRef.current = Date.now();
        }
        setLoadState("loading");
      }
      return;
    }

    // Loading finished — ensure minimum skeleton display time
    if (loadState === "loading" && !hasShownContentRef.current) {
      const elapsed = Date.now() - loadStartTimeRef.current;
      const remaining = MIN_SKELETON_DISPLAY_MS - elapsed;

      if (remaining > 0) {
        const timer = setTimeout(() => {
          hasShownContentRef.current = true;
          setLoadState("loaded");
        }, remaining);
        return () => clearTimeout(timer);
      }
    }

    hasShownContentRef.current = true;
    setLoadState("loaded");
  }, [travelTimesLoading, travelTimesError, loadState]);

  // Computed loading states for rendering
  const showSkeleton = loadState === "initial" || loadState === "loading";
  const showContent = loadState === "loaded" || loadState === "refreshing" || loadState === "error";
  const isRefreshing = loadState === "refreshing";

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
  // Active POI is pinned separately in ExplorerPOIList, but must be in the
  // data set so opening hours / travel times are available for it
  const visiblePOIs = useMemo(() => {
    const inViewport = filteredPOIs.filter((poi) => viewportPOIIds.has(poi.id));
    if (activePOI && !viewportPOIIds.has(activePOI)) {
      const active = filteredPOIs.find((poi) => poi.id === activePOI);
      if (active) inViewport.push(active);
    }
    return inViewport;
  }, [filteredPOIs, viewportPOIIds, activePOI]);

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

  // Toggle all categories in a theme: if all active → disable all, otherwise → enable all
  const handleToggleAllInTheme = useCallback((themeId: string) => {
    const theme = DEFAULT_THEMES.find((t) => t.id === themeId);
    if (!theme) return;
    setDisabledCategories((prev) => {
      const next = new Set(prev);
      const allActive = theme.categories.every((c) => !prev.has(c));
      if (allActive) {
        // Disable all categories in this theme
        for (const c of theme.categories) next.add(c);
      } else {
        // Enable all categories in this theme
        for (const c of theme.categories) next.delete(c);
      }
      return next;
    });
  }, []);

  // Category toggle: enable/disable individual category within active theme
  const handleToggleCategory = useCallback((categoryId: string) => {
    setDisabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Dismiss active POI (from map background click)
  const handleDismissActive = useCallback(() => {
    setActivePOI(null);
  }, []);

  // Collection toggle
  const handleToggleCollection = useCallback((poiId: string) => {
    if (collectionPOIs.includes(poiId)) {
      removeFromCollection(poiId);
    } else {
      addToCollection(poiId);
    }
  }, [collectionPOIs, addToCollection, removeFromCollection]);

  // Track whether to fit map to route (list click = yes, map click = no)
  const [fitRoute, setFitRoute] = useState(false);

  // POI selection (from list click — fit map to show route)
  const handlePOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
    setFitRoute(true);
  }, []);

  // POI selection from map click (no camera movement, with temporary highlight)
  const handleMapPOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
    setFitRoute(false);
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

  // Route origin: use GPS position when available, otherwise project center
  // (Different from travel times which use effectiveOrigin based on near/far logic)
  const routeOrigin = useMemo(() => {
    return geo.userPosition ?? project.centerCoordinates;
  }, [geo.userPosition, project.centerCoordinates]);

  // Fetch route when a POI is selected (from GPS position or project center)
  // Note: We look up POI from project.pois directly to avoid re-fetching when poiMap updates
  useEffect(() => {
    if (!activePOI) {
      setRouteData(null);
      return;
    }

    // Look up POI from project.pois (stable reference)
    const poi = project.pois.find(p => p.id === activePOI);
    if (!poi) {
      console.warn('Route: POI not found:', activePOI);
      return;
    }

    // Clear previous route while loading new one
    setRouteData(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const origin = `${routeOrigin.lng},${routeOrigin.lat}`;
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
        } else {
          console.warn('Route: No geometry returned for', activePOI);
        }
      })
      .catch((err) => {
        // Aborted requests are expected, other errors should be logged
        if (err.name !== 'AbortError') {
          console.error('Route fetch failed:', err);
        }
      });

    return () => controller.abort();
  }, [activePOI, routeOrigin, travelMode, project.pois]);

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
  const poiBounds = useMemo(() => {
    if (basePOIs.length === 0) return undefined;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const poi of basePOIs) {
      if (poi.coordinates.lat < minLat) minLat = poi.coordinates.lat;
      if (poi.coordinates.lat > maxLat) maxLat = poi.coordinates.lat;
      if (poi.coordinates.lng < minLng) minLng = poi.coordinates.lng;
      if (poi.coordinates.lng > maxLng) maxLng = poi.coordinates.lng;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [basePOIs]);

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
  // Use fixed values on server, update on client after mount to avoid hydration mismatch
  const [snapPoints, setSnapPoints] = useState([180, 420, 760]);
  useEffect(() => {
    setSnapPoints([180, window.innerHeight * 0.5, window.innerHeight * 0.92]);
  }, []);

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
    areaSlug,
    // Skeleton loading state
    showSkeleton,
    showContent,
    isRefreshing,
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
    disabledCategories,
    onToggleAllInTheme: handleToggleAllInTheme,
    onToggleCategory: handleToggleCategory,
    onSetTravelMode: setTravelMode,
    isCollectionView,
    collectionPoiCount: collection?.poiIds.length,
    collectionCreatedAt: collection?.createdAt,
    collectionEmail: collection?.email,
    explorerUrl: isCollectionView ? `/${project.customer}/${project.id}` : undefined,
  };

  const mapProps = {
    center: project.centerCoordinates,
    pois: filteredPOIs,
    allPOIs: poisWithTravelTimes,
    activePOI,
    activeCategories,
    onPOIClick: handleMapPOIClick,
    onDismissActive: handleDismissActive,
    onViewportPOIs: handleViewportPOIs,
    onZoomChange: handleZoomChange,
    projectName: project.name,
    routeData,
    travelMode,
    fitRoute,
    initialBounds: poiBounds,
    // Geolocation
    userPosition: geo.userPosition,
    userAccuracy: geo.accuracy,
    geoMode: geo.mode,
    distanceToProject: geo.distanceToProject,
    // Geolocation widget (for deferred mode)
    showGeoWidget,
    geoIsEnabled: geo.isEnabled,
    onEnableGeolocation: handleEnableGeolocation,
    // Skeleton loading state
    showSkeleton,
  };

  // Desktop: split layout — map gets its own area, no sidebar overlap
  const desktopMapPadding = {
    left: 60,
    top: 60,
    right: 60,
    bottom: 60,
  };

  // Announcement text for screen readers
  const loadingAnnouncement = useMemo(() => {
    if (loadState === "loading") return "Laster steder...";
    if (loadState === "loaded" && sortedVisiblePOIs.length > 0) {
      return `${sortedVisiblePOIs.length} steder lastet`;
    }
    if (loadState === "refreshing") return "Oppdaterer reisetider...";
    if (loadState === "error") return "Kunne ikke laste reisetider";
    return "";
  }, [loadState, sortedVisiblePOIs.length]);

  return (
    <div className="h-[calc(100vh-3rem)] w-screen relative overflow-hidden bg-white">
      {/* Screen reader announcement for loading state changes */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {loadingAnnouncement}
      </div>

      {/* ===== DESKTOP LAYOUT (lg+) ===== */}

      {/* Desktop: flex split — map + flush sidebar */}
      <div className="hidden lg:flex h-full">
        {/* Map: takes remaining width */}
        <div className="flex-1 relative">
          <ExplorerMap
            {...mapProps}
            mapPadding={desktopMapPadding}
          />
        </div>

        {/* Sidebar: flush right panel */}
        <div className="w-[40%] flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
          <ExplorerPOIList
            {...poiListProps}
            allPOIs={poisWithTravelTimes}
            disabledCategories={disabledCategories}
            onToggleAllInTheme={handleToggleAllInTheme}
            onToggleCategory={handleToggleCategory}
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
