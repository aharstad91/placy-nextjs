import { createServerClient } from "@/lib/supabase/client";
import RequestsAdminClient from "./requests-admin-client";
import { requireAdmin } from "@/lib/admin/require-admin";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  requireAdmin();

  const supabase = createServerClient();
  if (!supabase) {
    return <p>Database not configured</p>;
  }

  // PII-grense (PRD 12 Unit 5 AC3): generation_requests (email+consent) leses
  // KUN via service-role; admin-lesing er legitim operatør-tilgang bak
  // requireAdmin(). Feilet henting vises eksplisitt — aldri stille tom liste.
  const { data: requests, error } = await supabase
    .schema("v2")
    .from("generation_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Kunne ikke hente generation_requests:", error.message);
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Genereringsforespørsler
        </h1>
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">
          Kunne ikke hente forespørsler: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Genereringsforespørsler
      </h1>
      <RequestsAdminClient requests={requests ?? []} />
    </div>
  );
}

export const metadata = {
  robots: { index: false, follow: false },
  title: "Requests | Admin",
};
