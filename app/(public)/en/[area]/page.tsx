import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import {
  getAreaBySlug,
  getCategoriesForArea,
  getHighlightPOIs,
} from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";
import Breadcrumb from "@/components/public/Breadcrumb";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ area: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return {};

  return {
    title: `${area.nameEn} — Restaurants, cafes and sightseeing | Placy`,
    description: `Discover ${area.nameEn} with curated guides to the best restaurants, cafes, bars and sights. Local knowledge and editorial recommendations.`,
    openGraph: {
      title: `${area.nameEn} | Placy`,
      description: `Discover the best places in ${area.nameEn}`,
      type: "website",
      url: `https://placy.no/en/${area.slugEn}`,
    },
    alternates: {
      canonical: `https://placy.no/en/${area.slugEn}`,
      languages: {
        no: `https://placy.no/${area.slugNo}`,
        en: `https://placy.no/en/${area.slugEn}`,
      },
    },
  };
}

export default async function AreaPageEN({ params }: PageProps) {
  const { area: areaSlug } = await params;
  const area = await getAreaBySlug(areaSlug);

  if (!area) notFound();

  const [categories, highlights] = await Promise.all([
    getCategoriesForArea(area.id, "en"),
    getHighlightPOIs(area.id, 8),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Placy", url: "https://placy.no/en" },
          { name: area.nameEn },
        ]}
      />
      <Breadcrumb
        items={[
          { label: "Placy", href: "/en" },
          { label: area.nameEn },
        ]}
      />

      {/* Hero */}
      <section className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3 tracking-tight">
          {area.nameEn}
        </h1>
        {area.descriptionEn && (
          <p className="text-base text-[#6a6a6a] max-w-3xl leading-relaxed">
            {area.descriptionEn}
          </p>
        )}
      </section>

      {/* Category grid */}
      <section className="mb-16">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-6">
          Categories
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const Icon = getIcon(cat.icon);
            return (
              <Link
                key={cat.id}
                href={`/en/${area.slugEn}/${cat.slug}`}
                className="group flex items-center gap-3 p-4 bg-white rounded-xl border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: cat.color + "18" }}
                >
                  <Icon className="w-5 h-5" style={{ color: cat.color }} />
                </div>
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-[#1a1a1a] group-hover:underline truncate">
                    {cat.name}
                  </span>
                  <span className="block text-xs text-[#a0937d]">
                    {cat.count} places
                    {cat.avgRating != null && (
                      <>
                        {" "}· <Star className="w-3 h-3 inline text-[#b45309] fill-[#b45309]" /> {cat.avgRating}
                      </>
                    )}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Highlights */}
      {highlights.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-6">
            Recommended places
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {highlights.map((poi) => {
              const imageUrl = poi.featuredImage
                ?? (poi.photoReference
                  ? `/api/places/photo?photoReference=${encodeURIComponent(poi.photoReference)}&maxWidth=400`
                  : null);

              return (
                <Link
                  key={poi.id}
                  href={`/en/${area.slugEn}/places/${poi.slug}`}
                  className="group block bg-white rounded-lg overflow-hidden border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
                >
                  {imageUrl ? (
                    <div className="aspect-[16/9] bg-[#f5f3f0] overflow-hidden relative">
                      <Image
                        src={imageUrl}
                        alt={poi.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div
                      className="aspect-[16/9] flex items-center justify-center"
                      style={{ backgroundColor: poi.category.color + "18" }}
                    >
                      {(() => {
                        const CatIcon = getIcon(poi.category.icon);
                        return <CatIcon className="w-8 h-8" style={{ color: poi.category.color }} />;
                      })()}
                    </div>
                  )}
                  <div className="p-3">
                    <span
                      className="inline-block text-[11px] font-medium px-2 py-0.5 rounded-full mb-1"
                      style={{
                        backgroundColor: poi.category.color + "18",
                        color: poi.category.color,
                      }}
                    >
                      {poi.category.name}
                    </span>
                    <h3 className="text-sm font-semibold text-[#1a1a1a] group-hover:underline truncate">
                      {poi.name}
                    </h3>
                    {poi.editorialHook && (
                      <p className="text-xs text-[#6a6a6a] leading-relaxed line-clamp-2 mt-1">
                        {poi.editorialHook}
                      </p>
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
