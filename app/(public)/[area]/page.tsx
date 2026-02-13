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
import SaveButton from "@/components/public/SaveButton";

export const revalidate = 86400;

interface PageProps {
  params: Promise<{ area: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { area: areaSlug } = await params;
  const area = await getAreaBySlug(areaSlug);
  if (!area) return {};

  return {
    title: `${area.nameNo} — Restauranter, kafeer og severdigheter | Placy`,
    description: `Oppdag ${area.nameNo} med kuraterte guider til de beste restaurantene, kafeene, barene og severdighetene. Lokalkunnskap og redaksjonelle anbefalinger.`,
    openGraph: {
      title: `${area.nameNo} | Placy`,
      description: `Oppdag de beste stedene i ${area.nameNo}`,
      type: "website",
      url: `https://placy.no/${area.slugNo}`,
    },
    alternates: {
      canonical: `https://placy.no/${area.slugNo}`,
      languages: {
        no: `https://placy.no/${area.slugNo}`,
        en: `https://placy.no/en/${area.slugEn}`,
      },
    },
  };
}

export default async function AreaPage({ params }: PageProps) {
  const { area: areaSlug } = await params;
  const area = await getAreaBySlug(areaSlug);

  if (!area) notFound();

  const [categories, highlights] = await Promise.all([
    getCategoriesForArea(area.id, "no"),
    getHighlightPOIs(area.id, 8),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Placy", url: "https://placy.no" },
          { name: area.nameNo },
        ]}
      />
      <Breadcrumb
        items={[
          { label: "Placy", href: "/" },
          { label: area.nameNo },
        ]}
      />

      {/* Hero */}
      <section className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3 tracking-tight">
          {area.nameNo}
        </h1>
        {area.descriptionNo && (
          <p className="text-base text-[#6a6a6a] max-w-3xl leading-relaxed">
            {area.descriptionNo}
          </p>
        )}
      </section>

      {/* Category grid */}
      <section className="mb-16">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-6">
          Kategorier
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {categories.map((cat) => {
            const Icon = getIcon(cat.icon);
            return (
              <Link
                key={cat.id}
                href={`/${area.slugNo}/${cat.slug}`}
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
                    {cat.count} steder
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
            Anbefalte steder
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
