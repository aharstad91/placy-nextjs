import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getAreaBySlug,
  getCategoryBySlug,
  getPOIsForCategory,
} from "@/lib/public-queries";
import Breadcrumb from "@/components/public/Breadcrumb";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import ItemListJsonLd from "@/components/seo/ItemListJsonLd";
import FAQJsonLd from "@/components/seo/FAQJsonLd";
import GuideMapLayout from "@/components/guide/GuideMapLayout";

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

  const title = catInfo.seoTitle ?? `${categorySlug} i ${area.nameNo}`;

  return {
    title: `${title} | Placy`,
    description:
      catInfo.seoDescription ??
      `Oppdag de beste ${categorySlug} i ${area.nameNo}. Kuraterte anbefalinger med lokalkunnskap.`,
    openGraph: {
      title: `${title} | Placy`,
      description: `De beste ${categorySlug} i ${area.nameNo}`,
      type: "website",
      url: `https://placy.no/${areaSlug}/${categorySlug}`,
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

  const pois = await getPOIsForCategory(area.id, catInfo.categoryId);

  const featured = pois.filter((p) => p.poiTier === 1);
  const categoryName = pois[0]?.category.name ?? categorySlug;
  const title = catInfo.seoTitle ?? `${categoryName} i ${area.nameNo}`;

  // FAQ structured data for SEO
  const topRated = pois.filter((p) => p.googleRating != null).sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0));
  const faqItems = [
    {
      question: `Hvor mange ${categoryName.toLowerCase()} er det i ${area.nameNo}?`,
      answer: `Det er ${pois.length} ${categoryName.toLowerCase()} registrert i ${area.nameNo} på Placy${featured.length > 0 ? `, hvorav ${featured.length} er spesielt anbefalt` : ""}.`,
    },
    ...(topRated.length > 0
      ? [{
          question: `Hva er de best vurderte ${categoryName.toLowerCase()} i ${area.nameNo}?`,
          answer: `De best vurderte inkluderer ${topRated.slice(0, 3).map((p) => `${p.name} (${p.googleRating?.toFixed(1)})`).join(", ")}.`,
        }]
      : []),
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
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
      <section className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-2 tracking-tight">
          {title}
        </h1>
        <p className="text-sm text-[#6a6a6a]">
          {pois.length} steder
          {featured.length > 0 && ` · ${featured.length} anbefalte`}
        </p>
        {catInfo.introText && (
          <p className="mt-4 text-base text-[#4a4a4a] leading-relaxed max-w-3xl">
            {catInfo.introText}
          </p>
        )}
      </section>

      {/* Map + card layout */}
      <GuideMapLayout pois={pois} areaSlug={area.slugNo} interactive />
    </div>
  );
}
