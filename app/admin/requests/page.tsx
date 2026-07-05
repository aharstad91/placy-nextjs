import { redirect } from "next/navigation";
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

  const { data: requests } = await supabase
    .from("generation_requests")
    .select("*")
    .order("created_at", { ascending: false });

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
