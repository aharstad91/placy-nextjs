"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Star, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getIcon } from "@/lib/utils/map-icons";

/**
 * FeatureCarousel — Apple iPad-stil horisontal scroll av uniforme kort.
 *
 * Perfekt for kategorier UTEN et klart hub: mange likeverdige enheter
 * (spisesteder, gym, parker). Komplementerer BentoShowcase som gjør
 * zoom-in på ett subjekt.
 *
 * Kort: portrett-format, ~280px bredt, bilde-topp + innhold-bunn.
 * Scroll: snap-x-mandatory, piler på desktop, swipe på mobil.
 */

export interface FeatureCarouselItem {
  id: string;
  title: string;
  /** Small label above title (e.g. "RESTAURANT", "KAFÉ") */
  kicker?: string;
  /** Google Places image, editorial photo, or undefined */
  imageUrl?: string | null;
  /** Google rating 1-5 */
  rating?: number | null;
  /** Walk minutes */
  walkMin?: number | null;
  /** Editorial snippet (shown under title) */
  body?: string;
  /** Category icon name (fallback when no image) */
  iconName?: string;
  /** Category color for icon fallback */
  iconColor?: string;
  /** Optional click URL (POI detail, Google Maps, etc.) */
  href?: string;
}

export interface FeatureCarouselProps {
  sectionKicker?: string;
  sectionTitle?: string;
  /** Optional footer text below the carousel (e.g. "10 spisesteder · snittrating 4.2") */
  footer?: string;
  items: FeatureCarouselItem[];
}

export default function FeatureCarousel({
  sectionKicker,
  sectionTitle,
  footer,
  items,
}: FeatureCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [updateScrollState]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    // One card worth ~ 296px (280 + 16 gap)
    const step = 296;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  return (
    <div className="my-12">
      {(sectionKicker || sectionTitle) && (
        <div className="mb-6 text-center">
          {sectionKicker && (
            <p className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-2">
              {sectionKicker}
            </p>
          )}
          {sectionTitle && (
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1a1a1a]">
              {sectionTitle}
            </h3>
          )}
        </div>
      )}

      <div className="relative">
        {/* Scrollable track — overflow breaks out of the 800px column so cards
            can live in a wider horizontal space. negative margins handle the bleed. */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-16 px-16 scroll-px-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item) => (
            <CarouselCard key={item.id} item={item} />
          ))}
        </div>

        {/* Nav arrows — desktop only. Hidden when no overflow in that direction. */}
        <div className="hidden md:flex justify-end items-center gap-2 mt-3">
          <button
            onClick={() => scroll("left")}
            disabled={!canScrollLeft}
            className="w-9 h-9 rounded-full border border-[#e0dcd6] bg-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f1ec]"
            aria-label="Forrige"
          >
            <ChevronLeft className="w-4 h-4 text-[#3a3530]" />
          </button>
          <button
            onClick={() => scroll("right")}
            disabled={!canScrollRight}
            className="w-9 h-9 rounded-full border border-[#e0dcd6] bg-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#f5f1ec]"
            aria-label="Neste"
          >
            <ChevronRight className="w-4 h-4 text-[#3a3530]" />
          </button>
        </div>
      </div>

      {footer && (
        <p className="text-center text-sm text-[#8a8279] mt-4">{footer}</p>
      )}
    </div>
  );
}

function CarouselCard({ item }: { item: FeatureCarouselItem }) {
  const Icon = item.iconName ? (getIcon(item.iconName) as LucideIcon) : null;
  const [imageError, setImageError] = useState(false);
  const showImage = Boolean(item.imageUrl) && !imageError;

  const content = (
    <div className="w-[280px] md:w-[296px] shrink-0 snap-start rounded-2xl overflow-hidden bg-white border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all">
      {/* Image area */}
      <div className="relative aspect-[4/3] bg-[#f5f1ec] overflow-hidden">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl!}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              backgroundColor: item.iconColor
                ? `${item.iconColor}14`
                : "#f5f1ec",
            }}
          >
            {Icon && (
              <Icon
                className="w-10 h-10"
                style={{ color: item.iconColor ?? "#8a7e6b" }}
              />
            )}
          </div>
        )}

        {/* Walk-time badge */}
        {item.walkMin != null && (
          <div className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-sm text-xs font-medium text-[#1a1a1a] shadow-sm">
            <MapPin className="w-3 h-3 text-[#7a7062]" />
            {item.walkMin} min
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          {item.kicker && (
            <p className="text-[10px] uppercase tracking-[0.18em] font-medium text-[#a0937d]">
              {item.kicker}
            </p>
          )}
          {item.rating != null && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-[#3a3530]">
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              {item.rating.toFixed(1)}
            </span>
          )}
        </div>
        <h4 className="font-semibold text-[15px] md:text-base leading-snug text-[#1a1a1a] tracking-tight line-clamp-2">
          {item.title}
        </h4>
        {item.body && (
          <p className="text-xs text-[#5a5147] leading-snug line-clamp-2 mt-0.5">
            {item.body}
          </p>
        )}
      </div>
    </div>
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
      >
        {content}
      </a>
    );
  }
  return content;
}
