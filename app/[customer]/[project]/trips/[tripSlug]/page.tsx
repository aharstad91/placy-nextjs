import { notFound } from "next/navigation";
import { getProjectAsync } from "@/lib/data-server";
import TripPage from "@/components/variants/trip/TripPage";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
    tripSlug: string;
  }>;
}

export default async function TripDetailPage({ params }: PageProps) {
  const { customer, tripSlug } = await params;

  // Load the trip by its slug
  let projectData = await getProjectAsync(customer, tripSlug);

  if (!projectData || projectData.productType !== "guide") {
    notFound();
  }

  return <TripPage project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, tripSlug } = await params;

  const projectData = await getProjectAsync(customer, tripSlug);

  if (!projectData) {
    return { title: "Tur ikke funnet" };
  }

  return {
    title: `${projectData.tripConfig?.title ?? projectData.story.title} – Tur | Placy`,
    description: projectData.tripConfig?.description ?? projectData.story.introText,
  };
}
