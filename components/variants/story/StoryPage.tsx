"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import type { Project } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes/theme-definitions";
import { assertNever } from "@/lib/types";
import { composeStoryBlocks } from "@/lib/story/compose-story-blocks";
import type { StoryBlock, ChoiceOption } from "@/lib/story/types";
import StoryChatBubble from "./StoryChatBubble";
import StoryPOICard from "./StoryPOICard";
import StoryMapReveal from "./StoryMapReveal";
import StoryChoicePrompt from "./StoryChoicePrompt";
import StoryFactBubble from "./StoryFactBubble";
import StoryThemeBridge from "./StoryThemeBridge";
import StorySummary from "./StorySummary";
import StoryThemeSelector from "./StoryThemeSelector";

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
    // Deep link: skip intro and jump to theme
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

  // Ref guard against double-clicks on choice prompts
  const choiceGuardRef = useRef<Set<string>>(new Set());

  // Handle theme selection from theme selector
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

  // Handle choice prompt actions
  const handleChoice = useCallback(
    (blockId: string, option: ChoiceOption) => {
      // Synchronous double-click guard
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
            // Inject URLs into summary block
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

  // Expanded POI state (only one at a time)
  const [expandedPOIId, setExpandedPOIId] = useState<string | null>(null);

  const handlePOIToggle = useCallback((poiId: string) => {
    setExpandedPOIId((prev) => (prev === poiId ? null : poiId));
  }, []);

  // Block renderer
  function renderBlock(block: StoryBlock, index: number) {
    const staggerDelay = (index % 6) * 80;

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
      case "poi":
        return (
          <StoryPOICard
            key={block.id}
            poi={block.poi}
            isExpanded={expandedPOIId === block.poi.id}
            onToggle={() => handlePOIToggle(block.poi.id)}
            staggerDelay={staggerDelay}
          />
        );
      case "map":
        return (
          <StoryMapReveal
            key={block.id}
            staticMapUrl={block.staticMapUrl}
            themeColor={block.themeColor}
            poiCount={block.pois.length}
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
      case "fact":
        return (
          <StoryFactBubble
            key={block.id}
            icon={block.icon}
            number={block.number}
            label={block.label}
            themeColor={block.themeColor}
            staggerDelay={staggerDelay}
          />
        );
      case "bridge":
        return (
          <StoryThemeBridge
            key={block.id}
            themeName={block.themeName}
            themeIcon={block.themeIcon}
            themeColor={block.themeColor}
            bridgeText={block.bridgeText}
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

  // Filter available themes for selector (exclude visited)
  const availableThemes = composition.themes.filter(
    (t) => !state.visitedThemes.includes(t.id),
  );

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-xl mx-auto px-4 py-8 md:py-16">
        <div className="flex flex-col gap-5">
          {/* Render feed blocks */}
          {state.feedBlocks.map((block, i) => renderBlock(block, i))}

          {/* Theme selector (shown between themes) */}
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
  );
}
