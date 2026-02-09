import { notFound } from "next/navigation";
import { getTripBySlugAsync, getProjectTripOverrideAsync } from "@/lib/data-server";
import { tripToProject } from "@/lib/trip-adapter";
import TripPage from "@/components/variants/trip/TripPage";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
    tripSlug: string;
  }>;
}

export default async function TripDetailPage({ params }: PageProps) {
  const { customer, project: projectSlug, tripSlug } = await params;

  // Fetch trip from Supabase by slug
  const trip = await getTripBySlugAsync(tripSlug);
  if (!trip) {
    notFound();
  }

  // Fetch project-specific override (start POI, reward, etc.)
  const override = await getProjectTripOverrideAsync(tripSlug, customer, projectSlug);

  // Convert to legacy Project shape via adapter
  const projectData = tripToProject(trip, override ?? undefined);

  return <TripPage project={projectData} />;
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
