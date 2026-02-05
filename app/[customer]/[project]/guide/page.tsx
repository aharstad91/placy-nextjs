import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync } from "@/lib/data-server";
import GuidePage from "@/components/variants/guide/GuidePage";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function GuideProductPage({ params }: PageProps) {
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

  return <GuidePage project={projectData} />;
}

export async function generateMetadata({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  let projectData = await getProductAsync(customer, projectSlug, "guide");
  if (!projectData) {
    projectData = await getProjectAsync(customer, `${projectSlug}-guide`);
  }

  if (!projectData) {
    return { title: "Guide ikke funnet" };
  }

  return {
    title: `${projectData.guideConfig?.title ?? projectData.story.title} – Guide | Placy`,
    description: projectData.guideConfig?.description ?? projectData.story.introText,
  };
}
