import Link from "next/link";
import { MapPin } from "lucide-react";
import { isSupabaseConfigured, createServerClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

interface ProjectRow {
  id: string;
  name: string;
  url_slug: string;
  customer_id: string | null;
  customerName: string | null;
}

async function getProjects(): Promise<ProjectRow[]> {
  if (!isSupabaseConfigured()) return [];

  const client = createServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("projects")
    .select("id, name, url_slug, customer_id, customers(name)")
    .not("customer_id", "is", null)
    .order("name");

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    url_slug: p.url_slug,
    customer_id: p.customer_id,
    customerName: (p.customers as { name: string } | null)?.name ?? null,
  }));
}

export default async function ProjectListingPage() {
  const projects = await getProjects();

  const byCustomer = projects.reduce<Record<string, { name: string; projects: ProjectRow[] }>>((acc, p) => {
    const key = p.customer_id ?? "unknown";
    if (!acc[key]) acc[key] = { name: p.customerName ?? key, projects: [] };
    acc[key].projects.push(p);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-[#1a1a1a] mb-2">Placy B2B</h1>
          <p className="text-sm text-[#6a6a6a]">
            Velg et prosjekt for å utforske nabolaget.
          </p>
        </header>

        {Object.keys(byCustomer).length === 0 ? (
          <p className="text-sm text-[#a0937d]">Ingen prosjekter funnet.</p>
        ) : (
          <div className="space-y-8">
            {Object.entries(byCustomer).map(([customerId, { name: customerName, projects: customerProjects }]) => (
              <section key={customerId}>
                <h2 className="text-xs uppercase tracking-[0.2em] text-[#a0937d] mb-3">
                  {customerName}
                </h2>
                <ul className="space-y-2">
                  {customerProjects.map((project) => (
                    <li key={project.id}>
                      <Link
                        href={`/for/${project.customer_id}/${project.url_slug}`}
                        className="group flex items-center gap-3 p-4 bg-white border border-[#eae6e1] rounded-xl hover:shadow-md transition-all"
                      >
                        <MapPin className="w-5 h-5 text-[#7a7062] shrink-0" />
                        <div className="min-w-0">
                          <span className="font-medium text-[#1a1a1a] group-hover:underline">
                            {project.name}
                          </span>
                          <span className="block text-xs text-[#a0937d]">
                            /for/{project.customer_id}/{project.url_slug}
                          </span>
                        </div>
                        <span className="ml-auto text-sm text-[#a0937d] group-hover:text-[#1a1a1a] transition-colors">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
