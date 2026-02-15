"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Clock,
  MapPin,
  Footprints,
  ChevronRight,
  Gift,
  Play,
  type LucideIcon,
  UtensilsCrossed,
  Landmark,
  TreePine,
  Users,
  Mountain,
  Sparkles,
  Eye,
} from "lucide-react";
import type { Trip, TripStop, ProjectTripOverride, TripCategory } from "@/lib/types";

const TripPreviewMap = dynamic(() => import("./TripPreviewMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#f0ede8] animate-pulse rounded-2xl" />
  ),
});

const CATEGORY_ICONS: Record<TripCategory, LucideIcon> = {
  food: UtensilsCrossed,
  culture: Landmark,
  nature: TreePine,
  family: Users,
  active: Mountain,
  "hidden-gems": Sparkles,
  sightseeing: Eye,
};

const CATEGORY_LABELS: Record<TripCategory, string> = {
  food: "Mat & Drikke",
  culture: "Kultur & Historie",
  nature: "Natur",
  family: "Familievennlig",
  active: "Aktiv",
  "hidden-gems": "Skjulte Perler",
  sightseeing: "Sightseeing",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Enkel",
  moderate: "Moderat",
  challenging: "Krevende",
};

interface TripPreviewProps {
  trip: Trip;
  override?: ProjectTripOverride;
  activeHref: string;
  backHref?: string;
}

export default function TripPreview({
  trip,
  override,
  activeHref,
  backHref,
}: TripPreviewProps) {
  const router = useRouter();

  // Build stops with optional start POI prepended
  const stops = useMemo(() => {
    const result = [...trip.stops];
    if (override?.startPoi) {
      const startStop: TripStop = {
        id: `start-${override.startPoi.id}` as any,
        poi: override.startPoi,
        sortOrder: -1,
        nameOverride: override.startName,
        descriptionOverride: override.startDescription,
        transitionText: override.startTransitionText,
      };
      result.unshift(startStop);
    }
    return result;
  }, [trip.stops, override]);

  // POIs for the map
  const stopPOIs = useMemo(() => stops.map((s) => s.poi), [stops]);

  const category = trip.category ?? "hidden-gems";
  const CategoryIcon = CATEGORY_ICONS[category];
  const categoryLabel = CATEGORY_LABELS[category];
  const difficultyLabel = trip.difficulty
    ? DIFFICULTY_LABELS[trip.difficulty]
    : null;

  // Reward from override or trip defaults
  const rewardTitle =
    override?.rewardTitle ?? trip.defaultRewardTitle;
  const rewardDescription =
    override?.rewardDescription ?? trip.defaultRewardDescription;

  // Shared metadata items
  const metadataItems = (
    <>
      {trip.durationMinutes && trip.durationMinutes > 0 && (
        <MetadataItem
          icon={Clock}
          label={`${trip.durationMinutes} min`}
        />
      )}
      {trip.distanceMeters && trip.distanceMeters > 0 && (
        <MetadataItem
          icon={Footprints}
          label={formatDistance(trip.distanceMeters)}
        />
      )}
      <MetadataItem
        icon={MapPin}
        label={`${stops.length} stopp`}
      />
      {difficultyLabel && (
        <MetadataItem label={difficultyLabel} />
      )}
    </>
  );

  // Shared reward teaser
  const rewardTeaser = rewardTitle && (
    <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
        <Gift className="w-5 h-5 text-amber-700" />
      </div>
      <div>
        <h3 className="font-semibold text-[#1A1A1A] text-sm">
          {rewardTitle}
        </h3>
        {rewardDescription && (
          <p className="text-sm text-[#6B6560] mt-1">
            {rewardDescription}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#FAF8F5]">
      {/* ===== MOBILE LAYOUT ===== */}
      <div className="lg:hidden">
        {/* Hero */}
        <div className="relative w-full aspect-[16/9] sm:aspect-[2/1] bg-stone-800 overflow-hidden">
          <HeroImage trip={trip} CategoryIcon={CategoryIcon} />
          <HeroOverlay
            trip={trip}
            backHref={backHref}
            CategoryIcon={CategoryIcon}
            categoryLabel={categoryLabel}
            paddingClass="p-5 sm:p-8"
          />
        </div>

        {/* Metadata stripe */}
        <div className="flex items-center gap-4 px-5 sm:px-8 py-4 bg-white border-b border-stone-100 overflow-x-auto">
          {metadataItems}
        </div>

        {/* Description */}
        {trip.description && (
          <div className="px-5 sm:px-8 py-6">
            <p className="text-[#3a3530] leading-relaxed text-base">
              {trip.description}
            </p>
          </div>
        )}

        {/* Map */}
        <div className="px-4 sm:px-8">
          <div className="h-[280px] sm:h-[340px] rounded-2xl overflow-hidden shadow-sm">
            <TripPreviewMap
              center={trip.center}
              stops={stopPOIs}
            />
          </div>
        </div>

        {/* Free mode hint */}
        <div className="px-5 sm:px-8 pt-6 pb-0">
          <p className="text-xs text-[#9a9288] uppercase tracking-wide">
            Du kan også utforske stoppene i din egen rekkefølge
          </p>
        </div>

        {/* Stop list */}
        <div className="px-5 sm:px-8 py-8">
          <h2 className="font-serif text-xl font-semibold text-[#1A1A1A] mb-5">
            Stopp på turen
          </h2>
          <ol className="space-y-4">
            {stops.map((stop, index) => (
              <PreviewStopCard
                key={stop.id}
                stop={stop}
                index={index}
                isLast={index === stops.length - 1}
              />
            ))}
          </ol>
        </div>

        {/* Rewards teaser */}
        {rewardTeaser && (
          <div className="mx-5 sm:mx-8 mb-6">{rewardTeaser}</div>
        )}

        {/* CTA */}
        <div className="sticky bottom-0 px-5 sm:px-8 py-4 bg-gradient-to-t from-[#FAF8F5] via-[#FAF8F5]/95 to-[#FAF8F5]/0">
          <button
            onClick={() => router.push(activeHref)}
            className="w-full flex items-center justify-center gap-2.5 bg-[#1A1A1A] text-white py-4 rounded-2xl font-semibold text-base hover:bg-[#2a2a2a] active:scale-[0.98] transition-all shadow-lg shadow-black/20"
          >
            <Play className="w-5 h-5 fill-current" />
            Start turen
          </button>
        </div>

        {/* Bottom spacer for sticky CTA */}
        <div className="h-4" />
      </div>

      {/* ===== DESKTOP LAYOUT ===== */}
      <div className="hidden lg:block">
        {/* Hero — full width, height-constrained */}
        <div className="relative w-full h-[400px] bg-stone-800 overflow-hidden">
          <HeroImage trip={trip} CategoryIcon={CategoryIcon} />
          <HeroOverlay
            trip={trip}
            backHref={backHref}
            CategoryIcon={CategoryIcon}
            categoryLabel={categoryLabel}
            paddingClass="p-12"
          />
        </div>

        {/* Metadata stripe */}
        <div className="flex items-center gap-6 px-16 py-4 bg-white border-b border-stone-100">
          {metadataItems}
        </div>

        {/* Two-column: content + sticky map */}
        <div className="flex max-w-[1920px] mx-auto">
          {/* Left: Scrollable content */}
          <div className="w-[50%] px-16 min-w-0 overflow-hidden py-8">
            {/* Description */}
            {trip.description && (
              <div className="pb-6">
                <p className="text-[#3a3530] leading-relaxed text-base max-w-prose">
                  {trip.description}
                </p>
              </div>
            )}

            {/* Free mode hint */}
            <div className="pb-2">
              <p className="text-xs text-[#9a9288] uppercase tracking-wide">
                Du kan også utforske stoppene i din egen rekkefølge
              </p>
            </div>

            {/* Stop list */}
            <div className="py-6">
              <h2 className="font-serif text-xl font-semibold text-[#1A1A1A] mb-6">
                Stopp på turen
              </h2>
              <ol className="space-y-5">
                {stops.map((stop, index) => (
                  <PreviewStopCard
                    key={stop.id}
                    stop={stop}
                    index={index}
                    isLast={index === stops.length - 1}
                    desktop
                  />
                ))}
              </ol>
            </div>

            {/* Rewards teaser */}
            {rewardTeaser && (
              <div className="mb-8">{rewardTeaser}</div>
            )}

            {/* CTA — in flow, not sticky */}
            <div className="pb-16">
              <button
                onClick={() => router.push(activeHref)}
                className="flex items-center justify-center gap-2.5 bg-[#1A1A1A] text-white py-4 px-12 rounded-2xl font-semibold text-base hover:bg-[#2a2a2a] active:scale-[0.98] transition-all shadow-lg shadow-black/20"
              >
                <Play className="w-5 h-5 fill-current" />
                Start turen
              </button>
            </div>
          </div>

          {/* Right: Sticky map */}
          <div className="w-[50%] pt-8 pr-16 pb-16">
            <div className="sticky top-20 h-[calc(100vh-5rem-4rem)] rounded-2xl overflow-hidden shadow-sm">
              <TripPreviewMap center={trip.center} stops={stopPOIs} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function HeroImage({
  trip,
  CategoryIcon,
}: {
  trip: Trip;
  CategoryIcon: LucideIcon;
}) {
  if (trip.coverImageUrl) {
    return (
      <Image
        src={trip.coverImageUrl}
        alt={trip.title}
        fill
        sizes="100vw"
        className="object-cover"
        priority
      />
    );
  }
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-stone-700 to-stone-900">
      <div className="absolute bottom-8 right-8 opacity-20">
        <CategoryIcon className="w-32 h-32 text-white" />
      </div>
    </div>
  );
}

function HeroOverlay({
  trip,
  backHref,
  CategoryIcon,
  categoryLabel,
  paddingClass,
}: {
  trip: Trip;
  backHref?: string;
  CategoryIcon: LucideIcon;
  categoryLabel: string;
  paddingClass: string;
}) {
  return (
    <>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

      {/* Back button */}
      {backHref && (
        <Link
          href={backHref}
          className="absolute top-4 left-4 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-medium text-[#1A1A1A] hover:bg-white transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Tilbake
        </Link>
      )}

      {/* Category badge */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
        <CategoryIcon className="w-4 h-4 text-[#5a5042]" />
        <span className="text-sm font-medium text-[#1A1A1A]">
          {categoryLabel}
        </span>
      </div>

      {/* Title over hero */}
      <div className={`absolute bottom-0 left-0 right-0 ${paddingClass}`}>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
          {trip.title}
        </h1>
        {trip.city && (
          <p className="mt-1 text-sm text-white/70">{trip.city}</p>
        )}
      </div>
    </>
  );
}

function MetadataItem({
  icon: Icon,
  label,
}: {
  icon?: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm text-[#5a5042] whitespace-nowrap">
      {Icon && <Icon className="w-4 h-4 text-[#7a7062]" />}
      <span>{label}</span>
    </div>
  );
}

function PreviewStopCard({
  stop,
  index,
  isLast,
  desktop,
}: {
  stop: TripStop;
  index: number;
  isLast: boolean;
  desktop?: boolean;
}) {
  const displayName = stop.nameOverride ?? stop.poi.name;
  const description =
    stop.descriptionOverride ?? stop.poi.editorialHook ?? stop.poi.description;
  const imageUrl = stop.imageUrlOverride ?? stop.poi.featuredImage;

  const thumbSize = desktop ? "w-20 h-20 rounded-xl" : "w-14 h-14 rounded-lg";
  const clampClass = desktop ? "line-clamp-3" : "line-clamp-2";

  return (
    <li className="flex gap-4">
      {/* Timeline connector */}
      <div className="flex flex-col items-center">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] text-white text-xs font-bold flex items-center justify-center">
          {index + 1}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-stone-200 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 pb-4 ${isLast ? "" : "border-b border-stone-100"}`}>
        <div className="flex gap-3">
          {/* Thumbnail */}
          {imageUrl && (
            <div className={`flex-shrink-0 ${thumbSize} overflow-hidden bg-stone-100`}>
              <img
                src={imageUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-[#1A1A1A] leading-tight ${desktop ? "text-base" : "text-sm"}`}>
              {displayName}
            </h3>
            {stop.poi.category?.name && (
              <p className="text-xs text-[#7a7062] mt-0.5">
                {stop.poi.category.name}
              </p>
            )}
            {description && (
              <p className={`text-sm text-[#5a5042] mt-1.5 ${clampClass} leading-relaxed`}>
                {description}
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}
