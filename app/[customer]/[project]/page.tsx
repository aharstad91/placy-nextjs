"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { Sidebar, MainContent } from "@/components/layout";
import { StoryHero, StorySection, ThemeStoryCTA } from "@/components/story";
import { ThemeStoryModal } from "@/components/modal";
import { ErrorBoundary } from "@/components/error-boundary";
import { useTravelSettings, useActivePOI, useActiveThemeStory } from "@/lib/store";
import { getProject, getThemeStory } from "@/lib/data";
import { useTravelTimes } from "@/lib/hooks/useTravelTimes";

export default function ProjectPage() {
  // Bruk useParams hook for å hente dynamiske route params
  const params = useParams<{ customer: string; project: string }>();
  const searchParams = useSearchParams();
  const { travelMode } = useTravelSettings();
  const { activePOI, setActivePOI } = useActivePOI();
  const { activeThemeStory, setActiveThemeStory } = useActiveThemeStory();

  // Last prosjektdata
  const projectData = useMemo(() => {
    if (!params.customer || !params.project) return null;
    return getProject(params.customer, params.project);
  }, [params.customer, params.project]);

  // Sjekk for theme URL parameter
  useEffect(() => {
    const themeParam = searchParams.get("theme");
    if (themeParam && projectData) {
      const themeStory = getThemeStory(projectData, themeParam);
      if (themeStory) {
        setActiveThemeStory(themeStory.id);
      }
    }
  }, [searchParams, projectData, setActiveThemeStory]);

  // Hent reisetider fra Mapbox Matrix API
  const { pois: poisWithTravelTime, loading: travelTimesLoading } = useTravelTimes(
    projectData?.id || "",
    projectData?.centerCoordinates || { lat: 0, lng: 0 },
    projectData?.pois || []
  );

  // Hent aktiv theme story
  const currentThemeStory = useMemo(() => {
    if (!activeThemeStory || !projectData) return null;
    return getThemeStory(projectData, activeThemeStory);
  }, [activeThemeStory, projectData]);

  // Hent POIs for aktiv theme story
  const themeStoryPOIs = useMemo(() => {
    if (!currentThemeStory || !projectData) return [];
    const poiIds = currentThemeStory.sections.flatMap((s) => s.pois);
    return poisWithTravelTime.filter((poi) => poiIds.includes(poi.id));
  }, [currentThemeStory, projectData, poisWithTravelTime]);

  // Loading state
  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Laster prosjekt...</p>
        </div>
      </div>
    );
  }

  const { story } = projectData;

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-white">
        {/* Sidebar */}
        <Sidebar
        story={story}
        onOpenMap={() => {
          // Åpne første theme story som har transport
          const transportTheme = story.themeStories.find(
            (ts) => ts.slug === "transport-mobilitet"
          );
          if (transportTheme) {
            setActiveThemeStory(transportTheme.id);
          }
        }}
      />

      {/* Hovedinnhold */}
      <MainContent>
        {/* Hero */}
        <StoryHero
          title={story.title}
          introText={story.introText}
          heroImages={story.heroImages}
        />

        {/* Story sections */}
        {story.sections.map((section) => {
          const sectionPOIs = section.pois
            ? poisWithTravelTime.filter((poi) => section.pois?.includes(poi.id))
            : [];

          return (
            <StorySection
              key={section.id}
              section={section}
              pois={sectionPOIs}
              travelMode={travelMode}
              activePOI={activePOI}
              onPOIClick={(poiId) => {
                setActivePOI(poiId);
                // Finn hvilken theme story denne POI tilhører og åpne den
                const relevantThemeStory = story.themeStories.find((ts) =>
                  ts.sections.some((s) => s.pois.includes(poiId))
                );
                if (relevantThemeStory) {
                  setActiveThemeStory(relevantThemeStory.id);
                }
              }}
              onShowAllClick={() => {
                // Finn relevant theme story basert på seksjonen
                const relevantThemeStory = story.themeStories.find((ts) =>
                  ts.sections.some((s) =>
                    section.pois?.some((poiId) => s.pois.includes(poiId))
                  )
                );
                if (relevantThemeStory) {
                  setActiveThemeStory(relevantThemeStory.id);
                }
              }}
            />
          );
        })}

        {/* Theme Story CTAs */}
        <div className="space-y-4 mt-8">
          {story.themeStories.map((themeStory) => {
            const poiCount = themeStory.sections.reduce(
              (acc, s) => acc + s.pois.length,
              0
            );
            return (
              <ThemeStoryCTA
                key={themeStory.id}
                themeStory={themeStory}
                poiCount={poiCount}
                onClick={() => setActiveThemeStory(themeStory.id)}
              />
            );
          })}
        </div>
      </MainContent>

      {/* Theme Story Modal */}
        {currentThemeStory && (
          <ThemeStoryModal
            themeStory={currentThemeStory}
            pois={themeStoryPOIs}
            projectCenter={projectData.centerCoordinates}
            isOpen={!!activeThemeStory}
            onClose={() => setActiveThemeStory(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
