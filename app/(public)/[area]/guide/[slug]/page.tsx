import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import { getAreaBySlug, getCuratedPOIs } from "@/lib/public-queries";
import { getCuratedListBySlug, getCuratedListsForArea } from "@/lib/curated-lists";
import { getIcon } from "@/lib/utils/map-icons";
import Breadcrumb from "@/components/public/Breadcrumb";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import ItemListJsonLd from "@/components/seo/ItemListJsonLd";
import FAQJsonLd from "@/components/seo/FAQJsonLd";
import SaveButton from "@/components/public/SaveButton";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ area: string; slug: string }>;
}

export async function generateStaticParams() {
  // Generate all guide pages for all areas
  const params: { area: string; slug: string }[] = [];
  // Import dynamically to avoid circular deps
  const { CURATED_LISTS } = await import("@/lib/curated-lists");
  for (const [areaId, lists] of Object.entries(CURATED_LISTS)) {
    for (const list of lists) {
      params.push({ area: areaId, slug: list.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug, slug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return {};

  const list = getCuratedListBySlug(area.id, slug);
  if (!list) return {};

  return {
    title: `${list.titleNo} | Placy`,
    description: list.descriptionNo,
    openGraph: {
      title: `${list.titleNo} | Placy`,
      description: list.descriptionNo,
      type: "website",
      url: `https://placy.no/${areaSlug}/guide/${slug}`,
    },
    alternates: {
      canonical: `https://placy.no/${areaSlug}/guide/${slug}`,
    },
  };
}

export default async function GuidePage({ params }: PageProps) {
  const { area: areaSlug, slug } = await params;

  const area = await getAreaBySlug(areaSlug);
  if (!area) notFound();

  const list = getCuratedListBySlug(area.id, slug);
  if (!list) notFound();

  const pois = await getCuratedPOIs(area.id, {
    categoryId: list.categoryId,
    tier: list.tierFilter,
    bbox: list.bbox,
    limit: list.limit,
  });

  // FAQ structured data
  const topRated = pois
    .filter((p) => p.googleRating != null)
    .sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0));

  const faqItems = [
    {
      question: `Hvor mange steder er med i denne guiden?`,
      answer: `Denne guiden inneholder ${pois.length} kuraterte steder i ${area.nameNo}, håndplukket av Placy-redaksjonen.`,
    },
    ...(topRated.length > 0
      ? [
          {
            question: `Hva er de best vurderte stedene?`,
            answer: `De best vurderte inkluderer ${topRated
              .slice(0, 3)
              .map((p) => `${p.name} (${p.googleRating?.toFixed(1)})`)
              .join(", ")}.`,
          },
        ]
      : []),
  ];

  // Other guides for "See also" section
  const allLists = getCuratedListsForArea(area.id);
  const otherGuides = allLists.filter((l) => l.slug !== slug);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Placy", url: "https://placy.no" },
          { name: area.nameNo, url: `https://placy.no/${area.slugNo}` },
          { name: list.titleNo },
        ]}
      />
      <ItemListJsonLd
        items={pois.slice(0, 20).map((poi, i) => ({
          name: poi.name,
          url: `https://placy.no/${area.slugNo}/steder/${poi.slug}`,
          position: i + 1,
        }))}
      />
      <FAQJsonLd items={faqItems} />

      <Breadcrumb
        items={[
          { label: "Placy", href: "/" },
          { label: area.nameNo, href: `/${area.slugNo}` },
          { label: list.titleNo },
        ]}
      />

      {/* Header */}
      <section className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-2 tracking-tight">
          {list.titleNo}
        </h1>
        <p className="text-sm text-[#6a6a6a] mb-4">
          {pois.length} steder · Kuratert av Placy
        </p>
        <p className="text-base text-[#4a4a4a] leading-relaxed max-w-3xl">
          {list.introNo}
        </p>
      </section>

      {/* POI grid */}
      <section className="mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pois.map((poi) => {
            const imageUrl =
              poi.featuredImage ??
              (poi.photoReference
                ? `/api/places/photo?photoReference=${encodeURIComponent(poi.photoReference)}&maxWidth=400`
                : null);
            const CategoryIcon = getIcon(poi.category.icon);

            return (
              <Link
                key={poi.id}
                href={`/${area.slugNo}/steder/${poi.slug}`}
                className="group block bg-white rounded-lg overflow-hidden border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
              >
                <div className="relative">
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
                      <CategoryIcon
                        className="w-8 h-8"
                        style={{ color: poi.category.color }}
                      />
                    </div>
                  )}
                  <SaveButton
                    poiId={poi.id}
                    poiName={poi.name}
                    className="absolute top-2 right-2 bg-white/70 backdrop-blur-sm"
                  />
                </div>
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
          })}
        </div>
      </section>

      {/* Other guides */}
      {otherGuides.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4">
            Flere guider
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {otherGuides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/${area.slugNo}/guide/${guide.slug}`}
                className="group flex items-center gap-3 p-4 bg-white rounded-xl border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
              >
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-[#1a1a1a] group-hover:underline">
                    {guide.titleNo}
                  </span>
                  <span className="block text-xs text-[#a0937d] line-clamp-1 mt-0.5">
                    {guide.descriptionNo}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
