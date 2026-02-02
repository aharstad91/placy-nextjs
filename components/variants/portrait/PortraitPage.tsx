"use client";

import { useMemo } from "react";
import type { Project, POI } from "@/lib/types";
import { ferjemannsveien10Content } from "./portrait-content";
import type { PortraitContent } from "./portrait-content";
import PortraitHero from "./PortraitHero";
import PortraitChapter from "./PortraitChapter";
import PortraitClosing from "./PortraitClosing";

interface PortraitPageProps {
  project: Project;
}

export default function PortraitPage({ project }: PortraitPageProps) {
  // Build POI lookup map
  const poiMap = useMemo(() => {
    const map = new Map<string, POI>();
    for (const poi of project.pois) {
      map.set(poi.id, poi);
    }
    return map;
  }, [project.pois]);

  // Use hardcoded content for prototype
  const content: PortraitContent = ferjemannsveien10Content;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      {/* Hero */}
      <PortraitHero
        title={content.heroTitle}
        subtitle={content.heroSubtitle}
        heroImages={project.story.heroImages}
      />

      {/* Intro */}
      <section className="py-20 md:py-28">
        <div className="max-w-prose mx-auto px-6">
          {content.intro.map((paragraph, i) => (
            <p
              key={i}
              className="text-lg md:text-xl text-[#3d3d3d] leading-[1.8] mb-8 last:mb-0"
            >
              {paragraph}
            </p>
          ))}
        </div>
      </section>

      {/* Chapters */}
      {content.chapters.map((chapter, i) => (
        <PortraitChapter
          key={chapter.id}
          chapter={chapter}
          poiMap={poiMap}
          projectCenter={project.centerCoordinates}
          isLast={i === content.chapters.length - 1}
        />
      ))}

      {/* Closing */}
      <PortraitClosing
        title={content.closing.title}
        paragraphs={content.closing.paragraphs}
        projectName={project.name}
      />
    </div>
  );
}
