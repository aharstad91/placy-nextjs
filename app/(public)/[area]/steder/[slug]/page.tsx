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
import SaveButton from "@/components/public/SaveButton";
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
    `${poi.name} i ${area.nameNo} — ${poi.category.name}. Les anbefalinger og finn veien.`;

  return {
    title: `${poi.name} — ${poi.category.name} i ${area.nameNo} | Placy`,
    description,
    openGraph: {
      title: `${poi.name} | Placy`,
      description,
      type: "website",
      url: `https://placy.no/${areaSlug}/steder/${slug}`,
      ...(poi.featuredImage ? { images: [{ url: poi.featuredImage }] } : {}),
    },
    alternates: {
      canonical: `https://placy.no/${areaSlug}/steder/${slug}`,
      languages: {
        no: `https://placy.no/${areaSlug}/steder/${slug}`,
        en: `https://placy.no/en/${area.slugEn}/places/${slug}`,
      },
    },
  };
}

export default async function POIPage({ params }: PageProps) {
  const { area: areaSlug, slug } = await params;

  const area = await getAreaBySlug(areaSlug);
  if (!area) notFound();

  const poi = await getPOIBySlug(area.id, slug);
  if (!poi) notFound();

  const [similar, knowledge, allCategorySlugs] = await Promise.all([
    getSimilarPOIs(area.id, poi.category.id, poi.id, 4),
    getPlaceKnowledge(poi.id),
    getCategoriesForArea(area.id, "no"),
  ]);

  // Build gallery images array (prefer gallery_images, fall back to single image)
  const mainImage = poi.featuredImage ?? null;
  const galleryImages = poi.galleryImages?.length
    ? poi.galleryImages
    : (mainImage ? [mainImage] : []);

  const CategoryIcon = getIcon(poi.category.icon);

  // Static map for sidebar
  const staticMapUrl = getStaticMapUrl({
    lat: poi.coordinates.lat,
    lng: poi.coordinates.lng,
    zoom: 15,
    width: 400,
    height: 300,
    markerColor: poi.category.color.replace("#", ""),
  });

  // Find the category slug for breadcrumb (from parallelized query above)
  const categorySlug = allCategorySlugs.find((c) => c.id === poi.category.id)?.slug;

  // Breadcrumb data for JSON-LD
  const breadcrumbItems = [
    { name: "Placy", url: "https://placy.no" },
    { name: area.nameNo, url: `https://placy.no/${area.slugNo}` },
    ...(categorySlug
      ? [{ name: poi.category.name, url: `https://placy.no/${area.slugNo}/${categorySlug}` }]
      : []),
    { name: poi.name },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <POIJsonLd poi={poi} area={area} locale="no" />
      <BreadcrumbJsonLd items={breadcrumbItems} />

      <Breadcrumb
        items={[
          { label: "Placy", href: "/" },
          { label: area.nameNo, href: `/${area.slugNo}` },
          ...(categorySlug
            ? [{ label: poi.category.name, href: `/${area.slugNo}/${categorySlug}` }]
            : []),
          { label: poi.name },
        ]}
      />

      {/* Image gallery */}
      {galleryImages.length >= 3 ? (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] md:grid-rows-2 gap-1 rounded-xl overflow-hidden mb-6 md:h-[340px]">
          {/* Main image — full height on left */}
          <div className="relative aspect-[16/9] md:aspect-auto md:row-span-2 bg-[#f5f3f0]">
            <Image
              src={galleryImages[0]}
              alt={poi.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
              priority
            />
          </div>
          {/* Secondary images — stacked on right, hidden on mobile */}
          <div className="hidden md:block relative bg-[#f5f3f0]">
            <Image
              src={galleryImages[1]}
              alt={`${poi.name} — bilde 2`}
              fill
              className="object-cover"
              sizes="300px"
            />
          </div>
          <div className="hidden md:block relative bg-[#f5f3f0]">
            <Image
              src={galleryImages[2]}
              alt={`${poi.name} — bilde 3`}
              fill
              className="object-cover"
              sizes="300px"
            />
          </div>
        </div>
      ) : galleryImages.length > 0 ? (
        <div className="aspect-[21/9] rounded-xl overflow-hidden bg-[#f5f3f0] mb-6 relative">
          <Image
            src={galleryImages[0]}
            alt={poi.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
            priority
          />
        </div>
      ) : null}

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

        {/* Save + Rating + Address */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#6a6a6a]">
          <SaveButton poiId={poi.id} poiName={poi.name} />
          {poi.googleRating != null && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-[#b45309] fill-[#b45309]" />
              <span className="font-semibold text-[#1a1a1a]">
                {poi.googleRating.toFixed(1)}
              </span>
              {poi.googleReviewCount != null && (
                <span>({poi.googleReviewCount} anmeldelser)</span>
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
                Lokaltips
              </h2>
              <p className="text-sm text-[#4a4a4a] leading-relaxed">
                {poi.localInsight}
              </p>
            </div>
          )}

          {knowledge.length > 0 && (
            <PlaceKnowledgeSection
              knowledge={knowledge}
              locale="no"
              hasEditorialHook={!!poi.editorialHook}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="space-y-2">
            {poi.googleMapsUrl && isSafeUrl(poi.googleMapsUrl) && (
              <a
                href={poi.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#333] transition-colors"
              >
                <MapPin className="w-4 h-4" />
                Vis i Google Maps
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
                Nettside
              </a>
            )}
          </div>

          {/* Static map */}
          {staticMapUrl ? (
            <a
              href={poi.googleMapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${poi.coordinates.lat},${poi.coordinates.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg overflow-hidden border border-[#eae6e1] hover:border-[#d4cfc8] transition-all"
            >
              <Image
                src={staticMapUrl}
                alt={`Kart over ${poi.name}`}
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
            Lignende steder
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {similar.map((s) => {
              const sImageUrl = s.featuredImage ?? null;
              const SIcon = getIcon(s.category.icon);

              return (
                <Link
                  key={s.id}
                  href={`/${areaSlug}/steder/${s.slug}`}
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
