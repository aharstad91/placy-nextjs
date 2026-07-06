import Link from "next/link";
import { createServerClient } from "@/lib/supabase/client";
import {
  MapPin,
  Users,
  FolderOpen,
  Tag,
  Sparkles,
  ChevronRight,
  Database,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = {
  title: "Dashboard | Placy Admin",
  robots: { index: false, follow: false },
};

interface RecentRequest {
  id: string;
  address: string;
  status: string;
  created_at: string;
  result_url: string | null;
}

interface RecentProject {
  name: string;
  short_id: string;
  created_at: string;
}

// Statusfarger speiler requests-admin-client.tsx.
const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  processing: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

function formatActivityDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
  requireAdmin();

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

  // Fetch counts + siste aktivitet i parallell (v2-skjemaet — cutover 2026-07-06)
  const db = supabase.schema("v2");
  const [
    customersResult,
    projectsResult,
    poisResult,
    categoriesResult,
    recentRequestsResult,
    recentProjectsResult,
  ] = await Promise.all([
    db.from("customers").select("*", { count: "exact", head: true }),
    db.from("projects").select("*", { count: "exact", head: true }),
    db.from("pois").select("*", { count: "exact", head: true }),
    db.from("categories").select("*", { count: "exact", head: true }),
    // PII-grense: generation_requests leses kun via service-role bak requireAdmin().
    db
      .from("generation_requests")
      .select("id, address, status, created_at, result_url")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("projects")
      .select("name, short_id, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const stats = {
    customers: customersResult.count ?? 0,
    projects: projectsResult.count ?? 0,
    pois: poisResult.count ?? 0,
    categories: categoriesResult.count ?? 0,
  };

  // Feilet henting vises eksplisitt — aldri stille tom liste.
  if (recentRequestsResult.error) {
    console.error(
      "Kunne ikke hente siste generation_requests:",
      recentRequestsResult.error.message
    );
  }
  if (recentProjectsResult.error) {
    console.error(
      "Kunne ikke hente siste projects:",
      recentProjectsResult.error.message
    );
  }

  const recentRequests = (recentRequestsResult.data ??
    []) as RecentRequest[];
  const recentProjects = (recentProjectsResult.data ??
    []) as RecentProject[];

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

        <section className="mt-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
            Siste aktivitet
          </h2>

          <div className="mb-6">
            <h3 className="text-xs font-medium text-gray-400 mb-2">
              Siste genereringsforespørsler
            </h3>
            <div className="bg-white border rounded-lg divide-y divide-gray-100">
              {recentRequests.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">
                  Ingen forespørsler ennå ·{" "}
                  <Link
                    href="/admin/generate"
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Åpne Generator
                  </Link>
                </div>
              ) : (
                recentRequests.map((req) => {
                  const row = (
                    <div className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p
                          className="text-sm text-gray-900 truncate"
                          title={req.address}
                        >
                          {req.address}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatActivityDate(req.created_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                          REQUEST_STATUS_STYLES[req.status] ??
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>
                  );
                  return req.status === "completed" && req.result_url ? (
                    <a
                      key={req.id}
                      href={req.result_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:bg-gray-50"
                    >
                      {row}
                    </a>
                  ) : (
                    <div key={req.id}>{row}</div>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-medium text-gray-400 mb-2">
              Sist opprettede prosjekter
            </h3>
            <div className="space-y-2">
              {recentProjects.length === 0 ? (
                <div className="bg-white border rounded-lg p-4 text-sm text-gray-500">
                  Ingen prosjekter ennå
                </div>
              ) : (
                recentProjects.map((project) => (
                  <Link
                    key={project.short_id}
                    href={`/admin/projects/${project.short_id}`}
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:border-gray-400 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="p-2 bg-gray-100 rounded-lg text-gray-600">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {project.name}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {formatActivityDate(project.created_at)}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
                  </Link>
                ))
              )}
            </div>
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
