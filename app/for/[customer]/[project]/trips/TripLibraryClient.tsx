"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  ChevronRight,
  X,
  UtensilsCrossed,
  Landmark,
  TreePine,
  Users,
  Mountain,
  Sparkles,
  Eye,
  Clock,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { Project, TripCategory } from "@/lib/types";
import { TRIP_CATEGORIES, TRIP_CATEGORY_LABELS } from "@/lib/types";

// Gradient backgrounds for trips without cover images
const CATEGORY_GRADIENTS: Record<TripCategory, string> = {
  food: "from-amber-800 to-orange-600",
  culture: "from-stone-700 to-amber-800",
  nature: "from-emerald-800 to-teal-600",
  family: "from-sky-700 to-blue-500",
  active: "from-rose-700 to-orange-500",
  "hidden-gems": "from-purple-800 to-indigo-600",
  sightseeing: "from-indigo-700 to-blue-600",
};

const CATEGORY_ICONS: Record<TripCategory, LucideIcon> = {
  food: UtensilsCrossed,
  culture: Landmark,
  nature: TreePine,
  family: Users,
  active: Mountain,
  "hidden-gems": Sparkles,
  sightseeing: Eye,
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Enkel",
  moderate: "Moderat",
  challenging: "Krevende",
};

// ─── Trip item for display ───────────────────────────────────────────

interface TripItem {
  id: string;
  title: string;
  description: string;
  category: TripCategory;
  difficulty: string;
  stopCount: number;
  durationMinutes: number;
  featured: boolean;
  coverImageUrl?: string;
  href: string;
}

function tripToItem(trip: Project, customer: string, projectSlug: string): TripItem {
  const config = trip.tripConfig;
  return {
    id: trip.id,
    title: config?.title ?? trip.name,
    description: config?.description ?? "",
    category: config?.category ?? "hidden-gems",
    difficulty: config?.difficulty ?? "easy",
    stopCount: config?.stops.length ?? 0,
    durationMinutes: config?.precomputedDurationMinutes ?? 0,
    featured: config?.featured ?? false,
    coverImageUrl: config?.coverImageUrl,
    href: `/for/${customer}/${projectSlug}/trips/${trip.urlSlug}`,
  };
}

// ─── Components ──────────────────────────────────────────────────────

interface TripLibraryClientProps {
  customer: string;
  projectSlug: string;
  trips: Project[];
  welcomeText?: string;
}

/** Category navigation card (Report-style) */
function CategoryCard({
  category,
  tripCount,
  onClick,
}: {
  category: TripCategory;
  tripCount: number;
  onClick: () => void;
}) {
  const Icon = CATEGORY_ICONS[category];
  const label = TRIP_CATEGORY_LABELS[category];

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start p-4 bg-white border border-[#eae6e1] rounded-xl hover:border-[#c0b9ad] hover:shadow-sm transition-all text-left"
    >
      <Icon className="w-6 h-6 text-[#7a7062] group-hover:text-[#5a5042] mb-2 transition-colors" />
      <span className="font-semibold text-[#1a1a1a] text-sm leading-tight mb-1">
        {label}
      </span>
      <span className="text-xs text-[#6a6a6a]">
        {tripCount} {tripCount === 1 ? "tur" : "turer"}
      </span>
    </button>
  );
}

/** Featured trip card (large, horizontal) */
function FeaturedTripCard({ item }: { item: TripItem }) {
  const gradient = CATEGORY_GRADIENTS[item.category];
  const Icon = CATEGORY_ICONS[item.category];

  return (
    <Link href={item.href} className="flex-shrink-0 w-[300px] sm:w-[340px] group cursor-pointer snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C45C3A] focus-visible:ring-offset-2 rounded-2xl">
      <div className={`relative aspect-[16/10] rounded-2xl overflow-hidden bg-gradient-to-br ${gradient}`}>
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={item.title}
            fill
            sizes="340px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          /* Decorative pattern for placeholder */
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-6 right-6">
              <Icon className="w-20 h-20 text-white" />
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Category badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full">
          <Icon className="w-3.5 h-3.5 text-[#5a5042]" />
          <span className="text-xs font-medium text-[#1a1a1a]">
            {TRIP_CATEGORY_LABELS[item.category]}
          </span>
        </div>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-serif text-xl font-semibold text-white leading-tight mb-1">
            {item.title}
          </h3>
          <p className="text-sm text-white/80 line-clamp-1 mb-2">
            {item.description}
          </p>
          <div className="flex items-center gap-3 text-xs text-white/70">
            {item.durationMinutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.durationMinutes} min
              </span>
            )}
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {item.stopCount} stopp
            </span>
            <span>{DIFFICULTY_LABELS[item.difficulty] ?? ""}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Standard trip card (used in category rows) */
function TripCard({ item }: { item: TripItem }) {
  const gradient = CATEGORY_GRADIENTS[item.category];
  const Icon = CATEGORY_ICONS[item.category];

  return (
    <Link
      href={item.href}
      className="flex-shrink-0 w-48 group cursor-pointer snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C45C3A] focus-visible:ring-offset-2 rounded-xl"
    >
      <div className={`relative aspect-[4/5] rounded-xl overflow-hidden bg-gradient-to-br ${gradient}`}>
        {item.coverImageUrl ? (
          <Image
            src={item.coverImageUrl}
            alt={item.title}
            fill
            sizes="192px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 opacity-15">
            <div className="absolute bottom-4 right-4">
              <Icon className="w-12 h-12 text-white" />
            </div>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Stop count badge */}
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-medium text-[#1A1A1A]">
          {item.stopCount} stopp
        </div>
      </div>

      {/* Title and metadata */}
      <div className="mt-3">
        <h3 className="font-serif text-base font-semibold leading-tight line-clamp-2 text-[#1A1A1A] group-hover:text-[#C45C3A] transition-colors">
          {item.title}
        </h3>
        <div className="mt-1 flex items-center gap-2 text-xs text-[#6B6560]">
          {item.durationMinutes > 0 && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {item.durationMinutes} min
            </span>
          )}
          {item.difficulty && (
            <span>{DIFFICULTY_LABELS[item.difficulty] ?? ""}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Category row with horizontal scroll */
function CategoryRow({
  category,
  label,
  items,
}: {
  category: TripCategory;
  label: string;
  items: TripItem[];
}) {
  if (items.length === 0) return null;

  return (
    <section id={`trip-category-${category}`} className="mt-10 first:mt-6">
      <div className="flex items-center justify-between mb-4 px-4">
        <h2 className="font-serif text-lg font-semibold text-[#1A1A1A]">
          {label}
        </h2>
        <ChevronRight className="w-5 h-5 text-stone-400" />
      </div>

      <div className="relative" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="flex gap-3 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory">
          {items.map((item) => (
            <TripCard key={item.id} item={item} />
          ))}
        </div>
        {/* Scroll fade indicator */}
        {items.length > 1 && (
          <div className="absolute right-0 top-0 bottom-4 w-10 bg-gradient-to-l from-[#FAF8F5] to-transparent pointer-events-none" />
        )}
      </div>
    </section>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function TripLibraryClient({
  customer,
  projectSlug,
  trips,
  welcomeText,
}: TripLibraryClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);

  const allItems = useMemo(
    () => trips.map((t) => tripToItem(t, customer, projectSlug)),
    [trips, customer, projectSlug]
  );

  // Debounced search
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

  // Filter by search
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return allItems;
    const search = searchTerm.toLowerCase();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
    );
  }, [allItems, searchTerm]);

  // Group items
  const grouped = useMemo(() => {
    const result: Record<TripCategory, TripItem[]> = {
      food: [],
      culture: [],
      nature: [],
      family: [],
      active: [],
      "hidden-gems": [],
      sightseeing: [],
    };
    for (const item of filteredItems) {
      if (item.category in result) {
        result[item.category].push(item);
      }
    }
    return result;
  }, [filteredItems]);

  // Featured items
  const featuredItems = useMemo(
    () => filteredItems.filter((item) => item.featured),
    [filteredItems]
  );

  // Categories with items (in defined order)
  const categoriesWithItems = useMemo(
    () => TRIP_CATEGORIES.filter((cat) => grouped[cat].length > 0),
    [grouped]
  );

  // Scroll to category section
  const scrollToCategory = useCallback((category: TripCategory) => {
    const el = document.getElementById(`trip-category-${category}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  const hasNoResults = filteredItems.length === 0 && searchTerm;

  return (
    <main className="min-h-screen bg-[#FAF8F5] pb-12">
      {/* Header */}
      <header className="px-4 pt-6 pb-2">
        {welcomeText && (
          <p className="text-sm text-[#6B6560] leading-relaxed mb-3">
            {welcomeText}
          </p>
        )}

        <h1 className="font-serif text-2xl font-bold text-[#1A1A1A] mb-4">
          Utforsk turer
        </h1>

        {/* Search */}
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
                if (searchInputRef.current) searchInputRef.current.value = "";
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-stone-100 rounded-full"
            >
              <X className="w-4 h-4 text-[#6B6560]" />
            </button>
          )}
        </div>
      </header>

      {/* Category navigation cards (Report-style) */}
      {!searchTerm && categoriesWithItems.length > 0 && (
        <section className="px-4 mt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categoriesWithItems.map((cat) => (
              <CategoryCard
                key={cat}
                category={cat}
                tripCount={grouped[cat].length}
                onClick={() => scrollToCategory(cat)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured trips */}
      {!searchTerm && featuredItems.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4 px-4">
            <h2 className="font-serif text-lg font-semibold text-[#1A1A1A]">
              Anbefalt
            </h2>
          </div>
          <div className="relative" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="flex gap-4 overflow-x-auto px-4 pb-4 scrollbar-hide snap-x snap-mandatory">
              {featuredItems.map((item) => (
                <FeaturedTripCard key={item.id} item={item} />
              ))}
            </div>
            {featuredItems.length > 1 && (
              <div className="absolute right-0 top-0 bottom-4 w-10 bg-gradient-to-l from-[#FAF8F5] to-transparent pointer-events-none" />
            )}
          </div>
        </section>
      )}

      {/* No results */}
      {hasNoResults && (
        <div className="px-4 py-12 text-center">
          <p className="text-[#6B6560] mb-4">Ingen turer funnet</p>
          <button
            onClick={() => {
              setSearchTerm("");
              if (searchInputRef.current) searchInputRef.current.value = "";
            }}
            className="text-[#C45C3A] font-medium hover:underline"
          >
            Nullstill sok
          </button>
        </div>
      )}

      {/* Category rows */}
      {!hasNoResults &&
        categoriesWithItems.map((category) => (
          <CategoryRow
            key={category}
            category={category}
            label={TRIP_CATEGORY_LABELS[category]}
            items={grouped[category]}
          />
        ))}
    </main>
  );
}
