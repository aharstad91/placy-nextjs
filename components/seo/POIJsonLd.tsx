import type { PublicPOI, Area } from "@/lib/public-queries";

interface POIJsonLdProps {
  poi: PublicPOI;
  area: Area;
}

export default function POIJsonLd({ poi, area }: POIJsonLdProps) {
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": schemaType,
    name: poi.name,
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
    ...(poi.googleWebsite && { url: poi.googleWebsite }),
    ...(poi.editorialHook && { description: poi.editorialHook }),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
