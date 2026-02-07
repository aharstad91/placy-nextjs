import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import ImportClient from "./import-client";

export default async function ImportPage() {
  if (process.env.ADMIN_ENABLED !== "true") {
    redirect("/");
  }

  const supabase = createServerClient();

  // Fetch projects with customer names for the dropdown
  // Cast needed: discovery_circles column added in migration 013 but Supabase types not regenerated
  const { data: projects } = supabase
    ? await (supabase
        .from("projects")
        .select("id, name, center_lat, center_lng, discovery_circles, customers(name)")
        .order("updated_at", { ascending: false }) as unknown as Promise<{ data: Array<{
          id: string;
          name: string;
          center_lat: number;
          center_lng: number;
          discovery_circles: Array<{ lat: number; lng: number; radiusMeters: number }> | null;
          customers: { name: string } | null;
        }> | null }>)
    : { data: [] };

  return <ImportClient projects={projects || []} />;
}
