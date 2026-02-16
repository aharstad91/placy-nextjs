import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star, MapPin } from "lucide-react";
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
import POIDetailBody from "@/components/public/POIDetailBody";
import POIDetailSidebar from "@/components/public/POIDetailSidebar";
import POIJsonLd from "@/components/seo/POIJsonLd";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import type { KnowledgeTopic, KnowledgeCategory } from "@/lib/types";
import { KNOWLEDGE_CATEGORIES } from "@/lib/types";

export const revalidate = 86400;

const CATEGORY_ORDER: KnowledgeCategory[] = [
  "story",
  "experience",
  "taste",
  "place",
  "inside",
];

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

  // Build gallery images array (prefer gallery_images, fall back to single image)
  const mainImage = poi.featuredImage ?? null;
  const galleryImages = poi.galleryImages?.length
    ? poi.galleryImages
    : (mainImage ? [mainImage] : []);

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

  // --- Knowledge grouping for tabs ---
  const filteredKnowledge = poi.editorialHook
    ? knowledge.filter((k) => !k.sourceName?.toLowerCase().includes("backfill"))
    : knowledge;

  const byTopic = new Map<KnowledgeTopic, typeof filteredKnowledge>();
  for (const fact of filteredKnowledge) {
    const existing = byTopic.get(fact.topic) ?? [];
    existing.push(fact);
    byTopic.set(fact.topic, existing);
  }

  const knowledgeCategories = CATEGORY_ORDER
    .map((catKey) => {
      const cat = KNOWLEDGE_CATEGORIES[catKey];
      const activeTopics = cat.topics.filter((t) => byTopic.has(t as KnowledgeTopic));
      if (activeTopics.length === 0) return null;
      return {
        key: catKey,
        label: cat.labelEn,
        topicGroups: activeTopics.map((t) => ({
          topic: t as KnowledgeTopic,
          facts: byTopic.get(t as KnowledgeTopic)!,
          showLabel: activeTopics.length > 1,
        })),
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);

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

      {/* Image gallery */}
      {galleryImages.length >= 3 ? (
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] md:grid-rows-2 gap-1 rounded-xl overflow-hidden mb-6 md:h-[340px]">
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
          <div className="hidden md:block relative bg-[#f5f3f0]">
            <Image
              src={galleryImages[1]}
              alt={`${poi.name} — image 2`}
              fill
              className="object-cover"
              sizes="300px"
            />
          </div>
          <div className="hidden md:block relative bg-[#f5f3f0]">
            <Image
              src={galleryImages[2]}
              alt={`${poi.name} — image 3`}
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
          className="inline-block text-[15px] font-medium px-3 py-1 rounded-full mb-3"
          style={{
            backgroundColor: poi.category.color + "18",
            color: poi.category.color,
          }}
        >
          <CategoryIcon className="w-4 h-4 inline mr-1" />
          {poi.category.name}
        </span>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3 tracking-tight">
          {poi.name}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-[15px] text-[#6a6a6a]">
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

        {/* Editorial hook — plain paragraph */}
        {poi.editorialHook && (
          <p className="mt-4 text-base text-[#4a4a4a] leading-relaxed">
            {poi.editorialHook}
          </p>
        )}
      </div>

      {/* Tab body + sidebar */}
      <POIDetailBody categories={knowledgeCategories} locale="en">
        <POIDetailSidebar poi={poi} staticMapUrl={staticMapUrl} locale="en" />
      </POIDetailBody>

      {/* Similar places */}
      {similar.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-[#1a1a1a] mb-4">
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
                    <h3 className="text-[15px] font-medium text-[#1a1a1a] group-hover:underline truncate">
                      {s.name}
                    </h3>
                    {s.googleRating != null && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
                        <span className="text-[15px] text-[#6a6a6a]">{s.googleRating.toFixed(1)}</span>
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
