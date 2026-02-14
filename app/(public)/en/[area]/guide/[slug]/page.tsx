import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAreaBySlug, getCuratedPOIs } from "@/lib/public-queries";
import { getCuratedListBySlugEn, getCuratedListsForArea } from "@/lib/curated-lists";
import Breadcrumb from "@/components/public/Breadcrumb";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import ItemListJsonLd from "@/components/seo/ItemListJsonLd";
import FAQJsonLd from "@/components/seo/FAQJsonLd";
import { getStaticMapUrlMulti } from "@/lib/mapbox-static";
import GuideMapLayout from "@/components/guide/GuideMapLayout";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ area: string; slug: string }>;
}

export async function generateStaticParams() {
  const params: { area: string; slug: string }[] = [];
  const { CURATED_LISTS } = await import("@/lib/curated-lists");
  for (const [, lists] of Object.entries(CURATED_LISTS)) {
    for (const list of lists) {
      // English routes use slugEn (falling back to slug)
      params.push({ area: "trondheim", slug: list.slugEn ?? list.slug });
    }
  }
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug, slug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return {};

  const list = getCuratedListBySlugEn(area.id, slug);
  if (!list) return {};

  return {
    title: `${list.titleEn} | Placy`,
    description: list.descriptionEn,
    openGraph: {
      title: `${list.titleEn} | Placy`,
      description: list.descriptionEn,
      type: "website",
      url: `https://placy.no/en/${areaSlug}/guide/${slug}`,
    },
    alternates: {
      canonical: `https://placy.no/en/${areaSlug}/guide/${slug}`,
      languages: {
        no: `https://placy.no/${area.slugNo}/guide/${list.slug}`,
        en: `https://placy.no/en/${areaSlug}/guide/${slug}`,
      },
    },
  };
}

export default async function GuidePageEN({ params }: PageProps) {
  const { area: areaSlug, slug } = await params;

  const area = await getAreaBySlug(areaSlug);
  if (!area) notFound();

  const list = getCuratedListBySlugEn(area.id, slug);
  if (!list) notFound();

  const pois = await getCuratedPOIs(area.id, {
    categoryId: list.categoryId,
    categoryIds: list.categoryIds,
    tier: list.tierFilter,
    bbox: list.bbox,
    limit: list.limit,
  });

  const staticMarkers = pois
    .filter((p) => p.coordinates?.lat && p.coordinates?.lng)
    .slice(0, 80)
    .map((p) => ({
      lat: p.coordinates.lat,
      lng: p.coordinates.lng,
      color: p.category.color?.replace("#", ""),
    }));
  const staticMapUrl = getStaticMapUrlMulti({
    markers: staticMarkers,
    width: 800,
    height: 600,
    retina: true,
  });

  const topRated = pois
    .filter((p) => p.googleRating != null)
    .sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0));

  const faqItems = [
    {
      question: `How many places are included in this guide?`,
      answer: `This guide contains ${pois.length} curated places in ${area.nameEn}, handpicked by the Placy editorial team.`,
    },
    ...(topRated.length > 0
      ? [
          {
            question: `What are the highest rated places?`,
            answer: `The highest rated include ${topRated
              .slice(0, 3)
              .map((p) => `${p.name} (${p.googleRating?.toFixed(1)})`)
              .join(", ")}.`,
          },
        ]
      : []),
  ];

  const allLists = getCuratedListsForArea(area.id);
  const otherGuides = allLists.filter((l) => (l.slugEn ?? l.slug) !== slug);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Placy", url: "https://placy.no/en" },
          { name: area.nameEn, url: `https://placy.no/en/${area.slugEn}` },
          { name: list.titleEn },
        ]}
      />
      <ItemListJsonLd
        items={pois.slice(0, 20).map((poi, i) => ({
          name: poi.name,
          url: `https://placy.no/en/${area.slugEn}/places/${poi.slug}`,
          position: i + 1,
        }))}
      />
      <FAQJsonLd items={faqItems} />

      <Breadcrumb
        items={[
          { label: "Placy", href: "/en" },
          { label: area.nameEn, href: `/en/${area.slugEn}` },
          { label: list.titleEn },
        ]}
      />

      {/* Header */}
      <section className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-2 tracking-tight">
          {list.titleEn}
        </h1>
        <p className="text-sm text-[#6a6a6a] mb-4">
          {pois.length} places · Curated by Placy
        </p>
        <p className="text-base text-[#4a4a4a] leading-relaxed max-w-3xl">
          {list.introEn}
        </p>
      </section>

      {/* POI cards + sticky map */}
      <section className="mb-12">
        <GuideMapLayout
          pois={pois}
          areaSlug={area.slugEn}
          staticMapUrl={staticMapUrl}
          locale="en"
        />
      </section>

      {/* Other guides */}
      {otherGuides.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-4">
            More guides
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {otherGuides.map((guide) => (
              <Link
                key={guide.slug}
                href={`/en/${area.slugEn}/guide/${guide.slugEn ?? guide.slug}`}
                className="group flex items-center gap-3 p-4 bg-white rounded-xl border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
              >
                <div className="min-w-0">
                  <span className="block text-sm font-medium text-[#1a1a1a] group-hover:underline">
                    {guide.titleEn}
                  </span>
                  <span className="block text-xs text-[#a0937d] line-clamp-1 mt-0.5">
                    {guide.descriptionEn}
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
