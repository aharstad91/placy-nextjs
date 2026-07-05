import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import { GenerateClient } from "./generate-client";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Story Generator | Placy Admin",
  description: "Generer nye stories for Placy-prosjekter",
};

export default async function GeneratePage() {
  // Simple admin check
  requireAdmin();

  // Fetch customers from Supabase
  const supabase = createServerClient();
  let customers: { id: string; name: string }[] = [];

  if (supabase) {
    const { data } = await supabase
      .from("customers")
      .select("id, name")
      .order("name");
    customers = data || [];
  }

  return <GenerateClient customers={customers} />;
}
