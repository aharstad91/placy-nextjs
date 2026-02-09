import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTripBySlugAsync } from "@/lib/data-server";
import { tripToProject } from "@/lib/trip-adapter";
import TripPage from "@/components/variants/trip/TripPage";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

/**
 * Placy SEO route: /trips/[slug]
 * Shows a trip without any project-specific overrides.
 */
export default async function PlacyTripPage({ params }: PageProps) {
  const { slug } = await params;

  const trip = await getTripBySlugAsync(slug);
  if (!trip || !trip.published) {
    notFound();
  }

  // Convert to legacy Project shape — no override for SEO route
  const projectData = tripToProject(trip);

  return <TripPage project={projectData} />;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  const trip = await getTripBySlugAsync(slug);

  if (!trip) {
    return { title: "Tur ikke funnet" };
  }

  return {
    title: `${trip.title} – ${trip.city} | Placy`,
    description: trip.description ?? `Utforsk ${trip.title} i ${trip.city}`,
    openGraph: {
      title: `${trip.title} – ${trip.city}`,
      description: trip.description ?? `Utforsk ${trip.title} i ${trip.city}`,
      ...(trip.coverImageUrl ? { images: [{ url: trip.coverImageUrl }] } : {}),
    },
  };
}
