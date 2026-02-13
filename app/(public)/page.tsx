import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, ArrowRight } from "lucide-react";
import { getAreas, getCategoriesForArea, getHighlightPOIs } from "@/lib/public-queries";
import { getIcon } from "@/lib/utils/map-icons";

export const revalidate = 86400; // 24 hours

export const metadata: Metadata = {
  title: "Placy — Oppdag de beste stedene i norske byer",
  description:
    "Kuraterte guider til restauranter, kafeer, barer og severdigheter i Trondheim. Finn de beste stedene med lokalkunnskap og redaksjonelle anbefalinger.",
  openGraph: {
    title: "Placy — Oppdag de beste stedene i norske byer",
    description:
      "Kuraterte guider til restauranter, kafeer, barer og severdigheter i Trondheim.",
    type: "website",
    url: "https://placy.no",
  },
};

export default async function HomePage() {
  const areas = await getAreas();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Hero */}
      <section className="text-center mb-16">
        <h1 className="text-4xl sm:text-5xl font-bold text-[#1a1a1a] mb-4 tracking-tight">
          Oppdag de beste stedene
        </h1>
        <p className="text-lg text-[#6a6a6a] max-w-2xl mx-auto leading-relaxed">
          Kuraterte guider til restauranter, kafeer, barer og severdigheter
          — laget med lokalkunnskap.
        </p>
      </section>

      {/* City cards */}
      <section>
        <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-6">
          Byer
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {areas.map((area) => (
            <CityCard key={area.id} area={area} />
          ))}
        </div>
      </section>
    </div>
  );
}

async function CityCard({ area }: { area: Awaited<ReturnType<typeof getAreas>>[0] }) {
  const categories = await getCategoriesForArea(area.id, "no");
  const totalPOIs = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <Link
      href={`/${area.slugNo}`}
      className="group block bg-white rounded-xl border border-[#eae6e1] hover:border-[#d4cfc8] hover:shadow-md transition-all overflow-hidden"
    >
      {/* City image placeholder */}
      <div className="aspect-[16/9] bg-gradient-to-br from-[#f0ece7] to-[#e8e4df] flex items-center justify-center">
        <MapPin className="w-12 h-12 text-[#c0b9ad]" />
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-[#1a1a1a] group-hover:underline">
            {area.nameNo}
          </h3>
          <ArrowRight className="w-4 h-4 text-[#a0937d] group-hover:text-[#1a1a1a] transition-colors" />
        </div>

        <p className="text-sm text-[#6a6a6a] mb-3">
          {totalPOIs} steder i {categories.length} kategorier
        </p>

        {/* Top categories */}
        <div className="flex flex-wrap gap-1.5">
          {categories.slice(0, 4).map((cat) => {
            const Icon = getIcon(cat.icon);
            return (
              <span
                key={cat.id}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: cat.color + "18",
                  color: cat.color,
                }}
              >
                <Icon className="w-3 h-3" />
                {cat.name}
              </span>
            );
          })}
        </div>
      </div>
    </Link>
  );
}
