import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { Star } from "lucide-react";
import {
  getAreaBySlug,
  getCategoriesForArea,
  getHighlightPOIs,
  getCuratedPOIs,
} from "@/lib/public-queries";
import { getCuratedListsForArea } from "@/lib/curated-lists";
import { getIcon } from "@/lib/utils/map-icons";
import { getStaticMapUrlMulti } from "@/lib/mapbox-static";
import Breadcrumb from "@/components/public/Breadcrumb";
import BreadcrumbJsonLd from "@/components/seo/BreadcrumbJsonLd";
import SaveButton from "@/components/public/SaveButton";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Opplev Trondheim — Guider, restauranter og severdigheter | Placy",
  description:
    "Utforsk Trondheim med kuraterte guider til de beste restaurantene, kafeene, barene, severdighetene og familieaktivitetene. Lokalkunnskap fra Placy-redaksjonen.",
  openGraph: {
    title: "Opplev Trondheim | Placy",
    description:
      "Kuraterte guider og redaksjonelle anbefalinger for Trondheim — restauranter, severdigheter, uteliv og mer.",
    type: "website",
    url: "https://placy.no/visit-trondheim",
  },
  alternates: {
    canonical: "https://placy.no/visit-trondheim",
    languages: {
      no: "https://placy.no/visit-trondheim",
      en: "https://placy.no/en/visit-trondheim",
    },
  },
};

/** Tourist-relevant category subset */
const TOURIST_CATEGORIES = [
  "restaurant",
  "cafe",
  "bar",
  "museum",
  "sightseeing",
  "park",
  "badeplass",
  "hotel",
];

export default async function VisitTrondheimPage() {
  const area = await getAreaBySlug("trondheim");
  if (!area) return null;

  const [categories, highlights, tier1POIs] = await Promise.all([
    getCategoriesForArea(area.id, "no"),
    getHighlightPOIs(area.id, 8),
    getCuratedPOIs(area.id, { tier: 1, limit: 80 }),
  ]);

  const guides = getCuratedListsForArea(area.id);

  // Tourist-relevant categories only
  const touristCategories = categories.filter((c) =>
    TOURIST_CATEGORIES.includes(c.id)
  );

  // Static map with Tier 1 markers
  const staticMarkers = tier1POIs
    .filter((p) => p.coordinates?.lat && p.coordinates?.lng)
    .map((p) => ({
      lat: p.coordinates.lat,
      lng: p.coordinates.lng,
      color: p.category.color?.replace("#", ""),
    }));
  const staticMapUrl = getStaticMapUrlMulti({
    markers: staticMarkers,
    width: 1200,
    height: 500,
    retina: true,
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <BreadcrumbJsonLd
        items={[
          { name: "Placy", url: "https://placy.no" },
          { name: "Opplev Trondheim" },
        ]}
      />
      <Breadcrumb
        items={[
          { label: "Placy", href: "/" },
          { label: "Opplev Trondheim" },
        ]}
      />

      {/* Hero */}
      <section className="mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-3 tracking-tight">
          Opplev Trondheim
        </h1>
        <p className="text-base text-[#6a6a6a] max-w-3xl leading-relaxed mb-6">
          Trondheim er en av Norges mest sjarmerende byer — med tusenårig historie,
          et av landets beste matscener, og en kompakt bykjerne full av opplevelser.
          Placy har kartlagt over 1800 steder og kuratert de beste guidene for å hjelpe
          deg oppleve byen som en lokal.
        </p>

        {/* Static map */}
        {staticMapUrl && (
          <div className="rounded-xl overflow-hidden border border-[#eae6e1]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={staticMapUrl}
              alt="Kart over Trondheims beste steder"
              className="w-full h-auto"
              loading="eager"
            />
          </div>
        )}
      </section>

      {/* Thematic guides */}
      <section className="mb-16">
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-6">
          Tematiske guider
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {guides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/${area.slugNo}/guide/${guide.slug}`}
              className="group block p-4 bg-white rounded-xl border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-sm transition-all"
            >
              <h3 className="text-sm font-semibold text-[#1a1a1a] group-hover:underline mb-1">
                {guide.titleNo}
              </h3>
              <p className="text-xs text-[#6a6a6a] line-clamp-2 leading-relaxed">
                {guide.descriptionNo}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* Tourist categories */}
      {touristCategories.length > 0 && (
        <section className="mb-16">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-6">
            Utforsk kategorier
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {touristCategories.map((cat) => {
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
                          {" "}&middot; <Star className="w-3 h-3 inline text-[#b45309] fill-[#b45309]" /> {cat.avgRating}
                        </>
                      )}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <section className="mb-16">
          <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-6">
            Redaksjonens favoritter
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

      {/* CTA for Visit Trondheim */}
      <section className="bg-[#faf9f7] rounded-2xl border border-[#eae6e1] p-8 text-center">
        <h2 className="text-xl font-bold text-[#1a1a1a] mb-2">
          For Visit Trondheim
        </h2>
        <p className="text-sm text-[#6a6a6a] max-w-xl mx-auto leading-relaxed mb-4">
          Placy tilbyr kuraterte stedguider med redaksjonelt innhold, kartopplevelse
          og lokal kunnskap. Vi samarbeider gjerne om å gjøre Trondheim enda mer
          tilgjengelig for besøkende.
        </p>
        <a
          href="mailto:hei@placy.no"
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#1a1a1a] text-white text-sm font-medium rounded-full hover:bg-[#333] transition-colors"
        >
          Ta kontakt
        </a>
      </section>
    </div>
  );
}
