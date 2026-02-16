import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star, MapPin, ExternalLink } from "lucide-react";
import {
  getAreaBySlug,
  getPOIBySlug,
  getSimilarPOIs,
  getCategoriesForArea,
  getPlaceKnowledge,
} from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";
import { getStaticMapUrl } from "@/lib/mapbox-static";
import Breadcrumb from "@/components/public/Breadcrumb";
import PlaceKnowledgeSection from "@/components/public/PlaceKnowledgeSection";
import POIJsonLd from "@/components/seo/POIJsonLd";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import { isSafeUrl } from "@/lib/utils/url";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ area: string; slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug, slug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return {};

  const poi = await getPOIBySlug(area.id, slug);
  if (!poi) return {};

  const description =
    poi.editorialHook ??
    `${poi.name} in ${area.nameEn} — ${poi.category.name}. Read recommendations and find your way.`;

  return {
    title: `${poi.name} — ${poi.category.name} in ${area.nameEn} | Placy`,
    description,
    openGraph: {
      title: `${poi.name} | Placy`,
      description,
      type: "website",
      url: `https://placy.no/en/${areaSlug}/places/${slug}`,
      ...(poi.featuredImage ? { images: [{ url: poi.featuredImage }] } : {}),
    },
    alternates: {
      canonical: `https://placy.no/en/${areaSlug}/places/${slug}`,
      languages: {
        no: `https://placy.no/${area.slugNo}/steder/${slug}`,
        en: `https://placy.no/en/${area.slugEn}/places/${slug}`,
      },
    },
  };
}

export default async function POIPageEN({ params }: PageProps) {
  const { area: areaSlug, slug } = await params;

  const area = await getAreaBySlug(areaSlug);
  if (!area) notFound();

  const poi = await getPOIBySlug(area.id, slug);
  if (!poi) notFound();

  const [similar, knowledge, allCategorySlugs] = await Promise.all([
    getSimilarPOIs(area.id, poi.category.id, poi.id, 4),
    getPlaceKnowledge(poi.id),
    getCategoriesForArea(area.id, "en"),
  ]);

  const imageUrl = poi.featuredImage ?? null;

  const CategoryIcon = getIcon(poi.category.icon);

  const staticMapUrl = getStaticMapUrl({
    lat: poi.coordinates.lat,
    lng: poi.coordinates.lng,
    zoom: 15,
    width: 400,
    height: 300,
    markerColor: poi.category.color.replace("#", ""),
  });

  const categorySlug = allCategorySlugs.find((c) => c.id === poi.category.id)?.slug;

  const breadcrumbItems = [
    { name: "Placy", url: "https://placy.no/en" },
    { name: area.nameEn, url: `https://placy.no/en/${area.slugEn}` },
    ...(categorySlug
      ? [{ name: poi.category.name, url: `https://placy.no/en/${area.slugEn}/${categorySlug}` }]
      : []),
    { name: poi.name },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <POIJsonLd poi={poi} area={area} locale="en" />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <Breadcrumb
        items={[
          { label: "Placy", href: "/en" },
          { label: area.nameEn, href: `/en/${area.slugEn}` },
          ...(categorySlug
            ? [{ label: poi.category.name, href: `/en/${area.slugEn}/${categorySlug}` }]
            : []),
          { label: poi.name },
        ]}
      />

      {/* Hero image */}
      {imageUrl && (
        <div className="aspect-[21/9] rounded-xl overflow-hidden bg-[#f5f3f0] mb-6 relative">
          <Image
            src={imageUrl}
            alt={poi.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
            priority
          />
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <span
          className="inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3"
          style={{
            backgroundColor: poi.category.color + "18",
            color: poi.category.color,
          }}
        >
          <CategoryIcon className="w-3.5 h-3.5 inline mr-1" />
          {poi.category.name}
        </span>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3 tracking-tight">
          {poi.name}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-[#6a6a6a]">
          {poi.googleRating != null && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-[#b45309] fill-[#b45309]" />
              <span className="font-semibold text-[#1a1a1a]">
                {poi.googleRating.toFixed(1)}
              </span>
              {poi.googleReviewCount != null && (
                <span>({poi.googleReviewCount} reviews)</span>
              )}
            </div>
          )}
          {poi.address && (
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{poi.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Editorial content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 space-y-6">
          {poi.editorialHook && (
            <div className="bg-[#faf8f5] border-l-4 rounded-r-lg p-4" style={{ borderColor: poi.category.color }}>
              <p className="text-base text-[#1a1a1a] leading-relaxed italic">
                {poi.editorialHook}
              </p>
            </div>
          )}

          {poi.localInsight && (
            <div>
              <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-2">
                Local Tip
              </h2>
              <p className="text-sm text-[#4a4a4a] leading-relaxed">
                {poi.localInsight}
              </p>
            </div>
          )}

          {knowledge.length > 0 && (
            <PlaceKnowledgeSection
              knowledge={knowledge}
              locale="en"
              hasEditorialHook={!!poi.editorialHook}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="space-y-2">
            {poi.googleMapsUrl && isSafeUrl(poi.googleMapsUrl) && (
              <a
                href={poi.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#333] transition-colors"
              >
                <MapPin className="w-4 h-4" />
                View on Google Maps
              </a>
            )}
            {poi.googleWebsite && isSafeUrl(poi.googleWebsite) && (
              <a
                href={poi.googleWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-white text-[#1a1a1a] text-sm font-medium rounded-lg border border-[#eae6e1] hover:border-[#d4cfc8] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Website
              </a>
            )}
          </div>

          {staticMapUrl ? (
            <a
              href={poi.googleMapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${poi.coordinates.lat},${poi.coordinates.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-[#eae6e1] hover:border-[#d4cfc8] transition-all"
            >
              <Image
                src={staticMapUrl}
                alt={`Map of ${poi.name}`}
                width={400}
                height={300}
                className="w-full h-auto"
                loading="lazy"
              />
            </a>
          ) : (
            <div className="aspect-[4/3] rounded-lg bg-[#f0ece7] flex items-center justify-center">
              <MapPin className="w-8 h-8 text-[#c0b9ad]" />
            </div>
          )}
        </div>
      </div>

      {/* Similar places */}
      {similar.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4">
            Similar places
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {similar.map((s) => {
              const sImageUrl = s.featuredImage ?? null;
              const SIcon = getIcon(s.category.icon);

              return (
                <Link
                  key={s.id}
                  href={`/en/${areaSlug}/places/${s.slug}`}
                  className="group block bg-white rounded-lg overflow-hidden border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
                >
                  {sImageUrl ? (
                    <div className="aspect-[16/9] bg-[#f5f3f0] overflow-hidden relative">
                      <Image
                        src={sImageUrl}
                        alt={s.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, 25vw"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div
                      className="aspect-[16/9] flex items-center justify-center"
                      style={{ backgroundColor: s.category.color + "18" }}
                    >
                      <SIcon className="w-6 h-6" style={{ color: s.category.color }} />
                    </div>
                  )}
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-[#1a1a1a] group-hover:underline truncate">
                      {s.name}
                    </h3>
                    {s.googleRating != null && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Star className="w-3 h-3 text-[#b45309] fill-[#b45309]" />
                        <span className="text-[11px] text-[#6a6a6a]">{s.googleRating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
