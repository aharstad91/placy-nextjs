"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronRight, X } from "lucide-react";
import type { Project, GuideCategory } from "@/lib/types";

interface GuideLibraryClientProps {
  customer: string;
  guides: Project[];
  groupedGuides: Record<GuideCategory, Project[]>;
  categoriesWithGuides: readonly GuideCategory[];
  categoryLabels: Record<GuideCategory, string>;
}

// GuideCard component
function GuideCard({
  guide,
  customer,
  priority = false,
}: {
  guide: Project;
  customer: string;
  priority?: boolean;
}) {
  const config = guide.guideConfig;
  const stopCount = config?.stops.length ?? 0;
  const title = config?.title ?? guide.name;
  const coverImage = config?.coverImageUrl;

  return (
    <Link
      href={`/${customer}/${guide.urlSlug}`}
      className="flex-shrink-0 w-40 group cursor-pointer snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C45C3A] focus-visible:ring-offset-2 rounded-xl"
    >
      {/* Cover image with 4:5 aspect ratio */}
      <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-stone-200">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            sizes="160px"
            priority={priority}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-300 to-stone-400" />
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Stop count badge */}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-[#1A1A1A]">
          {stopCount} stopp
        </div>
      </div>

      {/* Title and metadata */}
      <div className="mt-3">
        <h3 className="font-serif text-base font-semibold leading-tight line-clamp-2 text-[#1A1A1A] group-hover:text-[#C45C3A] transition-colors">
          {title}
        </h3>
        {config?.category && (
          <p className="mt-1 text-xs text-[#6B6560]">
            {config.difficulty === "easy"
              ? "Enkel"
              : config.difficulty === "moderate"
              ? "Moderat"
              : config.difficulty === "challenging"
              ? "Krevende"
              : ""}
          </p>
        )}
      </div>
    </Link>
  );
}

// CategoryRow component
function CategoryRow({
  category,
  label,
  guides,
  customer,
  isFirstRow = false,
}: {
  category: GuideCategory;
  label: string;
  guides: Project[];
  customer: string;
  isFirstRow?: boolean;
}) {
  if (guides.length === 0) return null;

  return (
    <section className="mt-8 first:mt-4">
      <div className="flex items-center justify-between mb-3 px-4">
        <h2 className="font-serif text-lg font-semibold text-[#1A1A1A]">
          {label}
        </h2>
        <ChevronRight className="w-5 h-5 text-stone-400" />
      </div>

      <div
        className="relative"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory">
          {guides.map((guide, index) => (
            <GuideCard
              key={guide.id}
              guide={guide}
              customer={customer}
              priority={isFirstRow && index < 4}
            />
          ))}
        </div>
        {/* Scroll fade indicator */}
        <div className="absolute right-0 top-0 bottom-4 w-10 bg-gradient-to-l from-[#FAF8F5] to-transparent pointer-events-none" />
      </div>
    </section>
  );
}

export default function GuideLibraryClient({
  customer,
  guides,
  groupedGuides,
  categoriesWithGuides,
  categoryLabels,
}: GuideLibraryClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<GuideCategory | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  // Debounced search with cancellation
  const handleSearchChange = useCallback((value: string) => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = new AbortController();
    const signal = searchAbortRef.current.signal;

    const timeoutId = setTimeout(() => {
      if (signal.aborted) return;
      setSearchTerm(value);
    }, 150);

    signal.addEventListener("abort", () => clearTimeout(timeoutId));
  }, []);

  // Filter guides using useMemo (not useEffect + setState)
  const filteredGuides = useMemo(() => {
    let result = guides;

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter((guide) => {
        const title = (guide.guideConfig?.title ?? guide.name).toLowerCase();
        const description = (guide.guideConfig?.description ?? "").toLowerCase();
        const tags = guide.guideConfig?.tags?.join(" ").toLowerCase() ?? "";
        return title.includes(search) || description.includes(search) || tags.includes(search);
      });
    }

    // Filter by category
    if (activeCategory) {
      result = result.filter(
        (guide) => guide.guideConfig?.category === activeCategory
      );
    }

    return result;
  }, [guides, searchTerm, activeCategory]);

  // Group filtered guides
  const filteredGroupedGuides = useMemo(() => {
    const grouped: Record<GuideCategory, Project[]> = {
      'food': [],
      'culture': [],
      'nature': [],
      'family': [],
      'active': [],
      'hidden-gems': [],
    };

    for (const guide of filteredGuides) {
      const category = guide.guideConfig?.category ?? 'hidden-gems';
      if (category in grouped) {
        grouped[category].push(guide);
      }
    }

    return grouped;
  }, [filteredGuides]);

  // Categories to show
  const categoriesToShow = activeCategory
    ? [activeCategory]
    : categoriesWithGuides;

  const hasNoResults = filteredGuides.length === 0 && (searchTerm || activeCategory);

  return (
    <main className="min-h-screen bg-[#FAF8F5] py-6">
      {/* Header with search */}
      <header className="px-4 mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-4">
          Utforsk guides
        </h1>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6560]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Sok etter guides..."
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white rounded-xl border border-stone-200 text-[#1A1A1A] placeholder-[#6B6560] focus:outline-none focus:ring-2 focus:ring-[#C45C3A] focus:border-transparent"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm("");
                if (searchInputRef.current) {
                  searchInputRef.current.value = "";
                }
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-100 rounded-full"
            >
              <X className="w-4 h-4 text-[#6B6560]" />
            </button>
          )}
        </div>
      </header>

      {/* Category filter chips */}
      <div className="px-4 mb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeCategory === null
                ? "bg-[#1A1A1A] text-white"
                : "bg-[#F0EDE8] text-[#1A1A1A] hover:bg-stone-200"
            }`}
          >
            Alle
          </button>
          {categoriesWithGuides.map((category) => (
            <button
              key={category}
              onClick={() =>
                setActiveCategory(activeCategory === category ? null : category)
              }
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === category
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-[#F0EDE8] text-[#1A1A1A] hover:bg-stone-200"
              }`}
            >
              {categoryLabels[category]}
            </button>
          ))}
        </div>
      </div>

      {/* No results state */}
      {hasNoResults && (
        <div className="px-4 py-12 text-center">
          <p className="text-[#6B6560] mb-4">Ingen guides funnet</p>
          <button
            onClick={() => {
              setSearchTerm("");
              setActiveCategory(null);
              if (searchInputRef.current) {
                searchInputRef.current.value = "";
              }
            }}
            className="text-[#C45C3A] font-medium hover:underline"
          >
            Nullstill filter
          </button>
        </div>
      )}

      {/* Category rows */}
      {!hasNoResults &&
        categoriesToShow.map((category, index) => (
          <CategoryRow
            key={category}
            category={category}
            label={categoryLabels[category]}
            guides={
              activeCategory
                ? filteredGroupedGuides[category]
                : groupedGuides[category]
            }
            customer={customer}
            isFirstRow={index === 0}
          />
        ))}
    </main>
  );
}
