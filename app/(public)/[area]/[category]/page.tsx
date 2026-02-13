import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import {
  getAreaBySlug,
  getCategoryBySlug,
  getCategoriesForArea,
  getPOIsForCategory,
} from "@/lib/public-queries";
import { getStaticMapUrlMulti } from "@/lib/mapbox-static";
import { getIcon } from "@/lib/utils/map-icons";
import Breadcrumb from "@/components/public/Breadcrumb";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import ItemListJsonLd from "@/components/seo/ItemListJsonLd";
import FAQJsonLd from "@/components/seo/FAQJsonLd";
import GuideMapLayout from "@/components/guide/GuideMapLayout";
import CategoryHighlights from "@/components/public/CategoryHighlights";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ area: string; category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug, category: categorySlug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return {};

  const catInfo = await getCategoryBySlug(categorySlug, "no");
  if (!catInfo) return {};

  const pois = await getPOIsForCategory(area.id, catInfo.categoryId);
  const title = catInfo.seoTitle ?? `${categorySlug} i ${area.nameNo}`;

  // Generate OG image from POI markers on a static map
  const markers = pois
    .filter((p) => p.coordinates?.lat && p.coordinates?.lng)
    .slice(0, 50)
    .map((p) => ({ lat: p.coordinates.lat, lng: p.coordinates.lng }));
  const ogImage = getStaticMapUrlMulti({
    markers,
    width: 1200,
    height: 630,
    retina: false,
  });

  return {
    title: `${title} | Placy`,
    description:
      catInfo.seoDescription ??
      `Oppdag de beste ${categorySlug} i ${area.nameNo}. Kuraterte anbefalinger med lokalkunnskap.`,
    robots: { index: true, follow: true },
    openGraph: {
      title: `${title} | Placy`,
      description: `De beste ${categorySlug} i ${area.nameNo}`,
      type: "website",
      url: `https://placy.no/${areaSlug}/${categorySlug}`,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    alternates: {
      canonical: `https://placy.no/${areaSlug}/${categorySlug}`,
      languages: {
        no: `https://placy.no/${areaSlug}/${categorySlug}`,
        en: `https://placy.no/en/${area.slugEn}/${categorySlug}`,
      },
    },
  };
}

export default async function CategoryPage({ params }: PageProps) {
  const { area: areaSlug, category: categorySlug } = await params;

  const area = await getAreaBySlug(areaSlug);
  if (!area) notFound();

  const catInfo = await getCategoryBySlug(categorySlug, "no");
  if (!catInfo) notFound();

  const [pois, allCategories] = await Promise.all([
    getPOIsForCategory(area.id, catInfo.categoryId),
    getCategoriesForArea(area.id, "no"),
  ]);

  const featured = pois.filter((p) => p.poiTier === 1);
  const categoryName = pois[0]?.category.name ?? categorySlug;
  const title = catInfo.seoTitle ?? `${categoryName} i ${area.nameNo}`;

  // Cross-category links — exclude current, limit to 8
  const otherCategories = allCategories
    .filter((c) => c.slug !== categorySlug && c.count > 0)
    .slice(0, 8);

  // Static map image for desktop placeholder (zero JS until interaction)
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

  // Featured POIs with editorial content for highlights section
  const editorialFeatured = featured.filter((p) => p.editorialHook);

  // FAQ structured data for SEO — use categorySlug (plural) for grammatically correct Norwegian
  const topRated = pois.filter((p) => p.googleRating != null).sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0));
  const withEditorial = pois.filter((p) => p.editorialHook);
  const faqItems = [
    {
      question: `Hvor mange ${categorySlug} er det i ${area.nameNo}?`,
      answer: `Det er ${pois.length} ${categorySlug} registrert i ${area.nameNo} på Placy${featured.length > 0 ? `, hvorav ${featured.length} er spesielt anbefalt` : ""}.`,
    },
    ...(topRated.length > 0
      ? [{
          question: `Hva er de best vurderte ${categorySlug} i ${area.nameNo}?`,
          answer: `De best vurderte inkluderer ${topRated.slice(0, 3).map((p) => `${p.name} (${p.googleRating?.toFixed(1)}★)`).join(", ")}.`,
        }]
      : []),
    ...(withEditorial.length > 3
      ? [{
          question: `Hvilke ${categorySlug} i ${area.nameNo} anbefaler Placy?`,
          answer: `Placy anbefaler spesielt ${editorialFeatured.slice(0, 4).map((p) => p.name).join(", ")}${editorialFeatured.length > 4 ? ` og ${editorialFeatured.length - 4} til` : ""}. Disse er håndplukket basert på lokalkunnskap og kvalitet.`,
        }]
      : []),
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-0 py-8 lg:py-0 max-w-[1920px] mx-auto">
      <BreadcrumbJsonLd
        items={[
          { name: "Placy", url: "https://placy.no" },
          { name: area.nameNo, url: `https://placy.no/${area.slugNo}` },
          { name: categoryName },
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
          { label: categoryName },
        ]}
      />

      {/* Header */}
      <section className="mb-6 lg:px-16 lg:pt-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-2 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-[#6a6a6a]">
          {pois.length} steder
          {featured.length > 0 && ` · ${featured.length} anbefalte`}
        </p>
        {catInfo.introText && (
          <div className="mt-4 space-y-3 max-w-3xl">
            {catInfo.introText.split("\n\n").map((paragraph, i) => (
              <p key={i} className="text-base text-[#4a4a4a] leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Editorial highlights — Tier 1 with editorial content */}
      {editorialFeatured.length > 0 && (
        <CategoryHighlights
          pois={editorialFeatured}
          areaSlug={area.slugNo}
        />
      )}

      {/* Map + card layout */}
      <GuideMapLayout pois={pois} areaSlug={area.slugNo} interactive staticMapUrl={staticMapUrl} />

      {/* Cross-category links */}
      {otherCategories.length > 0 && (
        <section className="mt-12 mb-8 lg:px-16">
          <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4">
            Utforsk mer i {area.nameNo}
          </h2>
          <div className="flex flex-wrap gap-2">
            {otherCategories.map((cat) => {
              const Icon = getIcon(cat.icon);
              return (
                <Link
                  key={cat.id}
                  href={`/${areaSlug}/${cat.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[#eae6e1] bg-white px-4 py-2 text-sm text-[#4a4a4a] hover:border-[#d4cfc8] hover:bg-[#faf9f7] transition-all"
                >
                  <Icon className="w-4 h-4" style={{ color: cat.color }} />
                  <span>{cat.seoTitle ?? cat.name}</span>
                  <span className="text-xs text-[#a0937d]">({cat.count})</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
