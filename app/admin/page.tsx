import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase/client";
import { createPublicClient } from "@/lib/supabase/public-client";
import { CURATED_LISTS } from "@/lib/curated-lists";
import { MIN_TRUST_SCORE } from "@/lib/utils/poi-trust";
import {
  MapPin,
  Users,
  FolderOpen,
  Globe,
  Tag,
  Sparkles,
  ChevronRight,
  Database,
} from "lucide-react";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

interface StatCardProps {
  icon: React.ReactNode;
  title: string;
  count: number | null;
  description: string;
  href?: string;
  disabled?: boolean;
}

function StatCard({ icon, title, count, description, href, disabled }: StatCardProps) {
  const content = (
    <div
      className={`
        flex items-center justify-between p-4 bg-white border rounded-lg
        ${disabled ? "opacity-50" : "hover:border-gray-400 hover:shadow-sm"}
        transition-all
      `}
    >
      <div className="flex items-center gap-4">
        <div className="p-2 bg-gray-100 rounded-lg text-gray-600">{icon}</div>
        <div>
          <h3 className="font-medium text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {count !== null && (
          <span className="text-2xl font-semibold text-gray-900">{count}</span>
        )}
        {href && !disabled && <ChevronRight className="w-5 h-5 text-gray-400" />}
      </div>
    </div>
  );

  if (href && !disabled) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}

export default async function AdminPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  const supabase = createServerClient();

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <Database className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-center text-gray-900">
            Supabase ikke konfigurert
          </h1>
          <p className="mt-2 text-center text-gray-600">
            Sett NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY i .env
          </p>
        </div>
      </div>
    );
  }

  // Fetch counts in parallel
  const [customersResult, projectsResult, poisResult, categoriesResult] =
    await Promise.all([
      supabase.from("customers").select("*", { count: "exact", head: true }),
      supabase.from("projects").select("*", { count: "exact", head: true }),
      supabase.from("pois").select("*", { count: "exact", head: true }),
      supabase.from("categories").select("*", { count: "exact", head: true }),
    ]);

  const stats = {
    customers: customersResult.count ?? 0,
    projects: projectsResult.count ?? 0,
    pois: poisResult.count ?? 0,
    categories: categoriesResult.count ?? 0,
  };

  // Public pages stats (uses untyped client for areas/category_slugs)
  const publicClient = createPublicClient();
  let publicStats = { areas: 0, categoryPages: 0, guides: 0, publicPOIs: 0, editorialPct: 0 };

  if (publicClient) {
    const [areasRes, slugsRes] = await Promise.all([
      publicClient.from("areas").select("id", { count: "exact", head: true }).eq("active", true),
      publicClient.from("category_slugs").select("category_id", { count: "exact", head: true }).eq("locale", "no"),
    ]);

    // Fetch public POIs with pagination for editorial stats
    const PAGE_SIZE = 1000;
    const publicPois: { editorial_hook: string | null }[] = [];
    let page = 0;
    while (true) {
      const { data, error } = await publicClient
        .from("pois")
        .select("editorial_hook")
        .not("area_id", "is", null)
        .or(`trust_score.is.null,trust_score.gte.${MIN_TRUST_SCORE}`)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error || !data || data.length === 0) break;
      publicPois.push(...data);
      if (data.length < PAGE_SIZE) break;
      page++;
    }

    const editorialCount = publicPois.filter((p: { editorial_hook: string | null }) => p.editorial_hook).length;
    const totalGuides = Object.values(CURATED_LISTS).reduce((sum, lists) => sum + lists.length, 0);

    publicStats = {
      areas: areasRes.count ?? 0,
      categoryPages: slugsRes.count ?? 0,
      guides: totalGuides,
      publicPOIs: publicPois.length,
      editorialPct: publicPois.length > 0 ? Math.round((editorialCount / publicPois.length) * 100) : 0,
    };
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Placy Admin</h1>
          <p className="text-gray-600 mt-1">Administrer innhold og data</p>
        </header>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Data
          </h2>
          <div className="space-y-2">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              title="Kunder"
              count={stats.customers}
              description="Registrerte kunder"
              href="/admin/customers"
            />
            <StatCard
              icon={<FolderOpen className="w-5 h-5" />}
              title="Prosjekter"
              count={stats.projects}
              description="Aktive prosjekter"
              href="/admin/projects"
            />
            <StatCard
              icon={<MapPin className="w-5 h-5" />}
              title="POI-er"
              count={stats.pois}
              description="Points of Interest"
              href="/admin/pois"
            />
            <StatCard
              icon={<Tag className="w-5 h-5" />}
              title="Kategorier"
              count={stats.categories}
              description="POI-kategorier"
              href="/admin/categories"
            />
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Offentlige sider
          </h2>
          <div className="space-y-2">
            <StatCard
              icon={<Globe className="w-5 h-5" />}
              title="Offentlige sider"
              count={null}
              description={`${publicStats.areas} områder · ${publicStats.categoryPages} kategorisider · ${publicStats.guides} guider · ${publicStats.publicPOIs} POIs (${publicStats.editorialPct}% editorial)`}
              href="/admin/public"
            />
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Verktøy
          </h2>
          <div className="space-y-2">
            <StatCard
              icon={<Sparkles className="w-5 h-5" />}
              title="Story Generator"
              count={null}
              description="Generer nye stories fra koordinater"
              href="/admin/generate"
            />
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Placy Admin Panel &middot; Kun for autoriserte brukere
          </p>
        </footer>
      </div>
    </div>
  );
}
