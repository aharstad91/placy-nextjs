import { notFound, permanentRedirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/client";
import { eiendomUrl } from "@/lib/urls";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function KartRedirect({ params }: PageProps) {
  const { slug } = await params;

  const supabase = createServerClient();
  if (!supabase) notFound();

  const { data } = await supabase
    .from("generation_requests")
    .select("address_slug, customer_id")
    .eq("address_slug", slug)
    .single();

  if (!data) notFound();

  const customer = data.customer_id ?? "selvbetjent";
  permanentRedirect(eiendomUrl(customer, data.address_slug));
}
