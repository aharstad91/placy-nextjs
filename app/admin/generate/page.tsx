import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import { GenerateClient } from "./generate-client";

export const metadata = {
  title: "Story Generator | Placy Admin",
  description: "Generer nye stories for Placy-prosjekter",
};

export default async function GeneratePage() {
  // Simple admin check
  if (process.env.ADMIN_ENABLED !== "true") {
    redirect("/");
  }

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
