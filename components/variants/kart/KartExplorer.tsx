"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { Project, POI, TravelMode } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes";
import { buildCategoryToTheme } from "@/lib/themes";

type LoadState = "initial" | "loading" | "loaded" | "error" | "refreshing";
import { useTravelSettings } from "@/lib/store";
import { useKartBookmarks } from "@/lib/kart-bookmarks-store";
import { useTravelTimes } from "@/lib/hooks/useTravelTimes";
import { useOpeningHours } from "@/lib/hooks/useOpeningHours";
import dynamic from "next/dynamic";
import { SkeletonMapOverlay } from "@/components/ui/SkeletonMapOverlay";
import { Heart, MapPin } from "lucide-react";
import ExplorerPOIList from "@/components/variants/explorer/ExplorerPOIList";

const ExplorerMap = dynamic(() => import("@/components/variants/explorer/ExplorerMap"), {
  ssr: false,
  loading: () => <SkeletonMapOverlay />,
});
import ExplorerBottomSheet from "@/components/variants/explorer/ExplorerBottomSheet";
import ExplorerPanel from "@/components/variants/explorer/ExplorerPanel";

interface KartExplorerProps {
  project: Project;
  themes: ThemeDefinition[];
}

export default function KartExplorer({ project, themes }: KartExplorerProps) {
  const categoryToTheme = useMemo(() => buildCategoryToTheme(themes), [themes]);
  const { travelMode, setTravelMode } = useTravelSettings();
  const { bookmarkedPOIs, toggleBookmark } = useKartBookmarks();

  const [activePOI, setActivePOI] = useState<string | null>(null);
  const [highlightedPOI, setHighlightedPOI] = useState<string | null>(null);
  const [disabledCategories, setDisabledCategories] = useState<Set<string>>(new Set());

  // Derived: active categories
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const theme of themes) {
      for (const catId of theme.categories) {
        if (!disabledCategories.has(catId)) {
          cats.add(catId);
        }
      }
    }
    for (const cat of project.categories) {
      if (!categoryToTheme[cat.id] && !disabledCategories.has(cat.id)) {
        cats.add(cat.id);
      }
    }
    return cats;
  }, [disabledCategories, project.categories, themes, categoryToTheme]);

  const [viewportPOIIds, setViewportPOIIds] = useState<Set<string>>(new Set());
  const [visibleClusterCount, setVisibleClusterCount] = useState(0);
  const [mapZoom, setMapZoom] = useState(14);

  // Travel times
  const { pois: poisWithTravelTimes, loading: travelTimesLoading, error: travelTimesError } = useTravelTimes(
    project.id,
    project.centerCoordinates,
    project.pois,
  );

  // Loading state machine
  const [loadState, setLoadState] = useState<LoadState>("initial");
  const hasShownContentRef = useRef(false);
  const loadStartTimeRef = useRef<number>(0);
  const MIN_SKELETON_DISPLAY_MS = 400;

  useEffect(() => {
    if (travelTimesError) {
      setLoadState("error");
      return;
    }
    if (travelTimesLoading) {
      if (hasShownContentRef.current) {
        setLoadState("refreshing");
      } else {
        if (loadState === "initial") {
          loadStartTimeRef.current = Date.now();
        }
        setLoadState("loading");
      }
      return;
    }
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

  // Filtered POIs
  const filteredPOIs = useMemo(() => {
    return poisWithTravelTimes.filter((poi) => activeCategories.has(poi.category.id));
  }, [poisWithTravelTimes, activeCategories]);

  // Visible POIs
  const visiblePOIs = useMemo(() => {
    const inViewport = filteredPOIs.filter((poi) => viewportPOIIds.has(poi.id));
    if (activePOI && !viewportPOIIds.has(activePOI)) {
      const active = filteredPOIs.find((poi) => poi.id === activePOI);
      if (active) inViewport.push(active);
    }
    return inViewport;
  }, [filteredPOIs, viewportPOIIds, activePOI]);

  // Opening hours
  const { hoursData: openingHoursData } = useOpeningHours(visiblePOIs);

  // Sort visible POIs
  const sortedVisiblePOIs = useMemo(() => {
    const center = project.centerCoordinates;
    return [...visiblePOIs].sort((a, b) => {
      const timeA = a.travelTime?.walk;
      const timeB = b.travelTime?.walk;
      if (timeA != null && timeB != null) return timeA - timeB;
      if (timeA != null) return -1;
      if (timeB != null) return 1;
      const distA = Math.hypot(a.coordinates.lat - center.lat, a.coordinates.lng - center.lng);
      const distB = Math.hypot(b.coordinates.lat - center.lat, b.coordinates.lng - center.lng);
      return distA - distB;
    });
  }, [visiblePOIs, project.centerCoordinates]);

  // Theme/category toggles
  const handleToggleAllInTheme = useCallback((themeId: string) => {
    const theme = themes.find((t) => t.id === themeId);
    if (!theme) return;
    setDisabledCategories((prev) => {
      const next = new Set(prev);
      const allActive = theme.categories.every((c) => !prev.has(c));
      if (allActive) {
        for (const c of theme.categories) next.add(c);
      } else {
        for (const c of theme.categories) next.delete(c);
      }
      return next;
    });
  }, [themes]);

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

  const handleDismissActive = useCallback(() => {
    setActivePOI(null);
  }, []);

  // Route state
  const [routeData, setRouteData] = useState<{
    coordinates: [number, number][];
    travelTime: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [fitRoute, setFitRoute] = useState(false);

  const handlePOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
    setFitRoute(true);
  }, []);

  const handleMapPOIClick = useCallback((poiId: string) => {
    setActivePOI((prev) => (prev === poiId ? null : poiId));
    setFitRoute(false);
    setHighlightedPOI(poiId);
    setTimeout(() => setHighlightedPOI(null), 2000);
  }, []);

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

  // Route fetching
  useEffect(() => {
    if (!activePOI) {
      setRouteData(null);
      return;
    }
    const poi = project.pois.find(p => p.id === activePOI);
    if (!poi) return;

    setRouteData(null);
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
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Route fetch failed:', err);
        }
      });

    return () => controller.abort();
  }, [activePOI, travelMode, project.pois, project.centerCoordinates]);

  // Context hint
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
    if (visiblePOIs.length > 0) {
      return `${visiblePOIs.length} steder i synsfeltet`;
    }
    return null;
  }, [visiblePOIs, filteredPOIs, visibleClusterCount, mapZoom]);

  // Snap points for mobile
  const [snapPoints, setSnapPoints] = useState([180, 420, 760]);
  useEffect(() => {
    setSnapPoints([180, window.innerHeight * 0.5, window.innerHeight * 0.92]);
  }, []);

  // Bookmarked POI count for footer
  const bookmarkedCount = bookmarkedPOIs.filter(id => poiMap.has(id)).length;

  const loadingAnnouncement = useMemo(() => {
    if (loadState === "loading") return "Laster steder...";
    if (loadState === "loaded" && sortedVisiblePOIs.length > 0) {
      return `${sortedVisiblePOIs.length} steder lastet`;
    }
    if (loadState === "refreshing") return "Oppdaterer reisetider...";
    if (loadState === "error") return "Kunne ikke laste reisetider";
    return "";
  }, [loadState, sortedVisiblePOIs.length]);

  // 0 POIs empty state
  if (project.pois.length === 0) {
    return (
      <div className="h-screen w-screen relative bg-white">
        <div className="absolute inset-0">
          <ExplorerMap
            center={project.centerCoordinates}
            pois={[]}
            allPOIs={[]}
            activePOI={null}
            activeCategories={new Set()}
            onPOIClick={() => {}}
            onDismissActive={() => {}}
            onViewportPOIs={() => {}}
            onZoomChange={() => {}}
            projectName={project.name}
            routeData={null}
            travelMode="walk"
            fitRoute={false}
            showSkeleton={false}
            mapPadding={{ left: 60, top: 60, right: 60, bottom: 60 }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur rounded-2xl p-8 text-center max-w-sm mx-4 shadow-lg pointer-events-auto">
            <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">
              Vi fant dessverre ingen steder i nærheten av denne adressen
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Shared POI list props
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
    themes,
    showSkeleton,
    showContent,
    isRefreshing,
    collectionPOIs: bookmarkedPOIs,
    onToggleCollection: toggleBookmark,
    showBookmarkHeartOnly: true,
  };

  const panelProps = {
    ...poiListProps,
    allPOIs: poisWithTravelTimes,
    categories: project.categories,
    disabledCategories,
    onToggleAllInTheme: handleToggleAllInTheme,
    onToggleCategory: handleToggleCategory,
    onSetTravelMode: setTravelMode,
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
    showSkeleton,
  };

  const desktopMapPadding = { left: 60, top: 60, right: 60, bottom: 60 };

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-white">
      {/* Screen reader announcement */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {loadingAnnouncement}
      </div>

      {/* ===== DESKTOP LAYOUT (lg+) ===== */}
      <div className="hidden lg:flex h-full">
        <div className="flex-1 relative">
          <ExplorerMap {...mapProps} mapPadding={desktopMapPadding} />
        </div>

        <div className="w-[40%] flex-shrink-0 bg-white border-l border-gray-200 overflow-hidden flex flex-col">
          <ExplorerPOIList
            {...poiListProps}
            allPOIs={poisWithTravelTimes}
            disabledCategories={disabledCategories}
            onToggleAllInTheme={handleToggleAllInTheme}
            onToggleCategory={handleToggleCategory}
            onSetTravelMode={setTravelMode}
          />

          {/* Bookmarks footer */}
          {bookmarkedCount > 0 && (
            <div className="flex-shrink-0 border-t px-8 py-5 flex items-center gap-3 bg-gray-50 border-gray-200">
              <Heart className="w-5 h-5 text-red-500 flex-shrink-0" fill="currentColor" />
              <span className="text-base font-semibold text-gray-800">
                {bookmarkedCount} {bookmarkedCount === 1 ? "sted" : "steder"} lagret
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ===== MOBILE LAYOUT (below lg) ===== */}
      <div className="lg:hidden absolute inset-0">
        <ExplorerMap
          {...mapProps}
          mapPadding={{ left: 0, top: 0, right: 0, bottom: snapPoints[0] }}
        />
      </div>

      <div className="lg:hidden">
        <ExplorerBottomSheet
          snapPoints={snapPoints}
          initialSnap={1}
          onSnapChange={() => {}}
        >
          <ExplorerPanel {...panelProps} />

          {/* Bookmarks footer mobile */}
          {bookmarkedCount > 0 && (
            <div className="flex-shrink-0 border-t px-4 py-3.5 flex items-center gap-3 bg-gray-50 border-gray-200">
              <Heart className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" />
              <span className="text-sm font-semibold text-gray-800">
                {bookmarkedCount} {bookmarkedCount === 1 ? "sted" : "steder"} lagret
              </span>
            </div>
          )}
        </ExplorerBottomSheet>
      </div>
    </div>
  );
}
