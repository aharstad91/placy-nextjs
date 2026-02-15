import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTripBySlugAsync } from "@/lib/data-server";
import { tripToProject } from "@/lib/trip-adapter";
import TripPage from "@/components/variants/trip/TripPage";
import TripPreview from "@/components/variants/trip/TripPreview";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{ mode?: string }>;
}

/**
 * Placy SEO route: /trips/[slug]
 * Default: Preview mode. ?mode=active for active navigation.
 */
export default async function PlacyTripPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { mode } = await searchParams;

  const trip = await getTripBySlugAsync(slug);
  if (!trip || !trip.published) {
    notFound();
  }

  // Active mode: use existing TripPage with adapter
  if (mode === "active") {
    const projectData = tripToProject(trip);
    return <TripPage project={projectData} />;
  }

  // Default: Preview mode (no override for SEO route)
  return (
    <TripPreview
      trip={trip}
      activeHref={`/trips/${slug}?mode=active`}
    />
  );
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
