import type { PublicPOI, Area } from "@/lib/public-queries";
import { isSafeUrl } from "@/lib/utils/url";

interface POIJsonLdProps {
  poi: PublicPOI;
  area: Area;
  locale: "no" | "en";
}

export default function POIJsonLd({ poi, area, locale }: POIJsonLdProps) {
  // Map category to schema.org type
  const schemaTypeMap: Record<string, string> = {
    restaurant: "Restaurant",
    cafe: "CafeOrCoffeeShop",
    bar: "BarOrPub",
    bakery: "Bakery",
    hotel: "Hotel",
    museum: "Museum",
    gym: "ExerciseGym",
    spa: "DaySpa",
    cinema: "MovieTheater",
    library: "Library",
    supermarket: "GroceryStore",
    pharmacy: "Pharmacy",
    shopping: "Store",
  };

  const schemaType = schemaTypeMap[poi.category.id] ?? "LocalBusiness";

  // Locale-aware canonical URL
  const url =
    locale === "en"
      ? `https://placy.no/en/${area.slugEn}/places/${poi.slug}`
      : `https://placy.no/${area.slugNo}/steder/${poi.slug}`;

  // External profile URLs (validated)
  const sameAs = [poi.googleWebsite, poi.facebookUrl, poi.googleMapsUrl].filter(
    (u): u is string => !!u && isSafeUrl(u),
  );

  // Opening hours (validate weekday_text is string array)
  const weekdayText = poi.openingHoursJson?.weekday_text;
  const validOpeningHours =
    Array.isArray(weekdayText) && weekdayText.every((t) => typeof t === "string");

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: poi.name,
    url,
    ...(poi.address && {
      address: {
        "@type": "PostalAddress",
        streetAddress: poi.address,
        addressCountry: "NO",
      },
    }),
    ...(poi.coordinates && {
      geo: {
        "@type": "GeoCoordinates",
        latitude: poi.coordinates.lat,
        longitude: poi.coordinates.lng,
      },
    }),
    ...(poi.googleRating != null && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: poi.googleRating,
        ...(poi.googleReviewCount != null && { reviewCount: poi.googleReviewCount }),
        bestRating: 5,
      },
    }),
    ...(poi.featuredImage && { image: poi.featuredImage }),
    ...(poi.editorialHook && { description: poi.editorialHook }),
    ...(poi.googlePhone && { telephone: poi.googlePhone }),
    ...(validOpeningHours && { openingHours: weekdayText }),
    ...(sameAs.length > 0 && { sameAs }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
