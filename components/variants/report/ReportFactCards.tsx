"use client";

import { memo } from "react";
import { Star, Gem, TrendingUp } from "lucide-react";
import type { POI, Category } from "@/lib/types";
import type { ReportTheme } from "./report-data";
import { cn } from "@/lib/utils";

// ============ TYPES ============

interface StatisticsData {
  totalPOIs: number;
  avgRating: number | null;
  totalReviews: number;
}

interface TopPickData {
  poi: POI;
}

interface CategorySplitData {
  categories: Array<{ category: Category; count: number }>;
}

interface FunFactData {
  text: string;
}

interface HiddenGemData {
  poi: POI;
}

export type FactCardData =
  | { type: "statistics"; data: StatisticsData }
  | { type: "topPick"; data: TopPickData }
  | { type: "categorySplit"; data: CategorySplitData }
  | { type: "funFact"; data: FunFactData }
  | { type: "hiddenGem"; data: HiddenGemData };

// ============ TYPE GUARDS ============

function hasGoogleRating(poi: POI): poi is POI & { googleRating: number } {
  return poi.googleRating != null;
}

function isHiddenGemCandidate(
  poi: POI
): poi is POI & { googleRating: number; googleReviewCount: number } {
  return (
    poi.googleRating != null &&
    poi.googleRating >= 4.3 &&
    poi.googleReviewCount != null &&
    poi.googleReviewCount > 0 &&
    poi.googleReviewCount < 500
  );
}

// ============ COMPUTATION ============

export function computeFactCards(
  theme: ReportTheme,
  categoryFacts?: string[]
): FactCardData[] {
  const cards: FactCardData[] = [];

  // Single pass over allPOIs for categoryCounts and hiddenGem
  const { categoryCounts, hiddenGem } = theme.allPOIs.reduce(
    (acc, poi) => {
      // Category counting
      const catId = poi.category.id;
      const existing = acc.categoryCounts.find((c) => c.category.id === catId);
      if (existing) {
        existing.count++;
      } else {
        acc.categoryCounts.push({ category: poi.category, count: 1 });
      }

      // Hidden gem tracking (find max rating, no sort)
      if (isHiddenGemCandidate(poi)) {
        if (!acc.hiddenGem || poi.googleRating > acc.hiddenGem.googleRating) {
          acc.hiddenGem = poi;
        }
      }

      return acc;
    },
    {
      categoryCounts: [] as Array<{ category: Category; count: number }>,
      hiddenGem: null as
        | (POI & { googleRating: number; googleReviewCount: number })
        | null,
    }
  );

  // 1. Statistics (always if > 0 POIs)
  if (theme.stats.totalPOIs > 0) {
    cards.push({
      type: "statistics",
      data: {
        totalPOIs: theme.stats.totalPOIs,
        avgRating: theme.stats.avgRating,
        totalReviews: theme.stats.totalReviews,
      },
    });
  }

  // 2. Top Pick (requires rating) - use pre-sorted highlightPOIs
  const topPick = theme.highlightPOIs.find(hasGoogleRating);
  if (topPick) {
    cards.push({
      type: "topPick",
      data: { poi: topPick },
    });
  }

  // 3. Category Split (requires 2+ categories)
  if (categoryCounts.length >= 2) {
    cards.push({
      type: "categorySplit",
      data: {
        categories: categoryCounts.sort((a, b) => b.count - a.count),
      },
    });
  }

  // 4. Fun Fact (fallback chain)
  const funFactText = selectFunFact(categoryFacts, theme.highlightPOIs);
  if (funFactText) {
    cards.push({
      type: "funFact",
      data: { text: funFactText },
    });
  }

  // 5. Hidden Gem
  if (hiddenGem) {
    cards.push({
      type: "hiddenGem",
      data: { poi: hiddenGem },
    });
  }

  return cards;
}

function selectFunFact(
  categoryFacts: string[] | undefined,
  highlightPOIs: POI[]
): string | null {
  if (categoryFacts && categoryFacts.length > 0) {
    // Use a deterministic selection based on first POI name to avoid hydration issues
    const index = highlightPOIs[0]?.name.length ?? 0;
    return categoryFacts[index % categoryFacts.length];
  }
  const topPOI = highlightPOIs[0];
  if (topPOI?.localInsight) return topPOI.localInsight;
  if (topPOI?.editorialHook) return topPOI.editorialHook;
  return null;
}

// ============ CARD COMPONENTS ============

function FactCardWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-lg p-3 border border-[#eae6e1]",
        className
      )}
    >
      {children}
    </div>
  );
}

function StatisticsCard({ data }: { data: StatisticsData }) {
  return (
    <FactCardWrapper>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#4a4a4a]">
        <span className="font-semibold text-[#1a1a1a]">{data.totalPOIs}</span>
        <span>steder</span>
        {data.avgRating != null && (
          <>
            <span className="text-[#d4cfc8]">•</span>
            <span className="flex items-center gap-1">
              Snitt
              <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
              <span className="font-semibold text-[#1a1a1a]">
                {data.avgRating.toFixed(1)}
              </span>
            </span>
          </>
        )}
        {data.totalReviews > 0 && (
          <>
            <span className="text-[#d4cfc8]">•</span>
            <span>{formatReviewCount(data.totalReviews)} anmeldelser</span>
          </>
        )}
      </div>
    </FactCardWrapper>
  );
}

function TopPickCard({ data }: { data: TopPickData }) {
  const { poi } = data;
  return (
    <FactCardWrapper>
      <div className="flex items-center gap-1 mb-1">
        <TrendingUp className="w-3.5 h-3.5 text-[#b45309]" />
        <span className="text-[11px] font-medium text-[#b45309]">Anbefalt</span>
      </div>
      <h4 className="font-semibold text-[#1a1a1a] text-sm line-clamp-1">
        {poi.name}
      </h4>
      {poi.editorialHook && (
        <p className="text-xs text-[#6a6a6a] leading-relaxed line-clamp-2 mt-1">
          {poi.editorialHook}
        </p>
      )}
    </FactCardWrapper>
  );
}

function CategorySplitCard({ data }: { data: CategorySplitData }) {
  return (
    <FactCardWrapper>
      <div className="flex flex-wrap gap-2">
        {data.categories.slice(0, 4).map(({ category, count }) => (
          <span
            key={category.id}
            className="inline-flex items-center gap-1 text-xs"
          >
            <span className="font-medium" style={{ color: category.color }}>
              {count}
            </span>
            <span className="text-[#6a6a6a]">{category.name.toLowerCase()}</span>
          </span>
        ))}
      </div>
    </FactCardWrapper>
  );
}

function FunFactCard({ data }: { data: FunFactData }) {
  return (
    <FactCardWrapper className="bg-[#faf9f7]">
      <p className="text-xs text-[#4a4a4a] leading-relaxed line-clamp-3 italic">
        &ldquo;{data.text}&rdquo;
      </p>
    </FactCardWrapper>
  );
}

function HiddenGemCard({ data }: { data: HiddenGemData }) {
  const { poi } = data;
  return (
    <FactCardWrapper>
      <div className="flex items-center gap-1 mb-1">
        <Gem className="w-3.5 h-3.5 text-purple-600" />
        <span className="text-[11px] font-medium text-purple-600">
          Skjult perle
        </span>
      </div>
      <h4 className="font-semibold text-[#1a1a1a] text-sm line-clamp-1">
        {poi.name}
      </h4>
      <p className="text-xs text-[#6a6a6a] mt-0.5">
        ★ {poi.googleRating?.toFixed(1)} • {poi.googleReviewCount} anmeldelser
      </p>
    </FactCardWrapper>
  );
}

// ============ MAIN COMPONENT ============

function FactCard({ card }: { card: FactCardData }) {
  switch (card.type) {
    case "statistics":
      return <StatisticsCard data={card.data} />;
    case "topPick":
      return <TopPickCard data={card.data} />;
    case "categorySplit":
      return <CategorySplitCard data={card.data} />;
    case "funFact":
      return <FunFactCard data={card.data} />;
    case "hiddenGem":
      return <HiddenGemCard data={card.data} />;
  }
}

interface ReportFactCardsProps {
  cards: FactCardData[];
  variant?: "vertical" | "horizontal";
}

export const ReportFactCards = memo(function ReportFactCards({
  cards,
  variant = "vertical",
}: ReportFactCardsProps) {
  if (cards.length === 0) return null;

  if (variant === "horizontal") {
    return (
      <>
        {cards.map((card) => (
          <div key={card.type} className="flex-shrink-0 w-[200px] snap-start">
            <FactCard card={card} />
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map((card) => (
        <FactCard key={card.type} card={card} />
      ))}
    </div>
  );
});

// ============ UTILS ============

function formatReviewCount(count: number): string {
  if (count >= 10000) return `${Math.round(count / 1000)}k`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toLocaleString("nb-NO");
}
