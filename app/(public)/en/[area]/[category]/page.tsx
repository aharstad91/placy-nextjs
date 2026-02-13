import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import {
  getAreaBySlug,
  getCategoryBySlug,
  getPOIsForCategory,
} from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";
import Breadcrumb from "@/components/public/Breadcrumb";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import ItemListJsonLd from "@/components/seo/ItemListJsonLd";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ area: string; category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug, category: categorySlug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return {};

  const catInfo = await getCategoryBySlug(categorySlug, "en");
  if (!catInfo) return {};

  const title = catInfo.seoTitle ?? `${categorySlug} in ${area.nameEn}`;

  return {
    title: `${title} | Placy`,
    description:
      catInfo.seoDescription ??
      `Discover the best ${categorySlug} in ${area.nameEn}. Curated recommendations with local knowledge.`,
    openGraph: {
      title: `${title} | Placy`,
      description: `The best ${categorySlug} in ${area.nameEn}`,
      type: "website",
      url: `https://placy.no/en/${areaSlug}/${categorySlug}`,
    },
    alternates: {
      canonical: `https://placy.no/en/${areaSlug}/${categorySlug}`,
      languages: {
        no: `https://placy.no/${area.slugNo}/${categorySlug}`,
        en: `https://placy.no/en/${areaSlug}/${categorySlug}`,
      },
    },
  };
}

export default async function CategoryPageEN({ params }: PageProps) {
  const { area: areaSlug, category: categorySlug } = await params;

  const area = await getAreaBySlug(areaSlug);
  if (!area) notFound();

  const catInfo = await getCategoryBySlug(categorySlug, "en");
  if (!catInfo) notFound();

  const pois = await getPOIsForCategory(area.id, catInfo.categoryId);

  const featured = pois.filter((p) => p.poiTier === 1);
  const rest = pois.filter((p) => p.poiTier !== 1);

  const categoryName = pois[0]?.category.name ?? categorySlug;
  const title = catInfo.seoTitle ?? `${categoryName} in ${area.nameEn}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Placy", url: "https://placy.no/en" },
          { name: area.nameEn, url: `https://placy.no/en/${area.slugEn}` },
          { name: categoryName },
        ]}
      />
      <ItemListJsonLd
        items={pois.slice(0, 20).map((poi, i) => ({
          name: poi.name,
          url: `https://placy.no/en/${area.slugEn}/places/${poi.slug}`,
          position: i + 1,
        }))}
      />
      <Breadcrumb
        items={[
          { label: "Placy", href: "/en" },
          { label: area.nameEn, href: `/en/${area.slugEn}` },
          { label: categoryName },
        ]}
      />

      {/* Header */}
      <section className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-2 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-[#6a6a6a]">
          {pois.length} places
          {featured.length > 0 && ` · ${featured.length} recommended`}
        </p>
        {catInfo.introText && (
          <p className="mt-4 text-base text-[#4a4a4a] leading-relaxed max-w-3xl">
            {catInfo.introText}
          </p>
        )}
      </section>

      {/* Featured highlights */}
      {featured.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4">
            Recommended
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((poi) => (
              <POICardEN key={poi.id} poi={poi} areaSlug={area.slugEn} />
            ))}
          </div>
        </section>
      )}

      {/* All places */}
      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4">
          {featured.length > 0 ? "All places" : categoryName}
        </h2>
        <div className="bg-white rounded-xl border border-[#eae6e1] divide-y divide-[#f0ece7] overflow-hidden">
          {(featured.length > 0 ? rest : pois).map((poi) => (
            <CompactPOIRowEN key={poi.id} poi={poi} areaSlug={area.slugEn} />
          ))}
        </div>
      </section>
    </div>
  );
}

function POICardEN({
  poi,
  areaSlug,
}: {
  poi: Awaited<ReturnType<typeof getPOIsForCategory>>[0];
  areaSlug: string;
}) {
  const imageUrl = poi.featuredImage
    ?? (poi.photoReference
      ? `/api/places/photo?photoReference=${encodeURIComponent(poi.photoReference)}&maxWidth=400`
      : null);
  const CategoryIcon = getIcon(poi.category.icon);

  return (
    <Link
      href={`/en/${areaSlug}/places/${poi.slug}`}
      className="group block bg-white rounded-lg overflow-hidden border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
    >
      {imageUrl ? (
        <div className="aspect-[16/9] bg-[#f5f3f0] overflow-hidden relative">
          <Image
            src={imageUrl}
            alt={poi.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="aspect-[16/9] flex items-center justify-center"
          style={{ backgroundColor: poi.category.color + "18" }}
        >
          <CategoryIcon className="w-8 h-8" style={{ color: poi.category.color }} />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-[#1a1a1a] group-hover:underline leading-snug">
            {poi.name}
          </h3>
          {poi.googleRating != null && (
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Star className="w-3.5 h-3.5 text-[#b45309] fill-[#b45309]" />
              <span className="text-xs font-semibold text-[#1a1a1a]">
                {poi.googleRating.toFixed(1)}
              </span>
            </div>
          )}
        </div>
        {poi.editorialHook && (
          <p className="text-xs text-[#6a6a6a] leading-relaxed line-clamp-2">
            {poi.editorialHook}
          </p>
        )}
      </div>
    </Link>
  );
}

function CompactPOIRowEN({
  poi,
  areaSlug,
}: {
  poi: Awaited<ReturnType<typeof getPOIsForCategory>>[0];
  areaSlug: string;
}) {
  return (
    <Link
      href={`/en/${areaSlug}/places/${poi.slug}`}
      className="group flex items-center gap-3 px-4 py-3 hover:bg-[#faf9f7] transition-colors"
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: poi.category.color }}
      />
      <span className="flex-1 text-sm font-medium text-[#1a1a1a] group-hover:underline truncate">
        {poi.name}
      </span>
      {poi.googleRating != null && (
        <span className="flex items-center gap-1 text-sm text-[#6a6a6a] flex-shrink-0">
          <Star className="w-3 h-3 text-[#b45309] fill-[#b45309]" />
          {poi.googleRating.toFixed(1)}
        </span>
      )}
      {poi.editorialHook && (
        <span className="hidden sm:block text-xs text-[#a0937d] truncate max-w-[200px] flex-shrink-0">
          {poi.editorialHook}
        </span>
      )}
    </Link>
  );
}
