import { notFound } from "next/navigation";
import { getTripsByCustomer, getBaseSlug } from "@/lib/data-server";
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
  const trips = await getTripsByCustomer(customer);

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
