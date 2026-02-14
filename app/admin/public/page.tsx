import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  ExternalLink,
  Check,
  X as XIcon,
  Map as MapIcon,
  BookOpen,
  FileText,
} from "lucide-react";
import { createPublicClient } from "@/lib/supabase/public-client";
import { CURATED_LISTS } from "@/lib/curated-lists";
import { MIN_TRUST_SCORE } from "@/lib/utils/poi-trust";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

// Known landing pages (hardcoded routes in app/(public)/)
const LANDING_PAGES = [
  { name: "Hovedside", path: "/", pathEn: "/en" },
  { name: "Visit Trondheim", path: "/visit-trondheim", pathEn: "/en/visit-trondheim" },
];

interface AreaStats {
  id: string;
  nameNo: string;
  nameEn: string;
  slugNo: string;
  slugEn: string;
  active: boolean;
  categories: CategoryStats[];
  guides: GuideStats[];
  totalPOIs: number;
  editorialCount: number;
  tier1Count: number;
}

interface CategoryStats {
  id: string;
  name: string;
  slug: string;
  seoTitle: string | null;
  introText: boolean;
  poiCount: number;
}

interface GuideStats {
  slug: string;
  titleNo: string;
  description: string;
  filterInfo: string;
}

export default async function AdminPublicPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  const supabase = createPublicClient();

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
          <Globe className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900">Supabase ikke konfigurert</h1>
        </div>
      </div>
    );
  }

  // Fetch all data in parallel
  const [areasResult, poisResult, slugsResult, categoriesResult] = await Promise.all([
    supabase.from("areas").select("*").eq("active", true).order("name_no"),
    supabase
      .from("pois")
      .select("area_id, category_id, editorial_hook, poi_tier")
      .not("area_id", "is", null)
      .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`),
    supabase.from("category_slugs").select("category_id, slug, seo_title, intro_text, locale").eq("locale", "no"),
    supabase.from("categories").select("id, name"),
  ]);

  const areas = areasResult.data ?? [];
  const pois = poisResult.data ?? [];
  const slugs = slugsResult.data ?? [];
  const categories = categoriesResult.data ?? [];

  // Build lookup maps
  const categoryNameMap = new Map<string, string>();
  for (const c of categories) {
    categoryNameMap.set(c.id, c.name);
  }

  const slugMap = new Map<string, { slug: string; seoTitle: string | null; hasIntro: boolean }>();
  for (const s of slugs) {
    slugMap.set(s.category_id, {
      slug: s.slug,
      seoTitle: s.seo_title,
      hasIntro: !!s.intro_text,
    });
  }

  // Aggregate POI stats per area + category
  const poisByArea = new Map<string, Map<string, { count: number; editorial: number; tier1: number }>>();
  for (const poi of pois) {
    if (!poi.area_id || !poi.category_id) continue;
    if (!poisByArea.has(poi.area_id)) poisByArea.set(poi.area_id, new Map());
    const areaMap = poisByArea.get(poi.area_id)!;
    if (!areaMap.has(poi.category_id)) areaMap.set(poi.category_id, { count: 0, editorial: 0, tier1: 0 });
    const stats = areaMap.get(poi.category_id)!;
    stats.count++;
    if (poi.editorial_hook) stats.editorial++;
    if (poi.poi_tier === 1) stats.tier1++;
  }

  // Build area stats
  const areaStats: AreaStats[] = areas.map((area: { id: string; name_no: string; name_en: string; slug_no: string; slug_en: string; active: boolean }) => {
    const areaPOIs = poisByArea.get(area.id) ?? new Map();

    // Category stats
    const catStats: CategoryStats[] = [];
    for (const [catId, stats] of Array.from(areaPOIs.entries())) {
      const slugInfo = slugMap.get(catId);
      if (!slugInfo) continue; // No slug = not a public category page
      catStats.push({
        id: catId,
        name: categoryNameMap.get(catId) ?? catId,
        slug: slugInfo.slug,
        seoTitle: slugInfo.seoTitle,
        introText: slugInfo.hasIntro,
        poiCount: stats.count,
      });
    }
    catStats.sort((a, b) => b.poiCount - a.poiCount);

    // Guide stats
    const guides = (CURATED_LISTS[area.id] ?? []).map((g) => {
      const filters: string[] = [];
      if (g.tierFilter) filters.push("Tier 1");
      if (g.categoryId) filters.push(`Kategori: ${g.categoryId}`);
      if (g.categoryIds?.length) filters.push(`${g.categoryIds.length} kategorier`);
      if (g.bbox) filters.push("Bbox");
      if (g.limit) filters.push(`Maks ${g.limit}`);
      return {
        slug: g.slug,
        titleNo: g.titleNo,
        description: g.descriptionNo,
        filterInfo: filters.join(" · ") || "Alle",
      };
    });

    // Totals
    let totalPOIs = 0;
    let editorialCount = 0;
    let tier1Count = 0;
    for (const stats of Array.from(areaPOIs.values())) {
      totalPOIs += stats.count;
      editorialCount += stats.editorial;
      tier1Count += stats.tier1;
    }

    return {
      id: area.id,
      nameNo: area.name_no,
      nameEn: area.name_en,
      slugNo: area.slug_no,
      slugEn: area.slug_en,
      active: area.active,
      categories: catStats,
      guides,
      totalPOIs,
      editorialCount,
      tier1Count,
    };
  });

  // Grand totals
  const totalAreas = areaStats.length;
  const totalCategories = areaStats.reduce((sum, a) => sum + a.categories.length, 0);
  const totalGuides = areaStats.reduce((sum, a) => sum + a.guides.length, 0);
  const totalPOIs = areaStats.reduce((sum, a) => sum + a.totalPOIs, 0);
  const totalEditorial = areaStats.reduce((sum, a) => sum + a.editorialCount, 0);
  const editorialPct = totalPOIs > 0 ? Math.round((totalEditorial / totalPOIs) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Offentlige sider</h1>
          <p className="text-sm text-gray-500">
            {totalCategories} kategorisider · {totalGuides} guider · {totalPOIs} POIs · {editorialPct}% editorial
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <SummaryCard icon={<Globe className="w-4 h-4" />} label="Områder" value={totalAreas} />
          <SummaryCard icon={<FileText className="w-4 h-4" />} label="Kategorisider" value={totalCategories} />
          <SummaryCard icon={<BookOpen className="w-4 h-4" />} label="Guider" value={totalGuides} />
          <SummaryCard icon={<MapIcon className="w-4 h-4" />} label="Landingssider" value={LANDING_PAGES.length} />
        </div>

        {/* Per area */}
        {areaStats.map((area) => (
          <div key={area.id} className="mb-10">
            {/* Area header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{area.nameNo}</h2>
                <p className="text-xs text-gray-500">
                  <code className="bg-gray-100 px-1 rounded">{area.slugNo}</code>
                  {" / "}
                  <code className="bg-gray-100 px-1 rounded">{area.slugEn}</code>
                  {" · "}
                  {area.totalPOIs} POIs · {area.editorialCount} editorial ({area.totalPOIs > 0 ? Math.round((area.editorialCount / area.totalPOIs) * 100) : 0}%)
                  {" · "}
                  {area.tier1Count} Tier 1
                </p>
              </div>
              <Link
                href={`/${area.slugNo}`}
                target="_blank"
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Åpne live-side"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>

            {/* Categories */}
            <section className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Kategorisider ({area.categories.length})
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {area.categories.map((cat) => (
                  <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {cat.name}
                      </span>
                      <code className="text-xs text-gray-400 bg-gray-50 px-1.5 rounded hidden sm:inline">
                        /{area.slugNo}/{cat.slug}
                      </code>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className="text-xs text-gray-500 tabular-nums">{cat.poiCount} POIs</span>
                      <StatusBadge ok={!!cat.seoTitle} label="SEO" />
                      <StatusBadge ok={cat.introText} label="Intro" />
                      <Link
                        href={`/${area.slugNo}/${cat.slug}`}
                        target="_blank"
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
                {area.categories.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    Ingen kategorisider
                  </div>
                )}
              </div>
            </section>

            {/* Guides */}
            <section className="mb-6">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Kuraterte guider ({area.guides.length})
              </h3>
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {area.guides.map((guide) => (
                  <div key={guide.slug} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">
                        {guide.titleNo}
                      </span>
                      <span className="text-xs text-gray-400">{guide.filterInfo}</span>
                    </div>
                    <Link
                      href={`/${area.slugNo}/guide/${guide.slug}`}
                      target="_blank"
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
                {area.guides.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">
                    Ingen guider
                  </div>
                )}
              </div>
            </section>
          </div>
        ))}

        {/* Landing pages (global, not per area) */}
        <section className="mb-10">
          <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Landingssider ({LANDING_PAGES.length})
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {LANDING_PAGES.map((page) => (
              <div key={page.path} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900">{page.name}</span>
                  <code className="text-xs text-gray-400 bg-gray-50 px-1.5 rounded">
                    {page.path}
                  </code>
                  <span className="text-xs text-gray-400">+ EN</span>
                </div>
                <Link
                  href={page.path}
                  target="_blank"
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Editorial coverage breakdown */}
        {areaStats.length > 0 && (
          <section>
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Editorial dekning
            </h3>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-2xl font-semibold text-gray-900">{totalPOIs}</p>
                  <p className="text-xs text-gray-500">Offentlige POIs</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {totalEditorial}
                    <span className="text-sm font-normal text-gray-400 ml-1">({editorialPct}%)</span>
                  </p>
                  <p className="text-xs text-gray-500">Med editorial hook</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-gray-900">
                    {areaStats.reduce((sum, a) => sum + a.tier1Count, 0)}
                  </p>
                  <p className="text-xs text-gray-500">Tier 1 POIs</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-1">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded ${
        ok ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-400"
      }`}
    >
      {ok ? <Check className="w-3 h-3" /> : <XIcon className="w-3 h-3" />}
      {label}
    </span>
  );
}
