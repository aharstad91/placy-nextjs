"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { Project } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes/theme-definitions";
import { assertNever } from "@/lib/types";
import { composeStoryBlocks } from "@/lib/story/compose-story-blocks";
import type { StoryBlock, ChoiceOption } from "@/lib/story/types";
import StoryChatBubble from "./StoryChatBubble";
import StoryMapStripe from "./StoryMapStripe";
import StoryPOIListBubble from "./StoryPOIListBubble";
import StoryChoicePrompt from "./StoryChoicePrompt";
import StorySummary from "./StorySummary";
import StoryThemeSelector from "./StoryThemeSelector";
import StoryMapModal from "./StoryMapModal";
import type { MapStripeBlock } from "@/lib/story/types";

interface StoryPageProps {
  project: Project;
  themes: ThemeDefinition[];
  initialTheme?: string;
  explorerUrl: string;
  reportUrl: string;
}

interface StoryState {
  visitedThemes: string[];
  currentThemeId: string | null;
  currentBatchIndex: number;
  showSummary: boolean;
  feedBlocks: StoryBlock[];
  showThemeSelector: boolean;
}

export default function StoryPage({
  project,
  themes,
  initialTheme,
  explorerUrl,
  reportUrl,
}: StoryPageProps) {
  const composition = useMemo(
    () => composeStoryBlocks(project, themes),
    [project, themes],
  );

  const [state, setState] = useState<StoryState>(() => {
    if (initialTheme && composition.themes.some((t) => t.id === initialTheme)) {
      const blocks = [
        ...composition.intro,
        ...composition.getThemeBlocks(initialTheme, 0),
      ];
      return {
        visitedThemes: [initialTheme],
        currentThemeId: initialTheme,
        currentBatchIndex: 0,
        showSummary: false,
        feedBlocks: blocks,
        showThemeSelector: false,
      };
    }

    return {
      visitedThemes: [],
      currentThemeId: null,
      currentBatchIndex: 0,
      showSummary: false,
      feedBlocks: [...composition.intro],
      showThemeSelector: true,
    };
  });

  const choiceGuardRef = useRef<Set<string>>(new Set());

  const handleThemeSelect = useCallback(
    (themeId: string) => {
      setState((prev) => {
        const newBlocks = composition.getThemeBlocks(themeId, 0);
        return {
          ...prev,
          visitedThemes: [...prev.visitedThemes, themeId],
          currentThemeId: themeId,
          currentBatchIndex: 0,
          showThemeSelector: false,
          feedBlocks: [...prev.feedBlocks, ...newBlocks],
        };
      });
    },
    [composition],
  );

  const handleChoice = useCallback(
    (blockId: string, option: ChoiceOption) => {
      if (choiceGuardRef.current.has(blockId)) return;
      choiceGuardRef.current.add(blockId);

      setState((prev) => {
        switch (option.action) {
          case "more": {
            const nextBatch = prev.currentBatchIndex + 1;
            const newBlocks = composition.getThemeBlocks(
              prev.currentThemeId!,
              nextBatch,
            );
            return {
              ...prev,
              currentBatchIndex: nextBatch,
              feedBlocks: [...prev.feedBlocks, ...newBlocks],
            };
          }
          case "next-theme": {
            return {
              ...prev,
              currentThemeId: null,
              showThemeSelector: true,
            };
          }
          case "summary": {
            const summaryBlocks = composition.getSummary(prev.visitedThemes);
            const enrichedBlocks = summaryBlocks.map((b) =>
              b.type === "summary" ? { ...b, explorerUrl, reportUrl } : b,
            );
            return {
              ...prev,
              showSummary: true,
              showThemeSelector: false,
              feedBlocks: [...prev.feedBlocks, ...enrichedBlocks],
            };
          }
          default:
            return prev;
        }
      });
    },
    [composition, explorerUrl, reportUrl],
  );

  // Map modal state
  const [mapModal, setMapModal] = useState<MapStripeBlock | null>(null);

  function renderBlock(block: StoryBlock, index: number) {
    const staggerDelay = (index % 4) * 60;

    switch (block.type) {
      case "chat":
        return (
          <StoryChatBubble
            key={block.id}
            text={block.text}
            showAvatar={block.showAvatar}
            staggerDelay={staggerDelay}
          />
        );
      case "map-stripe":
        return (
          <StoryMapStripe
            key={block.id}
            staticMapUrl={block.staticMapUrl}
            themeColor={block.themeColor}
            poiCount={block.poiCount}
            themeName={block.themeName}
            onExpand={() => setMapModal(block)}
            staggerDelay={staggerDelay}
          />
        );
      case "poi-list":
        return (
          <StoryPOIListBubble
            key={block.id}
            pois={block.pois}
            themeColor={block.themeColor}
            staggerDelay={staggerDelay}
          />
        );
      case "choice":
        return (
          <StoryChoicePrompt
            key={block.id}
            blockId={block.id}
            options={block.options}
            onChoose={(option) => handleChoice(block.id, option)}
            staggerDelay={staggerDelay}
          />
        );
      case "summary":
        return (
          <StorySummary
            key={block.id}
            themes={block.themes}
            explorerUrl={block.explorerUrl}
            reportUrl={block.reportUrl}
            staggerDelay={staggerDelay}
          />
        );
      default:
        return assertNever(block);
    }
  }

  return (
    <>
      <main className="min-h-screen bg-[#faf9f7]">
        <div className="max-w-xl mx-auto px-4 py-8 md:py-16">
          <div className="flex flex-col gap-4">
            {state.feedBlocks.map((block, i) => renderBlock(block, i))}

            {state.showThemeSelector && !state.showSummary && (
              <StoryThemeSelector
                themes={composition.themes}
                visitedThemeIds={new Set(state.visitedThemes)}
                onSelect={handleThemeSelect}
              />
            )}
          </div>
        </div>
      </main>

      {/* Full-screen map modal */}
      {mapModal && (
        <StoryMapModal
          isOpen
          onClose={() => setMapModal(null)}
          pois={mapModal.pois}
          center={mapModal.center}
          themeColor={mapModal.themeColor}
          themeName={mapModal.themeName}
        />
      )}
    </>
  );
}
