import { redirect, notFound } from "next/navigation";
import { getProductAsync, getProjectAsync, getBaseSlug } from "@/lib/data-server";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

/**
 * Legacy route: /customer/slug/trip
 * Redirects to /customer/baseSlug/trips/tripSlug
 */
export default async function TripRedirectPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Find the trip slug — try hierarchy, then legacy patterns
  let tripSlug: string | null = null;

  const hierarchyData = await getProductAsync(customer, projectSlug, "guide");
  if (hierarchyData) {
    tripSlug = hierarchyData.urlSlug;
  }

  if (!tripSlug) {
    const legacyGuide = await getProjectAsync(customer, `${projectSlug}-guide`);
    if (legacyGuide) {
      tripSlug = legacyGuide.urlSlug;
    }
  }

  if (!tripSlug) {
    const directProject = await getProjectAsync(customer, projectSlug);
    if (directProject?.productType === "guide") {
      tripSlug = directProject.urlSlug;
    }
  }

  if (!tripSlug) {
    notFound();
  }

  const baseSlug = getBaseSlug(tripSlug);
  redirect(`/${customer}/${baseSlug}/trips/${tripSlug}`);
}
