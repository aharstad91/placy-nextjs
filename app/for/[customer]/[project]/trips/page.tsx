import { notFound } from "next/navigation";
import { getProjectIdBySlugAsync, getProjectTripsAsync } from "@/lib/data-server";
import { tripToProject } from "@/lib/trip-adapter";
import type { Project } from "@/lib/types";
import TripLibraryClient from "./TripLibraryClient";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
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

  return (
    <TripLibraryClient
      customer={customer}
      projectSlug={projectSlug}
      trips={trips}
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
