import { redirect } from "next/navigation";
import { getAllTripsAdmin } from "@/lib/supabase/queries";
import { TripsAdminClient } from "./trips-admin-client";

export const dynamic = "force-dynamic";

const adminEnabled = process.env.ADMIN_ENABLED === "true";

export default async function TripsAdminPage() {
  if (!adminEnabled) {
    redirect("/");
  }

  const trips = await getAllTripsAdmin();

  // Extract distinct cities for filter dropdown
  const cities = Array.from(new Set(trips.map((t) => t.city))).sort();

  return <TripsAdminClient trips={trips} cities={cities} />;
}
