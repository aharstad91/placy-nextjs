import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import TripPage from "@/components/variants/trip/TripPage";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function TripProductPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Try new hierarchy first
  let projectData = await getProductAsync(customer, projectSlug, "guide");

  // Fallback to legacy: try {slug}-guide
  if (!projectData) {
    projectData = await getProjectAsync(customer, `${projectSlug}-guide`);
  }

  // Final fallback: check if slug itself is a guide
  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "guide") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  return <TripPage project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "guide");
  if (!projectData) {
    projectData = await getProjectAsync(customer, `${projectSlug}-guide`);
  }

  if (!projectData) {
    return { title: "Tur ikke funnet" };
  }

  return {
    title: `${projectData.tripConfig?.title ?? projectData.story.title} – Tur | Placy`,
    description: projectData.tripConfig?.description ?? projectData.story.introText,
  };
}
