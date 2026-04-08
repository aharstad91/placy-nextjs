"use client";

import type { StoryData } from "./story-data";
import StoryHero from "./StoryHero";
import StoryThemeChapter from "./StoryThemeChapter";
import StoryClosing from "./StoryClosing";

interface StoryPageProps {
  data: StoryData;
}

export default function StoryPage({ data }: StoryPageProps) {
  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-2xl mx-auto px-6 py-12 md:py-20">
        <StoryHero
          projectName={data.projectName}
          heroIntro={data.heroIntro}
          themes={data.themes}
        />

        {data.themes.map((theme) => (
          <StoryThemeChapter
            key={theme.id}
            theme={theme}
            center={data.center}
          />
        ))}

        <StoryClosing
          projectName={data.projectName}
          explorerUrl={data.explorerUrl}
          reportUrl={data.reportUrl}
        />
      </div>
    </main>
  );
}
