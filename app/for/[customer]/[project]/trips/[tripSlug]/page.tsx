import { notFound } from "next/navigation";
import { getTripBySlugAsync, getProjectTripOverrideAsync } from "@/lib/data-server";
import { tripToProject } from "@/lib/trip-adapter";
import TripPage from "@/components/variants/trip/TripPage";
import TripPreview from "@/components/variants/trip/TripPreview";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
    tripSlug: string;
  }>;
  searchParams: Promise<{ mode?: string }>;
}

export default async function TripDetailPage({ params, searchParams }: PageProps) {
  const { customer, project: projectSlug, tripSlug } = await params;
  const { mode } = await searchParams;

  // Fetch trip from Supabase by slug
  const trip = await getTripBySlugAsync(tripSlug);
  if (!trip) {
    notFound();
  }

  // Fetch project-specific override (start POI, reward, etc.)
  const override = await getProjectTripOverrideAsync(tripSlug, customer, projectSlug);

  // Active mode: use existing TripPage with adapter
  if (mode === "active") {
    const projectData = tripToProject(trip, override ?? undefined);
    return <TripPage project={projectData} />;
  }

  // Default: Preview mode
  const basePath = `/for/${customer}/${projectSlug}/trips/${tripSlug}`;
  return (
    <TripPreview
      trip={trip}
      override={override ?? undefined}
      activeHref={`${basePath}?mode=active`}
      backHref={`/for/${customer}/${projectSlug}/trips`}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { tripSlug } = await params;

  const trip = await getTripBySlugAsync(tripSlug);

  if (!trip) {
    return { title: "Tur ikke funnet" };
  }

  return {
    title: `${trip.title} – Tur | Placy`,
    description: trip.description,
  };
}
