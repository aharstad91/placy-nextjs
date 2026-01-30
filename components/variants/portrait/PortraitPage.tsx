"use client";

import { useState, useEffect, useMemo } from "react";
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
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  // Sticky header: show after scrolling past hero
  useEffect(() => {
    const handleScroll = () => {
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      {/* Sticky header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolledPastHero
            ? "bg-[#faf9f7]/95 backdrop-blur-sm border-b border-[#e8e4df]"
            : "bg-transparent pointer-events-none"
        }`}
      >
        <div className="max-w-prose mx-auto px-6 py-4">
          <span
            className={`text-sm tracking-[0.15em] uppercase transition-opacity duration-500 ${
              scrolledPastHero
                ? "opacity-100 text-[#1a1a1a]"
                : "opacity-0"
            }`}
          >
            {project.name}
          </span>
        </div>
      </header>

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
