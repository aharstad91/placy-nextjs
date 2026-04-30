"use client";

import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Clock,
  ExternalLink,
  Footprints,
  Globe,
  Navigation,
  Phone,
  ShoppingBag,
  Sparkles,
  Tag,
} from "lucide-react";
import type { POI } from "@/lib/types";
import { GoogleRating } from "@/components/ui/GoogleRating";
import { shouldShowRating } from "@/lib/themes/rating-categories";
import { computeIsOpen } from "@/lib/hooks/useOpeningHours";
import { isSafeUrl } from "@/lib/utils/url";
import { slugify } from "@/lib/utils/slugify";
import { getFilledIcon } from "@/lib/utils/map-icons-filled";
import { BoardLiveTransport } from "./mobile/BoardLiveTransport";

interface Props {
  poi: POI;
  /** Område-slug brukt til "Les mer"-lenke (POI-detaljside). Skjules hvis udefinert. */
  areaSlug?: string | null;
}

const PRICE_CATEGORIES = new Set(["restaurant", "cafe", "bar", "bakery"]);
const PRICE_LABEL: Record<number, string> = { 1: "$", 2: "$$", 3: "$$$", 4: "$$$$" };

const ENGLISH_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const NO_DAYS = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
const NO_MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "mai",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "des",
];

function formatEventDate(dateStr: string): string {
  // T12:00:00 unngår timezone-shift på datoer uten tidspunkt
  const d = new Date(`${dateStr}T12:00:00`);
  return `${NO_DAYS[d.getDay()]}. ${d.getDate()}. ${NO_MONTHS[d.getMonth()]}`;
}

/**
 * Felles POI-detalj-blokk for rapport-board (mobile sheet + desktop accordion).
 *
 * Alle seksjoner gates dynamisk slik at irrelevante felter aldri vises:
 * - Rating: kun for kategorier i CATEGORIES_WITH_RATING (mat, kultur, butikk, trening)
 * - Pris: kun for restaurant/cafe/bar/bakery
 * - Åpningstider: kun når openingHoursJson finnes
 * - Telefon/Nettside: kun når Google-feltet er satt
 * - Trust-flagg: skjuler rating når trustFlags har innhold
 * - Live transport: kun for transport-POIer (eksisterende BoardLiveTransport-gating)
 * - Event-pille + Mer info-knapp: kun når eventDates finnes
 * - Child POIs grid: kun for parents (childPOIs.length > 0)
 *
 * Komponenten kan trygt rendres for alle POIer — minimum-render er
 * Vis rute + Utforsk-knappene (universelle handlinger).
 */
export function BoardPOIDetails({ poi, areaSlug }: Props) {
  // mymaps-domener må gå via image-proxy (ikke whitelisted i next.config.mjs)
  const imageUrl = poi.featuredImage
    ? poi.featuredImage.includes("mymaps.usercontent.google.com")
      ? `/api/image-proxy?url=${encodeURIComponent(poi.featuredImage)}`
      : poi.featuredImage
    : null;

  // Trust-gating: trustFlags med innhold = mistenkelig POI, skjul rating helt
  const trustOk = !poi.trustFlags || poi.trustFlags.length === 0;
  const showRating =
    trustOk &&
    shouldShowRating(poi.category.id) &&
    poi.googleRating != null &&
    poi.googleRating > 0;

  const showPrice =
    PRICE_CATEGORIES.has(poi.category.id) &&
    poi.googlePriceLevel != null &&
    poi.googlePriceLevel > 0;
  const priceLabel = showPrice ? PRICE_LABEL[poi.googlePriceLevel!] : null;

  const walkMinutes =
    poi.travelTime?.walk != null ? Math.round(poi.travelTime.walk / 60) : null;

  // Åpningstider — i dag-linje
  const weekdayText = poi.openingHoursJson?.weekday_text;
  const todayHours = (() => {
    if (!weekdayText?.length) return null;
    const today = ENGLISH_DAY_NAMES[new Date().getDay()];
    const line = weekdayText.find((l) =>
      l.toLowerCase().startsWith(today.toLowerCase()),
    );
    return line ? line.replace(/^[^:]+:\s*/, "") : null;
  })();
  const isOpenNow = weekdayText?.length ? computeIsOpen(weekdayText) : undefined;

  const isClosedPermanently = poi.googleBusinessStatus === "CLOSED_PERMANENTLY";
  const isClosedTemporarily = poi.googleBusinessStatus === "CLOSED_TEMPORARILY";

  const hasEvent = !!poi.eventDates?.length;
  const eventDateLabel = (() => {
    if (!poi.eventDates?.length) return null;
    if (poi.eventDates.length === 1) return formatEventDate(poi.eventDates[0]);
    if (poi.eventDates.length <= 3)
      return poi.eventDates.map(formatEventDate).join(", ");
    return `${formatEventDate(poi.eventDates[0])} – ${formatEventDate(
      poi.eventDates[poi.eventDates.length - 1],
    )}`;
  })();
  const eventTimeLabel = poi.eventTimeStart
    ? poi.eventTimeEnd
      ? `${poi.eventTimeStart}–${poi.eventTimeEnd}`
      : poi.eventTimeStart
    : null;

  // Action URLs
  const directionsUrl = poi.googlePlaceId
    ? `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&destination_place_id=${poi.googlePlaceId}&travelmode=walking`
    : `https://www.google.com/maps/dir/?api=1&destination=${poi.coordinates.lat},${poi.coordinates.lng}&travelmode=walking`;

  // Google AI Mode-søk (udm=50). poi.address gir Google nok kontekst til å
  // disambiguere når flere steder har samme navn.
  const exploreQuery = poi.address ? `${poi.name} ${poi.address}` : poi.name;
  const exploreUrl = `https://www.google.com/search?udm=50&q=${encodeURIComponent(exploreQuery)}`;

  const poiPageUrl = areaSlug ? `/${areaSlug}/steder/${slugify(poi.name)}` : null;

  const fallbackDescription =
    !poi.editorialHook && !poi.localInsight && poi.description
      ? poi.description
      : null;

  return (
    <div className="space-y-3.5">
      {/* Cover-bilde */}
      {imageUrl && (
        <div className="relative w-full aspect-[16/9] overflow-hidden rounded-xl bg-stone-100">
          <Image
            src={imageUrl}
            alt={poi.name}
            fill
            sizes="(max-width: 1024px) 100vw, 504px"
            className="object-cover"
            unoptimized={imageUrl.startsWith("/api/image-proxy")}
          />
        </div>
      )}

      {/* BusinessStatus-banner */}
      {isClosedPermanently && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">Permanent stengt</span>
        </div>
      )}
      {isClosedTemporarily && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">Midlertidig stengt</span>
        </div>
      )}

      {/* Meta-rad: rating · pris · gå-tid */}
      {(showRating || showPrice || walkMinutes != null) && (
        <div className="flex items-center gap-2 flex-wrap text-sm text-stone-600">
          {showRating && (
            <GoogleRating
              rating={poi.googleRating!}
              reviewCount={poi.googleReviewCount}
              size="sm"
            />
          )}
          {showRating && (showPrice || walkMinutes != null) && (
            <span className="text-stone-300">·</span>
          )}
          {showPrice && (
            <span className="font-medium text-stone-700">{priceLabel}</span>
          )}
          {showPrice && walkMinutes != null && (
            <span className="text-stone-300">·</span>
          )}
          {walkMinutes != null && (
            <span className="flex items-center gap-1">
              <Footprints className="w-3.5 h-3.5" />
              {walkMinutes} min
            </span>
          )}
        </div>
      )}

      {/* Event-piller (dato + tid + tags) */}
      {hasEvent && (eventDateLabel || eventTimeLabel) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium">
            <Clock className="w-3 h-3" />
            {eventDateLabel}
            {eventDateLabel && eventTimeLabel && " · "}
            {eventTimeLabel}
          </span>
          {poi.eventTags?.map((tagLabel) => (
            <span
              key={tagLabel}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-100 text-stone-700 text-xs"
            >
              <Tag className="w-3 h-3" />
              {tagLabel}
            </span>
          ))}
        </div>
      )}

      {/* Editorial hook — fremhevet "spotlight"-styling */}
      {poi.editorialHook && (
        <div className="bg-amber-50 rounded-xl px-3 py-2.5 border border-amber-100">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[15px] leading-relaxed text-amber-900">
              {poi.editorialHook}
            </p>
          </div>
        </div>
      )}

      {/* Local insight — sekundær body */}
      {poi.localInsight && (
        <p className="text-[15px] leading-relaxed text-stone-700">
          {poi.localInsight}
        </p>
      )}

      {/* Description fallback når ingen editorial finnes */}
      {fallbackDescription && (
        <p className="text-[15px] leading-relaxed text-stone-700">
          {fallbackDescription}
        </p>
      )}

      {/* Anchor-summary for parent POIs */}
      {poi.anchorSummary && (
        <p className="text-sm leading-relaxed text-stone-600">
          {poi.anchorSummary}
        </p>
      )}

      {/* Child POIs grid (kjøpesenter → butikker) */}
      {poi.childPOIs && poi.childPOIs.length > 0 && (
        <div className="rounded-xl bg-stone-50 border border-stone-200 px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-stone-500 mb-2">
            <ShoppingBag className="w-3 h-3" />
            <span>I senteret</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            {poi.childPOIs.map((child) => {
              const ChildIcon = getFilledIcon(child.category.icon);
              return (
                <div
                  key={child.id}
                  className="flex items-center gap-1.5 text-xs min-w-0"
                >
                  <ChildIcon
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: child.category.color }}
                    weight="fill"
                  />
                  <span className="text-stone-700 truncate">{child.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live transport (kun render hvis transport-POI med data) */}
      <BoardLiveTransport poi={poi} />

      {/* Åpningstider med "Åpen nå"-status */}
      {todayHours && (
        <div className="flex items-center gap-1.5 text-sm text-stone-600">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>
            I dag: {todayHours}
            {isOpenNow === true && (
              <span className="text-emerald-600 font-medium ml-1">· Åpen nå</span>
            )}
            {isOpenNow === false && (
              <span className="text-stone-400 ml-1">· Stengt</span>
            )}
          </span>
        </div>
      )}

      {/* Action-knapper */}
      <div className="flex items-center gap-2 flex-wrap pt-1">
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700 hover:bg-sky-100 transition-colors"
        >
          <Navigation className="w-3.5 h-3.5" />
          Vis rute
        </a>

        {poi.googleWebsite && isSafeUrl(poi.googleWebsite) && (
          <a
            href={poi.googleWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
          >
            <Globe className="w-3.5 h-3.5" />
            Nettside
          </a>
        )}

        {poi.googlePhone && (
          <a
            href={`tel:${poi.googlePhone.replace(/\s+/g, "")}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            Ring
          </a>
        )}

        <a
          href={exploreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Utforsk
        </a>

        {hasEvent && poi.eventUrl && isSafeUrl(poi.eventUrl) && (
          <a
            href={poi.eventUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Mer info
          </a>
        )}

        {poiPageUrl && (
          <Link
            href={poiPageUrl}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Les mer
          </Link>
        )}

        {poi.googleMapsUrl && isSafeUrl(poi.googleMapsUrl) && (
          <a
            href={poi.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Google Maps
          </a>
        )}
      </div>
    </div>
  );
}
