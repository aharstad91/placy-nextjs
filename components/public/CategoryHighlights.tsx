import Image from "next/image";
import Link from "next/link";
import { Star, Sparkles } from "lucide-react";
import type { PublicPOI } from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";

interface CategoryHighlightsProps {
  pois: PublicPOI[];
  areaSlug: string;
  title?: string;
}

/**
 * Editorial highlights section for category pages.
 * Shows Tier 1 POIs with full editorial hook + local insight
 * in larger cards than the standard thumbnail grid.
 */
export default function CategoryHighlights({
  pois,
  areaSlug,
  title = "Redaksjonens favoritter",
}: CategoryHighlightsProps) {
  if (pois.length === 0) return null;

  return (
    <section className="mb-8 lg:px-16">
      <h2 className="text-lg font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pois.map((poi) => (
          <HighlightCard key={poi.id} poi={poi} areaSlug={areaSlug} />
        ))}
      </div>
    </section>
  );
}

function HighlightCard({
  poi,
  areaSlug,
}: {
  poi: PublicPOI;
  areaSlug: string;
}) {
  const imageUrl = poi.featuredImage
    ?? (poi.photoReference
      ? `/api/places/photo?photoReference=${encodeURIComponent(poi.photoReference)}&maxWidth=400`
      : null);
  const CategoryIcon = getIcon(poi.category.icon);

  return (
    <Link
      href={`/${areaSlug}/steder/${poi.slug}`}
      className="group block bg-white rounded-xl border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-md transition-all overflow-hidden"
    >
      {/* Image */}
      {imageUrl ? (
        <div className="aspect-[16/9] bg-[#f5f3f0] overflow-hidden relative">
          <Image
            src={imageUrl}
            alt={poi.name}
            fill
            className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, 50vw"
            loading="lazy"
          />
        </div>
      ) : (
        <div
          className="aspect-[16/9] flex items-center justify-center"
          style={{ backgroundColor: poi.category.color + "18" }}
        >
          <CategoryIcon className="w-10 h-10" style={{ color: poi.category.color }} />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="text-base font-semibold text-[#1a1a1a] group-hover:underline leading-snug">
            {poi.name}
          </h3>
          {poi.googleRating != null && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Star className="w-4 h-4 text-[#b45309] fill-[#b45309]" />
              <span className="text-sm font-semibold text-[#1a1a1a]">
                {poi.googleRating.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        {poi.editorialHook && (
          <p className="text-sm text-[#4a4a4a] leading-relaxed mb-2">
            {poi.editorialHook}
          </p>
        )}

        {poi.localInsight && (
          <p className="text-xs text-[#8a7d6b] leading-relaxed italic">
            {poi.localInsight}
          </p>
        )}
      </div>
    </Link>
  );
}
