"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronRight, X } from "lucide-react";
import type { Project, TripCategory } from "@/lib/types";

interface TripLibraryClientProps {
  customer: string;
  trips: Project[];
  groupedTrips: Record<TripCategory, Project[]>;
  categoriesWithTrips: readonly TripCategory[];
  categoryLabels: Record<TripCategory, string>;
}

// TripCard component
function TripCard({
  trip,
  customer,
  priority = false,
}: {
  trip: Project;
  customer: string;
  priority?: boolean;
}) {
  const config = trip.tripConfig;
  const stopCount = config?.stops.length ?? 0;
  const title = config?.title ?? trip.name;
  const coverImage = config?.coverImageUrl;

  return (
    <Link
      href={`/${customer}/${trip.urlSlug}`}
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
  trips,
  customer,
  isFirstRow = false,
}: {
  category: TripCategory;
  label: string;
  trips: Project[];
  customer: string;
  isFirstRow?: boolean;
}) {
  if (trips.length === 0) return null;

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
          {trips.map((trip, index) => (
            <TripCard
              key={trip.id}
              trip={trip}
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

export default function TripLibraryClient({
  customer,
  trips,
  groupedTrips,
  categoriesWithTrips,
  categoryLabels,
}: TripLibraryClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<TripCategory | null>(null);
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

  // Filter trips using useMemo (not useEffect + setState)
  const filteredTrips = useMemo(() => {
    let result = trips;

    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter((trip) => {
        const title = (trip.tripConfig?.title ?? trip.name).toLowerCase();
        const description = (trip.tripConfig?.description ?? "").toLowerCase();
        const tags = trip.tripConfig?.tags?.join(" ").toLowerCase() ?? "";
        return title.includes(search) || description.includes(search) || tags.includes(search);
      });
    }

    // Filter by category
    if (activeCategory) {
      result = result.filter(
        (trip) => trip.tripConfig?.category === activeCategory
      );
    }

    return result;
  }, [trips, searchTerm, activeCategory]);

  // Group filtered trips
  const filteredGroupedTrips = useMemo(() => {
    const grouped: Record<TripCategory, Project[]> = {
      'food': [],
      'culture': [],
      'nature': [],
      'family': [],
      'active': [],
      'hidden-gems': [],
    };

    for (const trip of filteredTrips) {
      const category = trip.tripConfig?.category ?? 'hidden-gems';
      if (category in grouped) {
        grouped[category].push(trip);
      }
    }

    return grouped;
  }, [filteredTrips]);

  // Categories to show
  const categoriesToShow = activeCategory
    ? [activeCategory]
    : categoriesWithTrips;

  const hasNoResults = filteredTrips.length === 0 && (searchTerm || activeCategory);

  return (
    <main className="min-h-screen bg-[#FAF8F5] py-6">
      {/* Header with search */}
      <header className="px-4 mb-6">
        <h1 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-4">
          Utforsk turer
        </h1>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B6560]" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Sok etter turer..."
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
          {categoriesWithTrips.map((category) => (
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
          <p className="text-[#6B6560] mb-4">Ingen turer funnet</p>
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
            trips={
              activeCategory
                ? filteredGroupedTrips[category]
                : groupedTrips[category]
            }
            customer={customer}
            isFirstRow={index === 0}
          />
        ))}
    </main>
  );
}
