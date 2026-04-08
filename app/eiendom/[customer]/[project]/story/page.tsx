import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductAsync, getProjectAsync, productExists } from "@/lib/data-server";
import { eiendomUrl } from "@/lib/urls";
import { transformToStoryData } from "@/components/variants/story/story-data";
import StoryPage from "@/components/variants/story/StoryPage";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{
    customer: string;
    project: string;
  }>;
}

export default async function EiendomStoryPage({ params }: PageProps) {
  const { customer, project: projectSlug } = await params;

  // Load report data (Story uses same data source)
  let projectData = await getProductAsync(customer, projectSlug, "report");

  if (!projectData) {
    const legacyProject = await getProjectAsync(customer, projectSlug);
    if (legacyProject?.productType === "report") {
      projectData = legacyProject;
    }
  }

  if (!projectData) {
    notFound();
  }

  const storyData = transformToStoryData(projectData);

  // Build navigation URLs
  const hasExplorer = await productExists(customer, projectSlug, "explorer");
  storyData.explorerUrl = hasExplorer ? eiendomUrl(customer, projectSlug) : undefined;
  storyData.reportUrl = eiendomUrl(customer, projectSlug, "rapport");

  return <StoryPage data={storyData} />;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customer, project: projectSlug } = await params;

  const projectData = await getProductAsync(customer, projectSlug, "report");

  return {
    title: projectData
      ? `${projectData.name} — Nabolagshistorie | Placy`
      : "Story | Placy",
    robots: { index: false, follow: false },
  };
}
