import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import ImportClient from "./import-client";

export default async function ImportPage() {
  if (process.env.ADMIN_ENABLED !== "true") {
    redirect("/");
  }

  const supabase = createServerClient();

  // Fetch projects with customer names for the dropdown
  const { data: projects } = supabase
    ? await supabase
        .from("projects")
        .select("id, name, center_lat, center_lng, customers(name)")
        .order("updated_at", { ascending: false })
    : { data: [] };

  return <ImportClient projects={projects || []} />;
}
