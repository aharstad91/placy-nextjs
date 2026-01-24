"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Sidebar, MainContent } from "@/components/layout";
import { StoryHero, StorySection, ThemeStoryCTA } from "@/components/story";
import { ThemeStoryModal } from "@/components/modal";
import { ErrorBoundary } from "@/components/error-boundary";
import { useTravelSettings, useActivePOI, useActiveThemeStory } from "@/lib/store";
import { getThemeStory } from "@/lib/data";
import { useTravelTimes } from "@/lib/hooks/useTravelTimes";
import type { Project } from "@/lib/types";

interface ProjectPageClientProps {
  project: Project;
}

export default function ProjectPageClient({ project }: ProjectPageClientProps) {
  const searchParams = useSearchParams();
  const { travelMode } = useTravelSettings();
  const { activePOI, setActivePOI } = useActivePOI();
  const { activeThemeStory, setActiveThemeStory } = useActiveThemeStory();

  // Sjekk for theme URL parameter
  useEffect(() => {
    const themeParam = searchParams.get("theme");
    if (themeParam) {
      const themeStory = getThemeStory(project, themeParam);
      if (themeStory) {
        setActiveThemeStory(themeStory.id);
      }
    }
  }, [searchParams, project, setActiveThemeStory]);

  // Hent reisetider fra Mapbox Matrix API
  const { pois: poisWithTravelTime } = useTravelTimes(
    project.id,
    project.centerCoordinates,
    project.pois
  );

  // Hent aktiv theme story
  const currentThemeStory = useMemo(() => {
    if (!activeThemeStory) return null;
    return getThemeStory(project, activeThemeStory);
  }, [activeThemeStory, project]);

  // Hent POIs for aktiv theme story
  const themeStoryPOIs = useMemo(() => {
    if (!currentThemeStory) return [];
    const poiIds = currentThemeStory.sections.flatMap((s) => s.pois);
    return poisWithTravelTime.filter((poi) => poiIds.includes(poi.id));
  }, [currentThemeStory, poisWithTravelTime]);

  const { story } = project;

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-white">
        {/* Sidebar */}
        <Sidebar
          story={story}
          onOpenMap={() => {
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
                  const relevantThemeStory = story.themeStories.find((ts) =>
                    ts.sections.some((s) => s.pois.includes(poiId))
                  );
                  if (relevantThemeStory) {
                    setActiveThemeStory(relevantThemeStory.id);
                  }
                }}
                onShowAllClick={() => {
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
            projectCenter={project.centerCoordinates}
            isOpen={!!activeThemeStory}
            onClose={() => setActiveThemeStory(null)}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}
