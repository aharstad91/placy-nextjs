/**
 * Shared Google Place Details function (Places API New).
 * Used by both /api/places/[placeId] route and the trust-enrichment phase.
 * Avoids internal HTTP overhead by calling Google API directly.
 *
 * API-NØKKEL-KONTRAKT (CLAUDE.md «nøkkel i header, ALDRI URL»): denne bruker
 * Places API (New) med `X-Goog-Api-Key`- + `X-Goog-FieldMask`-headere, speilet
 * fra `photo-api.ts`. Den gamle legacy-stien la nøkkelen i `key=`-querystringen
 * mot `maps.googleapis.com/maps/api/place/details` — migrert bort (PRD 4 Unit 2).
 * Migreringen lukker regelen for BEGGE kall-stier som treffer denne funksjonen:
 * pipeline (`trust-enrichment.ts`) og klient-route (`app/api/places/[placeId]`).
 *
 * FELTNAVN-SKIFT legacy→Places-New (brukes direkte i FieldMask):
 *   user_ratings_total→userRatingCount, website→websiteUri,
 *   formatted_phone_number→nationalPhoneNumber, opening_hours→regularOpeningHours,
 *   business_status→businessStatus, price_level→priceLevel (nå ENUM-streng),
 *   photos[].photo_reference→photos[].name. `rating`/`businessStatus`-verdiene
 *   er uendret (samme tall/«OPERATIONAL»-enum som legacy → trust-scoring intakt).
 */

import { PlacesApiError } from "./errors";
import { belastApiKall } from "@/lib/api-budget";

export interface PlaceDetails {
  rating?: number;
  reviewCount?: number;
  photos?: Array<{ reference: string }>;
  website?: string;
  phone?: string;
  openingHours?: string[];
  isOpen?: boolean;
  businessStatus?: string; // "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY"
  priceLevel?: number; // 0-4 (mappet fra Places-New PRICE_LEVEL_*-enum)
}

/** Default fields for full place details (client-facing) — Places-New FieldMask-stier. */
const DEFAULT_FIELDS = [
  "rating",
  "userRatingCount",
  "photos",
  "websiteUri",
  "nationalPhoneNumber",
  "regularOpeningHours",
  "businessStatus",
  "priceLevel",
];

/** Minimal fields for trust enrichment only — Places-New FieldMask-stier. */
export const TRUST_ENRICHMENT_FIELDS = [
  "websiteUri",
  "businessStatus",
  "priceLevel",
  "rating",
  "userRatingCount",
];

/**
 * Minimalt feltsett for åpningstider + telefon (`refresh-opening-hours.ts`).
 *
 * KOSTNAD: FieldMask avgjør SKU, og hele kallet faktureres på det HØYESTE
 * nivået noe felt i masken tilhører. `regularOpeningHours` er Enterprise-nivå,
 * mens `photos` er Essentials ($0 via `photo-api.ts`). Å slå de to sammen i ett
 * kall ville derfor gjort bilde-oppslaget dyrt uten grunn. Derfor er masken her
 * snever, og bilder hentes i en egen $0-sti.
 */
export const OPENING_HOURS_FIELDS = ["regularOpeningHours", "nationalPhoneNumber"];

/**
 * Felt som løfter kallet til Enterprise-SKU.
 *
 * Listen er bevisst konservativ: står et felt her som egentlig er billigere,
 * belaster vi et strengere tak enn nødvendig. Motsatt vei ville vi undervurdert
 * kostnaden, og det er den feilen som koster penger.
 */
const ENTERPRISE_FIELDS = new Set([
  "regularOpeningHours",
  "currentOpeningHours",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "priceLevel",
  "rating",
  "userRatingCount",
  "reviews",
]);

/** Timeout mot Google Places API — henger aldri evig (mønster: checkWebsite). */
const PLACE_DETAILS_TIMEOUT_MS = 10_000;

/** Places-New `priceLevel` er en ENUM-streng — mappes tilbake til legacy 0-4-int
 *  (DB-kolonnen `google_price_level` er integer; trust bruker `priceLevel != null`,
 *  så FREE→0 må telle, UNSPECIFIED→undefined må ikke). */
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function mapPriceLevel(value: unknown): number | undefined {
  return typeof value === "string" ? PRICE_LEVEL_MAP[value] : undefined;
}

/** Places-New Place-objekt — kun feltene vi leser (alt optional; FieldMask styrer hva som kommer). */
interface PlacesNewResult {
  rating?: number;
  userRatingCount?: number;
  photos?: Array<{ name: string }>;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  businessStatus?: string;
  priceLevel?: string;
}

export interface FetchPlaceDetailsOptions {
  /**
   * BCP-47-språk for tekstfelt som `regularOpeningHours.weekdayDescriptions`.
   *
   * Utelates den, velger Google språk selv (Accept-Language/IP) — altså
   * ikke-deterministisk output. Kallere som LAGRER tekstfelt må sette den
   * eksplisitt; se `refresh-opening-hours.ts` for hvorfor `"en"` er valgt der.
   */
  languageCode?: string;
}

/**
 * Fetch place details from Google Places API (New).
 *
 * @param placeId - Google Place ID
 * @param apiKey - Google Places API key (sendes som X-Goog-Api-Key-header)
 * @param fields - Places-New FieldMask-stier (defaults to DEFAULT_FIELDS)
 * @param options - `languageCode` for deterministisk språk på tekstfelt
 * @returns PlaceDetails, eller null når stedet ikke finnes (HTTP 404 — legacy
 *   `status !== "OK"`-ekvivalenten). Kaster `PlacesApiError` ved andre
 *   ≠ok-statuser (403/429/500) så kallere ikke feiltolker API-feil som «tomt»
 *   (samme vern som photo-api.ts) — og slik at kvotefeil kan skilles fra
 *   transiente feil på `.status`.
 */
export async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
  fields: string[] = DEFAULT_FIELDS,
  options: FetchPlaceDetailsOptions = {}
): Promise<PlaceDetails | null> {
  // API-nøkkelen går ALDRI i querystringen (CLAUDE.md) — kun languageCode.
  const query = options.languageCode
    ? `?languageCode=${encodeURIComponent(options.languageCode)}`
    : "";
  const url = `https://places.googleapis.com/v1/places/${placeId}${query}`;

  // Feltmasken avgjør SKU: hele kallet faktureres på det HØYESTE nivået noe
  // felt tilhører (funn 2026-08-12), så åpningstider er Enterprise mens en ren
  // photos-maske er Essentials.
  belastApiKall(
    fields.some((f) => ENTERPRISE_FIELDS.has(f))
      ? "places-details-enterprise"
      : "places-details-essentials",
  );

  // Timeout kaster (AbortError) — samme feilhåndtering som annen fetch-feil
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PLACE_DETAILS_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fields.join(","),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  // 404 = stedet finnes ikke (legacy `status !== "OK"`-ekvivalent) → null.
  if (response.status === 404) {
    return null;
  }
  // Andre ≠ok = API-problem → kast, så kallere ikke tolker det som «tomt».
  if (!response.ok) {
    throw new PlacesApiError(response.status);
  }

  const place = (await response.json()) as PlacesNewResult;

  return {
    rating: place.rating,
    reviewCount: place.userRatingCount,
    photos: place.photos?.slice(0, 5).map((photo) => ({
      reference: photo.name,
    })),
    website: place.websiteUri,
    phone: place.nationalPhoneNumber,
    openingHours: place.regularOpeningHours?.weekdayDescriptions,
    isOpen: place.regularOpeningHours?.openNow,
    businessStatus: place.businessStatus,
    priceLevel: mapPriceLevel(place.priceLevel),
  };
}
