import { createServerClient } from "@/lib/supabase/client";
import { GenerateClient } from "./generate-client";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Generator | Placy Admin",
  description: "Provisjonér rapport-boards fra adresse (PRD 3-pipeline)",
};

export const dynamic = "force-dynamic";

export default async function GeneratePage() {
  requireAdmin();

  const supabase = createServerClient();
  let customers: { id: string; name: string }[] = [];

  if (supabase) {
    const { data, error } = await supabase
      .schema("v2")
      .from("customers")
      .select("id, name")
      .order("name");
    if (error) {
      console.error("Kunne ikke hente kunder til Generator:", error.message);
    }
    customers = data || [];
  }

  return <GenerateClient customers={customers} />;
}
