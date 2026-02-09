import { redirect, notFound } from "next/navigation";
import { getTripsByCustomer, getBaseSlug } from "@/lib/data-server";

interface PageProps {
  params: Promise<{
    customer: string;
  }>;
}

/**
 * Legacy route: /customer/trips
 * Redirects to /customer/{baseSlug}/trips to maintain consistent URL structure.
 */
export default async function TripsRedirectPage({ params }: PageProps) {
  const { customer } = await params;
  const trips = await getTripsByCustomer(customer);

  if (trips.length === 0) {
    notFound();
  }

  // Use the first trip's urlSlug to derive the base project slug
  const baseSlug = getBaseSlug(trips[0].urlSlug);
  redirect(`/${customer}/${baseSlug}/trips`);
}
