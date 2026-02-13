import { notFound } from "next/navigation";
import { getProjectIdBySlugAsync, getProjectTripsAsync } from "@/lib/data-server";
import { tripToProject } from "@/lib/trip-adapter";
import { TRIP_CATEGORIES, TRIP_CATEGORY_LABELS } from "@/lib/types";
import type { Project, TripCategory } from "@/lib/types";
import TripLibraryClient from "./TripLibraryClient";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

// Group trips by category
function groupTripsByCategory(trips: Project[]): Record<TripCategory, Project[]> {
  const grouped: Record<TripCategory, Project[]> = {
    'food': [],
    'culture': [],
    'nature': [],
    'family': [],
    'active': [],
    'hidden-gems': [],
  };

  for (const trip of trips) {
    const category = trip.tripConfig?.category;
    if (category && category in grouped) {
      grouped[category].push(trip);
    } else {
      // Default to hidden-gems if no category
      grouped['hidden-gems'].push(trip);
    }
  }

  return grouped;
}

export default async function TripsPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Look up the project ID from customer + project slug
  const projectId = await getProjectIdBySlugAsync(customer, projectSlug);
  if (!projectId) {
    notFound();
  }

  // Fetch trips linked to this project (with overrides)
  const projectTrips = await getProjectTripsAsync(projectId);

  // Convert each ProjectTrip to the legacy Project shape via adapter
  const trips: Project[] = projectTrips.map((pt) =>
    tripToProject(pt.trip, pt.override)
  );

  // Extract welcome text from first override (if any)
  const welcomeText = projectTrips[0]?.override?.welcomeText;

  // If no trips exist, show empty state
  if (trips.length === 0) {
    return (
      <main className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="font-serif text-2xl text-[#1A1A1A] mb-2">
            Ingen turer tilgjengelig
          </h1>
          <p className="text-[#6B6560]">
            Det finnes ingen turer for dette området enn&aacute;.
          </p>
        </div>
      </main>
    );
  }

  const groupedTrips = groupTripsByCategory(trips);

  // Get categories that have trips (in defined order)
  const categoriesWithTrips = TRIP_CATEGORIES.filter(
    (cat) => groupedTrips[cat].length > 0
  );

  return (
    <TripLibraryClient
      customer={customer}
      projectSlug={projectSlug}
      trips={trips}
      groupedTrips={groupedTrips}
      categoriesWithTrips={categoriesWithTrips}
      categoryLabels={TRIP_CATEGORY_LABELS}
      welcomeText={welcomeText}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { customer } = await params;

  return {
    title: `Turer | ${customer}`,
    description: `Utforsk alle turer for ${customer}`,
  };
}
